"""Unit tests for flight deduplication logic."""

from opensky.models import FlightLeg, FlightResult
from opensky.search import _deduplicate


def _make_flight(
    airline: str = "LH",
    flight_num: str = "760",
    dep: str = "BLR",
    arr: str = "HAM",
    price: float = 300.0,
    provider: str = "duffel",
) -> FlightResult:
    return FlightResult(
        price=price,
        currency="EUR",
        duration_minutes=600,
        stops=0,
        legs=[
            FlightLeg(
                airline=airline,
                flight_number=flight_num,
                departure_airport=dep,
                arrival_airport=arr,
                departure_time="2026-03-10T08:00:00",
                arrival_time="2026-03-10T18:00:00",
                duration_minutes=600,
            )
        ],
        provider=provider,
    )


def test_same_flight_different_prices_keeps_cheapest():
    f1 = _make_flight(price=400.0, provider="amadeus")
    f2 = _make_flight(price=350.0, provider="duffel")
    result = _deduplicate([f1, f2])
    assert len(result) == 1
    assert result[0].price == 350.0
    assert result[0].provider == "duffel"


def test_different_flights_keeps_both():
    f1 = _make_flight(airline="LH", flight_num="760")
    f2 = _make_flight(airline="EK", flight_num="505")
    result = _deduplicate([f1, f2])
    assert len(result) == 2


def test_priced_preferred_over_unpriced():
    f1 = _make_flight(price=0.0, provider="amadeus")
    f2 = _make_flight(price=300.0, provider="duffel")
    result = _deduplicate([f1, f2])
    assert len(result) == 1
    assert result[0].price == 300.0
    assert result[0].provider == "duffel"


def test_both_unpriced_keeps_first():
    f1 = _make_flight(price=0.0, provider="amadeus")
    f2 = _make_flight(price=0.0, provider="duffel")
    result = _deduplicate([f1, f2])
    assert len(result) == 1
    assert result[0].provider == "amadeus"


def test_single_flight_no_change():
    f1 = _make_flight(price=250.0)
    result = _deduplicate([f1])
    assert len(result) == 1
    assert result[0].price == 250.0


def test_empty_list():
    assert _deduplicate([]) == []
