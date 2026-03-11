from __future__ import annotations

import logging
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed

from skyroute import cache
from skyroute.config import ScanConfig
from skyroute.models import FlightLeg, FlightResult, RiskLevel, ScoredFlight
from skyroute.providers import FlightProvider, configured_providers
from skyroute.safety import check_route

log = logging.getLogger(__name__)


class _Unset:
    """Sentinel for distinguishing 'not provided' from None."""

_UNSET = _Unset()

STOPS_INT: dict[str, int | None] = {
    "any": None,
    "non_stop": 0,
    "one_stop_or_fewer": 1,
    "two_or_fewer_stops": 2,
}


def _deduplicate(results: list[FlightResult]) -> list[FlightResult]:
    """Deduplicate flights across providers.

    Key = airline+flight_number per leg + departure date.
    Same flight from two providers: keep the one with the lowest price
    (prefer priced over unpriced).
    """
    best: dict[str, FlightResult] = {}
    for flight in results:
        if not flight.legs:
            continue
        dep_date = flight.legs[0].departure_time[:10] if flight.legs[0].departure_time else ""
        # Normalize flight numbers: strip leading zeros for cross-provider matching
        key = dep_date + "|" + "|".join(
            f"{leg.airline}{leg.flight_number.lstrip('0') or '0'}:{leg.departure_airport}-{leg.arrival_airport}"
            for leg in flight.legs
        )
        existing = best.get(key)
        if existing is None:
            best[key] = flight
        else:
            # Prefer priced over unpriced; then cheapest
            if existing.price <= 0 and flight.price > 0:
                best[key] = flight
            elif flight.price > 0 and (existing.price <= 0 or flight.price < existing.price):
                best[key] = flight
    return list(best.values())


def _route_string(origin: str, dest: str, legs: list[FlightLeg]) -> str:
    airports = [origin]
    for leg in legs:
        if leg.departure_airport != airports[-1]:
            airports.append(leg.departure_airport)
        airports.append(leg.arrival_airport)
    # Deduplicate consecutive
    deduped = [airports[0]]
    for a in airports[1:]:
        if a != deduped[-1]:
            deduped.append(a)
    return " -> ".join(deduped)


def _all_airports(legs: list[FlightLeg]) -> list[str]:
    airports = []
    for leg in legs:
        airports.append(leg.departure_airport)
        airports.append(leg.arrival_airport)
    return list(dict.fromkeys(airports))


class SearchEngine:
    def __init__(
        self,
        currency: str = "EUR",
        proxy: str | None = None,
        use_cache: bool = True,
        seat: str = "economy",
        stops: str = "any",
        provider: str | None = None,
    ):
        self.currency = currency
        self.use_cache = use_cache
        self.seat = seat
        self.max_stops = STOPS_INT.get(stops, None)
        self._providers: list[FlightProvider] = configured_providers(
            currency=currency, proxy=proxy, only=provider,
        )

    def close(self) -> None:
        for p in self._providers:
            try:
                p.close()
            except Exception:
                pass
        self._providers = []

    def search_one(
        self,
        origin: str,
        dest: str,
        date: str,
    ) -> list[FlightResult]:
        all_results: list[FlightResult] = []

        for provider in self._providers:
            ck = cache.cache_key(
                origin, dest, date,
                seat=self.seat, currency=self.currency,
                stops=self.max_stops, provider=provider.name,
            )

            if self.use_cache:
                cached = cache.get(ck)
                if cached is not None:
                    all_results.extend(cached)
                    continue

            try:
                results = provider.search(
                    origin, dest, date,
                    cabin=self.seat,
                    currency=self.currency,
                    max_stops=self.max_stops,
                )
            except Exception as e:
                log.warning("Provider %s failed for %s->%s %s: %s", provider.name, origin, dest, date, e)
                continue

            if self.use_cache:
                cache.put(ck, results)

            all_results.extend(results)

        if len(self._providers) > 1:
            all_results = _deduplicate(all_results)

        return all_results

    def search_scored(
        self,
        origin: str,
        dest: str,
        date: str,
        risk_threshold: RiskLevel | None = RiskLevel.HIGH_RISK,
        price_weight: float = 1.0,
        duration_weight: float = 0.5,
        transit_hours: dict[str, float] | None = None,
        max_price: float = 0,
    ) -> list[ScoredFlight]:
        results = self.search_one(origin, dest, date)
        scored = []

        for flight in results:
            if max_price > 0 and flight.price > 0 and flight.price > max_price:
                continue

            airports = _all_airports(flight.legs)
            risk = check_route(airports)

            # Skip flights at or above the risk threshold
            if risk_threshold is not None and risk.risk_level >= risk_threshold:
                continue

            route = _route_string(origin, dest, flight.legs)
            th = (transit_hours or {}).get(dest, 0.0)
            total_hours = (flight.duration_minutes / 60) + th
            price = flight.price if flight.price > 0 else 99999
            score = (price_weight * price) + (duration_weight * total_hours)

            sf = ScoredFlight(
                flight=flight,
                origin=origin,
                destination=dest,
                date=date,
                route=route,
                risk=risk,
                score=score,
                transit_hours=th,
            )
            scored.append(sf)

        return scored

    def scan(
        self,
        config: ScanConfig,
        workers: int = 3,
        delay: float = 1.0,
        on_progress: Callable[[int, int, int], None] | None = None,
        on_result: Callable[[ScoredFlight], None] | None = None,
        risk_threshold_override: RiskLevel | None | _Unset = _UNSET,
    ) -> list[ScoredFlight]:
        dates = config.search.date_range.dates()
        combos = [
            (o, d, dt)
            for o in config.search.origins
            for d in config.search.destinations
            for dt in dates
        ]
        total = len(combos)
        if risk_threshold_override is not _UNSET:
            risk_threshold = risk_threshold_override
        else:
            risk_threshold = RiskLevel(config.safety.risk_threshold)
        transit_hours = config.connections.transit_hours
        pw = config.scoring.price_weight
        dw = config.scoring.duration_weight
        mp = config.search.max_price

        all_scored: list[ScoredFlight] = []
        completed = 0
        errors = 0
        consecutive_errors = 0
        effective_delay = delay

        def _search_combo(combo: tuple[str, str, str]) -> tuple[str, str, str, list[ScoredFlight] | None]:
            origin, dest, date = combo
            try:
                results = self.search_scored(
                    origin, dest, date,
                    risk_threshold=risk_threshold,
                    price_weight=pw,
                    duration_weight=dw,
                    transit_hours=transit_hours,
                    max_price=mp,
                )
                return (origin, dest, date, results)
            except Exception as e:
                log.warning("Search failed for %s->%s %s: %s", origin, dest, date, e)
                return (origin, dest, date, None)

        with ThreadPoolExecutor(max_workers=workers) as executor:
            i = 0
            while i < total:
                batch = combos[i:i + workers]
                futures = {executor.submit(_search_combo, c): c for c in batch}

                for future in as_completed(futures):
                    origin, dest, date, results = future.result()
                    completed += 1

                    if results is None:
                        errors += 1
                        consecutive_errors += 1
                        if consecutive_errors >= 3:
                            effective_delay = min(effective_delay * 2, 10.0)
                            log.warning(
                                "Increasing delay to %.1fs after %d consecutive errors",
                                effective_delay, consecutive_errors,
                            )
                    else:
                        if consecutive_errors > 0:
                            consecutive_errors = 0
                            effective_delay = max(effective_delay * 0.8, delay)
                        all_scored.extend(results)

                    if on_progress:
                        on_progress(completed, total, errors)

                    if results and on_result:
                        for sf in results:
                            on_result(sf)

                i += len(batch)
                if i < total:
                    time.sleep(effective_delay)

        all_scored.sort(key=lambda x: x.score)
        return all_scored
