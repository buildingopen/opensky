from __future__ import annotations

import logging

import httpx
from ratelimit import limits, sleep_and_retry

from opensky.models import FlightLeg, FlightResult
from opensky.providers import parse_iso_duration

log = logging.getLogger(__name__)

API_BASE = "https://api.duffel.com"

CABIN_MAP: dict[str, str] = {
    "economy": "economy",
    "premium_economy": "premium_economy",
    "business": "business",
    "first": "first",
}


def _convert_offer(offer: dict, currency: str) -> FlightResult:
    """Convert a Duffel offer dict to a FlightResult."""
    price = float(offer.get("total_amount", 0))
    offer_currency = offer.get("total_currency", currency)

    legs: list[FlightLeg] = []
    total_duration = 0

    for slc in offer.get("slices", []):
        for seg in slc.get("segments", []):
            dep = seg.get("departing_at", "")
            arr = seg.get("arriving_at", "")
            dur = parse_iso_duration(seg.get("duration", ""))
            total_duration += dur

            carrier = seg.get("operating_carrier", {})
            airline = carrier.get("iata_code", seg.get("marketing_carrier", {}).get("iata_code", ""))
            flight_num = seg.get("operating_carrier_flight_number") or seg.get("marketing_carrier_flight_number") or ""

            legs.append(FlightLeg(
                airline=airline,
                flight_number=flight_num,
                departure_airport=seg.get("origin", {}).get("iata_code", ""),
                arrival_airport=seg.get("destination", {}).get("iata_code", ""),
                departure_time=dep,
                arrival_time=arr,
                duration_minutes=dur,
            ))

    return FlightResult(
        price=price,
        currency=offer_currency,
        duration_minutes=total_duration,
        stops=max(len(legs) - 1, 0),
        legs=legs,
        provider="duffel",
    )


class DuffelProvider:
    name = "duffel"

    def __init__(self, token: str):
        self._token = token
        self._client = httpx.Client(
            base_url=API_BASE,
            headers={
                "Authorization": f"Bearer {token}",
                "Duffel-Version": "v2",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30.0,
        )

    @sleep_and_retry
    @limits(calls=10, period=1)
    def search(
        self,
        origin: str,
        dest: str,
        date: str,
        cabin: str,
        currency: str,
        max_stops: int | None,
    ) -> list[FlightResult]:
        cabin_class = CABIN_MAP.get(cabin, "economy")

        payload = {
            "data": {
                "slices": [
                    {
                        "origin": origin,
                        "destination": dest,
                        "departure_date": date,
                    }
                ],
                "passengers": [{"type": "adult"}],
                "cabin_class": cabin_class,
                "currency": currency,
                "return_offers": True,
                "max_connections": max_stops if max_stops is not None else 2,
            }
        }

        resp = self._client.post("/air/offer_requests", json=payload)
        resp.raise_for_status()
        data = resp.json().get("data", {})
        offers = data.get("offers", [])

        results = [_convert_offer(o, currency) for o in offers]

        # Client-side stops filter (Duffel max_connections is 0-2)
        if max_stops is not None:
            results = [r for r in results if r.stops <= max_stops]

        return results

    def close(self) -> None:
        self._client.close()
