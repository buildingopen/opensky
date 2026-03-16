#!/usr/bin/env python3
"""Zone alert checker for FlyFast. Detects conflict zone risk level changes and notifies subscribers."""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

from html import escape as html_escape
import httpx

sys.path.insert(0, "/opt/opensky/repo/src")

from opensky.safety import load_zones

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)

ALERTS_DB_PATH = os.environ.get("ALERTS_DB_PATH", "/opt/opensky/alerts.db")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = "FlyFast <alerts@flyfast.app>"
SNAPSHOT_PATH = Path("/opt/opensky/zone_risk_snapshot.json")

ZONE_DISPLAY_NAMES: dict[str, str] = {
    "ukraine": "Ukraine", "iran": "Iran", "iraq": "Iraq", "syria": "Syria",
    "israel": "Israel", "lebanon": "Lebanon", "yemen": "Yemen", "libya": "Libya",
    "somalia": "Somalia", "afghanistan": "Afghanistan", "north_korea": "North Korea",
    "sudan": "Sudan", "eritrea": "Eritrea", "ethiopia_partial": "Ethiopia (partial)",
    "mali": "Mali", "niger": "Niger", "gulf_states": "Gulf States",
    "pakistan_partial": "Pakistan (partial)", "russia_partial": "Russia (partial)",
}

RISK_LABELS: dict[str, str] = {
    "do_not_fly": "Do Not Fly",
    "high_risk": "High Risk",
    "caution": "Caution",
    "safe": "Safe",
}

RISK_COLORS: dict[str, str] = {
    "do_not_fly": "#ef4444",
    "high_risk": "#ff6b35",
    "caution": "#f59e0b",
    "safe": "#22c55e",
}


def _send_email(to: str, subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        log.warning("No RESEND_API_KEY, skipping email to %s", to)
        return False
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": FROM_EMAIL, "to": [to], "subject": subject, "html": html},
            timeout=15,
        )
        if resp.status_code in (200, 201):
            log.info("Email sent to %s: %s", to, subject)
            return True
        log.error("Resend error %d: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        log.error("Failed to send email to %s: %s", to, exc)
    return False


def _build_change_email(
    changes: list[dict],
    unsub_token: str,
) -> str:
    unsub_url = f"https://api.flyfast.app/api/zone-alerts/unsubscribe/{unsub_token}"

    rows = ""
    for ch in changes:
        name = html_escape(ch["name"])
        old_label = RISK_LABELS.get(ch["old"], ch["old"])
        new_label = RISK_LABELS.get(ch["new"], ch["new"])
        new_color = RISK_COLORS.get(ch["new"], "#6b7280")
        arrow = "&#x2B06;" if _risk_severity(ch["new"]) > _risk_severity(ch["old"]) else "&#x2B07;"
        rows += f"""<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px">{name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#6b7280">{old_label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px">{arrow}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:{new_color}">{new_label}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:20px;color:#1a1a2e">
  <div style="text-align:center;padding:16px 0;border-bottom:1px solid #e5e7eb">
    <h1 style="margin:0;font-size:20px;font-weight:700">FlyFast</h1>
  </div>
  <div style="padding:24px 0">
    <h2 style="margin:0 0 8px;font-size:18px">Conflict zone risk level changed</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:14px">
      {len(changes)} zone(s) you're monitoring had a risk level change:
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr style="background:#f9fafb">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">Zone</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">Was</th>
        <th style="padding:8px 12px;border-bottom:2px solid #e5e7eb"></th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb">Now</th>
      </tr>
      {rows}
    </table>
    <a href="https://flyfast.app/safety" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      View conflict zone map
    </a>
  </div>
  <div style="padding:16px 0;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
    You're receiving this because you subscribed to zone alerts on FlyFast.<br>
    <a href="{unsub_url}" style="color:#9ca3af">Unsubscribe</a>
  </div>
</body>
</html>"""


def _risk_severity(level: str) -> int:
    return {"safe": 0, "caution": 1, "high_risk": 2, "do_not_fly": 3}.get(level, -1)


def _load_snapshot() -> dict[str, str]:
    if SNAPSHOT_PATH.exists():
        return json.loads(SNAPSHOT_PATH.read_text())
    return {}


def _save_snapshot(snapshot: dict[str, str]) -> None:
    SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT_PATH.write_text(json.dumps(snapshot, indent=2))


def run() -> None:
    log.info("Starting zone alert check...")

    # Load current zone data
    zones = load_zones(force_bundled=False)
    current: dict[str, str] = {}
    for z in zones:
        current[z.id] = z.risk_level.value if hasattr(z.risk_level, "value") else str(z.risk_level)

    log.info("Loaded %d zones from data", len(current))

    # Load previous snapshot
    previous = _load_snapshot()

    if not previous:
        log.info("No previous snapshot found. Saving current state as baseline.")
        _save_snapshot(current)
        return

    # Detect changes
    all_changes: dict[str, dict] = {}
    for zone_id, new_level in current.items():
        old_level = previous.get(zone_id)
        if old_level and old_level != new_level:
            all_changes[zone_id] = {
                "name": ZONE_DISPLAY_NAMES.get(zone_id, zone_id),
                "old": old_level,
                "new": new_level,
            }
            log.info("  Change detected: %s %s -> %s", zone_id, old_level, new_level)

    # Save new snapshot
    _save_snapshot(current)

    if not all_changes:
        log.info("No zone risk level changes detected.")
        _expire_old_alerts()
        return

    log.info("Found %d zone changes. Notifying subscribers...", len(all_changes))

    # Get active subscribers
    conn = sqlite3.connect(ALERTS_DB_PATH)
    conn.row_factory = sqlite3.Row

    # Auto-expire
    conn.execute("UPDATE zone_alerts SET is_active = 0 WHERE is_active = 1 AND expires_at < datetime('now')")
    conn.commit()

    subscribers = conn.execute(
        "SELECT * FROM zone_alerts WHERE is_active = 1 AND expires_at > datetime('now')"
    ).fetchall()

    log.info("Found %d active zone alert subscribers", len(subscribers))
    emailed = 0

    for sub in subscribers:
        sub_zones = set(json.loads(sub["zones"]))
        relevant_changes = [ch for zone_id, ch in all_changes.items() if zone_id in sub_zones]

        if not relevant_changes:
            continue

        html = _build_change_email(relevant_changes, sub["unsubscribe_token"])
        zone_names = [ch["name"] for ch in relevant_changes]
        subject = f"Zone alert: {', '.join(zone_names[:3])}{'...' if len(zone_names) > 3 else ''} risk level changed"

        if _send_email(sub["email"], subject, html):
            now = datetime.now(timezone.utc).isoformat()
            conn.execute("UPDATE zone_alerts SET last_notified = ? WHERE id = ?", (now, sub["id"]))
            conn.commit()
            emailed += 1

    conn.close()
    log.info("Done. %d zone changes, notified %d subscribers.", len(all_changes), emailed)


def _expire_old_alerts() -> None:
    conn = sqlite3.connect(ALERTS_DB_PATH)
    expired = conn.execute(
        "UPDATE zone_alerts SET is_active = 0 WHERE is_active = 1 AND expires_at < datetime('now')"
    ).rowcount
    conn.commit()
    conn.close()
    if expired:
        log.info("Expired %d zone alerts", expired)


if __name__ == "__main__":
    run()
