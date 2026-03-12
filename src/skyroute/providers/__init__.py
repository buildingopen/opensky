from __future__ import annotations

import logging
import os
import re
from typing import Protocol, runtime_checkable

from skyroute.models import FlightResult

log = logging.getLogger(__name__)


def parse_iso_duration(iso: str) -> int:
    """Parse ISO 8601 duration like PT2H26M to minutes."""
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", iso or "")
    if not m:
        return 0
    hours = int(m.group(1) or 0)
    minutes = int(m.group(2) or 0)
    return hours * 60 + minutes


@runtime_checkable
class FlightProvider(Protocol):
    name: str

    def search(
        self,
        origin: str,
        dest: str,
        date: str,
        cabin: str,
        currency: str,
        max_stops: int | None,
    ) -> list[FlightResult]: ...

    def close(self) -> None: ...


def configured_providers(
    currency: str = "EUR",
    proxy: str | None = None,
    only: str | None = None,
) -> list[FlightProvider]:
    """Build the list of active providers based on env vars.

    If *only* is set, return just that one provider (or raise ValueError).
    Otherwise, return all providers whose credentials are configured.
    Google is always available (no key needed).
    """
    providers: list[FlightProvider] = []

    # Google: always available
    if only is None or only == "google":
        from skyroute.providers.google import GoogleProvider

        providers.append(GoogleProvider(currency=currency, proxy=proxy))

    # Duffel
    duffel_token = os.environ.get("SKYROUTE_DUFFEL_TOKEN")
    if only == "duffel" or (only is None and duffel_token):
        if not duffel_token:
            raise ValueError("SKYROUTE_DUFFEL_TOKEN not set")
        from skyroute.providers.duffel import DuffelProvider

        providers.append(DuffelProvider(token=duffel_token))

    # Amadeus
    amadeus_key = os.environ.get("SKYROUTE_AMADEUS_KEY")
    amadeus_secret = os.environ.get("SKYROUTE_AMADEUS_SECRET")
    if only == "amadeus" or (only is None and amadeus_key and amadeus_secret):
        if not amadeus_key or not amadeus_secret:
            raise ValueError("SKYROUTE_AMADEUS_KEY and SKYROUTE_AMADEUS_SECRET must both be set")
        from skyroute.providers.amadeus import AmadeusProvider

        providers.append(AmadeusProvider(key=amadeus_key, secret=amadeus_secret))

    if only and not providers:
        raise ValueError(f"Unknown provider: {only}")

    return providers
