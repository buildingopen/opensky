from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    SAFE = "safe"
    CAUTION = "caution"
    HIGH_RISK = "high_risk"
    DO_NOT_FLY = "do_not_fly"

    @property
    def severity(self) -> int:
        return {
            RiskLevel.SAFE: 0,
            RiskLevel.CAUTION: 1,
            RiskLevel.HIGH_RISK: 2,
            RiskLevel.DO_NOT_FLY: 3,
        }[self]

    def __ge__(self, other: RiskLevel) -> bool:
        return self.severity >= other.severity

    def __gt__(self, other: RiskLevel) -> bool:
        return self.severity > other.severity

    def __le__(self, other: RiskLevel) -> bool:
        return self.severity <= other.severity

    def __lt__(self, other: RiskLevel) -> bool:
        return self.severity < other.severity


class FlaggedAirport(BaseModel):
    code: str
    country: str
    zone_name: str
    risk_level: RiskLevel


class RiskAssessment(BaseModel):
    risk_level: RiskLevel = RiskLevel.SAFE
    flagged_airports: list[FlaggedAirport] = Field(default_factory=list)

    @property
    def is_safe(self) -> bool:
        return self.risk_level == RiskLevel.SAFE


class FlightLeg(BaseModel):
    airline: str
    flight_number: str
    departure_airport: str
    arrival_airport: str
    departure_time: str
    arrival_time: str
    duration_minutes: int


class FlightResult(BaseModel):
    price: float
    currency: str
    duration_minutes: int
    stops: int
    legs: list[FlightLeg]
    provider: str = ""
    booking_url: str = ""


class ScoredFlight(BaseModel):
    flight: FlightResult
    origin: str
    destination: str
    date: str
    route: str
    risk: RiskAssessment
    score: float = 0.0
    transit_hours: float = 0.0


class ConflictZone(BaseModel):
    id: str
    name: str
    risk_level: RiskLevel
    countries: list[str] = Field(default_factory=list)
    airports: list[str] = Field(default_factory=list)
    source: str = ""
    details: str = ""
    updated: str = ""
