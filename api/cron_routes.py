#!/usr/bin/env python3
"""Daily route cache updater for FlyFast programmatic SEO pages.

Runs on AX41 via cron:
  0 4 * * * cd /root/opensky-app/api && timeout 30m python3 cron_routes.py
"""

import json
import logging
import os
import sys
import time
from datetime import date, timedelta

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

API_BASE = os.environ.get("FLYFAST_API_URL", "https://api.flyfast.app")
API_TOKEN = os.environ.get("INTERNAL_API_TOKEN", "")

ROUTES = [
    # BER outbound (12)
    ("BER", "LHR"), ("BER", "CDG"), ("BER", "BCN"), ("BER", "IST"),
    ("BER", "ATH"), ("BER", "LIS"), ("BER", "FCO"), ("BER", "AMS"),
    ("BER", "NRT"), ("BER", "JFK"), ("BER", "TLV"), ("BER", "DXB"),
    # BER long-haul
    ("BER", "BKK"),
    # FRA outbound (12)
    ("FRA", "JFK"), ("FRA", "NRT"), ("FRA", "SIN"), ("FRA", "BKK"),
    ("FRA", "DEL"), ("FRA", "DXB"),
    ("FRA", "LAX"), ("FRA", "ORD"), ("FRA", "LHR"), ("FRA", "IST"),
    ("FRA", "BCN"), ("FRA", "FCO"),
    # MUC outbound (9)
    ("MUC", "JFK"), ("MUC", "IST"), ("MUC", "ATH"), ("MUC", "BKK"),
    ("MUC", "NRT"), ("MUC", "LHR"), ("MUC", "BCN"), ("MUC", "DEL"),
    ("MUC", "FCO"), ("MUC", "DXB"),
    # HAM outbound (4)
    ("HAM", "LHR"), ("HAM", "IST"), ("HAM", "BCN"), ("HAM", "ATH"),
    # DUS outbound (3)
    ("DUS", "IST"), ("DUS", "BCN"), ("DUS", "ATH"),
    # Reverse routes (2)
    ("LHR", "BER"), ("DEL", "FRA"),
]

CURRENCY = "EUR"
SLEEP_BETWEEN = 2  # seconds between API calls


def run():
    dates = [(date.today() + timedelta(weeks=w)).isoformat() for w in (2, 3, 4)]
    headers = {}
    if API_TOKEN:
        headers["X-Internal-API-Token"] = API_TOKEN

    total = len(ROUTES)
    ok = 0
    fail = 0

    log.info("Starting route cache update: %d routes, dates=%s", total, dates)

    for i, (origin, dest) in enumerate(ROUTES, 1):
        try:
            resp = httpx.post(
                f"{API_BASE}/api/route-snapshot",
                json={"origin": origin, "destination": dest, "dates": dates, "currency": CURRENCY},
                headers=headers,
                timeout=120,
            )
            if resp.status_code == 200:
                data = resp.json()
                sample = data.get("sample_count", 0)
                price_min = data.get("price_min", "?")
                log.info("[%d/%d] %s->%s: %d samples, min=%s %s", i, total, origin, dest, sample, price_min, CURRENCY)
                ok += 1
            else:
                log.warning("[%d/%d] %s->%s: HTTP %d %s", i, total, origin, dest, resp.status_code, resp.text[:200])
                fail += 1
        except Exception as e:
            log.error("[%d/%d] %s->%s failed: %s", i, total, origin, dest, e)
            fail += 1

        if i < total:
            time.sleep(SLEEP_BETWEEN)

    log.info("Done: %d OK, %d failed out of %d routes", ok, fail, total)
    if fail > 0:
        sys.exit(1)


if __name__ == "__main__":
    run()
