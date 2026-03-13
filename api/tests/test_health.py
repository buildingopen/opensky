from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_healthz_returns_ok():
    resp = client.get("/api/healthz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "uptime_seconds" in body


def test_readyz_has_checks_payload():
    resp = client.get("/api/readyz")
    assert resp.status_code in (200, 503)
    body = resp.json()
    if resp.status_code == 200:
        assert body["status"] == "ready"
        assert "checks" in body
