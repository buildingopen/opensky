"""Vendored and simplified from fli (punitarani/fli), MIT license.

https://github.com/punitarani/fli

Changes from original:
- Combined client.py, models/google_flights/base.py, models/google_flights/flights.py,
  and search/flights.py into a single file
- Replaced Airport/Airline enums with plain strings (eliminates 10k+ line enum files)
- Added currency support via URL query parameter
- Added Google consent wall detection
- Reduced default rate limit from 10/s to 3/s for scan workloads
"""

import json
import urllib.parse
from copy import deepcopy
from datetime import datetime
from enum import Enum
from typing import Any

from curl_cffi import requests
from pydantic import (
    BaseModel,
    NonNegativeFloat,
    NonNegativeInt,
    PositiveInt,
    ValidationInfo,
    field_validator,
    model_validator,
)
from ratelimit import limits, sleep_and_retry


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SeatType(Enum):
    ECONOMY = 1
    PREMIUM_ECONOMY = 2
    BUSINESS = 3
    FIRST = 4


class SortBy(Enum):
    NONE = 0
    TOP_FLIGHTS = 1
    CHEAPEST = 2
    DEPARTURE_TIME = 3
    ARRIVAL_TIME = 4
    DURATION = 5


class TripType(Enum):
    ROUND_TRIP = 1
    ONE_WAY = 2


class MaxStops(Enum):
    ANY = 0
    NON_STOP = 1
    ONE_STOP_OR_FEWER = 2
    TWO_OR_FEWER_STOPS = 3


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class TimeRestrictions(BaseModel):
    earliest_departure: NonNegativeInt | None = None
    latest_departure: PositiveInt | None = None
    earliest_arrival: NonNegativeInt | None = None
    latest_arrival: PositiveInt | None = None

    @field_validator("latest_departure", "latest_arrival")
    @classmethod
    def validate_latest_times(
        cls, v: PositiveInt | None, info: ValidationInfo
    ) -> PositiveInt | None:
        if v is None:
            return v
        field_prefix = "earliest_" + info.field_name[7:]
        earliest = info.data.get(field_prefix)
        if earliest is not None and earliest > v:
            info.data[field_prefix] = v
            return earliest
        return v


class PassengerInfo(BaseModel):
    adults: NonNegativeInt = 1
    children: NonNegativeInt = 0
    infants_in_seat: NonNegativeInt = 0
    infants_on_lap: NonNegativeInt = 0


class PriceLimit(BaseModel):
    max_price: PositiveInt


class LayoverRestrictions(BaseModel):
    airports: list[str] | None = None
    max_duration: PositiveInt | None = None


class FlightLeg(BaseModel):
    airline: str
    flight_number: str
    departure_airport: str
    arrival_airport: str
    departure_datetime: datetime
    arrival_datetime: datetime
    duration: PositiveInt


class FlightResult(BaseModel):
    legs: list[FlightLeg]
    price: NonNegativeFloat
    duration: PositiveInt
    stops: NonNegativeInt


class FlightSegment(BaseModel):
    departure_airport: list[list[str | int]]
    arrival_airport: list[list[str | int]]
    travel_date: str
    time_restrictions: TimeRestrictions | None = None
    selected_flight: FlightResult | None = None

    @field_validator("travel_date")
    @classmethod
    def validate_travel_date(cls, v: str) -> str:
        travel_date = datetime.strptime(v, "%Y-%m-%d").date()
        if travel_date < datetime.now().date():
            raise ValueError("Travel date cannot be in the past")
        return v

    @model_validator(mode="after")
    def validate_airports(self) -> "FlightSegment":
        if not self.departure_airport or not self.arrival_airport:
            raise ValueError("Both departure and arrival airports must be specified")
        dep = self.departure_airport[0][0] if isinstance(self.departure_airport[0][0], str) else None
        arr = self.arrival_airport[0][0] if isinstance(self.arrival_airport[0][0], str) else None
        if dep and arr and dep == arr:
            raise ValueError("Departure and arrival airports must be different")
        return self


# ---------------------------------------------------------------------------
# Filter encoder (protobuf-like structure for Google Flights API)
# ---------------------------------------------------------------------------

class FlightSearchFilters(BaseModel):
    trip_type: TripType = TripType.ONE_WAY
    passenger_info: PassengerInfo = PassengerInfo()
    flight_segments: list[FlightSegment]
    stops: MaxStops = MaxStops.ANY
    seat_type: SeatType = SeatType.ECONOMY
    price_limit: PriceLimit | None = None
    airlines: list[str] | None = None
    max_duration: PositiveInt | None = None
    layover_restrictions: LayoverRestrictions | None = None
    sort_by: SortBy = SortBy.CHEAPEST

    def format(self) -> list:
        def serialize(obj: Any) -> Any:
            if isinstance(obj, Enum):
                return obj.value
            if isinstance(obj, list):
                return [serialize(item) for item in obj]
            if isinstance(obj, dict):
                return {key: serialize(value) for key, value in obj.items()}
            if isinstance(obj, BaseModel):
                return serialize(obj.model_dump(exclude_none=True))
            return obj

        formatted_segments = []
        for segment in self.flight_segments:
            segment_filters = [
                [
                    [
                        [serialize(airport[0]), serialize(airport[1])]
                        for airport in segment.departure_airport
                    ]
                ],
                [
                    [
                        [serialize(airport[0]), serialize(airport[1])]
                        for airport in segment.arrival_airport
                    ]
                ],
            ]

            time_filters = None
            if segment.time_restrictions:
                time_filters = [
                    segment.time_restrictions.earliest_departure,
                    segment.time_restrictions.latest_departure,
                    segment.time_restrictions.earliest_arrival,
                    segment.time_restrictions.latest_arrival,
                ]

            airlines_filters = None
            if self.airlines:
                airlines_filters = sorted(self.airlines)

            layover_airports = (
                list(self.layover_restrictions.airports)
                if self.layover_restrictions and self.layover_restrictions.airports
                else None
            )
            layover_duration = (
                self.layover_restrictions.max_duration if self.layover_restrictions else None
            )

            selected_flights = None
            if self.trip_type == TripType.ROUND_TRIP and segment.selected_flight is not None:
                selected_flights = [
                    [
                        leg.departure_airport,
                        leg.departure_datetime.strftime("%Y-%m-%d"),
                        leg.arrival_airport,
                        None,
                        leg.airline,
                        leg.flight_number,
                    ]
                    for leg in segment.selected_flight.legs
                ]

            segment_formatted = [
                segment_filters[0],
                segment_filters[1],
                time_filters,
                serialize(self.stops.value),
                airlines_filters,
                None,
                segment.travel_date,
                [self.max_duration] if self.max_duration else None,
                selected_flights,
                layover_airports,
                None,
                None,
                layover_duration,
                None,
                3,
            ]
            formatted_segments.append(segment_formatted)

        filters = [
            [],
            [
                None,
                None,
                serialize(self.trip_type.value),
                None,
                [],
                serialize(self.seat_type.value),
                [
                    self.passenger_info.adults,
                    self.passenger_info.children,
                    self.passenger_info.infants_on_lap,
                    self.passenger_info.infants_in_seat,
                ],
                [None, self.price_limit.max_price] if self.price_limit else None,
                None,
                None,
                None,
                None,
                None,
                formatted_segments,
                None,
                None,
                None,
                1,
            ],
            serialize(self.sort_by.value),
            0,
            0,
            2,
        ]

        return filters

    def encode(self) -> str:
        formatted_filters = self.format()
        formatted_json = json.dumps(formatted_filters, separators=(",", ":"))
        wrapped_filters = [None, formatted_json]
        return urllib.parse.quote(json.dumps(wrapped_filters, separators=(",", ":")))


# ---------------------------------------------------------------------------
# HTTP client with rate limiting and retry
# ---------------------------------------------------------------------------

class GoogleConsentWallError(Exception):
    """Google returned a consent/cookie page instead of API data."""
    pass


class RateLimitError(Exception):
    """Google returned a 429 or captcha response."""
    pass


class Client:
    DEFAULT_HEADERS = {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    }

    def __init__(self, proxy: str | None = None):
        self._client = requests.Session()
        self._client.headers.update(self.DEFAULT_HEADERS)
        self._proxy = {"https": proxy, "http": proxy} if proxy else None
        self._consecutive_429s = 0
        self._backoff_delay = 0.0

    def close(self) -> None:
        self._client.close()

    def __del__(self) -> None:
        if hasattr(self, "_client"):
            self._client.close()

    @sleep_and_retry
    @limits(calls=3, period=1)
    def post(self, url: str, **kwargs: Any) -> requests.Response:
        import time as _time

        if self._backoff_delay > 0:
            _time.sleep(self._backoff_delay)

        if self._proxy:
            kwargs.setdefault("proxies", self._proxy)

        max_attempts = 4
        for attempt in range(max_attempts):
            try:
                response = self._client.post(url, **kwargs)
            except Exception:
                if attempt == max_attempts - 1:
                    raise
                _time.sleep(2 ** attempt)
                continue

            if response.status_code == 429:
                self._consecutive_429s += 1
                delay = min(2 ** self._consecutive_429s, 30)
                if self._consecutive_429s >= 3:
                    self._backoff_delay = 5.0
                _time.sleep(delay)
                if attempt == max_attempts - 1:
                    raise RateLimitError(
                        f"Rate limited after {max_attempts} retries. "
                        "Reduce --workers or increase --delay."
                    )
                continue

            response.raise_for_status()
            self._consecutive_429s = max(0, self._consecutive_429s - 1)
            if self._consecutive_429s == 0:
                self._backoff_delay = 0.0
            return response

        raise RateLimitError("Max retries exceeded")


# ---------------------------------------------------------------------------
# Flight search: request + response parsing
# ---------------------------------------------------------------------------

class SearchFlights:
    BASE_URL = (
        "https://www.google.com/_/FlightsFrontendUi/data/"
        "travel.frontend.flights.FlightsFrontendService/GetShoppingResults"
    )

    def __init__(self, currency: str = "USD", proxy: str | None = None):
        self.client = Client(proxy=proxy)
        self.currency = currency
        # Set SOCS consent cookie to bypass Google's GDPR consent wall
        # Without this, datacenter IPs get blocked with a consent page
        self.client._client.cookies.set("SOCS", "CAAaBgiA4cLNBg", domain=".google.com")

    def close(self) -> None:
        self.client.close()

    def _build_url(self) -> str:
        params = {"curr": self.currency, "hl": "en"}
        return f"{self.BASE_URL}?{urllib.parse.urlencode(params)}"

    def search(
        self, filters: FlightSearchFilters, top_n: int = 5
    ) -> list[FlightResult] | None:
        encoded_filters = filters.encode()
        url = self._build_url()

        response = self.client.post(
            url=url,
            data=f"f.req={encoded_filters}",
            impersonate="chrome",
            allow_redirects=True,
        )

        text = response.text
        if "<html" in text[:500] or "consent.google.com" in text[:2000]:
            raise GoogleConsentWallError(
                "Google blocked this request (consent wall detected). "
                "Use a residential internet connection or set --proxy."
            )

        parsed = json.loads(text.lstrip(")]}'"))[0][2]
        if not parsed:
            return None

        data = json.loads(parsed)
        flights_data = [
            item
            for i in [2, 3]
            if isinstance(data[i], list)
            for item in data[i][0]
        ]
        flights = [self._parse_flight(f) for f in flights_data]
        flights = self._deduplicate(flights)

        if (
            filters.trip_type == TripType.ONE_WAY
            or filters.flight_segments[0].selected_flight is not None
        ):
            return flights

        # Round-trip: fetch return flights for top N outbound options
        flight_pairs = []
        for selected_flight in flights[:top_n]:
            return_filters = deepcopy(filters)
            return_filters.flight_segments[0].selected_flight = selected_flight
            return_flights = self.search(return_filters, top_n=top_n)
            if return_flights:
                flight_pairs.extend(
                    (selected_flight, rf) for rf in return_flights
                )

        return flight_pairs if flight_pairs else flights

    @staticmethod
    def _deduplicate(flights: list[FlightResult]) -> list[FlightResult]:
        seen: set[str] = set()
        result = []
        for f in flights:
            key = "|".join(
                f"{leg.airline}{leg.flight_number}:{leg.departure_airport}-{leg.arrival_airport}"
                for leg in f.legs
            )
            if key not in seen:
                seen.add(key)
                result.append(f)
        return result

    @staticmethod
    def _parse_flight(data: list) -> FlightResult:
        return FlightResult(
            price=SearchFlights._parse_price(data),
            duration=data[0][9],
            stops=len(data[0][2]) - 1,
            legs=[
                FlightLeg(
                    airline=fl[22][0],
                    flight_number=fl[22][1],
                    departure_airport=fl[3],
                    arrival_airport=fl[6],
                    departure_datetime=SearchFlights._parse_datetime(fl[20], fl[8]),
                    arrival_datetime=SearchFlights._parse_datetime(fl[21], fl[10]),
                    duration=fl[11],
                )
                for fl in data[0][2]
            ],
        )

    @staticmethod
    def _parse_price(data: list) -> float:
        try:
            if data[1] and data[1][0]:
                raw = data[1][0][-1]
                if raw and raw > 0:
                    return float(raw)
        except (IndexError, TypeError):
            pass
        return 0.0

    @staticmethod
    def _parse_datetime(date_arr: list[int], time_arr: list[int]) -> datetime:
        return datetime(*(x or 0 for x in date_arr), *(x or 0 for x in time_arr))
