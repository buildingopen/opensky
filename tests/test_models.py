from opensky.models import (
    FlightLeg,
    FlightResult,
    RiskAssessment,
    RiskLevel,
    ScoredFlight,
)


def test_flight_result_serialization():
    fr = FlightResult(
        price=357.0,
        currency="EUR",
        duration_minutes=790,
        stops=1,
        legs=[
            FlightLeg(
                airline="EK",
                flight_number="565",
                departure_airport="BLR",
                arrival_airport="DXB",
                departure_time="2026-03-10T04:30:00",
                arrival_time="2026-03-10T07:00:00",
                duration_minutes=270,
            ),
            FlightLeg(
                airline="EK",
                flight_number="61",
                departure_airport="DXB",
                arrival_airport="HAM",
                departure_time="2026-03-10T09:15:00",
                arrival_time="2026-03-10T13:45:00",
                duration_minutes=420,
            ),
        ],
    )
    d = fr.model_dump()
    assert d["price"] == 357.0
    assert d["currency"] == "EUR"
    assert len(d["legs"]) == 2
    assert d["legs"][0]["airline"] == "EK"


def test_risk_assessment_safe():
    ra = RiskAssessment()
    assert ra.is_safe
    assert ra.risk_level == RiskLevel.SAFE


def test_risk_assessment_flagged():
    from opensky.models import FlaggedAirport, FlaggedOverflight

    ra = RiskAssessment(
        risk_level=RiskLevel.HIGH_RISK,
        flagged_airports=[
            FlaggedAirport(
                code="DXB", country="AE",
                zone_name="Gulf States", risk_level=RiskLevel.HIGH_RISK,
            )
        ],
        flagged_overflights=[
            FlaggedOverflight(
                country="SY",
                zone_name="Syria",
                risk_level=RiskLevel.DO_NOT_FLY,
                segment="TBS -> AMM",
            )
        ],
    )
    assert not ra.is_safe
    assert ra.flagged_airports[0].code == "DXB"
    assert ra.flagged_overflights[0].country == "SY"


def test_scored_flight_json_roundtrip():
    sf = ScoredFlight(
        flight=FlightResult(
            price=357.0, currency="EUR", duration_minutes=790, stops=1,
            legs=[
                FlightLeg(
                    airline="EK", flight_number="565",
                    departure_airport="BLR", arrival_airport="DXB",
                    departure_time="2026-03-10T04:30:00",
                    arrival_time="2026-03-10T07:00:00",
                    duration_minutes=270,
                ),
            ],
        ),
        origin="BLR", destination="HAM", date="2026-03-10",
        route="BLR -> DXB -> HAM",
        risk=RiskAssessment(risk_level=RiskLevel.HIGH_RISK),
        score=364.0,
    )
    json_str = sf.model_dump_json()
    assert '"BLR"' in json_str
    assert '"high_risk"' in json_str
