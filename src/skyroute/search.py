from __future__ import annotations

import logging
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from skyroute import cache
from skyroute._vendor.google_flights import (
    FlightSearchFilters,
    FlightSegment,
    MaxStops,
    PassengerInfo,
    SeatType,
    SearchFlights,
    SortBy,
)
from skyroute.config import ScanConfig
from skyroute.models import FlightLeg, FlightResult, RiskLevel, ScoredFlight
from skyroute.safety import check_route

log = logging.getLogger(__name__)

class _Unset:
    """Sentinel for distinguishing 'not provided' from None."""

_UNSET = _Unset()

SEAT_MAP = {
    "economy": SeatType.ECONOMY,
    "premium_economy": SeatType.PREMIUM_ECONOMY,
    "business": SeatType.BUSINESS,
    "first": SeatType.FIRST,
}


def _build_filters(
    origin: str,
    dest: str,
    date: str,
    seat: SeatType = SeatType.ECONOMY,
    stops: MaxStops = MaxStops.ANY,
) -> FlightSearchFilters:
    return FlightSearchFilters(
        flight_segments=[
            FlightSegment(
                departure_airport=[[origin, 0]],
                arrival_airport=[[dest, 0]],
                travel_date=date,
            )
        ],
        passenger_info=PassengerInfo(adults=1),
        seat_type=seat,
        stops=stops,
        sort_by=SortBy.CHEAPEST,
    )


def _convert_result(raw: Any, currency: str) -> FlightResult:
    legs = []
    for leg in raw.legs:
        legs.append(FlightLeg(
            airline=leg.airline,
            flight_number=leg.flight_number,
            departure_airport=leg.departure_airport,
            arrival_airport=leg.arrival_airport,
            departure_time=leg.departure_datetime.isoformat(),
            arrival_time=leg.arrival_datetime.isoformat(),
            duration_minutes=leg.duration,
        ))

    return FlightResult(
        price=raw.price,
        currency=currency,
        duration_minutes=raw.duration,
        stops=raw.stops,
        legs=legs,
    )


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
    ):
        self.currency = currency
        self.proxy = proxy
        self.use_cache = use_cache
        self.seat = SEAT_MAP.get(seat, SeatType.ECONOMY)
        self.stops = getattr(MaxStops, stops.upper(), MaxStops.ANY)
        self._api: SearchFlights | None = None

    def _get_api(self) -> SearchFlights:
        if self._api is None:
            self._api = SearchFlights(currency=self.currency, proxy=self.proxy)
        return self._api

    def close(self) -> None:
        if self._api:
            self._api.close()
            self._api = None

    def search_one(
        self,
        origin: str,
        dest: str,
        date: str,
    ) -> list[FlightResult]:
        ck = cache.cache_key(
            origin, dest, date,
            seat=self.seat.name, currency=self.currency, stops=self.stops.name,
        )

        if self.use_cache:
            cached = cache.get(ck)
            if cached is not None:
                return cached

        filters = _build_filters(origin, dest, date, self.seat, self.stops)
        api = self._get_api()
        raw_results = api.search(filters)

        if not raw_results:
            results: list[FlightResult] = []
        else:
            results = [_convert_result(r, self.currency) for r in raw_results]

        if self.use_cache:
            cache.put(ck, results)

        return results

    def search_scored(
        self,
        origin: str,
        dest: str,
        date: str,
        risk_threshold: RiskLevel | None = RiskLevel.HIGH_RISK,
        price_weight: float = 1.0,
        duration_weight: float = 0.5,
        transit_hours: dict[str, float] | None = None,
    ) -> list[ScoredFlight]:
        results = self.search_one(origin, dest, date)
        scored = []

        for flight in results:
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
