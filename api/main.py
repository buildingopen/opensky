"""OpenSky Web API - Prompt to fly."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import queue
import random
import re
import sqlite3
import threading
import time
import urllib.parse
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import httpx
from html import escape as html_escape
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from redis import asyncio as redis
from redis.exceptions import RedisError

import airportsdata

from skyroute.models import ConflictZone, RiskLevel, RoundTripResult, ScoredFlight
from skyroute.safety import check_route, load_zones, zones_age_warning
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
RATE_LIMIT_PREFIX = os.environ.get("RATE_LIMIT_PREFIX", "opensky:ratelimit")
API_KEYS = set(k.strip() for k in os.environ.get("API_KEYS", "").split(",") if k.strip())
API_KEY_QUOTA = int(os.environ.get("API_KEY_QUOTA", "100"))
REDIS_URL = os.environ.get("REDIS_URL", "").strip()
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
GEMINI_TIMEOUT_SECONDS = float(os.environ.get("GEMINI_TIMEOUT_SECONDS", "10"))
GEMINI_MAX_RETRIES = int(os.environ.get("GEMINI_MAX_RETRIES", "2"))
PROXY = os.environ.get("SKYROUTE_PROXY")
TRUST_PROXY = os.environ.get("TRUST_PROXY", "").lower() in ("1", "true", "yes")
REQUIRE_GEMINI_KEY = os.environ.get("REQUIRE_GEMINI_KEY", "true").lower() in ("1", "true", "yes")

# Validation constants for Gemini output sanitization
VALID_CURRENCIES = frozenset({
    "EUR", "USD", "GBP", "CHF", "CAD", "AUD", "JPY", "INR", "SEK", "NOK",
    "DKK", "PLN", "CZK", "HUF", "TRY", "BRL", "MXN", "SGD", "HKD", "NZD",
    "THB", "ZAR", "AED", "SAR", "KRW", "TWD", "CNY", "IDR", "MYR", "PHP",
    "VND", "ILS", "EGP", "NGN", "KES", "QAR", "BHD", "OMR", "KWD",
})
VALID_CABINS = frozenset({"economy", "premium_economy", "business", "first"})
VALID_STOPS = frozenset({"any", "non_stop", "one_stop_or_fewer", "two_or_fewer_stops"})
MAX_ORIGINS = 5
MAX_DESTINATIONS = 10
MAX_RATE_LIMIT_IPS = 10_000

_request_log: dict[str, list[float]] = defaultdict(list)
_api_key_log: dict[str, list[float]] = defaultdict(list)
redis_client: redis.Redis | None = None
_startup_at = time.time()
_zones_loaded = False

# ---------------------------------------------------------------------------
# Alerts DB (SQLite)
# ---------------------------------------------------------------------------
ALERTS_DB_PATH = os.environ.get("ALERTS_DB_PATH", "/opt/opensky/alerts.db")
_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
MAX_ALERTS_PER_EMAIL = 5


def _init_alerts_db() -> None:
    conn = sqlite3.connect(ALERTS_DB_PATH)
    conn.execute("""CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        query TEXT NOT NULL,
        origins TEXT NOT NULL,
        destinations TEXT NOT NULL,
        max_price REAL DEFAULT 0,
        currency TEXT DEFAULT 'EUR',
        cabin TEXT DEFAULT 'economy',
        is_round_trip INTEGER DEFAULT 0,
        last_price REAL,
        last_checked TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        unsubscribe_token TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(is_active, expires_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_alerts_email ON alerts(email)")
    # Zone alert subscriptions
    conn.execute("""CREATE TABLE IF NOT EXISTS zone_alerts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        zones TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        unsubscribe_token TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1,
        last_notified TEXT
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_zone_alerts_active ON zone_alerts(is_active, expires_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_zone_alerts_email ON zone_alerts(email)")
    conn.commit()
    conn.close()


def _alerts_db() -> sqlite3.Connection:
    conn = sqlite3.connect(ALERTS_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _check_rate_limit_memory(ip: str) -> int:
    if ip in RATE_LIMIT_WHITELIST:
        return 999
    now = time.time()
    window = 3600

    # Evict stale entries when dict grows too large (memory cap)
    if len(_request_log) > MAX_RATE_LIMIT_IPS:
        stale = [k for k, v in _request_log.items() if not v or now - v[-1] > window]
        for k in stale:
            del _request_log[k]

    _request_log[ip] = [t for t in _request_log[ip] if now - t < window]
    if len(_request_log[ip]) >= RATE_LIMIT:
        oldest = min(_request_log[ip])
        retry_after = int(oldest + window - now)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {RATE_LIMIT} searches per hour.",
            headers={"Retry-After": str(max(1, retry_after))},
        )
    _request_log[ip].append(now)
    return RATE_LIMIT - len(_request_log[ip])


async def _check_rate_limit_redis(ip: str) -> int:
    if ip in RATE_LIMIT_WHITELIST:
        return 999
    if not redis_client:
        return _check_rate_limit_memory(ip)

    key = f"{RATE_LIMIT_PREFIX}:{ip}"
    ttl = 3600
    try:
        count = await redis_client.incr(key)
        if count == 1:
            await redis_client.expire(key, ttl)
    except RedisError as exc:
        log.warning("Redis rate-limit failed, falling back to memory: %s", exc)
        return _check_rate_limit_memory(ip)

    if count > RATE_LIMIT:
        try:
            remaining_ttl = await redis_client.ttl(key)
            retry_after = max(1, remaining_ttl) if remaining_ttl and remaining_ttl > 0 else 3600
        except RedisError:
            retry_after = 3600
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {RATE_LIMIT} searches per hour.",
            headers={"Retry-After": str(retry_after)},
        )
    return RATE_LIMIT - count


async def _check_rate_limit(ip: str) -> int:
    if redis_client:
        return await _check_rate_limit_redis(ip)
    return _check_rate_limit_memory(ip)


def _extract_api_key(request: Request) -> str | None:
    """Extract API key from X-API-Key or Authorization: Bearer header."""
    key = request.headers.get("X-API-Key", "").strip()
    if key:
        return key
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def _hash_key(key: str) -> str:
    """Return a short hash for rate-limit key storage (avoid leaking raw keys)."""
    import hashlib
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def _check_rate_limit_api_key_memory(key_hash: str) -> int:
    """In-memory rate limit for API keys."""
    now = time.time()
    window = 3600
    if len(_api_key_log) > MAX_RATE_LIMIT_IPS:
        stale = [k for k, v in _api_key_log.items() if not v or now - v[-1] > window]
        for k in stale:
            del _api_key_log[k]
    _api_key_log[key_hash] = [t for t in _api_key_log[key_hash] if now - t < window]
    if len(_api_key_log[key_hash]) >= API_KEY_QUOTA:
        oldest = min(_api_key_log[key_hash])
        retry_after = int(oldest + window - now)
        raise HTTPException(
            status_code=429,
            detail=f"API key rate limit exceeded. Max {API_KEY_QUOTA} searches per hour.",
            headers={"Retry-After": str(max(1, retry_after))},
        )
    _api_key_log[key_hash].append(now)
    return API_KEY_QUOTA - len(_api_key_log[key_hash])


async def _check_rate_limit_api_key_redis(key_hash: str) -> int:
    """Redis rate limit for API keys."""
    if not redis_client:
        return _check_rate_limit_api_key_memory(key_hash)
    key = f"{RATE_LIMIT_PREFIX}:key:{key_hash}"
    ttl = 3600
    try:
        count = await redis_client.incr(key)
        if count == 1:
            await redis_client.expire(key, ttl)
    except RedisError as exc:
        log.warning("Redis API-key rate-limit failed, falling back to memory: %s", exc)
        return _check_rate_limit_api_key_memory(key_hash)
    if count > API_KEY_QUOTA:
        try:
            remaining_ttl = await redis_client.ttl(key)
            retry_after = max(1, remaining_ttl) if remaining_ttl and remaining_ttl > 0 else 3600
        except RedisError:
            retry_after = 3600
        raise HTTPException(
            status_code=429,
            detail=f"API key rate limit exceeded. Max {API_KEY_QUOTA} searches per hour.",
            headers={"Retry-After": str(retry_after)},
        )
    return API_KEY_QUOTA - count


def _extract_gemini_text(data: dict) -> str:
    """Extract parser JSON text from Gemini response safely."""
    try:
        candidates = data.get("candidates", [])
        if not candidates:
            return ""
        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            return ""
        return str(parts[0].get("text", ""))
    except (AttributeError, IndexError, TypeError):
        return ""


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
  "stops": "any",
  "safe_only": false
}}

Rules:
- If the user says "safe", "safe routes", "safe only", "safe routes only", "avoid conflict zones", "avoid war zones", "only safe", "no conflict zones", set safe_only to true.
- Convert city names to IATA codes. Use the main airport for each city.
- For date ranges like "March 10-20", list every date in the range.
- For relative dates like "next week" or "tomorrow", calculate from today ({today}).
- "next [weekday]": count forward day by day from today until you reach that weekday. Example: today=Saturday 2026-03-14, "next Friday" → count 1(Sun Mar15), 2(Mon), 3(Tue), 4(Wed), 5(Thu), 6(Fri Mar20) → return 2026-03-20. NEVER jump to the following week's occurrence.
- "this weekend": if today IS Saturday → return today + tomorrow (Sunday). If today IS Sunday → return today only. If today is Mon–Fri → return the nearest upcoming Saturday + Sunday.
- If no dates specified, use next 7 days from today.
- return_dates: list of return dates for round trips. Empty list [] for one-way trips.
  - Set return_dates (non-empty) when the query contains ANY of these round trip indicators:
    English: "round trip", "return", "returning on", "back on", "come back", "both ways"
    German: "hin und zurück", "hin- und rückflug", "rückflug", "zurück", "retour", "rundflug"
    Spanish: "ida y vuelta", "viaje redondo", "vuelo de regreso"
    French: "aller-retour", "aller retour", "vol retour"
    Italian: "andata e ritorno", "ritorno"
    Portuguese: "ida e volta"
    Also set true if the query implies needing to come back (e.g., "I need to be back by...", "flying home on...")
  - "JFK to London April 10 returning April 17" -> dates=["2026-04-10"], return_dates=["2026-04-17"]
  - "round trip March 10-12 returning March 20-22" -> dates=["2026-03-10","2026-03-11","2026-03-12"], return_dates=["2026-03-20","2026-03-21","2026-03-22"]
  - If user indicates round trip but no specific return date, set return_dates to 7 days after each outbound date.
- max_price 0 means no limit.
- cabin: economy | premium_economy | business | first
- stops: any | non_stop | one_stop_or_fewer | two_or_fewer_stops
- If currency is mentioned ($ or USD), use "USD". Default is "EUR".
- If the user says "direct" or "nonstop", set stops to "non_stop".
- Always return valid IATA airport codes (3-letter), NOT city codes. For cities with multiple airports, use the main one (e.g. London=LHR, New York=JFK, Paris=CDG, Tokyo=NRT, Moscow=SVO, Milan=MXP, Chicago=ORD, Washington=IAD, Stockholm=ARN, Sao Paulo=GRU).
- Never return city codes like LON, NYC, PAR, TYO, MOW, MIL, CHI, WAS, STO, SAO. Always use specific airport codes.
NEARBY AIRPORTS & GENEROUS EXPANSION:
- When the user says "or nearby", "any airport around", "reachable by train", "flexible on airport", or similar: be GENEROUS. Include all major airports within ~3h by train/car. Hidden gems come from unexpected departure airports.
  - "Hamburg or nearby" → HAM, BRE, HAJ, BER, LBC (Berlin is 1.5h by ICE, a major hub, don't miss it!)
  - "London or nearby" → LHR, LGW, STN, LTN, BRS, BHX, MAN
  - "Paris or nearby" → CDG, ORY, BRU, LUX, LIL
  - "Milan or nearby" → MXP, LIN, BGY, VRN, TRN
- When the user names a SPECIFIC single city without "nearby" qualifiers, return only that city's main airport.
- For destinations: if the user lists specific cities, use those. If they say "anywhere in [region]" or "West Coast" or "California", expand generously (5-8 airports).
- For dates: when the user says "end of month / beginning of next", cover the FULL transition period. "end of March / beg of April" → Mar 28, 29, 30, 31, Apr 1, 2, 3, 4, 5 (not just the last day of March).

FLEXIBLE / INSPIRATIONAL DATE SEARCHES:
When the user does NOT specify exact dates but instead wants to explore a period (e.g. "cheapest in July", "flexible dates in April", "anytime in summer", "cheapest week", "best time to fly in June"), use SAMPLED dates instead of listing every single day. This keeps the search fast and under limits.
- "cheapest in July" or "anytime in July" -> sample every 3rd day: Jul 1, 4, 7, 10, 13, 16, 19, 22, 25, 28
- "flexible dates in April" or "flexible April" -> sample weekly: Apr 1, 8, 15, 22, 29
- "anytime next month" -> sample weekly across next month (1st, 8th, 15th, 22nd, 29th if exists)
- "cheapest week" or "best week to fly" -> one date per week for the next 4 weeks from today
- "anytime in summer" -> sample every 2 weeks across Jun-Aug: Jun 1, 15, Jul 1, 15, Aug 1, 15
- For return_dates in flexible searches: if outbound dates are sampled, generate a return date 7 days after each outbound date (unless the user specified a trip duration, then use that duration).
- IMPORTANT: never list more than 15 dates for a flexible search. Always sample/skip days to stay within this limit.

Examples:
- "Bangkok to Hamburg next week under 400 euros" -> {{"origins":["BKK"],"destinations":["HAM"],"dates":["2026-03-16","2026-03-17",...],"return_dates":[],"max_price":400,"currency":"EUR","cabin":"economy","stops":"any"}}
- "BLR, DEL, BKK to FRA, HAM, BER March 15-20 economy max 1 stop" -> {{"origins":["BLR","DEL","BKK"],"destinations":["FRA","HAM","BER"],"dates":["2026-03-15",...,"2026-03-20"],"return_dates":[],"max_price":0,"currency":"EUR","cabin":"economy","stops":"one_stop_or_fewer"}}
- "JFK to London round trip April 10 returning April 17 under $800" -> {{"origins":["JFK"],"destinations":["LHR"],"dates":["2026-04-10"],"return_dates":["2026-04-17"],"max_price":800,"currency":"USD","cabin":"economy","stops":"any"}}
- "Barcelona to anywhere in Europe, cheapest week in July" -> {{"origins":["BCN"],"destinations":["LHR","CDG","FCO","BER","AMS","LIS","ATH","VIE","WAW","PRG","BUD","MAD","ZRH","CPH","OSL","HEL","DUB","BRU","MUC","ARN"],"dates":["2026-07-01","2026-07-08","2026-07-15","2026-07-22","2026-07-29"],"return_dates":[],"max_price":0,"currency":"EUR","cabin":"economy","stops":"any"}}
- "anywhere in Asia" -> pick 10-15 relevant airports: NRT, HND, ICN, PVG, HKG, BKK, SIN, KUL, MNL, CGK, DEL, BOM, CMB, KTM, DAD
- "anywhere in Americas" -> pick 10-15 relevant airports: JFK, LAX, ORD, MIA, GRU, MEX, BOG, LIM, SCL, EZE, YYZ, YVR, SFO, ATL, DFW
- When user says "anywhere" or "any destination", pick 10-15 relevant airports that match trip context (not always the same list)
- NEVER include origin airports in the destinations list. If the user flies FROM Berlin, BER must NOT appear in destinations. Same for all origins.
- IMPORTANT: For "anywhere warm", "beach", "sunny", or similar open-ended destination searches, use at most 5-6 destinations to avoid search timeout. More than 6 destinations × multiple dates = too many routes.
- "fly somewhere warm from [European city]" → prefer NEARBY warm airports (shorter = cheaper, more likely under budget): AGP (Malaga), PMI (Palma), ATH (Athens), TFS (Tenerife), RAK (Marrakech), HRG (Hurghada), LPA (Gran Canaria), FNC (Madeira). Only add long-haul (MIA, BKK, SIN, CUN) if the user has NO price constraint or budget > €500.
- "cheapest week to fly JFK to CDG" -> one date per week for next 4 weeks from today ({today})
- "HAM to anywhere beach next week roundtrip 5-7 days" -> {{"origins":["HAM"],"destinations":["AGP","PMI","ATH","TFS","HRG"],"dates":["2026-03-23","2026-03-24","2026-03-25","2026-03-27"],"return_dates":["2026-03-28","2026-03-29","2026-03-30","2026-04-01","2026-04-02"],...}} (1×5×4×5=100 combos, at limit)

CRITICAL LIMIT — MANDATORY: Maximum 100 route combinations.
Formula: total = len(origins) × len(destinations) × len(dates) × max(len(return_dates), 1)
You MUST calculate this before outputting. If total > 100, REDUCE until it fits.

Round trips multiply fast: 5 destinations × 7 dates × 7 return_dates = 245 (OVER LIMIT).
For round trip + open-ended destinations: use 5 destinations × 4 outbound dates × 5 return dates = 100 (exactly at limit).
For round trip + specific route (1 dest): you can use more dates, e.g. 1×7×7=49.
AIM for 80-100 combinations to maximize coverage. Do NOT go far below 50.

Reduction strategies (apply in order until total ≤ 100):
1. Cut destinations to 3-5 (pick the best matches)
2. Sample dates: every 2nd or 3rd day instead of consecutive
3. Sample return_dates: pick 2-3 representative return dates (e.g. 5 days, 7 days after first outbound)
4. Cut origins to 1-2

Include "total_routes": <your calculated number> in the JSON.
For broad queries (e.g. "any beach", "anywhere warm"), select only the top 3-5 best-matching destinations."""


async def parse_prompt(prompt: str) -> dict:
    """Use Gemini Flash to parse a natural language flight search prompt."""
    if not GEMINI_KEY:
        raise HTTPException(status_code=503, detail="Search parser is not configured.")

    today = date.today().isoformat()
    system = PARSE_SYSTEM.format(today=today)
    text = ""
    for attempt in range(GEMINI_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SECONDS) as client:
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
        except httpx.RequestError as exc:
            log.warning("Gemini request failed (attempt %s): %s", attempt + 1, exc)
            if attempt < GEMINI_MAX_RETRIES:
                await asyncio.sleep((0.25 * (2**attempt)) + random.uniform(0, 0.15))
                continue
            raise HTTPException(status_code=502, detail="Failed to parse search prompt")

        if resp.status_code != 200:
            log.warning("Gemini API error status=%s attempt=%s", resp.status_code, attempt + 1)
            if attempt < GEMINI_MAX_RETRIES:
                await asyncio.sleep((0.25 * (2**attempt)) + random.uniform(0, 0.15))
                continue
            raise HTTPException(status_code=502, detail="Failed to parse search prompt")

        data = resp.json()
        text = _extract_gemini_text(data)
        if text:
            break
        if attempt < GEMINI_MAX_RETRIES:
            await asyncio.sleep((0.25 * (2**attempt)) + random.uniform(0, 0.15))

    if not text:
        log.error("Gemini returned empty payload")
        raise HTTPException(status_code=502, detail="Failed to parse search prompt")

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

    # Cap origins and destinations to prevent abuse
    parsed["origins"] = parsed["origins"][:MAX_ORIGINS]
    parsed["destinations"] = parsed["destinations"][:MAX_DESTINATIONS]

    # Validate currency against allowlist
    parsed["currency"] = str(parsed.get("currency", "EUR")).upper()[:3]
    if parsed["currency"] not in VALID_CURRENCIES:
        parsed["currency"] = "EUR"

    # Validate cabin
    parsed["cabin"] = str(parsed.get("cabin", "economy")).lower()
    if parsed["cabin"] not in VALID_CABINS:
        parsed["cabin"] = "economy"

    # Validate stops
    parsed["stops"] = str(parsed.get("stops", "any")).lower()
    if parsed["stops"] not in VALID_STOPS:
        parsed["stops"] = "any"

    # Validate max_price
    try:
        parsed["max_price"] = max(0, float(parsed.get("max_price", 0)))
    except (ValueError, TypeError):
        parsed["max_price"] = 0

    # Validate and filter dates
    today_dt = date.today()
    max_date = today_dt + timedelta(days=365)
    valid_dates = []
    for d in parsed.get("dates", []):
        try:
            dt = date.fromisoformat(str(d))
            if today_dt <= dt <= max_date:
                valid_dates.append(dt.isoformat())
        except (ValueError, TypeError):
            pass

    if not valid_dates:
        valid_dates = [(today_dt + timedelta(days=i)).isoformat() for i in range(1, 8)]

    # Cap dates to 21 to allow broader flexible/inspirational searches
    # while staying under the 100-combo limit for single O/D pairs
    parsed["dates"] = valid_dates[:21]

    # Validate and filter return_dates
    valid_return = []
    for d in parsed.get("return_dates", []) or []:
        try:
            dt = date.fromisoformat(str(d))
            if today_dt <= dt <= max_date:
                valid_return.append(dt.isoformat())
        except (ValueError, TypeError):
            pass
    parsed["return_dates"] = valid_return[:21]

    return parsed


SUGGEST_SYSTEM = """You are a flight search assistant. A user's search was too broad (too many route combinations).
Given the original prompt and what was parsed, suggest 3 specific, narrowed search queries the user can try instead.
Each suggestion must be a complete natural language search query (not instructions), ready to be searched directly.
Focus on making the search more specific: fewer destinations, a specific date or short range, or a single origin.
Return ONLY a JSON array of 3 strings. No explanation.
Example: ["Berlin to Paris next Friday", "Berlin to Amsterdam or Rome in April, cheapest day", "BER to LHR March 20 direct under €200"]"""

def _trim_to_limit(parsed: dict, return_dates: list, is_round_trip: bool, limit: int = 100) -> tuple[dict, int]:
    """Trim parsed search dimensions to fit under the route combination limit.

    Strategy: iteratively halve the largest dimension until total <= limit.
    Priority order when dimensions are equal: return_dates > dates > destinations > origins.
    Uses evenly-spaced sampling to preserve coverage across the range.
    """
    import math

    def _sample(lst: list, n: int) -> list:
        """Pick n evenly-spaced items from lst, always including first and last."""
        if n >= len(lst):
            return lst
        if n <= 0:
            return [lst[0]]
        if n == 1:
            return [lst[0]]
        step = (len(lst) - 1) / (n - 1)
        return [lst[round(i * step)] for i in range(n)]

    def _total(p: dict) -> int:
        rd = p.get("return_dates", [])
        return len(p["origins"]) * len(p["destinations"]) * len(p["dates"]) * max(len(rd), 1)

    p = dict(parsed)
    for _ in range(20):  # safety cap on iterations
        t = _total(p)
        if t <= limit:
            return p, t
        # Find which dimension to trim: pick the largest, with priority order for ties
        dims = [
            ("return_dates", len(p.get("return_dates", []))),
            ("dates", len(p["dates"])),
            ("destinations", len(p["destinations"])),
            ("origins", len(p["origins"])),
        ]
        # Only trim dimensions with length > 1 (and return_dates > 0)
        trimmable = [(name, size) for name, size in dims if size > 1]
        if not trimmable:
            break
        # Sort by size descending, then by priority order (return_dates first)
        trimmable.sort(key=lambda x: (-x[1], dims.index(x)))
        dim_name = trimmable[0][0]
        current_size = trimmable[0][1]
        # Halve the dimension (minimum 1, except return_dates can go to 1)
        new_size = max(math.ceil(current_size / 2), 1)
        p[dim_name] = _sample(p[dim_name], new_size)

    return p, _total(p)


async def suggest_narrowing(prompt: str, parsed: dict, combined_total: int) -> list[str]:
    """Ask Gemini to suggest 3 narrowed alternatives when a search is too broad."""
    if not GEMINI_KEY:
        return []
    context = (
        f"Original prompt: {prompt}\n"
        f"Parsed: {len(parsed['origins'])} origin(s), {len(parsed['destinations'])} destination(s), "
        f"{len(parsed['dates'])} date(s) = {combined_total} combinations (limit is 100).\n"
        f"Origins: {', '.join(parsed['origins'])}\n"
        f"Destinations: {', '.join(parsed['destinations'][:10])}"
        + (" (and more)" if len(parsed["destinations"]) > 10 else "")
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                GEMINI_URL,
                params={"key": GEMINI_KEY},
                json={
                    "contents": [{"parts": [{"text": context}]}],
                    "systemInstruction": {"parts": [{"text": SUGGEST_SYSTEM}]},
                    "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"},
                },
            )
        if resp.status_code == 200:
            text = _extract_gemini_text(resp.json())
            suggestions = json.loads(text)
            if isinstance(suggestions, list):
                return [str(s) for s in suggestions[:3] if s]
    except Exception as exc:
        log.warning("suggest_narrowing failed: %s", exc)
    return []


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global redis_client
    global _zones_loaded

    if REQUIRE_GEMINI_KEY and not GEMINI_KEY:
        raise RuntimeError("GEMINI_API_KEY is required for startup.")

    _init_alerts_db()

    try:
        load_zones()
        _zones_loaded = True
    except Exception:
        _zones_loaded = False
        raise

    if REDIS_URL:
        try:
            redis_client = redis.from_url(REDIS_URL, decode_responses=True)
            await redis_client.ping()
            log.info("Redis rate limiting enabled")
        except RedisError as exc:
            log.warning("Redis unavailable, falling back to memory rate limiting: %s", exc)
            redis_client = None

    log.info("Conflict zones loaded, Gemini key: %s", "set" if GEMINI_KEY else "MISSING")
    yield

    if redis_client:
        await redis_client.aclose()


app = FastAPI(title="OpenSky API", version="0.2.0", lifespan=lifespan)

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
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
    safe_only: bool = False
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
    booking_label: str
    booking_exact: bool
    origin: str
    destination: str
    date: str


class RoundTripOut(BaseModel):
    outbound: dict
    inbound: dict
    total_price: float
    currency: str
    risk_level: str
    risk_details: list[dict]
    score: float


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
_SEAT_PB = {"economy": 1, "premium_economy": 2, "business": 3, "first": 4}

def _google_flights_url(origin: str, dest: str, date: str, currency: str = "EUR", cabin: str = "economy", legs: list[dict] | None = None) -> str:
    """Generate a Google Flights deep link using protobuf-encoded ?tfs= parameter.

    When legs are provided with airline/flight_number, encodes a specific itinerary.
    Otherwise falls back to a route search (origin/dest/date only).
    """
    import base64
    cur = (currency or "EUR").upper()[:3]
    seat = _SEAT_PB.get(cabin, 1)

    def _varint(n: int) -> bytes:
        out = bytearray()
        while n > 0x7F:
            out.append((n & 0x7F) | 0x80)
            n >>= 7
        out.append(n)
        return bytes(out)

    def _tag(field: int, wt: int) -> bytes:
        return _varint((field << 3) | wt)

    def _pb_str(field: int, s: str) -> bytes:
        b = s.encode()
        return _tag(field, 2) + _varint(len(b)) + b

    def _pb_bytes(field: int, data: bytes) -> bytes:
        return _tag(field, 2) + _varint(len(data)) + data

    has_legs = legs and all(l.get("airline") and l["airline"] != "ZZ" and l.get("flight_number") for l in legs)
    if has_legs:
        def _pb_leg(orig: str, dst: str, dt: str, airline: str, fnum: str) -> bytes:
            return _pb_str(1, orig) + _pb_str(2, dt) + _pb_str(3, dst) + _pb_str(5, airline) + _pb_str(6, fnum)
        leg_bytes = b"".join(
            _pb_bytes(4, _pb_leg(l["from"], l["to"], l["departs"][:10], l["airline"], l["flight_number"]))
            for l in legs
        )
        flight_inner = _pb_str(2, date) + leg_bytes + _pb_bytes(13, _pb_str(2, origin)) + _pb_bytes(14, _pb_str(2, dest))
    else:
        flight_inner = _pb_str(2, date) + _pb_bytes(13, _pb_str(2, origin)) + _pb_bytes(14, _pb_str(2, dest))

    tfs_bytes = _pb_bytes(3, flight_inner) + _pb_bytes(8, b"\x01") + _tag(9, 0) + bytes([seat]) + _tag(19, 0) + b"\x02"
    tfs = base64.b64encode(tfs_bytes).decode()
    return f"https://www.google.com/travel/flights/search?tfs={urllib.parse.quote(tfs)}&hl=en&curr={cur}"


def _skyscanner_date(iso_date: str) -> str:
    """Convert YYYY-MM-DD to Skyscanner's YYMMDD format (e.g. 2026-03-19 -> 260319)."""
    return iso_date.replace("-", "")[2:]


def _skyscanner_url(origin: str, dest: str, date: str, currency: str = "EUR", cabin: str = "economy", return_date: str = "") -> str:
    """Skyscanner deep link with pre-filled route, date, cabin, and currency."""
    o = urllib.parse.quote(origin.lower(), safe="")
    d = urllib.parse.quote(dest.lower(), safe="")
    sd = _skyscanner_date(date)
    date_part = f"{sd}/{_skyscanner_date(return_date)}" if return_date else sd
    params = urllib.parse.urlencode({
        "adultsv2": "1",
        "cabinclass": cabin,
        "currency": currency,
        "sortby": "cheapest",
        "preferDirects": "false",
    })
    return f"https://www.skyscanner.net/transport/flights/{o}/{d}/{date_part}/?{params}"


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


def _booking_link(raw: str, origin: str, dest: str, dt: str, currency: str, cabin: str, return_date: str) -> tuple[str, str, bool]:
    """Return a booking/search URL plus UI metadata that matches the link semantics."""
    if raw and raw.startswith(("https://", "http://")):
        return raw, "Book direct", True
    return _skyscanner_url(origin, dest, dt, currency, cabin, return_date=return_date), "Search on Skyscanner", False


def _scored_to_out(sf: ScoredFlight, cabin: str = "economy", return_date: str = "") -> FlightOut:
    booking_url, booking_label, booking_exact = _booking_link(
        getattr(sf.flight, 'booking_url', ''),
        sf.origin, sf.destination, sf.date, sf.flight.currency, cabin, return_date,
    )
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
        booking_url=booking_url,
        booking_label=booking_label,
        booking_exact=booking_exact,
        origin=sf.origin,
        destination=sf.destination,
        date=sf.date,
    )


def _get_client_ip(request: Request) -> str:
    if TRUST_PROXY:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _run_scan(
    parsed: dict,
    progress_cb: callable = None,
    cancel: threading.Event | None = None,
    error_counter: list | None = None,
    partial_results: list | None = None,
) -> tuple[list[ScoredFlight], int | None]:
    """Run multi-origin x multi-dest x multi-date search with parallel workers.

    Returns (scored_flights, max_cache_age_seconds).
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    engine = SearchEngine(
        currency=parsed.get("currency", "EUR"),
        use_cache=True,
        seat=parsed.get("cabin", "economy"),
        stops=parsed.get("stops", "any"),
        proxy=PROXY,
        provider="google",
    )
    try:
        all_scored: list[ScoredFlight] = []
        cache_ages: list[int] = []
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
                threshold = RiskLevel.CAUTION if parsed.get("safe_only") else RiskLevel.HIGH_RISK
                report = engine.search_scored_report(
                    origin=origin, dest=dest, date=dt,
                    risk_threshold=threshold,
                    max_price=parsed.get("max_price", 0),
                )
                return report.results, report.cache_age_seconds
            except Exception as e:
                log.warning("Search failed %s->%s %s: %s", origin, dest, dt, e)
                if error_counter is not None:
                    error_counter.append(1)
                return [], None

        workers = min(16, total)
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {executor.submit(_search_one, c): c for c in combos}
            for future in as_completed(futures):
                if cancel and cancel.is_set():
                    break
                results, age = future.result()
                all_scored.extend(results)
                if partial_results is not None:
                    partial_results.extend(results)
                if age is not None:
                    cache_ages.append(age)
                completed += 1
                combo = futures[future]
                if progress_cb:
                    progress_cb(completed, total, combo[0], combo[1], combo[2])

        all_scored.sort(key=lambda x: x.score)
        max_age = max(cache_ages) if cache_ages else None
        return all_scored, max_age
    finally:
        engine.close()


def _legs_airports(legs: list) -> list[str]:
    seen: dict[str, None] = {}
    for leg in legs:
        seen[leg.departure_airport] = None
        seen[leg.arrival_airport] = None
    return list(seen)


def _flight_result_to_dict(fr, origin: str, dest: str, dt: str, url: str, label: str, exact: bool) -> dict:
    return {
        "price": fr.price,
        "currency": fr.currency,
        "duration_minutes": fr.duration_minutes,
        "stops": fr.stops,
        "route": f"{origin} -> {dest}",
        "risk_level": "safe",
        "risk_details": [],
        "legs": [
            {
                "airline": leg.airline,
                "flight_number": leg.flight_number,
                "from": leg.departure_airport,
                "to": leg.arrival_airport,
                "departs": leg.departure_time,
                "arrives": leg.arrival_time,
                "duration_minutes": leg.duration_minutes,
            }
            for leg in fr.legs
        ],
        "provider": fr.provider,
        "booking_url": url,
        "booking_label": label,
        "booking_exact": exact,
        "origin": origin,
        "destination": dest,
        "date": dt,
    }


def _round_trip_to_out(
    rt: RoundTripResult,
    origin: str,
    dest: str,
    outbound_date: str,
    return_date: str,
    cabin: str,
    price_weight: float = 1.0,
    duration_weight: float = 0.5,
) -> dict | None:
    all_airports = _legs_airports(rt.outbound.legs) + _legs_airports(rt.inbound.legs)
    risk = check_route(list(dict.fromkeys(all_airports)))

    if risk.risk_level >= RiskLevel.HIGH_RISK:
        return None

    risk_penalty = {RiskLevel.SAFE: 0, RiskLevel.CAUTION: 200}.get(risk.risk_level, 500)
    total_hours = (rt.outbound.duration_minutes + rt.inbound.duration_minutes) / 60
    effective_price = rt.total_price if rt.total_price > 0 else 99999
    score = (price_weight * effective_price) + (duration_weight * total_hours) + risk_penalty

    out_url, out_label, out_exact = _booking_link(
        getattr(rt.outbound, "booking_url", ""), origin, dest, outbound_date, rt.currency, cabin, ""
    )
    in_url, in_label, in_exact = _booking_link(
        getattr(rt.inbound, "booking_url", ""), dest, origin, return_date, rt.currency, cabin, ""
    )

    outbound_dict = _flight_result_to_dict(rt.outbound, origin, dest, outbound_date, out_url, out_label, out_exact)
    inbound_dict = _flight_result_to_dict(rt.inbound, dest, origin, return_date, in_url, in_label, in_exact)

    # Compute per-leg risk so individual flight rows show accurate badges
    out_risk = check_route(_legs_airports(rt.outbound.legs))
    outbound_dict["risk_level"] = out_risk.risk_level.value
    outbound_dict["risk_details"] = [
        {"airport": fa.code, "country": fa.country, "zone": fa.zone_name, "risk": fa.risk_level.value}
        for fa in out_risk.flagged_airports
    ]
    in_risk = check_route(_legs_airports(rt.inbound.legs))
    inbound_dict["risk_level"] = in_risk.risk_level.value
    inbound_dict["risk_details"] = [
        {"airport": fa.code, "country": fa.country, "zone": fa.zone_name, "risk": fa.risk_level.value}
        for fa in in_risk.flagged_airports
    ]

    return {
        "outbound": outbound_dict,
        "inbound": inbound_dict,
        "total_price": rt.total_price,
        "currency": rt.currency,
        "risk_level": risk.risk_level.value,
        "risk_details": [
            {"airport": fa.code, "country": fa.country, "zone": fa.zone_name, "risk": fa.risk_level.value}
            for fa in risk.flagged_airports
        ],
        "score": round(score, 2),
    }


def _run_round_trip_scan(
    parsed: dict,
    progress_cb=None,
    cancel: threading.Event | None = None,
    error_counter: list | None = None,
    partial_results: list | None = None,
) -> tuple[list[dict], int | None]:
    """Split-scan round trips: search outbound and return as separate one-way flights, then pair.

    For 5 dests × 4 outbound × 5 return dates, this does 5×4 + 5×5 = 45 calls
    instead of 5×4×5 = 100 round-trip calls.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    engine = SearchEngine(
        currency=parsed.get("currency", "EUR"),
        use_cache=True,
        seat=parsed.get("cabin", "economy"),
        stops=parsed.get("stops", "any"),
        proxy=PROXY,
        provider="google",
    )
    try:
        cabin = parsed.get("cabin", "economy")
        max_price = parsed.get("max_price", 0)

        # Build unique one-way combos for outbound and return legs
        outbound_combos = list({
            (o.upper(), d.upper(), od)
            for o in parsed["origins"]
            for d in parsed["destinations"]
            for od in parsed["dates"]
        })
        return_combos = list({
            (d.upper(), o.upper(), rd)
            for o in parsed["origins"]
            for d in parsed["destinations"]
            for rd in parsed["return_dates"]
        })

        total = len(outbound_combos) + len(return_combos)
        completed = 0

        # Store results keyed by (origin, dest) for pairing
        outbound_by_route: dict[tuple[str, str], list] = {}
        return_by_route: dict[tuple[str, str], list] = {}

        def _search_one_way(combo):
            origin, dest, dt = combo
            try:
                threshold = RiskLevel.CAUTION if parsed.get("safe_only") else RiskLevel.HIGH_RISK
                report = engine.search_scored_report(
                    origin=origin, dest=dest, date=dt,
                    risk_threshold=threshold,
                    max_price=0,  # filter later on combined price
                )
                return report.results
            except Exception as e:
                log.warning("RT leg failed %s->%s %s: %s", origin, dest, dt, e)
                if error_counter is not None:
                    error_counter.append(1)
                return []

        def _pair_route(orig: str, dest: str) -> list[dict]:
            """Pair outbound and return flights for one (origin, dest) route."""
            out_flights = outbound_by_route.get((orig, dest), [])
            ret_flights = return_by_route.get((dest, orig), [])
            if not out_flights or not ret_flights:
                return []
            pairs = []
            out_sorted = sorted(out_flights, key=lambda sf: sf.score)[:5]
            ret_sorted = sorted(ret_flights, key=lambda sf: sf.score)[:5]
            for sf_out in out_sorted:
                for sf_ret in ret_sorted:
                    out_airports = _legs_airports(sf_out.flight.legs)
                    ret_airports = _legs_airports(sf_ret.flight.legs)
                    all_airports_list = out_airports + ret_airports
                    risk = check_route(list(dict.fromkeys(all_airports_list)))
                    pair_threshold = RiskLevel.CAUTION if parsed.get("safe_only") else RiskLevel.HIGH_RISK
                    if risk.risk_level >= pair_threshold:
                        continue
                    total_price = sf_out.flight.price + sf_ret.flight.price
                    if max_price > 0 and total_price > max_price:
                        continue
                    currency = parsed.get("currency", "EUR")
                    risk_penalty = {RiskLevel.SAFE: 0, RiskLevel.CAUTION: 200}.get(risk.risk_level, 500)
                    total_hours = (sf_out.flight.duration_minutes + sf_ret.flight.duration_minutes) / 60
                    effective_price = total_price if total_price > 0 else 99999
                    score = effective_price + (0.5 * total_hours) + risk_penalty
                    out_url, out_label, out_exact = _booking_link(
                        getattr(sf_out.flight, "booking_url", ""), orig, dest, sf_out.date, currency, cabin, ""
                    )
                    in_url, in_label, in_exact = _booking_link(
                        getattr(sf_ret.flight, "booking_url", ""), dest, orig, sf_ret.date, currency, cabin, ""
                    )
                    outbound_dict = _flight_result_to_dict(sf_out.flight, orig, dest, sf_out.date, out_url, out_label, out_exact)
                    inbound_dict = _flight_result_to_dict(sf_ret.flight, dest, orig, sf_ret.date, in_url, in_label, in_exact)
                    out_risk = check_route(out_airports)
                    outbound_dict["risk_level"] = out_risk.risk_level.value
                    outbound_dict["risk_details"] = [
                        {"airport": fa.code, "country": fa.country, "zone": fa.zone_name, "risk": fa.risk_level.value}
                        for fa in out_risk.flagged_airports
                    ]
                    in_risk = check_route(ret_airports)
                    inbound_dict["risk_level"] = in_risk.risk_level.value
                    inbound_dict["risk_details"] = [
                        {"airport": fa.code, "country": fa.country, "zone": fa.zone_name, "risk": fa.risk_level.value}
                        for fa in in_risk.flagged_airports
                    ]
                    pairs.append({
                        "outbound": outbound_dict,
                        "inbound": inbound_dict,
                        "total_price": total_price,
                        "currency": currency,
                        "risk_level": risk.risk_level.value,
                        "risk_details": [
                            {"airport": fa.code, "country": fa.country, "zone": fa.zone_name, "risk": fa.risk_level.value}
                            for fa in risk.flagged_airports
                        ],
                        "score": round(score, 2),
                    })
            return pairs

        # All unique (origin, dest) route pairs for incremental pairing
        route_pairs = list({(o.upper(), d.upper()) for o in parsed["origins"] for d in parsed["destinations"]})

        workers = min(16, total)
        all_combos = [(c, "outbound") for c in outbound_combos] + [(c, "return") for c in return_combos]

        results: list[dict] = []
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {executor.submit(_search_one_way, c): (c, direction) for c, direction in all_combos}
            for future in as_completed(futures):
                if cancel and cancel.is_set():
                    break
                combo, direction = futures[future]
                origin, dest, dt = combo
                scored_flights = future.result()

                if direction == "outbound":
                    outbound_by_route.setdefault((origin, dest), []).extend(scored_flights)
                else:
                    return_by_route.setdefault((origin, dest), []).extend(scored_flights)

                completed += 1

                # Incremental pairing: re-pair all routes and update partial_results
                if partial_results is not None:
                    partial_results.clear()
                    for orig, dest_code in route_pairs:
                        partial_results.extend(_pair_route(orig, dest_code))

                if progress_cb:
                    progress_cb(completed, total, origin, dest, dt)

        # Final pairing
        for orig, dest_code in route_pairs:
            results.extend(_pair_route(orig, dest_code))

        results.sort(key=lambda x: x["score"])
        return results, None
    finally:
        engine.close()


def _build_summary(flights: list[dict], currency: str) -> dict:
    """Build scan summary: best per destination + date/destination price matrix."""
    if not flights:
        return None

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
    api_key = _extract_api_key(request)
    if api_key and api_key in API_KEYS:
        key_hash = _hash_key(api_key)
        if redis_client:
            remaining = await _check_rate_limit_api_key_redis(key_hash)
        else:
            remaining = _check_rate_limit_api_key_memory(key_hash)
    else:
        ip = _get_client_ip(request)
        remaining = await _check_rate_limit(ip)

    # Step 1: Parse with Gemini
    parsed = await parse_prompt(req.prompt)
    total = len(parsed["origins"]) * len(parsed["destinations"]) * len(parsed["dates"])

    return_dates = parsed.get("return_dates", [])
    # Fix 5: Return dates must be after the last departure date
    return_date_warning: str | None = None
    if return_dates and parsed.get("dates"):
        last_departure = max(parsed["dates"])
        filtered_return = [d for d in return_dates if d > last_departure]
        if not filtered_return:
            return_date_warning = "Return date is before or same as departure — searching one-way only."
            return_dates = []
            parsed["return_dates"] = []
        elif len(filtered_return) < len(return_dates):
            return_dates = filtered_return
            parsed["return_dates"] = filtered_return
    is_round_trip = len(return_dates) > 0
    # For round trips: each (origin, dest, outbound_date, return_date) is one combo
    if is_round_trip:
        combined_total = len(parsed["origins"]) * len(parsed["destinations"]) * len(parsed["dates"]) * len(return_dates)
    else:
        combined_total = total

    # Guard: same origin and destination – remove overlap instead of rejecting
    overlapping = set(parsed["origins"]) & set(parsed["destinations"])
    if overlapping:
        parsed["destinations"] = [d for d in parsed["destinations"] if d not in overlapping]
        if not parsed["destinations"]:
            return JSONResponse(
                status_code=400,
                content={"detail": "Origin and destination are the same. Please choose different airports."},
            )

    if combined_total > 100:
        # Auto-trim to fit under 100 instead of rejecting
        parsed, combined_total = _trim_to_limit(parsed, return_dates, is_round_trip)
        return_dates = parsed.get("return_dates", [])
        is_round_trip = len(return_dates) > 0

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
        safe_only=bool(parsed.get("safe_only", False)),
        total_routes=combined_total,
        airport_names=names,
    )

    async def event_stream():
        # Send parsed params immediately
        try:
            parsed_data = parsed_out.model_dump()
        except Exception:
            yield f"data: {json.dumps({'type': 'error', 'detail': 'Internal error preparing search.'})}\n\n"
            return
        parsed_event: dict = {"type": "parsed", "parsed": parsed_data}
        if return_date_warning:
            parsed_event["warning"] = return_date_warning
        yield f"data: {json.dumps(parsed_event)}\n\n"

        cancel = threading.Event()
        progress_q: queue.Queue = queue.Queue()

        filtered_counter: list[int] = [0]
        partial_results: list = []  # Shared list for streaming preview flights

        def on_progress(done: int, total: int, origin: str, dest: str, dt: str):
            # Build preview from best partial results so far (deduped)
            preview = []
            if partial_results and done < total:
                if is_round_trip:
                    # Dedup by (route, date, stops) keeping lowest combined price
                    deduped: dict[tuple, tuple] = {}
                    for r in partial_results:
                        key = (r["outbound"]["route"], r["outbound"].get("date", ""), r["outbound"]["stops"])
                        combined = r["outbound"]["price"] + r["inbound"]["price"]
                        if key not in deduped or combined < deduped[key][1]:
                            deduped[key] = (r, combined)
                    sorted_deduped = sorted(deduped.values(), key=lambda x: x[1])[:3]
                    preview = [{"price": r["outbound"]["price"] + r["inbound"]["price"], "currency": r["outbound"].get("currency", "EUR"), "route": r["outbound"]["route"], "duration_minutes": r["outbound"]["duration_minutes"], "stops": r["outbound"]["stops"], "risk_level": r.get("risk_level", "safe"), "risk_details": r.get("risk_details", []), "legs": r["outbound"].get("legs", []), "_combined_price": r["outbound"]["price"] + r["inbound"]["price"]} for r, _ in sorted_deduped]
                else:
                    # Dedup by (route, date, stops) keeping lowest score
                    deduped_ow: dict[tuple, tuple] = {}
                    for sf in partial_results:
                        d = _flight_result_to_dict(sf.flight, sf.origin, sf.destination, sf.date, "", "", True)
                        d["risk_level"] = sf.risk.risk_level.value
                        d["risk_details"] = [
                            {"airport": fa.code, "country": fa.country, "zone": fa.zone_name, "risk": fa.risk_level.value}
                            for fa in sf.risk.flagged_airports
                        ]
                        key = (d["route"], d["date"], d["stops"])
                        if key not in deduped_ow or sf.score < deduped_ow[key][1]:
                            deduped_ow[key] = (d, sf.score)
                    sorted_deduped_ow = sorted(deduped_ow.values(), key=lambda x: x[1])[:3]
                    preview = [d for d, _ in sorted_deduped_ow]
            msg = {"type": "progress", "done": done, "total": total, "route": f"{origin} -> {dest}", "date": dt, "filtered": filtered_counter[0]}
            if preview:
                msg["preview_flights"] = preview
            progress_q.put(msg)

        # Run scan in thread
        result_holder: list = []
        error_holder: list = []
        outbound_errors: list = []  # Fix 7: track per-combo errors for zero-results reason

        if is_round_trip:
            def run():
                try:
                    result_holder.append(_run_round_trip_scan(parsed, progress_cb=on_progress, cancel=cancel, error_counter=outbound_errors, partial_results=partial_results))
                except Exception as e:
                    error_holder.append(str(e))
                finally:
                    progress_q.put(None)
        else:
            def run():
                try:
                    result_holder.append(_run_scan(parsed, progress_cb=on_progress, cancel=cancel, error_counter=outbound_errors, partial_results=partial_results))
                except Exception as e:
                    error_holder.append(str(e))
                finally:
                    progress_q.put(None)  # sentinel

        thread = threading.Thread(target=run, daemon=True)
        thread.start()

        # Stream progress events with keepalive (max 300s total)
        scan_start = time.time()
        while True:
            if time.time() - scan_start > 300:
                cancel.set()
                yield f"data: {json.dumps({'type': 'error', 'detail': 'Search timed out after 5 minutes. Try a narrower search.'})}\n\n"
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
            error_id = str(uuid4())[:8]
            log.error("Search worker failed [%s]: %s", error_id, error_holder[0])
            yield f"data: {json.dumps({'type': 'error', 'detail': f'Search failed. Reference: {error_id}'})}\n\n"
            return

        cabin = parsed.get("cabin", "economy")
        warning = zones_age_warning()
        outbound_error_count = len(outbound_errors)
        no_results_reason: str | None = None
        cache_age_seconds: int | None = None

        if is_round_trip:
            # Round-trip: results are already paired by _run_round_trip_scan
            rt_raw, rt_cache_age = result_holder[0] if result_holder else ([], None)
            cache_age_seconds = rt_cache_age
            rt_results: list[dict] = rt_raw
            # Post-search safe_only filter for round trips
            if parsed.get("safe_only"):
                rt_results = [r for r in rt_results if r.get("risk_level") == "safe"]
            round_trip_results = rt_results[:20]
            # Derive outbound flights for summary purposes
            flights = [r["outbound"] for r in rt_results[:10]]
            total_count = len(round_trip_results)
            summary = None  # summary not applicable for paired round trips
            if not round_trip_results:
                no_results_reason = "provider_error" if outbound_error_count > 0 else "no_routes"
            result_data: dict = {
                "type": "results",
                "flights": flights,
                "round_trip_results": round_trip_results,
                "count": total_count,
                "remaining_searches": remaining,
                "zones_warning": warning,
                "summary": summary,
            }
        else:
            scored_raw, scan_cache_age = result_holder[0] if result_holder else ([], None)
            cache_age_seconds = scan_cache_age
            scored = scored_raw

            def _process_flights(scored_list):
                fl = [_scored_to_out(sf, cabin=cabin).model_dump() for sf in scored_list]
                priced = [f for f in fl if f["price"] > 0]
                fl = priced if priced else fl
                fl = _filter_price_anomalies(fl)
                seen: dict[tuple, dict] = {}
                for f in fl:
                    key = (f["route"], f["date"], f["stops"])
                    if key not in seen or f["price"] < seen[key]["price"]:
                        seen[key] = f
                return sorted(seen.values(), key=lambda x: x["score"])

            flights = _process_flights(scored)
            # Count how many flights will be filtered for safety reasons
            filter_levels = ("high_risk", "do_not_fly", "caution") if parsed.get("safe_only") else ("high_risk", "do_not_fly")
            safety_filtered_count = sum(1 for f in flights if f.get("risk_level") in filter_levels)
            # Post-search safe_only filter: remove non-safe flights even from cache
            if parsed.get("safe_only"):
                flights = [f for f in flights if f.get("risk_level") == "safe"]
            # C8: when every result is high_risk, suppress them and emit safety_filtered
            if flights and all(f.get("risk_level") == "high_risk" for f in flights):
                no_results_reason = "safety_filtered"
                flights = []
            elif not flights:
                no_results_reason = "provider_error" if outbound_error_count > 0 else "no_routes"
            total_count = len(flights)
            summary = _build_summary(flights, parsed.get("currency", "EUR"))
            result_data = {
                "type": "results",
                "flights": flights[:20],
                "count": total_count,
                "remaining_searches": remaining,
                "zones_warning": warning,
                "summary": summary,
                "safety_filtered_count": safety_filtered_count,
            }

        if no_results_reason:
            result_data["no_results_reason"] = no_results_reason
        if return_date_warning:
            result_data["warning"] = return_date_warning
        if cache_age_seconds is not None:
            result_data["cache_age_seconds"] = cache_age_seconds
        yield f"data: {json.dumps(result_data)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/zones", response_model=ZonesResponse)
async def get_zones():
    zones = load_zones()
    warning = zones_age_warning()
    return ZonesResponse(zones=zones, warning=warning)


@app.get("/api/healthz")
async def healthz():
    """Liveness probe: process is up."""
    return {"status": "ok", "uptime_seconds": int(time.time() - _startup_at)}


@app.get("/api/readyz")
async def readyz():
    """Readiness probe: critical dependencies are available."""
    checks = {
        "zones_loaded": _zones_loaded,
        "gemini_key": bool(GEMINI_KEY),
        "redis": True,
    }
    if REDIS_URL and redis_client:
        try:
            checks["redis"] = bool(await redis_client.ping())
        except RedisError:
            checks["redis"] = False

    ready = checks["zones_loaded"] and (checks["gemini_key"] or not REQUIRE_GEMINI_KEY) and checks["redis"]
    if not ready:
        raise HTTPException(status_code=503, detail={"status": "not_ready", "checks": checks})
    return {"status": "ready", "checks": checks}


# ---------------------------------------------------------------------------
# Price Alerts
# ---------------------------------------------------------------------------
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = "FlyFast <alerts@flyfast.app>"


def _currency_symbol(c: str) -> str:
    return {"EUR": "\u20ac", "USD": "$", "GBP": "\u00a3"}.get(c, c)


def _send_confirmation_email(
    to: str, query: str, currency: str, max_price: float,
    current_price: float | None, unsub_token: str,
) -> None:
    """Send confirmation email via Resend (fire-and-forget, non-blocking)."""
    if not RESEND_API_KEY:
        return
    sym = _currency_symbol(currency)
    encoded_q = urllib.parse.quote(query)
    flyfast_url = f"https://flyfast.app/?q={encoded_q}&ref=alert_email&utm_source=alert_confirmation"
    unsub_url = f"https://api.flyfast.app/api/alerts/unsubscribe/{unsub_token}"

    safe_query = html_escape(query.replace("\n", " ").replace("\r", " "))
    price_line = ""
    if current_price and current_price > 0:
        price_line = f'<p style="margin:0 0 16px;color:#6b7280;font-size:14px">Current best price: <strong style="color:#22c55e;font-size:18px">{sym}{current_price:.0f}</strong></p>'

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#1a1a2e">
  <div style="text-align:center;padding:16px 0;border-bottom:1px solid #e5e7eb">
    <h1 style="margin:0;font-size:20px;font-weight:700">FlyFast</h1>
  </div>
  <div style="padding:24px 0">
    <h2 style="margin:0 0 8px;font-size:18px">Alert set: {safe_query}</h2>
    <p style="margin:0 0 12px;color:#6b7280;font-size:14px">
      We'll notify you when prices drop{f' below <strong>{sym}{max_price:.0f}</strong>' if max_price > 0 else ''}.
    </p>
    {price_line}
    <a href="{flyfast_url}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      View current prices on FlyFast
    </a>
  </div>
  <div style="padding:16px 0;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
    Alert active for 90 days. Daily price checks.<br>
    <a href="{unsub_url}" style="color:#9ca3af">Unsubscribe</a>
  </div>
</body>
</html>"""

    try:
        httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
                "to": [to],
                "subject": f"Alert set: {query}",
                "html": html,
            },
            timeout=10,
        )
    except Exception as exc:
        log.warning("Confirmation email failed for %s: %s", to, exc)


class AlertCreate(BaseModel):
    email: str
    query: str = Field(..., min_length=3, max_length=500)
    origins: list[str]
    destinations: list[str]
    max_price: float = Field(default=0, ge=0, le=100000)
    currency: str = "EUR"
    cabin: str = "economy"
    is_round_trip: bool = False
    current_price: float | None = None


@app.post("/api/alerts")
async def create_alert(body: AlertCreate):
    if not _EMAIL_RE.match(body.email):
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if not body.origins or not body.destinations:
        raise HTTPException(status_code=400, detail="Origins and destinations are required.")
    if len(body.origins) > MAX_ORIGINS or len(body.destinations) > MAX_DESTINATIONS:
        raise HTTPException(status_code=400, detail="Too many origins or destinations.")
    # Validate IATA codes
    body.origins = [c.upper()[:3] for c in body.origins]
    body.destinations = [c.upper()[:3] for c in body.destinations]
    bad_codes = _validate_iata_codes(body.origins, "origin") + _validate_iata_codes(body.destinations, "dest")
    if bad_codes:
        raise HTTPException(status_code=400, detail=f"Invalid airport code(s): {', '.join(bad_codes[:5])}")
    # Sanitize currency and cabin
    body.currency = body.currency.upper()[:3] if body.currency else "EUR"
    if body.currency not in VALID_CURRENCIES:
        body.currency = "EUR"
    body.cabin = body.cabin.lower() if body.cabin else "economy"
    if body.cabin not in VALID_CABINS:
        body.cabin = "economy"

    conn = _alerts_db()
    try:
        active_count = conn.execute(
            "SELECT COUNT(*) FROM alerts WHERE email = ? AND is_active = 1 AND expires_at > datetime('now')",
            (body.email.lower(),),
        ).fetchone()[0]
        if active_count >= MAX_ALERTS_PER_EMAIL:
            raise HTTPException(status_code=429, detail=f"Maximum {MAX_ALERTS_PER_EMAIL} active alerts per email.")

        alert_id = uuid4().hex[:12]
        unsub_token = uuid4().hex
        now = datetime.now(timezone.utc).isoformat()
        expires = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()

        conn.execute(
            """INSERT INTO alerts (id, email, query, origins, destinations, max_price, currency, cabin, is_round_trip, created_at, expires_at, unsubscribe_token)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                alert_id,
                body.email.lower(),
                body.query,
                json.dumps(body.origins),
                json.dumps(body.destinations),
                body.max_price,
                body.currency.upper(),
                body.cabin,
                1 if body.is_round_trip else 0,
                now,
                expires,
                unsub_token,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    # Fire-and-forget confirmation email
    _send_confirmation_email(
        to=body.email.lower(),
        query=body.query,
        currency=body.currency.upper(),
        max_price=body.max_price,
        current_price=body.current_price,
        unsub_token=unsub_token,
    )

    return {"id": alert_id, "message": "Alert created. We'll email you when prices drop."}


@app.get("/api/alerts/unsubscribe/{token}")
async def unsubscribe_alert(token: str):
    conn = _alerts_db()
    try:
        row = conn.execute("SELECT id, query FROM alerts WHERE unsubscribe_token = ?", (token,)).fetchone()
        if not row:
            return HTMLResponse("<html><body><h2>Alert not found</h2><p>This link may have expired.</p></body></html>", status_code=404)
        conn.execute("UPDATE alerts SET is_active = 0 WHERE unsubscribe_token = ?", (token,))
        conn.commit()
    finally:
        conn.close()

    return HTMLResponse(
        "<html><body style='font-family:system-ui;max-width:480px;margin:40px auto;text-align:center'>"
        "<h2>Alert cancelled</h2>"
        f"<p>You won't receive further emails for: <strong>{html_escape(row['query'])}</strong></p>"
        "<p><a href='https://flyfast.app'>Back to FlyFast</a></p>"
        "</body></html>"
    )


# ---------------------------------------------------------------------------
# Zone Alert Subscriptions (Conflict Zone Newsletter)
# ---------------------------------------------------------------------------
MAX_ZONE_ALERTS_PER_EMAIL = 3

# Valid zone IDs (must match zones-data.ts ZONE_FLAGS keys)
VALID_ZONE_IDS = {
    "ukraine", "iran", "iraq", "syria", "israel", "lebanon", "yemen",
    "libya", "somalia", "afghanistan", "north_korea", "sudan", "eritrea",
    "ethiopia_partial", "mali", "niger", "gulf_states", "pakistan_partial",
    "russia_partial",
}

ZONE_DISPLAY_NAMES: dict[str, str] = {
    "ukraine": "Ukraine", "iran": "Iran", "iraq": "Iraq", "syria": "Syria",
    "israel": "Israel", "lebanon": "Lebanon", "yemen": "Yemen", "libya": "Libya",
    "somalia": "Somalia", "afghanistan": "Afghanistan", "north_korea": "North Korea",
    "sudan": "Sudan", "eritrea": "Eritrea", "ethiopia_partial": "Ethiopia (partial)",
    "mali": "Mali", "niger": "Niger", "gulf_states": "Gulf States",
    "pakistan_partial": "Pakistan (partial)", "russia_partial": "Russia (partial)",
}


class ZoneAlertCreate(BaseModel):
    email: str
    zones: list[str] = Field(..., min_length=1, max_length=19)


def _send_zone_alert_confirmation(to: str, zone_names: list[str], unsub_token: str) -> None:
    if not RESEND_API_KEY:
        return
    unsub_url = f"https://api.flyfast.app/api/zone-alerts/unsubscribe/{unsub_token}"
    zone_list_html = "".join(f"<li>{html_escape(z)}</li>" for z in zone_names)

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#1a1a2e">
  <div style="text-align:center;padding:16px 0;border-bottom:1px solid #e5e7eb">
    <h1 style="margin:0;font-size:20px;font-weight:700">FlyFast</h1>
  </div>
  <div style="padding:24px 0">
    <h2 style="margin:0 0 8px;font-size:18px">Conflict zone alert active</h2>
    <p style="margin:0 0 12px;color:#6b7280;font-size:14px">
      You'll be notified when the risk level changes for:
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#374151;font-size:14px">{zone_list_html}</ul>
    <a href="https://flyfast.app/safety" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      View conflict zone map
    </a>
  </div>
  <div style="padding:16px 0;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
    Alert active for 180 days.<br>
    <a href="{unsub_url}" style="color:#9ca3af">Unsubscribe</a>
  </div>
</body>
</html>"""

    try:
        httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
                "to": [to],
                "subject": f"Zone alert active: {', '.join(zone_names[:3])}{'...' if len(zone_names) > 3 else ''}",
                "html": html,
            },
            timeout=10,
        )
    except Exception as exc:
        log.warning("Zone alert confirmation email failed for %s: %s", to, exc)


@app.post("/api/zone-alerts")
async def create_zone_alert(body: ZoneAlertCreate):
    if not _EMAIL_RE.match(body.email):
        raise HTTPException(status_code=400, detail="Invalid email address.")

    # Validate zone IDs
    invalid = [z for z in body.zones if z not in VALID_ZONE_IDS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid zone(s): {', '.join(invalid[:5])}")

    conn = _alerts_db()
    try:
        active_count = conn.execute(
            "SELECT COUNT(*) FROM zone_alerts WHERE email = ? AND is_active = 1 AND expires_at > datetime('now')",
            (body.email.lower(),),
        ).fetchone()[0]
        if active_count >= MAX_ZONE_ALERTS_PER_EMAIL:
            raise HTTPException(status_code=429, detail=f"Maximum {MAX_ZONE_ALERTS_PER_EMAIL} active zone alert subscriptions per email.")

        alert_id = uuid4().hex[:12]
        unsub_token = uuid4().hex
        now = datetime.now(timezone.utc).isoformat()
        expires = (datetime.now(timezone.utc) + timedelta(days=180)).isoformat()

        conn.execute(
            """INSERT INTO zone_alerts (id, email, zones, created_at, expires_at, unsubscribe_token)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (alert_id, body.email.lower(), json.dumps(body.zones), now, expires, unsub_token),
        )
        conn.commit()
    finally:
        conn.close()

    zone_names = [ZONE_DISPLAY_NAMES.get(z, z) for z in body.zones]
    _send_zone_alert_confirmation(to=body.email.lower(), zone_names=zone_names, unsub_token=unsub_token)

    return {"id": alert_id, "message": f"Zone alert created for {len(body.zones)} zone(s). Check your email for confirmation."}


@app.get("/api/zone-alerts/unsubscribe/{token}")
async def unsubscribe_zone_alert(token: str):
    conn = _alerts_db()
    try:
        row = conn.execute("SELECT id, zones FROM zone_alerts WHERE unsubscribe_token = ?", (token,)).fetchone()
        if not row:
            return HTMLResponse("<html><body><h2>Alert not found</h2><p>This link may have expired.</p></body></html>", status_code=404)
        conn.execute("UPDATE zone_alerts SET is_active = 0 WHERE unsubscribe_token = ?", (token,))
        conn.commit()
        zone_ids = json.loads(row["zones"])
        zone_names = [ZONE_DISPLAY_NAMES.get(z, z) for z in zone_ids]
    finally:
        conn.close()

    return HTMLResponse(
        "<html><body style='font-family:system-ui;max-width:480px;margin:40px auto;text-align:center'>"
        "<h2>Zone alert cancelled</h2>"
        f"<p>You won't receive further updates for: <strong>{html_escape(', '.join(zone_names))}</strong></p>"
        "<p><a href='https://flyfast.app/safety'>Back to conflict zone map</a></p>"
        "</body></html>"
    )
