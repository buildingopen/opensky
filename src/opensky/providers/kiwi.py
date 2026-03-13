from __future__ import annotations

import logging
from datetime import datetime

import httpx
from ratelimit import limits, sleep_and_retry

from opensky.models import FlightLeg, FlightResult

log = logging.getLogger(__name__)

API_BASE = "https://api.tequila.kiwi.com"

CABIN_MAP: dict[str, str] = {
    "economy": "M",
    "premium_economy": "W",
    "business": "C",
    "first": "F",
}


def _parse_route(route: list[dict], currency: str) -> tuple[list[FlightLeg], int]:
    """Parse Kiwi route array into FlightLeg list and total duration."""
    legs: list[FlightLeg] = []
    total_duration = 0

    for seg in route:
        dep_time = ""
        arr_time = ""
        try:
            dep_time = datetime.utcfromtimestamp(seg.get("dTime", 0)).isoformat()
            arr_time = datetime.utcfromtimestamp(seg.get("aTime", 0)).isoformat()
        except (ValueError, OSError):
            dep_time = seg.get("local_departure", "")
            arr_time = seg.get("local_arrival", "")

        dur = int((seg.get("aTime", 0) - seg.get("dTime", 0)) / 60)
        if dur < 0:
            dur = 0
        total_duration += dur

        legs.append(FlightLeg(
            airline=seg.get("airline", ""),
            flight_number=str(seg.get("flight_no", "")),
            departure_airport=seg.get("flyFrom", ""),
            arrival_airport=seg.get("flyTo", ""),
            departure_time=dep_time,
            arrival_time=arr_time,
            duration_minutes=dur,
        ))

    return legs, total_duration


def _convert_result(item: dict, currency: str) -> FlightResult:
    """Convert a Kiwi search result to FlightResult."""
    legs, total_duration = _parse_route(item.get("route", []), currency)

    return FlightResult(
        price=float(item.get("price", 0)),
        currency=currency,
        duration_minutes=total_duration,
        stops=max(len(legs) - 1, 0),
        legs=legs,
        provider="kiwi",
        booking_url=item.get("deep_link", ""),
    )


class KiwiProvider:
    name = "kiwi"

    def __init__(self, token: str):
        self._client = httpx.Client(
            base_url=API_BASE,
            headers={"apikey": token},
            timeout=30.0,
        )

    @sleep_and_retry
    @limits(calls=5, period=1)
    def search(
        self,
        origin: str,
        dest: str,
        date: str,
        cabin: str,
        currency: str,
        max_stops: int | None,
    ) -> list[FlightResult]:
        # Kiwi uses dd/mm/YYYY format
        try:
            d = datetime.strptime(date, "%Y-%m-%d")
            date_fmt = d.strftime("%d/%m/%Y")
        except ValueError:
            date_fmt = date

        params: dict = {
            "fly_from": origin,
            "fly_to": dest,
            "date_from": date_fmt,
            "date_to": date_fmt,
            "curr": currency,
            "selected_cabins": CABIN_MAP.get(cabin, "M"),
            "adults": 1,
            "limit": 30,
            "sort": "price",
            "one_for_city": 0,
            "flight_type": "oneway",
        }

        if max_stops is not None:
            params["max_stopovers"] = max_stops

        try:
            resp = self._client.get("/v2/search", params=params)
            resp.raise_for_status()
            data = resp.json().get("data", [])
        except httpx.HTTPStatusError as e:
            log.warning("Kiwi API error %s: %s", e.response.status_code, e.response.text[:200])
            return []
        except Exception as e:
            log.warning("Kiwi request failed: %s", e)
            return []

        results = []
        for item in data:
            try:
                results.append(_convert_result(item, currency))
            except Exception as e:
                log.debug("Skipping Kiwi result: %s", e)

        return results

    def close(self) -> None:
        self._client.close()
