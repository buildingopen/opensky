from __future__ import annotations

import json
import math
import time
from pathlib import Path

import airportsdata

from opensky.models import (
    ConflictZone,
    FlaggedAirport,
    FlaggedOverflight,
    RiskAssessment,
    RiskLevel,
)

_BUNDLED_PATH = Path(__file__).parent / "data" / "conflict_zones.json"
_COUNTRY_SHAPES_PATH = Path(__file__).parent / "data" / "risk_country_shapes.json"
_CACHE_PATH = Path.home() / ".cache" / "opensky" / "conflict_zones.json"
_LEGACY_CACHE_PATH = Path.home() / ".cache" / "skyroute" / "conflict_zones.json"
_CACHE_MAX_AGE = 7 * 24 * 3600  # 7 days
_OVERFLIGHT_PROXY_MAX_SEGMENT_KM = 2500.0
_OVERFLIGHT_SAMPLE_STEP_KM = 75.0

_airports_db: dict[str, dict] | None = None
_zones: list[ConflictZone] | None = None
_country_risk: dict[str, tuple[RiskLevel, str]] | None = None
_airport_risk: dict[str, tuple[RiskLevel, str]] | None = None
_country_shapes: dict[str, list[list[list[tuple[float, float]]]]] | None = None
_country_shape_bounds: dict[str, tuple[float, float, float, float]] | None = None
_segment_risk_cache: dict[tuple[str, str], list[FlaggedOverflight]] = {}
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


def airport_coords(iata: str) -> tuple[float, float] | None:
    db = _get_airports_db()
    info = db.get(iata)
    if not info:
        return None
    return info["lat"], info["lon"]


def _load_zones_from_file(path: Path) -> list[ConflictZone]:
    data = json.loads(path.read_text())
    return [ConflictZone(**z) for z in data["zones"]]


def _load_country_shapes() -> dict[str, list[list[list[tuple[float, float]]]]]:
    global _country_shapes, _country_shape_bounds
    if _country_shapes is not None and _country_shape_bounds is not None:
        return _country_shapes

    data = json.loads(_COUNTRY_SHAPES_PATH.read_text())
    shapes: dict[str, list[list[list[tuple[float, float]]]]] = {}
    bounds: dict[str, tuple[float, float, float, float]] = {}
    for country, polygons in data["countries"].items():
        typed_polygons: list[list[list[tuple[float, float]]]] = []
        lon_values: list[float] = []
        lat_values: list[float] = []
        for polygon in polygons:
            typed_polygon: list[list[tuple[float, float]]] = []
            for ring in polygon:
                typed_ring = [(lon, lat) for lon, lat in ring]
                typed_polygon.append(typed_ring)
                lon_values.extend(lon for lon, _ in typed_ring)
                lat_values.extend(lat for _, lat in typed_ring)
            typed_polygons.append(typed_polygon)
        shapes[country] = typed_polygons
        bounds[country] = (
            min(lon_values),
            min(lat_values),
            max(lon_values),
            max(lat_values),
        )

    _country_shapes = shapes
    _country_shape_bounds = bounds
    return _country_shapes


def load_zones(force_bundled: bool = False) -> list[ConflictZone]:
    global _zones, _country_risk, _airport_risk

    if _zones is not None and not force_bundled:
        return _zones

    if not force_bundled and not _CACHE_PATH.exists() and _LEGACY_CACHE_PATH.exists():
        _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        try:
            _LEGACY_CACHE_PATH.replace(_CACHE_PATH)
        except Exception:
            _CACHE_PATH.write_text(_LEGACY_CACHE_PATH.read_text())

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

    _segment_risk_cache.clear()
    return _zones


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    hav = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 6371.0 * 2 * math.asin(min(1.0, math.sqrt(hav)))


def _to_cartesian(point: tuple[float, float]) -> tuple[float, float, float]:
    lat, lon = map(math.radians, point)
    return (
        math.cos(lat) * math.cos(lon),
        math.cos(lat) * math.sin(lon),
        math.sin(lat),
    )


def _from_cartesian(x: float, y: float, z: float) -> tuple[float, float]:
    hyp = math.hypot(x, y)
    return (
        math.degrees(math.atan2(z, hyp)),
        math.degrees(math.atan2(y, x)),
    )


def _great_circle_points(
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    step_km: float = _OVERFLIGHT_SAMPLE_STEP_KM,
) -> list[tuple[float, float]]:
    distance_km = _haversine_km(start, end)
    steps = max(4, math.ceil(distance_km / step_km))
    p1 = _to_cartesian(start)
    p2 = _to_cartesian(end)
    dot = max(-1.0, min(1.0, sum(u * v for u, v in zip(p1, p2))))
    delta = math.acos(dot)
    if delta == 0:
        return []

    sin_delta = math.sin(delta)
    points: list[tuple[float, float]] = []
    for idx in range(1, steps):
        fraction = idx / steps
        a = math.sin((1 - fraction) * delta) / sin_delta
        b = math.sin(fraction * delta) / sin_delta
        x = (a * p1[0]) + (b * p2[0])
        y = (a * p1[1]) + (b * p2[1])
        z = (a * p1[2]) + (b * p2[2])
        mag = math.sqrt((x * x) + (y * y) + (z * z))
        points.append(_from_cartesian(x / mag, y / mag, z / mag))
    return points


def _point_in_ring(lon: float, lat: float, ring: list[tuple[float, float]]) -> bool:
    inside = False
    for idx in range(len(ring)):
        x1, y1 = ring[idx]
        x2, y2 = ring[(idx + 1) % len(ring)]
        crosses = (y1 > lat) != (y2 > lat)
        if not crosses:
            continue
        xinters = ((x2 - x1) * (lat - y1) / ((y2 - y1) or 1e-12)) + x1
        if lon < xinters:
            inside = not inside
    return inside


def _point_in_polygon(
    lon: float,
    lat: float,
    polygon: list[list[tuple[float, float]]],
) -> bool:
    if not _point_in_ring(lon, lat, polygon[0]):
        return False
    for hole in polygon[1:]:
        if _point_in_ring(lon, lat, hole):
            return False
    return True


def _point_in_country(country: str, lon: float, lat: float) -> bool:
    shapes = _load_country_shapes()
    if _country_shape_bounds is None:
        raise RuntimeError("Country shape bounds not loaded")
    bounds = _country_shape_bounds.get(country)
    if bounds is None:
        return False
    min_lon, min_lat, max_lon, max_lat = bounds
    if lon < min_lon or lon > max_lon or lat < min_lat or lat > max_lat:
        return False
    return any(
        _point_in_polygon(lon, lat, polygon)
        for polygon in shapes.get(country, [])
    )


def _segment_overflights(
    departure_airport: str,
    arrival_airport: str,
) -> list[FlaggedOverflight]:
    cache_key = (departure_airport, arrival_airport)
    if cache_key in _segment_risk_cache:
        return list(_segment_risk_cache[cache_key])

    if _country_risk is None:
        raise RuntimeError("Conflict zones not loaded")

    departure_coords = airport_coords(departure_airport)
    arrival_coords = airport_coords(arrival_airport)
    if departure_coords is None or arrival_coords is None:
        _segment_risk_cache[cache_key] = []
        return []

    distance_km = _haversine_km(departure_coords, arrival_coords)
    if distance_km > _OVERFLIGHT_PROXY_MAX_SEGMENT_KM:
        _segment_risk_cache[cache_key] = []
        return []

    sampled_points = _great_circle_points(departure_coords, arrival_coords)
    if not sampled_points:
        _segment_risk_cache[cache_key] = []
        return []

    departure_country = airport_country(departure_airport)
    arrival_country = airport_country(arrival_airport)
    findings: list[FlaggedOverflight] = []
    for country, (risk_level, zone_name) in _country_risk.items():
        if country in {departure_country, arrival_country}:
            continue
        if country not in _load_country_shapes():
            continue
        if any(
            _point_in_country(country, lon, lat)
            for lat, lon in sampled_points
        ):
            findings.append(
                FlaggedOverflight(
                    country=country,
                    zone_name=zone_name,
                    risk_level=risk_level,
                    segment=f"{departure_airport} -> {arrival_airport}",
                )
            )

    _segment_risk_cache[cache_key] = findings
    return list(findings)


def check_route(airports: list[str]) -> RiskAssessment:
    load_zones()
    if _country_risk is None or _airport_risk is None:
        raise RuntimeError("Conflict zones not loaded")

    worst = RiskLevel.SAFE
    flagged: list[FlaggedAirport] = []
    flagged_overflights: list[FlaggedOverflight] = []
    seen_overflights: set[tuple[str, str, str]] = set()

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

    for departure_airport, arrival_airport in zip(airports, airports[1:]):
        for finding in _segment_overflights(departure_airport, arrival_airport):
            key = (finding.country, finding.zone_name, finding.segment)
            if key in seen_overflights:
                continue
            seen_overflights.add(key)
            flagged_overflights.append(finding)
            if finding.risk_level > worst:
                worst = finding.risk_level

    return RiskAssessment(
        risk_level=worst,
        flagged_airports=flagged,
        flagged_overflights=flagged_overflights,
    )


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
            result = f"Conflict zone data is {int(age_days)} days old. Run `opensky zones --update` to refresh."
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
                    result = f"Bundled conflict zone data is {age_days} days old. Run `opensky zones --update` to refresh."
            except ValueError:
                pass

    _zones_warning_computed = True
    _zones_warning_value = result
    return result


def save_cached_zones(data: str) -> None:
    _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_PATH.write_text(data)
    # Force reload
    global _zones, _country_risk, _airport_risk, _zones_warning_computed, _zones_warning_value
    _zones = None
    _country_risk = None
    _airport_risk = None
    _segment_risk_cache.clear()
    _zones_warning_computed = False
    _zones_warning_value = None
