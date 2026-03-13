from fastapi.testclient import TestClient

import main


client = TestClient(main.app)


def test_parse_requires_prompt():
    resp = client.post("/api/parse", json={})
    assert resp.status_code == 422


def test_parse_returns_structured_payload(monkeypatch):
    async def fake_parse_prompt(_prompt: str):
        return {
            "origins": ["JFK"],
            "destinations": ["LHR"],
            "dates": ["2026-06-10"],
            "return_dates": [],
            "max_price": 500,
            "currency": "USD",
            "cabin": "economy",
            "stops": "any",
        }

    monkeypatch.setattr(main, "parse_prompt", fake_parse_prompt)
    resp = client.post("/api/parse", json={"prompt": "NYC to London under $500"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["origins"] == ["JFK"]
    assert body["destinations"] == ["LHR"]
    assert body["total_routes"] == 1
