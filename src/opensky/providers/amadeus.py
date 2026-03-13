from __future__ import annotations

import logging
import threading
import time

import httpx
from ratelimit import limits, sleep_and_retry

from opensky.models import FlightLeg, FlightResult
from opensky.providers import parse_iso_duration

log = logging.getLogger(__name__)

API_BASE = "https://api.amadeus.com"
TOKEN_URL = f"{API_BASE}/v1/security/oauth2/token"
SEARCH_URL = f"{API_BASE}/v2/shopping/flight-offers"

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

    legs: list[FlightLeg] = []
    total_duration = 0

    for itinerary in offer.get("itineraries", []):
        itin_duration = parse_iso_duration(itinerary.get("duration", ""))
        total_duration += itin_duration

        for seg in itinerary.get("segments", []):
            dep = seg.get("departure", {})
            arr = seg.get("arrival", {})
            dur = parse_iso_duration(seg.get("duration", ""))

            carrier = (
                seg.get("operating", {}).get("carrierCode", "")
                or seg.get("carrierCode", "")
            )
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

    def __init__(self, key: str, secret: str, currency: str = "EUR"):
        self._key = key
        self._secret = secret
        self._currency = currency
        self._client = httpx.Client(timeout=30.0)
        self._token: str | None = None
        self._token_expires_at: float = 0.0
        self._auth_lock = threading.Lock()

    def _authenticate(self) -> str:
        """Get a valid bearer token, refreshing if expired."""
        now = time.monotonic()
        if self._token and now < self._token_expires_at:
            return self._token

        with self._auth_lock:
            # Double-check after acquiring lock
            now = time.monotonic()
            if self._token and now < self._token_expires_at:
                return self._token

            resp = self._client.post(
                TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._key,
                    "client_secret": self._secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            body = resp.json()

            self._token = body["access_token"]
            # Expire 60s early to avoid edge-case failures
            self._token_expires_at = now + body.get("expires_in", 1799) - 60
            return self._token

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
        token = self._authenticate()
        cabin_class = CABIN_MAP.get(cabin, "ECONOMY")

        payload: dict = {
            "currencyCode": currency,
            "originDestinations": [
                {
                    "id": "1",
                    "originLocationCode": origin,
                    "destinationLocationCode": dest,
                    "departureDateTimeRange": {"date": date},
                }
            ],
            "travelers": [{"id": "1", "travelerType": "ADULT"}],
            "sources": ["GDS"],
            "searchCriteria": {
                "maxFlightOffers": 30,
                "flightFilters": {
                    "cabinRestrictions": [
                        {
                            "cabin": cabin_class,
                            "coverage": "MOST_SEGMENTS",
                            "originDestinationIds": ["1"],
                        }
                    ],
                },
            },
        }

        # Direct flights only when max_stops == 0
        if max_stops == 0:
            payload["searchCriteria"]["flightFilters"]["connectionRestrictions"] = {
                "nonStop": True,
            }

        resp = self._client.post(
            SEARCH_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        offers = resp.json().get("data", [])

        results = [_convert_offer(o, currency) for o in offers]

        # Client-side stops filter for cases where max_stops > 0
        if max_stops is not None and max_stops > 0:
            results = [r for r in results if r.stops <= max_stops]

        return results

    def close(self) -> None:
        self._client.close()
