from __future__ import annotations

import logging
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field

from opensky import cache
from opensky.config import ScanConfig, VALID_CABINS, VALID_STOPS
from opensky.models import FlightLeg, FlightResult, RiskLevel, ScoredFlight
from opensky.providers import FlightProvider, configured_providers
from opensky.safety import check_route

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


@dataclass(frozen=True)
class ProviderFailure:
    provider: str
    error: str


@dataclass
class SearchReport:
    results: list[FlightResult]
    successful_providers: list[str] = field(default_factory=list)
    failed_providers: list[ProviderFailure] = field(default_factory=list)


@dataclass
class ScoredSearchReport:
    results: list[ScoredFlight]
    successful_providers: list[str] = field(default_factory=list)
    failed_providers: list[ProviderFailure] = field(default_factory=list)


@dataclass
class ScanReport:
    results: list[ScoredFlight]
    successful_providers: dict[str, int] = field(default_factory=dict)
    failed_providers: dict[str, int] = field(default_factory=dict)
    failed_provider_errors: dict[str, str] = field(default_factory=dict)


def _increment_count(counts: dict[str, int], key: str) -> None:
    counts[key] = counts.get(key, 0) + 1


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
    for airport in airports[1:]:
        if airport != deduped[-1]:
            deduped.append(airport)
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
        if seat not in VALID_CABINS:
            raise ValueError(f"Invalid cabin: {seat}. Choose from: {', '.join(VALID_CABINS)}.")
        if stops not in VALID_STOPS:
            raise ValueError(
                f"Invalid stops filter: {stops}. Choose from: {', '.join(VALID_STOPS)}."
            )

        self.currency = currency
        self.use_cache = use_cache
        self.seat = seat
        self.max_stops = STOPS_INT.get(stops, None)
        self._providers: list[FlightProvider] = configured_providers(
            currency=currency, proxy=proxy, only=provider,
        )

    def close(self) -> None:
        for provider in self._providers:
            try:
                provider.close()
            except Exception:
                pass
        self._providers = []

    def search_one(
        self,
        origin: str,
        dest: str,
        date: str,
    ) -> list[FlightResult]:
        return self.search_one_report(origin, dest, date).results

    def search_one_report(
        self,
        origin: str,
        dest: str,
        date: str,
    ) -> SearchReport:
        all_results: list[FlightResult] = []
        successful_providers: list[str] = []
        failed_providers: list[ProviderFailure] = []

        for provider in self._providers:
            ck = cache.cache_key(
                origin, dest, date,
                seat=self.seat, currency=self.currency,
                stops=self.max_stops, provider=provider.name,
            )

            if self.use_cache:
                cached = cache.get(ck)
                if cached is not None:
                    successful_providers.append(provider.name)
                    all_results.extend(cached)
                    continue

            try:
                results = provider.search(
                    origin, dest, date,
                    cabin=self.seat,
                    currency=self.currency,
                    max_stops=self.max_stops,
                )
            except Exception as exc:
                log.warning(
                    "Provider %s failed for %s->%s %s: %s",
                    provider.name, origin, dest, date, exc,
                )
                failed_providers.append(
                    ProviderFailure(
                        provider=provider.name,
                        error=str(exc) or exc.__class__.__name__,
                    )
                )
                continue

            successful_providers.append(provider.name)
            if self.use_cache:
                cache.put(ck, results)

            all_results.extend(results)

        if len(self._providers) > 1:
            all_results = _deduplicate(all_results)

        return SearchReport(
            results=all_results,
            successful_providers=successful_providers,
            failed_providers=failed_providers,
        )

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
        return self.search_scored_report(
            origin,
            dest,
            date,
            risk_threshold=risk_threshold,
            price_weight=price_weight,
            duration_weight=duration_weight,
            transit_hours=transit_hours,
            max_price=max_price,
        ).results

    def search_scored_report(
        self,
        origin: str,
        dest: str,
        date: str,
        risk_threshold: RiskLevel | None = RiskLevel.HIGH_RISK,
        price_weight: float = 1.0,
        duration_weight: float = 0.5,
        transit_hours: dict[str, float] | None = None,
        max_price: float = 0,
    ) -> ScoredSearchReport:
        search_report = self.search_one_report(origin, dest, date)
        scored = []

        for flight in search_report.results:
            if max_price > 0 and flight.price > 0 and flight.price > max_price:
                continue

            airports = _all_airports(flight.legs)
            risk = check_route(airports)

            # Skip flights at or above the risk threshold
            if risk_threshold is not None and risk.risk_level >= risk_threshold:
                continue

            route = _route_string(origin, dest, flight.legs)
            transit = (transit_hours or {}).get(dest, 0.0)
            total_hours = (flight.duration_minutes / 60) + transit
            price = flight.price if flight.price > 0 else 99999
            score = (price_weight * price) + (duration_weight * total_hours)

            scored.append(
                ScoredFlight(
                    flight=flight,
                    origin=origin,
                    destination=dest,
                    date=date,
                    route=route,
                    risk=risk,
                    score=score,
                    transit_hours=transit,
                )
            )

        return ScoredSearchReport(
            results=scored,
            successful_providers=search_report.successful_providers,
            failed_providers=search_report.failed_providers,
        )

    def scan(
        self,
        config: ScanConfig,
        workers: int = 3,
        delay: float = 1.0,
        on_progress: Callable[[int, int, int], None] | None = None,
        on_result: Callable[[ScoredFlight], None] | None = None,
        risk_threshold_override: RiskLevel | None | _Unset = _UNSET,
    ) -> list[ScoredFlight]:
        return self.scan_report(
            config,
            workers=workers,
            delay=delay,
            on_progress=on_progress,
            on_result=on_result,
            risk_threshold_override=risk_threshold_override,
        ).results

    def scan_report(
        self,
        config: ScanConfig,
        workers: int = 3,
        delay: float = 1.0,
        on_progress: Callable[[int, int, int], None] | None = None,
        on_result: Callable[[ScoredFlight], None] | None = None,
        risk_threshold_override: RiskLevel | None | _Unset = _UNSET,
    ) -> ScanReport:
        dates = config.search.date_range.dates()
        combos = [
            (origin, destination, travel_date)
            for origin in config.search.origins
            for destination in config.search.destinations
            for travel_date in dates
        ]
        total = len(combos)
        if risk_threshold_override is not _UNSET:
            risk_threshold = risk_threshold_override
        else:
            risk_threshold = RiskLevel(config.safety.risk_threshold)
        transit_hours = config.connections.transit_hours
        price_weight = config.scoring.price_weight
        duration_weight = config.scoring.duration_weight
        max_price = config.search.max_price

        all_scored: list[ScoredFlight] = []
        successful_providers: dict[str, int] = {}
        failed_providers: dict[str, int] = {}
        failed_provider_errors: dict[str, str] = {}
        completed = 0
        errors = 0
        consecutive_errors = 0
        effective_delay = delay

        def _search_combo(
            combo: tuple[str, str, str],
        ) -> tuple[str, str, str, ScoredSearchReport | None]:
            origin, dest, travel_date = combo
            try:
                report = self.search_scored_report(
                    origin, dest, travel_date,
                    risk_threshold=risk_threshold,
                    price_weight=price_weight,
                    duration_weight=duration_weight,
                    transit_hours=transit_hours,
                    max_price=max_price,
                )
                return (origin, dest, travel_date, report)
            except Exception as exc:
                log.warning(
                    "Search failed for %s->%s %s: %s",
                    origin, dest, travel_date, exc,
                )
                return (origin, dest, travel_date, None)

        with ThreadPoolExecutor(max_workers=workers) as executor:
            index = 0
            while index < total:
                batch = combos[index:index + workers]
                futures = {executor.submit(_search_combo, combo): combo for combo in batch}

                for future in as_completed(futures):
                    _origin, _dest, _date, report = future.result()
                    completed += 1

                    if report is None:
                        errors += 1
                        consecutive_errors += 1
                        if consecutive_errors >= 3:
                            effective_delay = min(effective_delay * 2, 10.0)
                            log.warning(
                                "Increasing delay to %.1fs after %d consecutive errors",
                                effective_delay, consecutive_errors,
                            )
                    else:
                        if not report.successful_providers and report.failed_providers:
                            errors += 1
                            consecutive_errors += 1
                        else:
                            if consecutive_errors > 0:
                                consecutive_errors = 0
                                effective_delay = max(effective_delay * 0.8, delay)

                        all_scored.extend(report.results)
                        for provider in report.successful_providers:
                            _increment_count(successful_providers, provider)
                        for failure in report.failed_providers:
                            _increment_count(failed_providers, failure.provider)
                            failed_provider_errors.setdefault(
                                failure.provider, failure.error
                            )

                    if on_progress:
                        on_progress(completed, total, errors)

                    if report and report.results and on_result:
                        for scored in report.results:
                            on_result(scored)

                index += len(batch)
                if index < total:
                    time.sleep(effective_delay)

        all_scored.sort(key=lambda scored: scored.score)
        return ScanReport(
            results=all_scored,
            successful_providers=successful_providers,
            failed_providers=failed_providers,
            failed_provider_errors=failed_provider_errors,
        )
