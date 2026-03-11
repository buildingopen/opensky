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

from skyroute.models import ConflictZone, RiskLevel, ScoredFlight
from skyroute.safety import load_zones, zones_age_warning
from skyroute.search import SearchEngine

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
RATE_LIMIT = int(os.environ.get("RATE_LIMIT_PER_HOUR", "10"))
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

_request_log: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(ip: str) -> int:
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
- max_price 0 means no limit.
- cabin: economy | premium_economy | business | first
- stops: any | non_stop | one_stop_or_fewer | two_or_fewer_stops
- If currency is mentioned ($ or USD), use "USD". Default is "EUR".
- If the user says "direct" or "nonstop", set stops to "non_stop".
- Always return valid IATA airport codes (3-letter), NOT city codes. For cities with multiple airports, use the main one (e.g. London=LHR, New York=JFK, Paris=CDG, Tokyo=NRT, Moscow=SVO, Milan=MXP, Chicago=ORD, Washington=IAD, Stockholm=ARN, Sao Paulo=GRU).
- Never return city codes like LON, NYC, PAR, TYO, MOW, MIL, CHI, WAS, STO, SAO. Always use specific airport codes.

Examples:
- "Bangkok to Hamburg next week under 400 euros" -> {{"origins":["BKK"],"destinations":["HAM"],"dates":["2026-03-16","2026-03-17",...],"max_price":400,"currency":"EUR","cabin":"economy","stops":"any"}}
- "BLR, DEL, BKK to FRA, HAM, BER March 15-20 economy max 1 stop" -> {{"origins":["BLR","DEL","BKK"],"destinations":["FRA","HAM","BER"],"dates":["2026-03-15",...,"2026-03-20"],"max_price":0,"currency":"EUR","cabin":"economy","stops":"one_stop_or_fewer"}}"""


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

    if not parsed.get("dates"):
        # Default: next 7 days
        today_dt = date.today()
        parsed["dates"] = [(today_dt + timedelta(days=i)).isoformat() for i in range(1, 8)]

    # Cap dates to 14 to avoid abuse
    parsed["dates"] = parsed["dates"][:14]

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
    max_price: float = 0
    currency: str = "EUR"
    cabin: str = "economy"
    stops: str = "any"
    total_routes: int = 0


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
    # Google Flights booking URL format with pre-filled route
    return f"https://www.google.com/travel/flights?q=Flights+from+{origin}+to+{dest}+on+{date}&curr={currency}&hl=en"


def _skyscanner_url(origin: str, dest: str, date: str) -> str:
    """Fallback booking link via Skyscanner."""
    # Date format: YYMMDD
    d = date.replace("-", "")[2:]
    return f"https://www.skyscanner.com/transport/flights/{origin.lower()}/{dest.lower()}/{d}/"


def _scored_to_out(sf: ScoredFlight) -> FlightOut:
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
        booking_url=_google_flights_url(sf.origin, sf.destination, sf.date, sf.flight.currency),
        origin=sf.origin,
        destination=sf.destination,
        date=sf.date,
    )


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _run_scan(parsed: dict, progress_cb: callable = None) -> list[ScoredFlight]:
    """Run multi-origin x multi-dest x multi-date search with parallel workers."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    engine = SearchEngine(
        currency=parsed.get("currency", "EUR"),
        use_cache=True,
        seat=parsed.get("cabin", "economy"),
        stops=parsed.get("stops", "any"),
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
    return ParsedSearch(
        origins=parsed["origins"],
        destinations=parsed["destinations"],
        dates=parsed["dates"],
        max_price=parsed.get("max_price", 0),
        currency=parsed.get("currency", "EUR"),
        cabin=parsed.get("cabin", "economy"),
        stops=parsed.get("stops", "any"),
        total_routes=total,
    )


@app.post("/api/search")
async def search_flights(req: PromptRequest, request: Request):
    """Parse prompt with AI, then stream search progress via SSE."""
    ip = _get_client_ip(request)
    remaining = _check_rate_limit(ip)

    # Step 1: Parse with Gemini
    parsed = await parse_prompt(req.prompt)
    total = len(parsed["origins"]) * len(parsed["destinations"]) * len(parsed["dates"])

    if total > 100:
        raise HTTPException(
            status_code=400,
            detail=f"Search too broad: {total} route combinations. Narrow your origins, destinations, or date range.",
        )

    parsed_out = ParsedSearch(
        origins=parsed["origins"],
        destinations=parsed["destinations"],
        dates=parsed["dates"],
        max_price=parsed.get("max_price", 0),
        currency=parsed.get("currency", "EUR"),
        cabin=parsed.get("cabin", "economy"),
        stops=parsed.get("stops", "any"),
        total_routes=total,
    )

    async def event_stream():
        import queue
        import threading

        # Send parsed params immediately
        yield f"data: {json.dumps({'type': 'parsed', 'parsed': parsed_out.model_dump()})}\n\n"

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

        # Stream progress events with keepalive
        while True:
            try:
                msg = progress_q.get(timeout=2.0)
            except queue.Empty:
                # Send SSE comment as keepalive to prevent connection drop
                yield ": keepalive\n\n"
                continue
            if msg is None:
                break
            yield f"data: {json.dumps(msg)}\n\n"

        thread.join()

        if error_holder:
            yield f"data: {json.dumps({'type': 'error', 'detail': error_holder[0]})}\n\n"
        else:
            scored = result_holder[0] if result_holder else []
            flights = [_scored_to_out(sf).model_dump() for sf in scored]
            # Filter out flights with no price (Google scrape failures)
            priced = [f for f in flights if f["price"] > 0]
            flights = priced if priced else flights
            # Dedup: keep cheapest per route+date+duration+stops
            seen: dict[tuple, dict] = {}
            for f in flights:
                key = (f["route"], f["date"], f["duration_minutes"], f["stops"])
                if key not in seen or f["price"] < seen[key]["price"]:
                    seen[key] = f
            flights = sorted(seen.values(), key=lambda x: x["score"])
            warning = zones_age_warning()
            summary = _build_summary(flights, parsed.get("currency", "EUR"))
            yield f"data: {json.dumps({'type': 'results', 'flights': flights, 'count': len(flights), 'remaining_searches': remaining, 'zones_warning': warning, 'summary': summary})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/zones", response_model=ZonesResponse)
async def get_zones():
    zones = load_zones()
    warning = zones_age_warning()
    return ZonesResponse(zones=zones, warning=warning)


@app.get("/api/health")
async def health():
    return {"status": "ok", "gemini": bool(GEMINI_KEY)}
