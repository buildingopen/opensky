import { describe, it, expect } from "vitest";
import { GET } from "../app/api/og/route";
import { NextRequest } from "next/server";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/og");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe("OG image route", () => {
  it("returns a PNG image with flight data", async () => {
    const res = await GET(makeReq({ route: "Mumbai to Frankfurt", codes: "BOM-FRA", price: "260", currency: "EUR", safety: "safe", stops: "1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
  });

  it("returns a PNG image without flight data (fallback)", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
  });

  it("handles caution safety level", async () => {
    const res = await GET(makeReq({ route: "Istanbul to Tbilisi", codes: "IST-TBS", price: "89", currency: "USD", safety: "caution", stops: "0" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
  });

  it("handles unknown currency gracefully", async () => {
    const res = await GET(makeReq({ route: "Tokyo to Seoul", price: "15000", currency: "KRW", safety: "safe" }));
    expect(res.status).toBe(200);
  });

  it("handles multi-leg routes", async () => {
    const res = await GET(makeReq({ route: "Mumbai to Amman to Frankfurt", codes: "BOM-AMM-FRA", price: "260", currency: "EUR", safety: "safe", stops: "2" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
  });

  it("handles long city names without breaking", async () => {
    const res = await GET(makeReq({ route: "Kuala Lumpur to San Francisco", codes: "KUL-SFO", price: "450", currency: "USD", safety: "safe", stops: "1" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
  });

  it("handles high_risk and do_not_fly safety levels", async () => {
    const high = await GET(makeReq({ route: "Beirut to Tehran", codes: "BEY-IKA", price: "120", safety: "high_risk" }));
    expect(high.status).toBe(200);
    const dnf = await GET(makeReq({ route: "Kyiv to Moscow", codes: "IEV-SVO", price: "300", safety: "do_not_fly" }));
    expect(dnf.status).toBe(200);
  });

  it("handles missing optional params", async () => {
    const res = await GET(makeReq({ route: "Paris to Berlin", price: "75" }));
    expect(res.status).toBe(200);
  });
});
