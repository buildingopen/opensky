#!/usr/bin/env python3
"""Daily price alert checker for FlyFast."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from datetime import datetime, timedelta

from html import escape as html_escape
import httpx

from skyroute.search import SearchEngine
from skyroute.models import RiskLevel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)

ALERTS_DB_PATH = os.environ.get("ALERTS_DB_PATH", "/data/alerts.db")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
DUFFEL_TOKEN = os.environ.get("SKYROUTE_DUFFEL_TOKEN", "")
FROM_EMAIL = "FlyFast <alerts@flyfast.app>"
API_BASE = "https://api.flyfast.app"


def _next_fridays(count: int = 3) -> list[str]:
    """Return the next N Fridays as YYYY-MM-DD strings."""
    today = datetime.now(tz=None).date()
    days_until_friday = (4 - today.weekday()) % 7
    if days_until_friday == 0:
        days_until_friday = 7
    fridays = []
    for i in range(count):
        d = today + timedelta(days=days_until_friday + 7 * i)
        fridays.append(d.isoformat())
    return fridays


def _currency_symbol(c: str) -> str:
    return {"EUR": "\u20ac", "USD": "$", "GBP": "\u00a3"}.get(c, c)


def _send_email(to: str, subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        log.warning("No RESEND_API_KEY, skipping email to %s", to)
        return False
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=15,
        )
        if resp.status_code in (200, 201):
            log.info("Email sent to %s: %s", to, subject)
            return True
        log.error("Resend error %d: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        log.error("Failed to send email to %s: %s", to, exc)
    return False


def _build_email_html(
    query: str,
    origin: str,
    dest: str,
    price: float,
    currency: str,
    date: str,
    unsub_token: str,
) -> str:
    sym = _currency_symbol(currency)
    safe_query = html_escape(query)
    gf_url = f"https://www.google.com/travel/flights?q=flights+from+{origin}+to+{dest}+on+{date}"
    unsub_url = f"{API_BASE}/api/alerts/unsubscribe/{unsub_token}"
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#1a1a2e">
  <div style="text-align:center;padding:16px 0;border-bottom:1px solid #e5e7eb">
    <h1 style="margin:0;font-size:20px;font-weight:700">FlyFast</h1>
  </div>
  <div style="padding:24px 0">
    <h2 style="margin:0 0 8px;font-size:18px">Price alert for {safe_query}</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px">
      We found flights from <strong>{origin}</strong> to <strong>{dest}</strong>
      for <strong style="color:#22c55e;font-size:18px">{sym}{price:.0f}</strong> on {date}.
    </p>
    <a href="{gf_url}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      View on Google Flights
    </a>
  </div>
  <div style="padding:16px 0;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
    You're receiving this because you set a price alert on FlyFast.<br>
    <a href="{unsub_url}" style="color:#9ca3af">Unsubscribe</a>
  </div>
</body>
</html>"""


def run() -> None:
    log.info("Starting alert check...")
    conn = sqlite3.connect(ALERTS_DB_PATH)
    conn.row_factory = sqlite3.Row

    # Auto-deactivate expired alerts
    conn.execute("UPDATE alerts SET is_active = 0 WHERE is_active = 1 AND expires_at < datetime('now')")
    conn.commit()

    alerts = conn.execute(
        "SELECT * FROM alerts WHERE is_active = 1 AND expires_at > datetime('now')"
    ).fetchall()

    log.info("Found %d active alerts", len(alerts))
    fridays = _next_fridays(3)
    checked = 0
    emailed = 0

    for alert in alerts:
        alert_id = alert["id"]
        origins = json.loads(alert["origins"])
        destinations = json.loads(alert["destinations"])
        max_price = alert["max_price"]
        last_price = alert["last_price"]
        currency = alert["currency"]
        cabin = alert["cabin"]
        unsub_token = alert["unsubscribe_token"]
        query = alert["query"]
        email = alert["email"]

        log.info("Checking alert %s: %s (%s)", alert_id, query, email)

        engine = SearchEngine(
            currency=currency,
            proxy=None,
            use_cache=True,
            seat=cabin,
        )
        best_price = None
        best_origin = None
        best_dest = None
        best_date = None

        try:
            for origin in origins:
                for dest in destinations:
                    for date in fridays:
                        try:
                            report = engine.search_scored_report(
                                origin, dest, date,
                                risk_threshold=RiskLevel.HIGH_RISK,
                                max_price=max_price if max_price > 0 else 0,
                            )
                            for sf in report.results:
                                if sf.flight.price > 0 and (best_price is None or sf.flight.price < best_price):
                                    best_price = sf.flight.price
                                    best_origin = origin
                                    best_dest = dest
                                    best_date = date
                        except Exception as exc:
                            log.warning("Search failed %s->%s on %s: %s", origin, dest, date, exc)
                            continue
        finally:
            engine.close()

        # Update last_checked
        now = datetime.now(tz=None).isoformat()
        conn.execute(
            "UPDATE alerts SET last_checked = ?, last_price = COALESCE(?, last_price) WHERE id = ?",
            (now, best_price, alert_id),
        )
        conn.commit()
        checked += 1

        if best_price is None:
            log.info("  No prices found for alert %s", alert_id)
            continue

        # Trigger conditions
        should_email = False
        if max_price > 0 and best_price <= max_price:
            log.info("  Price %s <= threshold %s", best_price, max_price)
            should_email = True
        elif last_price and best_price < last_price * 0.85:
            log.info("  Price dropped 15%%+: %s -> %s", last_price, best_price)
            should_email = True

        if should_email:
            html = _build_email_html(
                query, best_origin, best_dest, best_price, currency, best_date, unsub_token
            )
            sym = _currency_symbol(currency)
            safe_subj = query.replace("\r", "").replace("\n", "")
            subject = f"Price drop: {safe_subj} from {sym}{best_price:.0f}"
            if _send_email(email, subject, html):
                emailed += 1

    conn.close()
    log.info("Done. Checked %d alerts, sent %d emails.", checked, emailed)


if __name__ == "__main__":
    run()
