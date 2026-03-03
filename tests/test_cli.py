"""CLI tests for provider-related flags and error paths."""

import os
from unittest.mock import patch

from typer.testing import CliRunner

from skyroute.cli import app

runner = CliRunner()


def test_invalid_provider_name():
    result = runner.invoke(app, ["search", "BLR", "HAM", "2026-03-10", "--provider", "fake"])
    assert result.exit_code == 1
    assert "Unknown provider: fake" in result.output


def test_duffel_missing_env_var():
    with patch.dict(os.environ, {}, clear=True):
        result = runner.invoke(app, ["search", "BLR", "HAM", "2026-03-10", "--provider", "duffel"])
    assert result.exit_code == 1
    assert "SKYROUTE_DUFFEL_TOKEN" in result.output


def test_amadeus_missing_env_vars():
    with patch.dict(os.environ, {}, clear=True):
        result = runner.invoke(app, ["search", "BLR", "HAM", "2026-03-10", "--provider", "amadeus"])
    assert result.exit_code == 1
    assert "SKYROUTE_AMADEUS_KEY" in result.output


def test_past_date_rejected():
    result = runner.invoke(app, ["search", "BLR", "HAM", "2020-01-01"])
    assert result.exit_code == 1
    assert "in the past" in result.output


def test_invalid_date_rejected():
    result = runner.invoke(app, ["search", "BLR", "HAM", "not-a-date"])
    assert result.exit_code == 1
    assert "Invalid date" in result.output
