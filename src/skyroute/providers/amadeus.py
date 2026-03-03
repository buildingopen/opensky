from __future__ import annotations

import logging
import time

import httpx
from ratelimit import limits, sleep_and_retry

from skyroute.models import FlightLeg, FlightResult
from skyroute.providers import parse_iso_duration

log = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://test.api.amadeus.com"

CABIN_MAP: dict[str, str] = {
    "economy": "ECONOMY",
    "premium_economy": "PREMIUM_ECONOMY",
    "business": "BUSINESS",
    "first": "FIRST",
}


def _convert_offer(offer: dict, currency: str) -> FlightResult:
    """Convert an Amadeus flight-offer dict to a FlightResult."""
    price = float(offer.get("price", {}).get("grandTotal", 0))
    offer_currency = offer.get("price", {}).get("currency", currency)

    itineraries = offer.get("itineraries", [])
    if not itineraries:
        return FlightResult(
            price=price, currency=offer_currency,
            duration_minutes=0, stops=0, legs=[], provider="amadeus",
        )

    itin = itineraries[0]
    total_duration = parse_iso_duration(itin.get("duration", ""))
    segments = itin.get("segments", [])

    legs: list[FlightLeg] = []
    for seg in segments:
        dep = seg.get("departure", {})
        arr = seg.get("arrival", {})
        dur = parse_iso_duration(seg.get("duration", ""))

        carrier = seg.get("operating", {}).get("carrierCode", seg.get("carrierCode", ""))
        flight_num = seg.get("number", "")

        legs.append(FlightLeg(
            airline=carrier,
            flight_number=flight_num,
            departure_airport=dep.get("iataCode", ""),
            arrival_airport=arr.get("iataCode", ""),
            departure_time=dep.get("at", ""),
            arrival_time=arr.get("at", ""),
            duration_minutes=dur,
        ))

    return FlightResult(
        price=price,
        currency=offer_currency,
        duration_minutes=total_duration,
        stops=max(len(legs) - 1, 0),
        legs=legs,
        provider="amadeus",
    )


class AmadeusProvider:
    name = "amadeus"

    def __init__(
        self,
        key: str,
        secret: str,
        base_url: str = DEFAULT_BASE_URL,
    ):
        self._key = key
        self._secret = secret
        self._base_url = base_url
        self._client = httpx.Client(base_url=base_url, timeout=30.0)
        self._token: str | None = None
        self._token_expires: float = 0

    def _authenticate(self) -> str:
        """Get a valid access token, refreshing if needed."""
        if self._token and time.time() < self._token_expires - 60:
            return self._token

        resp = self._client.post(
            "/v1/security/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": self._key,
                "client_secret": self._secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        data = resp.json()
        self._token = data["access_token"]
        self._token_expires = time.time() + data.get("expires_in", 1799)
        return self._token

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
        token = self._authenticate()
        travel_class = CABIN_MAP.get(cabin, "ECONOMY")

        params: dict[str, str | int | bool] = {
            "originLocationCode": origin,
            "destinationLocationCode": dest,
            "departureDate": date,
            "adults": 1,
            "currencyCode": currency,
            "travelClass": travel_class,
            "max": 50,
        }

        # Amadeus only supports nonStop boolean, not max_stops count
        if max_stops == 0:
            params["nonStop"] = "true"

        resp = self._client.get(
            "/v2/shopping/flight-offers",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        offers = resp.json().get("data", [])

        results = [_convert_offer(o, currency) for o in offers]

        # Client-side stops filter for 1-2 stop limits
        if max_stops is not None and max_stops > 0:
            results = [r for r in results if r.stops <= max_stops]

        return results

    def close(self) -> None:
        self._client.close()
