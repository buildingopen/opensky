"""Integration tests using saved API fixture data."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from skyroute._vendor.google_flights import SearchFlights
from skyroute.models import RiskLevel
from skyroute.search import SearchEngine

FIXTURE = Path(__file__).parent / "fixture_flights_blr_ham.json"


def _load_fixture():
    with open(FIXTURE) as f:
        return json.load(f)


def _make_mock_engine():
    """Create a SearchEngine with a mocked API that returns fixture data."""
    engine = SearchEngine(currency="EUR", use_cache=False)

    flights_data = _load_fixture()
    parsed_flights = [SearchFlights._parse_flight(f) for f in flights_data]
    parsed_flights = SearchFlights._deduplicate(parsed_flights)

    mock_api = MagicMock()
    mock_api.search.return_value = parsed_flights
    engine._api = mock_api

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
