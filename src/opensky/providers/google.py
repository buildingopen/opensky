from __future__ import annotations

from typing import Any

from opensky._vendor.google_flights import (
    FlightSearchFilters,
    FlightSegment,
    MaxStops,
    PassengerInfo,
    SeatType,
    SearchFlights,
    SortBy,
)
from opensky.models import FlightLeg, FlightResult

SEAT_MAP: dict[str, SeatType] = {
    "economy": SeatType.ECONOMY,
    "premium_economy": SeatType.PREMIUM_ECONOMY,
    "business": SeatType.BUSINESS,
    "first": SeatType.FIRST,
}

STOPS_MAP: dict[int | None, MaxStops] = {
    None: MaxStops.ANY,
    0: MaxStops.NON_STOP,
    1: MaxStops.ONE_STOP_OR_FEWER,
    2: MaxStops.TWO_OR_FEWER_STOPS,
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
        provider="google",
    )


class GoogleProvider:
    name = "google"

    def __init__(self, currency: str = "EUR", proxy: str | None = None):
        self._currency = currency
        self._proxy = proxy
        self._api: SearchFlights | None = None

    def _get_api(self) -> SearchFlights:
        if self._api is None:
            self._api = SearchFlights(currency=self._currency, proxy=self._proxy)
        return self._api

    def search(
        self,
        origin: str,
        dest: str,
        date: str,
        cabin: str,
        currency: str,
        max_stops: int | None,
    ) -> list[FlightResult]:
        seat = SEAT_MAP.get(cabin, SeatType.ECONOMY)
        stops = STOPS_MAP.get(max_stops, MaxStops.ANY)
        filters = _build_filters(origin, dest, date, seat, stops)
        api = self._get_api()
        raw_results = api.search(filters)
        if not raw_results:
            return []
        return [_convert_result(r, currency) for r in raw_results]

    def close(self) -> None:
        if self._api:
            self._api.close()
            self._api = None
