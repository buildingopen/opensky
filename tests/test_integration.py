"""Integration tests using saved API fixture data."""

import json
from pathlib import Path
from unittest.mock import MagicMock

from skyroute._vendor.google_flights import SearchFlights
from skyroute.models import FlightLeg, FlightResult, RiskLevel
from skyroute.providers.google import _convert_result
from skyroute.search import SearchEngine

FIXTURE = Path(__file__).parent / "fixture_flights_blr_ham.json"


def _load_fixture():
    with open(FIXTURE) as f:
        return json.load(f)


def _make_mock_engine():
    """Create a SearchEngine with a mocked provider that returns fixture data."""
    engine = SearchEngine(currency="EUR", use_cache=False)

    flights_data = _load_fixture()
    parsed_flights = [SearchFlights._parse_flight(f) for f in flights_data]
    parsed_flights = SearchFlights._deduplicate(parsed_flights)

    domain_results = [_convert_result(f, "EUR") for f in parsed_flights]

    mock_provider = MagicMock()
    mock_provider.name = "google"
    mock_provider.search.return_value = domain_results
    engine._providers = [mock_provider]

    return engine, parsed_flights


def test_search_one_returns_all_flights():
    engine, parsed = _make_mock_engine()
    results = engine.search_one("BLR", "HAM", "2026-03-10")
    assert len(results) == len(parsed)
    engine.close()


def test_search_one_converts_to_domain_models():
    engine, _ = _make_mock_engine()
    results = engine.search_one("BLR", "HAM", "2026-03-10")

    for r in results:
        assert hasattr(r, "price")
        assert hasattr(r, "currency")
        assert r.currency == "EUR"
        assert hasattr(r, "legs")
        for leg in r.legs:
            assert hasattr(leg, "airline")
            assert hasattr(leg, "departure_airport")
            assert hasattr(leg, "arrival_airport")

    engine.close()


def test_search_scored_filters_conflict_zones():
    engine, _ = _make_mock_engine()

    # Default: filter at HIGH_RISK (should remove DXB/DOH routes)
    scored = engine.search_scored("BLR", "HAM", "2026-03-10")
    dxb_flights = [s for s in scored if "DXB" in s.route]
    assert len(dxb_flights) == 0, "DXB flights should be filtered at HIGH_RISK"

    engine.close()


def test_search_scored_show_all_with_none_threshold():
    engine, _ = _make_mock_engine()

    # None threshold: no filtering, all flights returned
    scored = engine.search_scored(
        "BLR", "HAM", "2026-03-10", risk_threshold=None,
    )
    dxb_flights = [s for s in scored if "DXB" in s.route]
    assert len(dxb_flights) > 0, "DXB flights should appear when threshold is None"

    engine.close()


def test_search_scored_risky_flights_have_risk_data():
    engine, _ = _make_mock_engine()

    scored = engine.search_scored(
        "BLR", "HAM", "2026-03-10", risk_threshold=None,
    )
    risky = [s for s in scored if s.risk.risk_level >= RiskLevel.HIGH_RISK]
    assert len(risky) > 0

    for sf in risky:
        assert len(sf.risk.flagged_airports) > 0
        assert sf.risk.risk_level in (RiskLevel.HIGH_RISK, RiskLevel.DO_NOT_FLY)

    engine.close()


def test_search_scored_prices():
    engine, _ = _make_mock_engine()

    scored = engine.search_scored(
        "BLR", "HAM", "2026-03-10", risk_threshold=None,
    )

    priced = [s for s in scored if s.flight.price > 0]
    unpriced = [s for s in scored if s.flight.price == 0]

    assert len(priced) > 0, "Some flights should have prices"
    # Fixture has 2 flights with empty price data
    assert len(unpriced) >= 2, "Fixture has at least 2 flights without prices"

    # Verify known prices from fixture
    prices = sorted(s.flight.price for s in priced)
    assert 357 in prices, "Cheapest Emirates flight should be 357 EUR"

    engine.close()


def test_search_scored_sorting():
    engine, _ = _make_mock_engine()

    scored = engine.search_scored(
        "BLR", "HAM", "2026-03-10", risk_threshold=None,
    )
    scores = [s.score for s in scored]
    # search_scored returns unsorted; CLI sorts. Verify scores are computed.
    assert all(s > 0 for s in scores)

    engine.close()


def test_search_scored_route_strings():
    engine, _ = _make_mock_engine()

    scored = engine.search_scored(
        "BLR", "HAM", "2026-03-10", risk_threshold=None,
    )
    for sf in scored:
        assert sf.route.startswith("BLR")
        assert sf.route.endswith("HAM")
        assert " -> " in sf.route

    engine.close()


# ---- Multi-provider dedup through search_one ----

def _make_leg(airline="LH", num="760", dep="BLR", arr="HAM",
              dep_t="2026-03-10T08:00:00", arr_t="2026-03-10T18:00:00", dur=600):
    return FlightLeg(
        airline=airline, flight_number=num,
        departure_airport=dep, arrival_airport=arr,
        departure_time=dep_t, arrival_time=arr_t, duration_minutes=dur,
    )


def test_search_one_multi_provider_deduplicates():
    """Same flight from two providers: search_one keeps the cheapest."""
    shared_leg = _make_leg()

    google_flight = FlightResult(
        price=400.0, currency="EUR", duration_minutes=600, stops=0,
        legs=[shared_leg], provider="google",
    )
    duffel_flight = FlightResult(
        price=350.0, currency="EUR", duration_minutes=600, stops=0,
        legs=[shared_leg], provider="duffel",
    )

    mock_google = MagicMock()
    mock_google.name = "google"
    mock_google.search.return_value = [google_flight]

    mock_duffel = MagicMock()
    mock_duffel.name = "duffel"
    mock_duffel.search.return_value = [duffel_flight]

    engine = SearchEngine(currency="EUR", use_cache=False)
    engine._providers = [mock_google, mock_duffel]

    results = engine.search_one("BLR", "HAM", "2026-03-10")
    assert len(results) == 1
    assert results[0].price == 350.0
    assert results[0].provider == "duffel"
    engine.close()


def test_search_one_multi_provider_keeps_unique():
    """Different flights from two providers: both kept."""
    google_flight = FlightResult(
        price=400.0, currency="EUR", duration_minutes=600, stops=0,
        legs=[_make_leg(airline="LH", num="760")], provider="google",
    )
    duffel_flight = FlightResult(
        price=350.0, currency="EUR", duration_minutes=540, stops=0,
        legs=[_make_leg(airline="EK", num="505")], provider="duffel",
    )

    mock_google = MagicMock()
    mock_google.name = "google"
    mock_google.search.return_value = [google_flight]

    mock_duffel = MagicMock()
    mock_duffel.name = "duffel"
    mock_duffel.search.return_value = [duffel_flight]

    engine = SearchEngine(currency="EUR", use_cache=False)
    engine._providers = [mock_google, mock_duffel]

    results = engine.search_one("BLR", "HAM", "2026-03-10")
    assert len(results) == 2
    providers = {r.provider for r in results}
    assert providers == {"google", "duffel"}
    engine.close()


def test_search_one_provider_failure_still_returns_others():
    """One provider failing doesn't block results from the other."""
    good_flight = FlightResult(
        price=300.0, currency="EUR", duration_minutes=600, stops=0,
        legs=[_make_leg()], provider="google",
    )

    mock_google = MagicMock()
    mock_google.name = "google"
    mock_google.search.return_value = [good_flight]

    mock_duffel = MagicMock()
    mock_duffel.name = "duffel"
    mock_duffel.search.side_effect = RuntimeError("API down")

    engine = SearchEngine(currency="EUR", use_cache=False)
    engine._providers = [mock_google, mock_duffel]

    results = engine.search_one("BLR", "HAM", "2026-03-10")
    assert len(results) == 1
    assert results[0].provider == "google"
    engine.close()
