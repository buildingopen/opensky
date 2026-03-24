from __future__ import annotations

import logging
import os
import re
from typing import Protocol, runtime_checkable

from opensky.models import FlightResult

log = logging.getLogger(__name__)


def _env_value(primary: str, legacy: str) -> str | None:
    return os.environ.get(primary) or os.environ.get(legacy)


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
    """
    providers: list[FlightProvider] = []

    # Duffel
    duffel_token = _env_value("OPENSKY_DUFFEL_TOKEN", "SKYROUTE_DUFFEL_TOKEN")
    if only == "duffel" or (only is None and duffel_token):
        if not duffel_token:
            raise ValueError("OPENSKY_DUFFEL_TOKEN not set (fallback: SKYROUTE_DUFFEL_TOKEN)")
        from opensky.providers.duffel import DuffelProvider

        providers.append(DuffelProvider(token=duffel_token))

    # Amadeus
    amadeus_key = _env_value("OPENSKY_AMADEUS_KEY", "SKYROUTE_AMADEUS_KEY")
    amadeus_secret = _env_value("OPENSKY_AMADEUS_SECRET", "SKYROUTE_AMADEUS_SECRET")
    if only == "amadeus" or (only is None and amadeus_key and amadeus_secret):
        if not amadeus_key or not amadeus_secret:
            raise ValueError(
                "OPENSKY_AMADEUS_KEY and OPENSKY_AMADEUS_SECRET must both be set "
                "(fallback: SKYROUTE_AMADEUS_KEY and SKYROUTE_AMADEUS_SECRET)"
            )
        from opensky.providers.amadeus import AmadeusProvider

        providers.append(AmadeusProvider(key=amadeus_key, secret=amadeus_secret))

    if only and not providers:
        raise ValueError(f"Unknown provider: {only}")

    return providers
