"""OpenSky Web API - Prompt to fly."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import urllib.parse
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import airportsdata

from skyroute.models import ConflictZone, RiskLevel, ScoredFlight
from skyroute.safety import load_zones, zones_age_warning
from skyroute.search import SearchEngine

logging.basicConfig(level=logging.INFO)

# Valid IATA airport codes (loaded once at import)
_IATA_DB = airportsdata.load("IATA")
_VALID_IATA = set(_IATA_DB.keys())


def _validate_iata_codes(codes: list[str], label: str) -> list[str]:
    """Validate IATA codes, return list of invalid ones."""
    invalid = [c for c in codes if c.upper() not in _VALID_IATA]
    return invalid


def _iata_city_name(code: str) -> str:
    """Get city name for an IATA code."""
    entry = _IATA_DB.get(code.upper())
    return entry["city"] if entry else code


def _airport_names(codes: list[str]) -> dict[str, str]:
    """Build IATA -> 'City' mapping for a list of codes."""
    names = {}
    for code in codes:
        entry = _IATA_DB.get(code.upper())
        if entry:
            names[code.upper()] = entry["city"]
    return names
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
RATE_LIMIT = int(os.environ.get("RATE_LIMIT_PER_HOUR", "10"))
RATE_LIMIT_WHITELIST = set(
    ip.strip() for ip in os.environ.get("RATE_LIMIT_WHITELIST", "").split(",") if ip.strip()
)
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
PROXY = os.environ.get("SKYROUTE_PROXY")

_request_log: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(ip: str) -> int:
    if ip in RATE_LIMIT_WHITELIST:
        return 999
    now = time.time()
    window = 3600
    _request_log[ip] = [t for t in _request_log[ip] if now - t < window]
    if len(_request_log[ip]) >= RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {RATE_LIMIT} searches per hour.",
        )
    _request_log[ip].append(now)
    return RATE_LIMIT - len(_request_log[ip])


# ---------------------------------------------------------------------------
# Gemini Flash: parse natural language prompt into structured search
# ---------------------------------------------------------------------------
PARSE_SYSTEM = """You are a flight search query parser. Extract structured search parameters from natural language.

Today's date is {today}.

Return ONLY valid JSON with this exact structure:
{{
  "origins": ["IATA", ...],
  "destinations": ["IATA", ...],
  "dates": ["YYYY-MM-DD", ...],
  "return_dates": [],
  "max_price": 0,
  "currency": "EUR",
  "cabin": "economy",
  "stops": "any"
}}

Rules:
- Convert city names to IATA codes. Use the main airport for each city.
- For date ranges like "March 10-20", list every date in the range.
- For relative dates like "next week" or "tomorrow", calculate from today ({today}).
- If no dates specified, use next 7 days from today.
- return_dates: list of return dates for round trips. Empty list [] for one-way trips.
  - If user says "round trip", "return", "returning on", "back on", parse the return date(s).
  - "JFK to London April 10 returning April 17" -> dates=["2026-04-10"], return_dates=["2026-04-17"]
  - "round trip March 10-12 returning March 20-22" -> dates=["2026-03-10","2026-03-11","2026-03-12"], return_dates=["2026-03-20","2026-03-21","2026-03-22"]
  - If user says "round trip" but no specific return date, set return_dates to 7 days after each outbound date.
- max_price 0 means no limit.
- cabin: economy | premium_economy | business | first
- stops: any | non_stop | one_stop_or_fewer | two_or_fewer_stops
- If currency is mentioned ($ or USD), use "USD". Default is "EUR".
- If the user says "direct" or "nonstop", set stops to "non_stop".
- Always return valid IATA airport codes (3-letter), NOT city codes. For cities with multiple airports, use the main one (e.g. London=LHR, New York=JFK, Paris=CDG, Tokyo=NRT, Moscow=SVO, Milan=MXP, Chicago=ORD, Washington=IAD, Stockholm=ARN, Sao Paulo=GRU).
- Never return city codes like LON, NYC, PAR, TYO, MOW, MIL, CHI, WAS, STO, SAO. Always use specific airport codes.

Examples:
- "Bangkok to Hamburg next week under 400 euros" -> {{"origins":["BKK"],"destinations":["HAM"],"dates":["2026-03-16","2026-03-17",...],"return_dates":[],"max_price":400,"currency":"EUR","cabin":"economy","stops":"any"}}
- "BLR, DEL, BKK to FRA, HAM, BER March 15-20 economy max 1 stop" -> {{"origins":["BLR","DEL","BKK"],"destinations":["FRA","HAM","BER"],"dates":["2026-03-15",...,"2026-03-20"],"return_dates":[],"max_price":0,"currency":"EUR","cabin":"economy","stops":"one_stop_or_fewer"}}
- "JFK to London round trip April 10 returning April 17 under $800" -> {{"origins":["JFK"],"destinations":["LHR"],"dates":["2026-04-10"],"return_dates":["2026-04-17"],"max_price":800,"currency":"USD","cabin":"economy","stops":"any"}}"""


async def parse_prompt(prompt: str) -> dict:
    """Use Gemini Flash to parse a natural language flight search prompt."""
    today = date.today().isoformat()
    system = PARSE_SYSTEM.format(today=today)

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            GEMINI_URL,
            params={"key": GEMINI_KEY},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "systemInstruction": {"parts": [{"text": system}]},
                "generationConfig": {
                    "temperature": 0,
                    "responseMimeType": "application/json",
                },
            },
        )

    if resp.status_code != 200:
        log.error("Gemini API error: %s %s", resp.status_code, resp.text[:200])
        raise HTTPException(status_code=502, detail="Failed to parse search prompt")

    data = resp.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        log.error("Gemini returned invalid JSON: %s", text[:200])
        raise HTTPException(status_code=502, detail="Failed to parse search prompt")

    # Validate required fields
    if not parsed.get("origins") or not parsed.get("destinations"):
        raise HTTPException(status_code=400, detail="Could not understand origin or destination from your prompt.")

    # Validate IATA codes against known airports
    parsed["origins"] = [c.upper() for c in parsed["origins"]]
    parsed["destinations"] = [c.upper() for c in parsed["destinations"]]
    bad_origins = _validate_iata_codes(parsed["origins"], "origin")
    bad_dests = _validate_iata_codes(parsed["destinations"], "destination")
    all_bad = bad_origins + bad_dests
    if all_bad:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown airport code(s): {', '.join(all_bad)}. Please use valid IATA airport codes or clearer city names.",
        )

    if not parsed.get("dates"):
        # Default: next 7 days
        today_dt = date.today()
        parsed["dates"] = [(today_dt + timedelta(days=i)).isoformat() for i in range(1, 8)]

    # Cap dates to 14 to avoid abuse
    parsed["dates"] = parsed["dates"][:14]

    # Ensure return_dates is always a list
    if not parsed.get("return_dates"):
        parsed["return_dates"] = []
    parsed["return_dates"] = parsed["return_dates"][:14]

    return parsed


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_zones()
    log.info("Conflict zones loaded, Gemini key: %s", "set" if GEMINI_KEY else "MISSING")
    yield


app = FastAPI(title="OpenSky API", version="0.2.0", lifespan=lifespan)

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class PromptRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=500)


class ParsedSearch(BaseModel):
    origins: list[str]
    destinations: list[str]
    dates: list[str]
    return_dates: list[str] = []
    max_price: float = 0
    currency: str = "EUR"
    cabin: str = "economy"
    stops: str = "any"
    total_routes: int = 0
    airport_names: dict[str, str] = {}  # IATA -> "City (Airport Name)"


class FlightOut(BaseModel):
    price: float
    currency: str
    duration_minutes: int
    stops: int
    route: str
    risk_level: str
    risk_details: list[dict]
    score: float
    legs: list[dict]
    provider: str
    booking_url: str
    origin: str
    destination: str
    date: str


class SearchResponse(BaseModel):
    parsed: ParsedSearch
    flights: list[FlightOut]
    count: int
    remaining_searches: int
    zones_warning: str | None = None


class ZonesResponse(BaseModel):
    zones: list[ConflictZone]
    warning: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _google_flights_url(origin: str, dest: str, date: str, currency: str = "EUR") -> str:
    """Generate a Google Flights deep link with route and date pre-filled."""
    return f"https://www.google.com/travel/flights?q=Flights+from+{origin}+to+{dest}+on+{date}&curr={currency}&hl=en"


def _skyscanner_url(origin: str, dest: str, date: str, currency: str = "EUR", cabin: str = "economy", return_date: str = "") -> str:
    """Skyscanner deep link with pre-filled route, date, cabin, and currency."""
    date_part = f"{date}/{return_date}" if return_date else date
    return (
        f"https://www.skyscanner.net/transport/flights/{origin.lower()}/{dest.lower()}/{date_part}/"
        f"?adultsv2=1&cabinclass={cabin}&currency={currency}&sortby=cheapest&preferDirects=false"
    )


def _filter_price_anomalies(flights: list[dict]) -> list[dict]:
    """Drop flights with anomalous prices (>3x cheapest for same O/D pair).

    When multiple providers return results, one may have wildly wrong prices.
    This filters out those outliers to keep results looking sane.
    """
    by_od: dict[tuple, list[dict]] = defaultdict(list)
    for f in flights:
        by_od[(f["origin"], f["destination"])].append(f)

    filtered = []
    for group in by_od.values():
        priced = [f for f in group if f["price"] > 0]
        if len(priced) < 2:
            filtered.extend(group)
            continue

        cheapest = min(f["price"] for f in priced)
        threshold = cheapest * 3
        for f in group:
            if f["price"] <= 0 or f["price"] <= threshold:
                filtered.append(f)
            else:
                log.info(
                    "Dropped anomalous price: %s %s->%s %.0f (cheapest: %.0f, provider: %s)",
                    f["date"], f["origin"], f["destination"], f["price"], cheapest, f["provider"],
                )

    return filtered


def _scored_to_out(sf: ScoredFlight, cabin: str = "economy") -> FlightOut:
    return FlightOut(
        price=sf.flight.price,
        currency=sf.flight.currency,
        duration_minutes=sf.flight.duration_minutes,
        stops=sf.flight.stops,
        route=sf.route,
        risk_level=sf.risk.risk_level.value,
        risk_details=[
            {"airport": fa.code, "country": fa.country, "zone": fa.zone_name, "risk": fa.risk_level.value}
            for fa in sf.risk.flagged_airports
        ],
        score=round(sf.score, 2),
        legs=[
            {
                "airline": leg.airline,
                "flight_number": leg.flight_number,
                "from": leg.departure_airport,
                "to": leg.arrival_airport,
                "departs": leg.departure_time,
                "arrives": leg.arrival_time,
                "duration_minutes": leg.duration_minutes,
            }
            for leg in sf.flight.legs
        ],
        provider=sf.flight.provider,
        booking_url=getattr(sf.flight, 'booking_url', '') or _skyscanner_url(sf.origin, sf.destination, sf.date, sf.flight.currency, cabin),
        origin=sf.origin,
        destination=sf.destination,
        date=sf.date,
    )


def _get_client_ip(request: Request) -> str:
    # X-Real-IP is set by nginx from $remote_addr (not spoofable)
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _run_scan(parsed: dict, progress_cb: callable = None) -> list[ScoredFlight]:
    """Run multi-origin x multi-dest x multi-date search with parallel workers."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    engine = SearchEngine(
        currency=parsed.get("currency", "EUR"),
        use_cache=True,
        seat=parsed.get("cabin", "economy"),
        stops=parsed.get("stops", "any"),
        proxy=PROXY,
    )
    try:
        all_scored: list[ScoredFlight] = []
        combos = [
            (o.upper(), d.upper(), dt)
            for o in parsed["origins"]
            for d in parsed["destinations"]
            for dt in parsed["dates"]
        ]
        total = len(combos)
        completed = 0

        def _search_one(combo):
            origin, dest, dt = combo
            try:
                return engine.search_scored(
                    origin=origin, dest=dest, date=dt,
                    risk_threshold=RiskLevel.HIGH_RISK,
                    max_price=parsed.get("max_price", 0),
                )
            except Exception as e:
                log.warning("Search failed %s->%s %s: %s", origin, dest, dt, e)
                return []

        workers = min(3, total)
        with ThreadPoolExecutor(max_workers=workers) as executor:
            i = 0
            while i < total:
                batch = combos[i:i + workers]
                futures = {executor.submit(_search_one, c): c for c in batch}
                for future in as_completed(futures):
                    results = future.result()
                    all_scored.extend(results)
                    completed += 1
                    combo = futures[future]
                    if progress_cb:
                        progress_cb(completed, total, combo[0], combo[1], combo[2])
                i += len(batch)
                if i < total:
                    time.sleep(0.5)

        all_scored.sort(key=lambda x: x.score)
        return all_scored
    finally:
        engine.close()


def _build_summary(flights: list[dict], currency: str) -> dict:
    """Build scan summary: best per destination + date/destination price matrix."""
    if not flights:
        return {}

    priced = [f for f in flights if f["price"] > 0]
    destinations = sorted({f["destination"] for f in flights})
    dates = sorted({f["date"] for f in flights})

    # Best per destination (lowest score = best value)
    best_per_dest = {}
    for f in flights:
        d = f["destination"]
        if d not in best_per_dest or f["score"] < best_per_dest[d]["score"]:
            best_per_dest[d] = f
    best_destinations = [best_per_dest[d] for d in sorted(best_per_dest)]

    # Date x destination price matrix (cheapest price per cell)
    matrix: dict[tuple[str, str], float] = {}
    for f in priced:
        key = (f["destination"], f["date"])
        if key not in matrix or f["price"] < matrix[key]:
            matrix[key] = f["price"]

    # Cheapest date per destination (for highlighting)
    cheapest_per_dest: dict[str, float] = {}
    for (dest, _), price in matrix.items():
        if dest not in cheapest_per_dest or price < cheapest_per_dest[dest]:
            cheapest_per_dest[dest] = price

    price_matrix = {
        "destinations": destinations,
        "dates": dates,
        "prices": {f"{dest}|{dt}": matrix.get((dest, dt)) for dest in destinations for dt in dates},
        "cheapest_per_dest": cheapest_per_dest,
    }

    # Stats
    price_values = [f["price"] for f in priced]
    stats = {
        "total_flights": len(flights),
        "destinations": len(destinations),
        "origins": len({f["origin"] for f in flights}),
        "dates": len(dates),
        "min_price": min(price_values) if price_values else 0,
        "max_price": max(price_values) if price_values else 0,
    }

    return {
        "best_destinations": best_destinations,
        "price_matrix": price_matrix,
        "stats": stats,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.post("/api/parse", response_model=ParsedSearch)
async def parse_search(req: PromptRequest):
    """Parse a natural language prompt into structured search params (no search executed)."""
    parsed = await parse_prompt(req.prompt)
    total = len(parsed["origins"]) * len(parsed["destinations"]) * len(parsed["dates"])
    names = _airport_names(parsed["origins"] + parsed["destinations"])
    return ParsedSearch(
        origins=parsed["origins"],
        destinations=parsed["destinations"],
        dates=parsed["dates"],
        max_price=parsed.get("max_price", 0),
        currency=parsed.get("currency", "EUR"),
        cabin=parsed.get("cabin", "economy"),
        stops=parsed.get("stops", "any"),
        total_routes=total,
        airport_names=names,
    )


@app.post("/api/search")
async def search_flights(req: PromptRequest, request: Request):
    """Parse prompt with AI, then stream search progress via SSE."""
    ip = _get_client_ip(request)
    remaining = _check_rate_limit(ip)

    # Step 1: Parse with Gemini
    parsed = await parse_prompt(req.prompt)
    total = len(parsed["origins"]) * len(parsed["destinations"]) * len(parsed["dates"])

    return_dates = parsed.get("return_dates", [])
    is_round_trip = len(return_dates) > 0
    # For round trips, total includes outbound + return combos
    return_total = len(parsed["destinations"]) * len(parsed["origins"]) * len(return_dates) if is_round_trip else 0
    combined_total = total + return_total

    if combined_total > 100:
        raise HTTPException(
            status_code=400,
            detail=f"Search too broad: {combined_total} route combinations. Narrow your origins, destinations, or date range.",
        )

    names = _airport_names(parsed["origins"] + parsed["destinations"])
    parsed_out = ParsedSearch(
        origins=parsed["origins"],
        destinations=parsed["destinations"],
        dates=parsed["dates"],
        return_dates=return_dates,
        max_price=parsed.get("max_price", 0),
        currency=parsed.get("currency", "EUR"),
        cabin=parsed.get("cabin", "economy"),
        stops=parsed.get("stops", "any"),
        total_routes=combined_total,
        airport_names=names,
    )

    async def event_stream():
        import queue
        import threading

        # Send parsed params immediately
        try:
            parsed_data = parsed_out.model_dump()
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Internal error preparing search.'})}\n\n"
            return
        yield f"data: {json.dumps({'type': 'parsed', 'parsed': parsed_data})}\n\n"

        progress_q: queue.Queue = queue.Queue()

        def on_progress(done: int, total: int, origin: str, dest: str, dt: str):
            progress_q.put({"type": "progress", "done": done, "total": total, "route": f"{origin} -> {dest}", "date": dt})

        # Run scan in thread
        result_holder: list = []
        error_holder: list = []

        def run():
            try:
                result_holder.append(_run_scan(parsed, progress_cb=on_progress))
            except Exception as e:
                error_holder.append(str(e))
            finally:
                progress_q.put(None)  # sentinel

        thread = threading.Thread(target=run)
        thread.start()

        # Stream progress events with keepalive (max 60s total)
        scan_start = time.time()
        while True:
            if time.time() - scan_start > 60:
                yield f"data: {json.dumps({'type': 'error', 'detail': 'Search timed out after 60 seconds. Try a narrower search.'})}\n\n"
                thread.join(timeout=5)
                return
            try:
                msg = progress_q.get(timeout=2.0)
            except queue.Empty:
                # Send SSE comment as keepalive to prevent connection drop
                yield ": keepalive\n\n"
                continue
            if msg is None:
                break
            yield f"data: {json.dumps(msg)}\n\n"

        thread.join(timeout=10)

        if error_holder:
            yield f"data: {json.dumps({'type': 'error', 'detail': error_holder[0]})}\n\n"
            return

        scored = result_holder[0] if result_holder else []
        cabin = parsed.get("cabin", "economy")

        def _process_flights(scored_list, direction="outbound"):
            flights = [_scored_to_out(sf, cabin=cabin).model_dump() for sf in scored_list]
            priced = [f for f in flights if f["price"] > 0]
            flights = priced if priced else flights
            flights = _filter_price_anomalies(flights)
            seen: dict[tuple, dict] = {}
            for f in flights:
                key = (f["route"], f["date"], f["stops"])
                if key not in seen or f["price"] < seen[key]["price"]:
                    seen[key] = f
            return sorted(seen.values(), key=lambda x: x["score"])

        flights = _process_flights(scored)
        total_count = len(flights)
        warning = zones_age_warning()
        summary = _build_summary(flights, parsed.get("currency", "EUR"))
        top_flights = flights[:20]

        # Round-trip: run return searches
        return_flights_out = None
        if is_round_trip:
            return_parsed = {
                **parsed,
                "origins": parsed["destinations"],
                "destinations": parsed["origins"],
                "dates": return_dates,
            }

            return_progress_offset = total

            def on_return_progress(done, total_r, origin, dest, dt):
                progress_q.put({
                    "type": "progress",
                    "done": return_progress_offset + done,
                    "total": combined_total,
                    "route": f"{origin} -> {dest}",
                    "date": dt,
                })

            return_result_holder: list = []

            def run_return():
                try:
                    return_result_holder.append(_run_scan(return_parsed, progress_cb=on_return_progress))
                except Exception as e:
                    log.warning("Return search failed: %s", e)
                    return_result_holder.append([])
                finally:
                    progress_q.put(None)

            return_thread = threading.Thread(target=run_return)
            return_thread.start()

            # Stream return progress
            while True:
                if time.time() - scan_start > 120:
                    yield f"data: {json.dumps({'type': 'error', 'detail': 'Search timed out. Try a narrower search.'})}\n\n"
                    return_thread.join(timeout=5)
                    return
                try:
                    msg = progress_q.get(timeout=2.0)
                except queue.Empty:
                    yield ": keepalive\n\n"
                    continue
                if msg is None:
                    break
                yield f"data: {json.dumps(msg)}\n\n"

            return_thread.join(timeout=10)
            return_scored = return_result_holder[0] if return_result_holder else []
            return_flights = _process_flights(return_scored, "return")
            return_flights_out = return_flights[:20] if return_flights else []

        result_data = {
            "type": "results",
            "flights": top_flights,
            "count": total_count,
            "remaining_searches": remaining,
            "zones_warning": warning,
            "summary": summary,
        }
        if return_flights_out is not None:
            result_data["return_flights"] = return_flights_out
        yield f"data: {json.dumps(result_data)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/zones", response_model=ZonesResponse)
async def get_zones():
    zones = load_zones()
    warning = zones_age_warning()
    return ZonesResponse(zones=zones, warning=warning)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
