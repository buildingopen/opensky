"""RunIt entry point: exposes OpenSky's SearchEngine as a deployable function."""

import sys
import os

# Add src/ to path so opensky package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from opensky.search import SearchEngine


def search_flights(
    origin: str = "BER",
    destination: str = "LHR",
    date: str = "2026-04-01",
    currency: str = "EUR",
    max_price: float = 500.0,
) -> dict:
    """Search flights between airports. Uses real airline data, no API keys needed."""
    engine = SearchEngine(currency=currency)
    try:
        results = engine.search_scored(
            origin.upper(),
            destination.upper(),
            date,
            max_price=max_price,
        )
        flights = []
        for sf in results:
            f = sf.flight
            flight = {
                "origin": sf.origin,
                "destination": sf.destination,
                "date": sf.date,
                "route": sf.route,
                "price": f.price,
                "currency": f.currency,
                "stops": f.stops,
                "duration_minutes": f.duration_minutes,
                "provider": f.provider,
                "risk_level": sf.risk.risk_level.value,
            }
            if f.booking_url:
                flight["booking_url"] = f.booking_url
            flights.append(flight)

        return {
            "route": f"{origin.upper()} -> {destination.upper()}",
            "date": date,
            "currency": currency,
            "total_results": len(flights),
            "flights": sorted(flights, key=lambda x: x["price"]),
        }
    finally:
        engine.close()
