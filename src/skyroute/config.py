from __future__ import annotations

import tomllib
from datetime import date, timedelta
from pathlib import Path

from pydantic import BaseModel, field_validator


class DateRange(BaseModel):
    start: str
    end: str

    @field_validator("start", "end")
    @classmethod
    def validate_date(cls, v: str) -> str:
        date.fromisoformat(v)
        return v

    def dates(self) -> list[str]:
        s = date.fromisoformat(self.start)
        e = date.fromisoformat(self.end)
        result = []
        while s <= e:
            result.append(s.isoformat())
            s += timedelta(days=1)
        return result


class SearchConfig(BaseModel):
    origins: list[str]
    destinations: list[str]
    date_range: DateRange
    cabin: str = "economy"
    currency: str = "EUR"
    stops: str = "any"
    max_price: float = 0


class SafetyConfig(BaseModel):
    risk_threshold: str = "high_risk"


class ScoringConfig(BaseModel):
    price_weight: float = 1.0
    duration_weight: float = 0.5


class ConnectionsConfig(BaseModel):
    final_destination: str = ""
    transit_hours: dict[str, float] = {}


class ScanConfig(BaseModel):
    search: SearchConfig
    safety: SafetyConfig = SafetyConfig()
    scoring: ScoringConfig = ScoringConfig()
    connections: ConnectionsConfig = ConnectionsConfig()


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
start = "2026-03-10"
end = "2026-03-20"

[safety]
risk_threshold = "high_risk"   # filter out: do_not_fly | high_risk | caution

[scoring]
price_weight = 1.0
duration_weight = 0.5

[connections]
final_destination = "Hamburg"

[connections.transit_hours]
HAM = 0
HAJ = 1.5
BER = 2
FRA = 4
MUC = 5.5
AMS = 5
CPH = 5
"""
