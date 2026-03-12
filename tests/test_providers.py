"""Unit tests for provider conversion functions."""

import os
import time
from unittest.mock import MagicMock, patch

import pytest

from skyroute.providers import parse_iso_duration
from skyroute.providers.duffel import _convert_offer as duffel_convert
from skyroute.providers.amadeus import _convert_offer as amadeus_convert


# ---- ISO duration parsing (shared) ----

def test_parse_duration_hours_and_minutes():
    assert parse_iso_duration("PT2H26M") == 146

def test_parse_duration_hours_only():
    assert parse_iso_duration("PT3H") == 180

def test_parse_duration_minutes_only():
    assert parse_iso_duration("PT45M") == 45

def test_parse_duration_empty():
    assert parse_iso_duration("") == 0
    assert parse_iso_duration(None) == 0

def test_parse_duration_long_haul():
    assert parse_iso_duration("PT12H30M") == 750


# ---- Duffel offer conversion ----

DUFFEL_OFFER = {
    "total_amount": "357.00",
    "total_currency": "EUR",
    "slices": [
        {
            "segments": [
                {
                    "departing_at": "2026-03-10T08:00:00",
                    "arriving_at": "2026-03-10T12:30:00",
                    "duration": "PT4H30M",
                    "operating_carrier": {"iata_code": "LH"},
                    "operating_carrier_flight_number": "760",
                    "origin": {"iata_code": "BLR"},
                    "destination": {"iata_code": "FRA"},
                },
                {
                    "departing_at": "2026-03-10T14:00:00",
                    "arriving_at": "2026-03-10T15:30:00",
                    "duration": "PT1H30M",
                    "operating_carrier": {"iata_code": "LH"},
                    "operating_carrier_flight_number": "006",
                    "origin": {"iata_code": "FRA"},
                    "destination": {"iata_code": "HAM"},
                },
            ]
        }
    ],
}


def test_duffel_convert_offer():
    result = duffel_convert(DUFFEL_OFFER, "EUR")
    assert result.price == 357.0
    assert result.currency == "EUR"
    assert result.provider == "duffel"
    assert result.stops == 1
    assert len(result.legs) == 2
    assert result.legs[0].airline == "LH"
    assert result.legs[0].flight_number == "760"
    assert result.legs[0].departure_airport == "BLR"
    assert result.legs[0].arrival_airport == "FRA"
    assert result.legs[0].duration_minutes == 270
    assert result.legs[1].departure_airport == "FRA"
    assert result.legs[1].arrival_airport == "HAM"
    assert result.duration_minutes == 360


# ---- Amadeus offer conversion ----

AMADEUS_OFFER = {
    "price": {"grandTotal": "420.50", "currency": "EUR"},
    "itineraries": [
        {
            "duration": "PT10H15M",
            "segments": [
                {
                    "departure": {"iataCode": "BLR", "at": "2026-03-10T02:00:00"},
                    "arrival": {"iataCode": "DXB", "at": "2026-03-10T05:00:00"},
                    "duration": "PT4H30M",
                    "operating": {"carrierCode": "EK"},
                    "carrierCode": "EK",
                    "number": "505",
                },
                {
                    "departure": {"iataCode": "DXB", "at": "2026-03-10T08:00:00"},
                    "arrival": {"iataCode": "HAM", "at": "2026-03-10T12:15:00"},
                    "duration": "PT5H45M",
                    "operating": {"carrierCode": "EK"},
                    "carrierCode": "EK",
                    "number": "057",
                },
            ],
        }
    ],
}


def test_amadeus_convert_offer():
    result = amadeus_convert(AMADEUS_OFFER, "EUR")
    assert result.price == 420.50
    assert result.currency == "EUR"
    assert result.provider == "amadeus"
    assert result.stops == 1
    assert len(result.legs) == 2
    assert result.legs[0].airline == "EK"
    assert result.legs[0].flight_number == "505"
    assert result.legs[0].departure_airport == "BLR"
    assert result.legs[0].arrival_airport == "DXB"
    assert result.duration_minutes == 615


# ---- configured_providers ----

def test_configured_providers_google_always_present():
    from skyroute.providers import configured_providers

    with patch.dict(os.environ, {}, clear=True):
        providers = configured_providers()
    assert len(providers) == 1
    assert providers[0].name == "google"


def test_configured_providers_duffel_with_token():
    from skyroute.providers import configured_providers

    with patch.dict(os.environ, {"SKYROUTE_DUFFEL_TOKEN": "test_token"}, clear=True):
        providers = configured_providers()
    names = [p.name for p in providers]
    assert "google" in names
    assert "duffel" in names


def test_configured_providers_only_filter():
    from skyroute.providers import configured_providers

    with patch.dict(os.environ, {"SKYROUTE_DUFFEL_TOKEN": "test_token"}, clear=True):
        providers = configured_providers(only="duffel")
    assert len(providers) == 1
    assert providers[0].name == "duffel"


def test_configured_providers_amadeus_with_both_keys():
    from skyroute.providers import configured_providers

    env = {"SKYROUTE_AMADEUS_KEY": "test_key", "SKYROUTE_AMADEUS_SECRET": "test_secret"}
    with patch.dict(os.environ, env, clear=True):
        providers = configured_providers()
    names = [p.name for p in providers]
    assert "google" in names
    assert "amadeus" in names


def test_configured_providers_amadeus_missing_secret():
    from skyroute.providers import configured_providers

    with patch.dict(os.environ, {"SKYROUTE_AMADEUS_KEY": "test_key"}, clear=True):
        # Only key set, no secret: amadeus not auto-enabled
        providers = configured_providers()
    names = [p.name for p in providers]
    assert "amadeus" not in names


def test_configured_providers_only_amadeus_missing_creds():
    from skyroute.providers import configured_providers

    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError, match="SKYROUTE_AMADEUS_KEY"):
            configured_providers(only="amadeus")


def test_configured_providers_only_duffel_missing_token():
    from skyroute.providers import configured_providers

    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError, match="SKYROUTE_DUFFEL_TOKEN"):
            configured_providers(only="duffel")


def test_configured_providers_unknown_provider():
    from skyroute.providers import configured_providers

    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError, match="Unknown provider"):
            configured_providers(only="nonexistent")


def test_configured_providers_all_three():
    from skyroute.providers import configured_providers

    env = {
        "SKYROUTE_DUFFEL_TOKEN": "tok",
        "SKYROUTE_AMADEUS_KEY": "key",
        "SKYROUTE_AMADEUS_SECRET": "sec",
    }
    with patch.dict(os.environ, env, clear=True):
        providers = configured_providers()
    names = [p.name for p in providers]
    assert names == ["google", "duffel", "amadeus"]


# ---- Amadeus auth token caching ----

def test_amadeus_auth_caches_token():
    from skyroute.providers.amadeus import AmadeusProvider

    provider = AmadeusProvider(key="k", secret="s")
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"access_token": "tok123", "expires_in": 1799}
    mock_client.post.return_value = mock_resp
    provider._client = mock_client

    # First call: fetches token
    token1 = provider._authenticate()
    assert token1 == "tok123"
    assert mock_client.post.call_count == 1

    # Second call: returns cached token (no new HTTP call)
    token2 = provider._authenticate()
    assert token2 == "tok123"
    assert mock_client.post.call_count == 1


def test_amadeus_auth_refreshes_expired_token():
    from skyroute.providers.amadeus import AmadeusProvider

    provider = AmadeusProvider(key="k", secret="s")
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"access_token": "new_tok", "expires_in": 1799}
    mock_client.post.return_value = mock_resp
    provider._client = mock_client

    # Set an expired token
    provider._token = "old_tok"
    provider._token_expires_at = time.monotonic() - 10  # expired

    token = provider._authenticate()
    assert token == "new_tok"
    assert mock_client.post.call_count == 1


# ---- Duffel mock HTTP search ----

def test_duffel_search_parses_response():
    from skyroute.providers.duffel import DuffelProvider

    provider = DuffelProvider(token="test_tok")
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "data": {
            "offers": [DUFFEL_OFFER],
        }
    }
    mock_client.post.return_value = mock_resp
    provider._client = mock_client

    results = provider.search("BLR", "HAM", "2026-03-10", "economy", "EUR", None)
    assert len(results) == 1
    assert results[0].provider == "duffel"
    assert results[0].price == 357.0
    mock_client.post.assert_called_once()


# ---- Amadeus mock HTTP search ----

def test_amadeus_search_parses_response():
    from skyroute.providers.amadeus import AmadeusProvider

    provider = AmadeusProvider(key="k", secret="s")
    # Pre-set a valid token to skip auth
    provider._token = "valid_tok"
    provider._token_expires_at = time.monotonic() + 600

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"data": [AMADEUS_OFFER]}
    mock_client.post.return_value = mock_resp
    provider._client = mock_client

    results = provider.search("BLR", "HAM", "2026-03-10", "economy", "EUR", None)
    assert len(results) == 1
    assert results[0].provider == "amadeus"
    assert results[0].price == 420.50
    mock_client.post.assert_called_once()
