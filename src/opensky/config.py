from __future__ import annotations

import tomllib
from datetime import date, timedelta
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from opensky.models import RiskLevel

VALID_CABINS = ("economy", "premium_economy", "business", "first")
VALID_STOPS = ("any", "non_stop", "one_stop_or_fewer", "two_or_fewer_stops")
VALID_RISK_THRESHOLDS = tuple(level.value for level in RiskLevel)


class DateRange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: str
    end: str

    @field_validator("start", "end")
    @classmethod
    def validate_date(cls, v: str) -> str:
        date.fromisoformat(v)
        return v

    @model_validator(mode="after")
    def validate_order(self) -> DateRange:
        if date.fromisoformat(self.end) < date.fromisoformat(self.start):
            raise ValueError("end date must be on or after start date")
        return self

    def dates(self) -> list[str]:
        s = date.fromisoformat(self.start)
        e = date.fromisoformat(self.end)
        result = []
        while s <= e:
            result.append(s.isoformat())
            s += timedelta(days=1)
        return result


class SearchConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    origins: list[str]
    destinations: list[str]
    date_range: DateRange
    cabin: str = "economy"
    currency: str = "EUR"
    stops: str = "any"
    max_price: float = 0

    @field_validator("origins", "destinations")
    @classmethod
    def validate_airports(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("must include at least one airport")
        normalized = [airport.upper() for airport in value]
        if any(not airport for airport in normalized):
            raise ValueError("airport codes must not be empty")
        return normalized

    @field_validator("cabin")
    @classmethod
    def validate_cabin(cls, value: str) -> str:
        if value not in VALID_CABINS:
            raise ValueError(f"cabin must be one of: {', '.join(VALID_CABINS)}")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("stops")
    @classmethod
    def validate_stops(cls, value: str) -> str:
        if value not in VALID_STOPS:
            raise ValueError(f"stops must be one of: {', '.join(VALID_STOPS)}")
        return value


class SafetyConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    risk_threshold: str = "high_risk"

    @field_validator("risk_threshold")
    @classmethod
    def validate_risk_threshold(cls, value: str) -> str:
        if value not in VALID_RISK_THRESHOLDS:
            raise ValueError(
                f"risk_threshold must be one of: {', '.join(VALID_RISK_THRESHOLDS)}"
            )
        return value


class ScoringConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    price_weight: float = 1.0
    duration_weight: float = 0.5


class ConnectionsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transit_hours: dict[str, float] = Field(default_factory=dict)

    @field_validator("transit_hours")
    @classmethod
    def validate_transit_hours(cls, value: dict[str, float]) -> dict[str, float]:
        normalized: dict[str, float] = {}
        for airport, hours in value.items():
            if hours < 0:
                raise ValueError("transit hours must be non-negative")
            normalized[airport.upper()] = hours
        return normalized


class ScanConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    search: SearchConfig
    safety: SafetyConfig = Field(default_factory=SafetyConfig)
    scoring: ScoringConfig = Field(default_factory=ScoringConfig)
    connections: ConnectionsConfig = Field(default_factory=ConnectionsConfig)


def load_config(path: str | Path) -> ScanConfig:
    p = Path(path)
    with open(p, "rb") as f:
        data = tomllib.load(f)
    return ScanConfig(**data)


EXAMPLE_CONFIG = """\
[search]
origins = ["BLR", "DEL", "BOM", "KUL", "BKK", "SIN"]
destinations = ["HAM", "FRA", "MUC", "BER", "AMS", "CPH"]
cabin = "economy"
currency = "EUR"
stops = "any"   # any | non_stop | one_stop_or_fewer | two_or_fewer_stops
# max_price = 500  # filter out flights above this price (0 = no limit)

[search.date_range]
start = "2026-04-10"
end = "2026-04-20"

[safety]
risk_threshold = "high_risk"   # filter out: do_not_fly | high_risk | caution

[scoring]
price_weight = 1.0
duration_weight = 0.5

[connections.transit_hours]
HAM = 0
HAJ = 1.5
BER = 2
FRA = 4
MUC = 5.5
AMS = 5
CPH = 5
"""
