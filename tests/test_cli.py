"""CLI tests for provider-related flags and error paths."""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

from typer.testing import CliRunner

from opensky.cli import app
from opensky.models import FlightLeg, FlightResult
from tests.utils import future_date, future_datetime

runner = CliRunner()
DATE = future_date(14)
DEP_TIME = future_datetime(14, 8, 0)
ARR_TIME = future_datetime(14, 18, 0)


class GoodProvider:
    name = "duffel"

    def search(self, *args, **kwargs):
        return [
            FlightResult(
                price=300.0,
                currency="EUR",
                duration_minutes=600,
                stops=0,
                legs=[
                    FlightLeg(
                        airline="LH",
                        flight_number="760",
                        departure_airport="BLR",
                        arrival_airport="HAM",
                        departure_time=DEP_TIME,
                        arrival_time=ARR_TIME,
                        duration_minutes=600,
                    )
                ],
                provider="duffel",
            )
        ]

    def close(self):
        return None


class BadProvider:
    def __init__(self, name: str = "duffel", error: str = "API down"):
        self.name = name
        self.error = error

    def search(self, *args, **kwargs):
        raise RuntimeError(self.error)

    def close(self):
        return None


def _write_scan_config() -> str:
    with tempfile.NamedTemporaryFile(suffix=".toml", mode="w", delete=False) as handle:
        handle.write(
            f"""
[search]
origins = ["BLR"]
destinations = ["HAM"]

[search.date_range]
start = "{DATE}"
end = "{DATE}"
"""
        )
        return handle.name


def test_invalid_provider_name():
    result = runner.invoke(app, ["search", "BLR", "HAM", DATE, "--provider", "fake"])
    assert result.exit_code == 1
    assert "Unknown provider: fake" in result.output


def test_invalid_cabin_name():
    result = runner.invoke(app, ["search", "BLR", "HAM", DATE, "--cabin", "vip"])
    assert result.exit_code == 1
    assert "Unknown cabin: vip" in result.output


def test_invalid_stops_name():
    result = runner.invoke(app, ["search", "BLR", "HAM", DATE, "--stops", "three_stops"])
    assert result.exit_code == 1
    assert "Unknown stops filter: three_stops" in result.output


def test_duffel_missing_env_var():
    with patch.dict(os.environ, {}, clear=True):
        result = runner.invoke(app, ["search", "BLR", "HAM", DATE, "--provider", "duffel"])
    assert result.exit_code == 1
    assert "OPENSKY_DUFFEL_TOKEN" in result.output


def test_amadeus_missing_env_vars():
    with patch.dict(os.environ, {}, clear=True):
        result = runner.invoke(app, ["search", "BLR", "HAM", DATE, "--provider", "amadeus"])
    assert result.exit_code == 1
    assert "OPENSKY_AMADEUS_KEY" in result.output


def test_past_date_rejected():
    result = runner.invoke(app, ["search", "BLR", "HAM", "2020-01-01"])
    assert result.exit_code == 1
    assert "in the past" in result.output


def test_invalid_date_rejected():
    result = runner.invoke(app, ["search", "BLR", "HAM", "not-a-date"])
    assert result.exit_code == 1
    assert "Invalid date" in result.output


def test_search_reports_total_provider_failure():
    with patch("opensky.search.configured_providers", return_value=[BadProvider("duffel", "API error")]):
        result = runner.invoke(app, ["search", "BLR", "HAM", DATE, "--json", "--no-cache"])
    assert result.exit_code == 1
    assert "Search failed: duffel (API error)" in result.output


def test_search_warns_on_partial_results():
    providers = [GoodProvider(), BadProvider("amadeus", "API down")]
    with patch("opensky.search.configured_providers", return_value=providers):
        result = runner.invoke(app, ["search", "BLR", "HAM", DATE, "--json", "--no-cache"])
    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert len(payload) == 1
    assert payload[0]["flight"]["provider"] == "duffel"
    assert "Searching duffel, amadeus..." in result.stderr
    assert "Partial results: amadeus (API down)" in result.stderr


def test_scan_reports_total_provider_failure():
    config_path = _write_scan_config()
    try:
        with patch("opensky.search.configured_providers", return_value=[BadProvider("duffel", "API error")]):
            result = runner.invoke(
                app,
                ["scan", "--config", config_path, "--json", "--workers", "1", "--delay", "0", "--no-cache"],
            )
        assert result.exit_code == 1
        assert "Scan failed: duffel x1 (API error)" in result.output
    finally:
        Path(config_path).unlink(missing_ok=True)


def test_scan_missing_provider_creds_keeps_stdout_clean_in_json_mode():
    config_path = _write_scan_config()
    try:
        with patch.dict(os.environ, {}, clear=True):
            result = runner.invoke(
                app,
                ["scan", "--config", config_path, "--provider", "duffel", "--json"],
            )
        assert result.exit_code == 1
        assert result.stdout == ""
        assert "OPENSKY_DUFFEL_TOKEN" in result.stderr
    finally:
        Path(config_path).unlink(missing_ok=True)


def test_scan_warns_on_partial_results():
    config_path = _write_scan_config()
    try:
        providers = [GoodProvider(), BadProvider("amadeus", "API down")]
        with patch("opensky.search.configured_providers", return_value=providers):
            result = runner.invoke(
                app,
                ["scan", "--config", config_path, "--json", "--workers", "1", "--delay", "0", "--no-cache"],
            )
        assert result.exit_code == 0
        payload = json.loads(result.stdout)
        assert len(payload) == 1
        assert payload[0]["flight"]["provider"] == "duffel"
        assert "Scanning 1 origins x 1 destinations x 1 dates = 1 combos via duffel, amadeus" in result.stderr
        assert "Partial results: amadeus x1 (API down)" in result.stderr
    finally:
        Path(config_path).unlink(missing_ok=True)


def test_demo_json_is_machine_readable():
    result = runner.invoke(app, ["demo", "--json"])
    assert result.exit_code == 0
    payload = json.loads(result.stdout)
    assert len(payload) > 0
