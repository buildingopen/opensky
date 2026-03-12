import tempfile
from pathlib import Path

import pytest

from skyroute.config import EXAMPLE_CONFIG, DateRange, ScanConfig, load_config


def test_date_range():
    dr = DateRange(start="2026-03-10", end="2026-03-12")
    dates = dr.dates()
    assert dates == ["2026-03-10", "2026-03-11", "2026-03-12"]


def test_date_range_single_day():
    dr = DateRange(start="2026-03-10", end="2026-03-10")
    assert dr.dates() == ["2026-03-10"]


def test_load_example_config():
    with tempfile.NamedTemporaryFile(suffix=".toml", mode="w", delete=False) as f:
        f.write(EXAMPLE_CONFIG)
        f.flush()
        cfg = load_config(f.name)

    assert cfg.search.origins == ["BLR", "DEL", "BOM", "KUL", "BKK", "SIN"]
    assert cfg.search.destinations == ["HAM", "FRA", "MUC", "BER", "AMS", "CPH"]
    assert cfg.search.currency == "EUR"
    assert cfg.search.cabin == "economy"
    assert cfg.safety.risk_threshold == "high_risk"
    assert cfg.scoring.price_weight == 1.0
    assert cfg.scoring.duration_weight == 0.5
    assert cfg.connections.transit_hours["HAM"] == 0
    assert cfg.connections.transit_hours["FRA"] == 4

    Path(f.name).unlink()


def test_scan_config_defaults():
    cfg = ScanConfig(
        search={
            "origins": ["BLR"],
            "destinations": ["HAM"],
            "date_range": {"start": "2026-03-10", "end": "2026-03-10"},
        }
    )
    assert cfg.safety.risk_threshold == "high_risk"
    assert cfg.scoring.price_weight == 1.0
    assert cfg.connections.transit_hours == {}


def test_date_range_rejects_reverse_order():
    with pytest.raises(ValueError, match="end date must be on or after start date"):
        DateRange(start="2026-03-12", end="2026-03-10")


def test_scan_config_rejects_invalid_cabin():
    with pytest.raises(ValueError, match="cabin must be one of"):
        ScanConfig(
            search={
                "origins": ["BLR"],
                "destinations": ["HAM"],
                "date_range": {"start": "2026-03-10", "end": "2026-03-10"},
                "cabin": "vip",
            }
        )


def test_scan_config_rejects_invalid_stops():
    with pytest.raises(ValueError, match="stops must be one of"):
        ScanConfig(
            search={
                "origins": ["BLR"],
                "destinations": ["HAM"],
                "date_range": {"start": "2026-03-10", "end": "2026-03-10"},
                "stops": "three_stops",
            }
        )


def test_scan_config_rejects_invalid_risk_threshold():
    with pytest.raises(ValueError, match="risk_threshold must be one of"):
        ScanConfig(
            search={
                "origins": ["BLR"],
                "destinations": ["HAM"],
                "date_range": {"start": "2026-03-10", "end": "2026-03-10"},
            },
            safety={"risk_threshold": "unsafe"},
        )


def test_scan_config_rejects_negative_transit_hours():
    with pytest.raises(ValueError, match="transit hours must be non-negative"):
        ScanConfig(
            search={
                "origins": ["BLR"],
                "destinations": ["HAM"],
                "date_range": {"start": "2026-03-10", "end": "2026-03-10"},
            },
            connections={"transit_hours": {"fra": -1}},
        )


def test_scan_config_rejects_removed_final_destination_field():
    with pytest.raises(ValueError, match="final_destination"):
        ScanConfig(
            search={
                "origins": ["BLR"],
                "destinations": ["HAM"],
                "date_range": {"start": "2026-03-10", "end": "2026-03-10"},
            },
            connections={
                "final_destination": "Hamburg",
                "transit_hours": {"HAM": 0},
            },
        )
