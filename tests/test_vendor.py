from datetime import datetime

from skyroute._vendor.google_flights import (
    FlightLeg,
    FlightResult,
    FlightSearchFilters,
    FlightSegment,
    MaxStops,
    PassengerInfo,
    SearchFlights,
    SeatType,
    SortBy,
)


def test_filter_encode_roundtrip():
    """Verify filters encode without errors."""
    filters = FlightSearchFilters(
        flight_segments=[
            FlightSegment(
                departure_airport=[["BLR", 0]],
                arrival_airport=[["HAM", 0]],
                travel_date="2026-03-10",
            )
        ],
        passenger_info=PassengerInfo(adults=1),
        seat_type=SeatType.ECONOMY,
        stops=MaxStops.ANY,
        sort_by=SortBy.CHEAPEST,
    )
    encoded = filters.encode()
    assert isinstance(encoded, str)
    assert len(encoded) > 0
    # Should be URL-encoded JSON
    assert "%22" in encoded or "%5B" in encoded


def test_filter_format_structure():
    filters = FlightSearchFilters(
        flight_segments=[
            FlightSegment(
                departure_airport=[["BLR", 0]],
                arrival_airport=[["HAM", 0]],
                travel_date="2026-03-10",
            )
        ],
    )
    formatted = filters.format()
    assert isinstance(formatted, list)
    assert len(formatted) == 6
    # First element is empty list
    assert formatted[0] == []
    # Sort by value
    assert formatted[2] == SortBy.CHEAPEST.value


def test_deduplicate():
    leg = FlightLeg(
        airline="LH",
        flight_number="765",
        departure_airport="BLR",
        arrival_airport="MUC",
        departure_datetime=datetime(2026, 3, 10, 2, 50),
        arrival_datetime=datetime(2026, 3, 10, 8, 10),
        duration=590,
    )
    f1 = FlightResult(legs=[leg], price=357, duration=590, stops=0)
    f2 = FlightResult(legs=[leg], price=357, duration=590, stops=0)
    f3 = FlightResult(
        legs=[
            FlightLeg(
                airline="EK",
                flight_number="565",
                departure_airport="BLR",
                arrival_airport="DXB",
                departure_datetime=datetime(2026, 3, 10, 4, 30),
                arrival_datetime=datetime(2026, 3, 10, 7, 0),
                duration=270,
            )
        ],
        price=498,
        duration=775,
        stops=0,
    )

    deduped = SearchFlights._deduplicate([f1, f2, f3])
    assert len(deduped) == 2
    assert deduped[0].price == 357
    assert deduped[1].price == 498


def test_parse_price_normal():
    data = [None, [[None, 357], "base64data"]]
    assert SearchFlights._parse_price(data) == 357.0


def test_parse_price_empty():
    data = [None, [[], "base64data"]]
    assert SearchFlights._parse_price(data) == 0.0


def test_parse_price_none():
    data = [None, None]
    assert SearchFlights._parse_price(data) == 0.0


def test_parse_datetime():
    dt = SearchFlights._parse_datetime([2026, 3, 10], [14, 30])
    assert dt == datetime(2026, 3, 10, 14, 30)


def test_parse_datetime_with_nones():
    dt = SearchFlights._parse_datetime([2026, 3, 10], [14, None])
    assert dt == datetime(2026, 3, 10, 14, 0)


def test_string_airports_in_segment():
    """String airport codes work (no enum needed)."""
    seg = FlightSegment(
        departure_airport=[["BLR", 0]],
        arrival_airport=[["HAM", 0]],
        travel_date="2026-03-10",
    )
    assert seg.departure_airport[0][0] == "BLR"
    assert seg.arrival_airport[0][0] == "HAM"


def test_string_airlines_filter():
    """String airline codes sort correctly."""
    filters = FlightSearchFilters(
        flight_segments=[
            FlightSegment(
                departure_airport=[["BLR", 0]],
                arrival_airport=[["HAM", 0]],
                travel_date="2026-03-10",
            )
        ],
        airlines=["LH", "EK", "AI"],
    )
    formatted = filters.format()
    # Airlines should be in the segment structure at index 4
    segment = formatted[1][13][0]
    assert segment[4] == ["AI", "EK", "LH"]  # sorted
