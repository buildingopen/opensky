import io

from rich.console import Console

from skyroute.display import (
    _best_per_destination,
    _date_matrix,
    _scan_stats,
    _top_flights,
    flights_table,
    format_duration,
    format_price,
    scan_summary,
)
from skyroute.models import (
    FlaggedOverflight,
    FlightLeg,
    FlightResult,
    RiskAssessment,
    RiskLevel,
    ScoredFlight,
)


def test_format_duration():
    assert format_duration(90) == "1h 30m"
    assert format_duration(60) == "1h"
    assert format_duration(45) == "0h 45m"
    assert format_duration(0) == "0h"
    assert format_duration(885) == "14h 45m"


def test_format_price():
    assert format_price(357, "EUR") == "\u20ac357"
    assert format_price(1407, "EUR") == "\u20ac1,407"
    assert format_price(0, "EUR") == "N/A"
    assert format_price(416, "USD") == "$416"
    assert format_price(299, "GBP") == "\u00a3299"
    assert format_price(25000, "INR") == "\u20b925,000"
    assert format_price(100, "CHF") == "CHF 100"


def _make_scored_flight(
    origin: str = "BLR",
    destination: str = "HAM",
    date: str = "2026-03-10",
    price: float = 500,
    currency: str = "EUR",
    duration_minutes: int = 600,
    stops: int = 1,
    score: float = 0.0,
    risk_level: RiskLevel = RiskLevel.SAFE,
) -> ScoredFlight:
    leg = FlightLeg(
        airline="LH",
        flight_number="1234",
        departure_airport=origin,
        arrival_airport=destination,
        departure_time="2026-03-10T08:00:00",
        arrival_time="2026-03-10T18:00:00",
        duration_minutes=duration_minutes,
    )
    flight = FlightResult(
        price=price,
        currency=currency,
        duration_minutes=duration_minutes,
        stops=stops,
        legs=[leg],
    )
    return ScoredFlight(
        flight=flight,
        origin=origin,
        destination=destination,
        date=date,
        route=f"{origin} -> {destination}",
        risk=RiskAssessment(risk_level=risk_level),
        score=score if score else price + duration_minutes * 0.5,
    )


def _capture(func, *args, **kwargs) -> str:
    buf = io.StringIO()
    import skyroute.display as display_mod

    original = display_mod.console
    display_mod.console = Console(file=buf, width=120, no_color=True)
    try:
        func(*args, **kwargs)
    finally:
        display_mod.console = original
    return buf.getvalue()


def test_scan_stats_counts():
    flights = [
        _make_scored_flight(origin="BLR", destination="HAM", date="2026-03-10", price=300),
        _make_scored_flight(origin="DEL", destination="FRA", date="2026-03-11", price=450),
        _make_scored_flight(origin="BLR", destination="FRA", date="2026-03-10", price=600),
    ]
    out = _capture(_scan_stats, flights, "EUR")
    assert "3" in out  # 3 flights
    assert "2" in out  # 2 destinations or 2 origins
    assert "\u20ac300-\u20ac600" in out  # price range with dash


def test_scan_stats_empty():
    out = _capture(_scan_stats, [], "EUR")
    assert "No flights found" in out


def test_scan_stats_same_price():
    flights = [
        _make_scored_flight(price=300),
        _make_scored_flight(price=300),
    ]
    out = _capture(_scan_stats, flights, "EUR")
    assert "Price: \u20ac300" in out
    assert "-" not in out.split("Price:")[1]  # no range dash


def test_best_per_destination_picks_lowest_score():
    flights = [
        _make_scored_flight(destination="HAM", price=500, score=500),
        _make_scored_flight(destination="HAM", price=300, score=300),
        _make_scored_flight(destination="FRA", price=400, score=400),
    ]
    out = _capture(_best_per_destination, flights)
    # Table has one row per destination
    assert "HAM" in out
    assert "FRA" in out
    # Best for HAM is 300
    assert "\u20ac300" in out


def test_date_matrix_handles_mixed_priced():
    flights = [
        _make_scored_flight(destination="HAM", date="2026-03-10", price=300),
        _make_scored_flight(destination="HAM", date="2026-03-11", price=0),  # unpriced
        _make_scored_flight(destination="HAM", date="2026-03-12", price=500),
    ]
    out = _capture(_date_matrix, flights, "EUR")
    assert "03-10" in out
    assert "03-12" in out
    # Unpriced flight (price=0) excluded, so only 03-10 and 03-12 dates
    assert "\u20ac300" in out
    assert "\u20ac500" in out


def test_date_matrix_all_unpriced():
    flights = [
        _make_scored_flight(price=0),
    ]
    out = _capture(_date_matrix, flights, "EUR")
    # No priced flights, no table
    assert out.strip() == ""


def test_top_flights_limits():
    flights = [_make_scored_flight(score=float(i)) for i in range(20)]
    out = _capture(_top_flights, flights, 5)
    assert "Top 5" in out


def test_flights_table_shows_overflight_marker():
    flight = _make_scored_flight(risk_level=RiskLevel.DO_NOT_FLY)
    flight.risk = RiskAssessment(
        risk_level=RiskLevel.DO_NOT_FLY,
        flagged_overflights=[
            FlaggedOverflight(
                country="SY",
                zone_name="Syria",
                risk_level=RiskLevel.DO_NOT_FLY,
                segment="TBS -> AMM",
            )
        ],
    )
    out = _capture(flights_table, [flight])
    assert "OF:SY" in out


def test_scan_summary_empty():
    out = _capture(scan_summary, [], "EUR")
    assert "No flights found" in out


def test_scan_summary_full():
    flights = [
        _make_scored_flight(origin="BLR", destination="HAM", date="2026-03-10", price=300, score=300),
        _make_scored_flight(origin="DEL", destination="FRA", date="2026-03-11", price=450, score=450),
    ]
    out = _capture(scan_summary, flights, "EUR")
    # Stats line
    assert "2" in out  # 2 flights
    # Best per destination table
    assert "HAM" in out
    assert "FRA" in out
    # Date matrix
    assert "03-10" in out
    assert "03-11" in out
    # Top flights table
    assert "Top 2" in out
