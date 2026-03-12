from __future__ import annotations

from datetime import date, timedelta


def future_date(days: int = 7) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def future_datetime(days: int = 7, hour: int = 8, minute: int = 0) -> str:
    d = date.today() + timedelta(days=days)
    return f"{d.isoformat()}T{hour:02d}:{minute:02d}:00"
