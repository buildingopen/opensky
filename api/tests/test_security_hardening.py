import sqlite3

from fastapi.testclient import TestClient

import main


client = TestClient(main.app)


def _reset_alerts_db(monkeypatch, tmp_path):
    db_path = tmp_path / "alerts.db"
    monkeypatch.setattr(main, "ALERTS_DB_PATH", str(db_path))
    main._init_alerts_db()
    return db_path


def test_parse_hidden_when_public_parse_disabled(monkeypatch):
    monkeypatch.setattr(main, "PUBLIC_PARSE_ENABLED", False)
    monkeypatch.setattr(main, "INTERNAL_API_TOKEN", "")

    resp = client.post("/api/parse", json={"prompt": "NYC to London"})
    assert resp.status_code == 404


def test_alerts_require_internal_token_when_configured(monkeypatch, tmp_path):
    _reset_alerts_db(monkeypatch, tmp_path)
    monkeypatch.setattr(main, "INTERNAL_API_TOKEN", "test-secret")

    resp = client.post(
        "/api/alerts",
        json={
            "email": "test@example.com",
            "query": "JFK to LHR",
            "origins": ["JFK"],
            "destinations": ["LHR"],
        },
    )

    assert resp.status_code == 403


def test_alert_confirmation_and_unsubscribe_flow(monkeypatch, tmp_path):
    db_path = _reset_alerts_db(monkeypatch, tmp_path)
    monkeypatch.setattr(main, "INTERNAL_API_TOKEN", "test-secret")

    create = client.post(
        "/api/alerts",
        headers={"X-Internal-API-Token": "test-secret"},
        json={
            "email": "test@example.com",
            "query": "JFK to LHR",
            "origins": ["JFK"],
            "destinations": ["LHR"],
            "max_price": 500,
            "currency": "USD",
            "cabin": "economy",
        },
    )
    assert create.status_code == 200
    assert "confirm" in create.json()["message"].lower()

    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT confirm_token, unsubscribe_token, is_active, confirmed_at, unsubscribed_at FROM alerts"
    ).fetchone()
    assert row is not None
    confirm_token, unsubscribe_token, is_active, confirmed_at, unsubscribed_at = row
    assert confirm_token
    assert is_active == 0
    assert confirmed_at is None
    assert unsubscribed_at is None

    confirm_page = client.get(f"/api/alerts/confirm/{confirm_token}")
    assert confirm_page.status_code == 200
    assert "Confirm alert" in confirm_page.text

    confirm = client.post(f"/api/alerts/confirm/{confirm_token}")
    assert confirm.status_code == 200
    row = conn.execute(
        "SELECT confirm_token, is_active, confirmed_at FROM alerts WHERE unsubscribe_token = ?",
        (unsubscribe_token,),
    ).fetchone()
    assert row[0] is None
    assert row[1] == 1
    assert row[2] is not None

    unsubscribe_page = client.get(f"/api/alerts/unsubscribe/{unsubscribe_token}")
    assert unsubscribe_page.status_code == 200
    row = conn.execute(
        "SELECT is_active, unsubscribed_at FROM alerts WHERE unsubscribe_token = ?",
        (unsubscribe_token,),
    ).fetchone()
    assert row[0] == 1
    assert row[1] is None

    unsubscribe = client.post(f"/api/alerts/unsubscribe/{unsubscribe_token}")
    assert unsubscribe.status_code == 200
    row = conn.execute(
        "SELECT is_active, unsubscribed_at FROM alerts WHERE unsubscribe_token = ?",
        (unsubscribe_token,),
    ).fetchone()
    conn.close()
    assert row[0] == 0
    assert row[1] is not None
