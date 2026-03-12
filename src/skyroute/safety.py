from __future__ import annotations

import json
import time
from pathlib import Path

import airportsdata

from skyroute.models import ConflictZone, FlaggedAirport, RiskAssessment, RiskLevel

_BUNDLED_PATH = Path(__file__).parent / "data" / "conflict_zones.json"
_CACHE_PATH = Path.home() / ".cache" / "skyroute" / "conflict_zones.json"
_CACHE_MAX_AGE = 7 * 24 * 3600  # 7 days

_airports_db: dict[str, dict] | None = None
_zones: list[ConflictZone] | None = None
_country_risk: dict[str, tuple[RiskLevel, str]] | None = None
_airport_risk: dict[str, tuple[RiskLevel, str]] | None = None
_zones_warning_computed = False
_zones_warning_value: str | None = None


def _get_airports_db() -> dict[str, dict]:
    global _airports_db
    if _airports_db is None:
        _airports_db = airportsdata.load("IATA")
    return _airports_db


def airport_country(iata: str) -> str | None:
    db = _get_airports_db()
    info = db.get(iata)
    return info["country"] if info else None


def _load_zones_from_file(path: Path) -> list[ConflictZone]:
    data = json.loads(path.read_text())
    return [ConflictZone(**z) for z in data["zones"]]


def load_zones(force_bundled: bool = False) -> list[ConflictZone]:
    global _zones, _country_risk, _airport_risk

    if _zones is not None and not force_bundled:
        return _zones

    # Prefer cached version if fresh
    source = _BUNDLED_PATH
    if not force_bundled and _CACHE_PATH.exists():
        age = time.time() - _CACHE_PATH.stat().st_mtime
        if age < _CACHE_MAX_AGE:
            source = _CACHE_PATH

    _zones = _load_zones_from_file(source)

    # Build lookup tables
    _country_risk = {}
    _airport_risk = {}
    for zone in _zones:
        rl = zone.risk_level
        for cc in zone.countries:
            existing = _country_risk.get(cc)
            if existing is None or rl > existing[0]:
                _country_risk[cc] = (rl, zone.name)
        for ap in zone.airports:
            existing = _airport_risk.get(ap)
            if existing is None or rl > existing[0]:
                _airport_risk[ap] = (rl, zone.name)

    return _zones


def check_route(airports: list[str]) -> RiskAssessment:
    load_zones()
    if _country_risk is None or _airport_risk is None:
        raise RuntimeError("Conflict zones not loaded")

    worst = RiskLevel.SAFE
    flagged: list[FlaggedAirport] = []

    for code in airports:
        # Check specific airport first
        ap_entry = _airport_risk.get(code)
        if ap_entry:
            rl, zone_name = ap_entry
            country = airport_country(code) or "??"
            flagged.append(FlaggedAirport(
                code=code, country=country, zone_name=zone_name, risk_level=rl
            ))
            if rl > worst:
                worst = rl
            continue

        # Check country
        country = airport_country(code)
        if country:
            cc_entry = _country_risk.get(country)
            if cc_entry:
                rl, zone_name = cc_entry
                flagged.append(FlaggedAirport(
                    code=code, country=country, zone_name=zone_name, risk_level=rl
                ))
                if rl > worst:
                    worst = rl

    return RiskAssessment(risk_level=worst, flagged_airports=flagged)


def zones_age_warning() -> str | None:
    """Return a warning string if the conflict zone data is stale, else None."""
    global _zones_warning_computed, _zones_warning_value
    if _zones_warning_computed:
        return _zones_warning_value

    load_zones()
    result = None

    # Check if using cached version
    if _CACHE_PATH.exists():
        age_days = (time.time() - _CACHE_PATH.stat().st_mtime) / 86400
        if age_days > 7:
            result = f"Conflict zone data is {int(age_days)} days old. Run `skyroute zones --update` to refresh."
    else:
        # Using bundled -- check its age from metadata
        data = json.loads(_BUNDLED_PATH.read_text())
        updated = data.get("metadata", {}).get("updated", "")
        if updated:
            from datetime import datetime
            try:
                updated_dt = datetime.strptime(updated, "%Y-%m-%d")
                age_days = (datetime.now() - updated_dt).days
                if age_days > 14:
                    result = f"Bundled conflict zone data is {age_days} days old. Run `skyroute zones --update` to refresh."
            except ValueError:
                pass

    _zones_warning_computed = True
    _zones_warning_value = result
    return result


def save_cached_zones(data: str) -> None:
    _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_PATH.write_text(data)
    # Force reload
    global _zones
    _zones = None
