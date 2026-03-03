from skyroute.models import RiskLevel
from skyroute.safety import airport_country, check_route, load_zones


def test_load_zones():
    zones = load_zones()
    assert len(zones) > 0
    names = [z.name for z in zones]
    assert "Ukraine" in names
    assert "Iran" in names
    assert "Gulf States (Airspace Risk)" in names


def test_airport_country():
    assert airport_country("DXB") == "AE"
    assert airport_country("HAM") == "DE"
    assert airport_country("THR") == "IR"
    assert airport_country("BLR") == "IN"
    assert airport_country("ZZZZZ") is None


def test_safe_route():
    risk = check_route(["BLR", "MUC", "FRA", "HAM"])
    assert risk.risk_level == RiskLevel.SAFE
    assert risk.is_safe
    assert len(risk.flagged_airports) == 0


def test_gulf_state_high_risk():
    for airport in ["DXB", "AUH", "DOH", "BAH", "KWI"]:
        risk = check_route(["BLR", airport, "HAM"])
        assert risk.risk_level == RiskLevel.HIGH_RISK, f"{airport} not flagged as HIGH_RISK"
        assert len(risk.flagged_airports) == 1
        assert risk.flagged_airports[0].code == airport


def test_country_level_do_not_fly():
    # Iran (country-level)
    risk = check_route(["DEL", "THR", "HAM"])
    assert risk.risk_level == RiskLevel.DO_NOT_FLY
    assert risk.flagged_airports[0].zone_name == "Iran"

    # Iraq (country-level)
    risk = check_route(["DEL", "BGW", "FRA"])
    assert risk.risk_level == RiskLevel.DO_NOT_FLY

    # Syria
    risk = check_route(["IST", "DAM"])
    assert risk.risk_level == RiskLevel.DO_NOT_FLY


def test_caution_level():
    risk = check_route(["IST", "ROV", "HAM"])
    assert risk.risk_level == RiskLevel.CAUTION


def test_worst_risk_wins():
    # Route through both CAUTION and DO_NOT_FLY
    risk = check_route(["BLR", "ROV", "THR", "HAM"])
    assert risk.risk_level == RiskLevel.DO_NOT_FLY
    assert len(risk.flagged_airports) == 2


def test_risk_level_ordering():
    assert RiskLevel.SAFE < RiskLevel.CAUTION
    assert RiskLevel.CAUTION < RiskLevel.HIGH_RISK
    assert RiskLevel.HIGH_RISK < RiskLevel.DO_NOT_FLY
    assert RiskLevel.DO_NOT_FLY > RiskLevel.SAFE
    assert RiskLevel.SAFE <= RiskLevel.SAFE
    assert RiskLevel.DO_NOT_FLY >= RiskLevel.DO_NOT_FLY
