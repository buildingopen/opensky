import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const route = params.get("route") || ""; // City names: "Mumbai to Frankfurt"
  const codes = params.get("codes") || ""; // IATA codes: "BOM-FRA"
  const price = params.get("price") || "";
  const currency = params.get("currency") || "EUR";
  const safety = params.get("safety") || "safe";
  const stops = params.get("stops") || "";

  const currencySymbol: Record<string, string> = {
    EUR: "\u20ac", USD: "$", GBP: "\u00a3", INR: "\u20b9",
    JPY: "\u00a5", AUD: "A$", CAD: "C$", CHF: "CHF",
  };
  const sym = currencySymbol[currency.toUpperCase()] || currency;

  const safetyConfig: Record<string, { label: string; color: string }> = {
    safe: { label: "Safe route", color: "#22c55e" },
    caution: { label: "Caution zone", color: "#f59e0b" },
    high_risk: { label: "High risk", color: "#ff6b35" },
    do_not_fly: { label: "Do not fly", color: "#ef4444" },
  };
  const s = safetyConfig[safety] || safetyConfig.safe;

  const hasData = route && price;
  const stopsLabel = stops === "0" ? "Nonstop" : stops === "1" ? "1 stop" : stops ? `${stops} stops` : "";
  // Show city names with arrow, e.g. "Mumbai \u2192 Frankfurt"
  const routeDisplay = route.includes(" to ") ? route.replaceAll(" to ", " \u2192 ") : route.replaceAll("->", " \u2192 ");
  // Show IATA codes as subtitle if available
  const codesDisplay = codes ? codes.replaceAll("-", " \u2192 ") : "";
  // Scale font for long routes (multi-leg or long city names)
  const routeFontSize = routeDisplay.length > 30 ? "48px" : "64px";

  const badges: Array<{ text: string; color: string; bg: string; border: string; dot?: boolean }> = [];
  if (stopsLabel) {
    badges.push({ text: stopsLabel, color: "#94a3b8", bg: "transparent", border: "#334155" });
  }
  badges.push({ text: s.label, color: s.color, bg: `${s.color}15`, border: `${s.color}40`, dot: true });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0A0F1A",
          padding: "60px 70px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
            <path d="M3 12l9-8v5h8l-9 8v-5H3z" fill="#22c55e" />
          </svg>
          <div style={{ display: "flex" }}>
            <span style={{ fontSize: "32px", fontWeight: 700, color: "#22c55e", letterSpacing: "-0.5px" }}>fly</span>
            <span style={{ fontSize: "32px", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.5px" }}>fast</span>
          </div>
        </div>

        {hasData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div
                style={{
                  fontSize: routeFontSize,
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: "-1px",
                  display: "flex",
                }}
              >
                {routeDisplay}
              </div>
              {codesDisplay && (
                <span style={{ fontSize: "24px", color: "#64748b" }}>{codesDisplay}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <span style={{ fontSize: "52px", fontWeight: 700, color: "#22c55e" }}>
                {`from ${sym}${price}`}
              </span>
              {badges.map((b, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "24px",
                    color: b.color,
                    padding: "6px 16px",
                    borderRadius: "8px",
                    border: `1px solid ${b.border}`,
                    backgroundColor: b.bg,
                  }}
                >
                  {b.dot && (
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: b.color }} />
                  )}
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: "56px", fontWeight: 700, color: "#ffffff", letterSpacing: "-1px", display: "flex" }}>
              Describe your trip.
            </div>
            <div style={{ fontSize: "28px", color: "#94a3b8", display: "flex" }}>
              Every flight on Google Flights. Conflict zones filtered.
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "22px", color: "#64748b" }}>Prompt to fly. Free, no login.</span>
          <span style={{ fontSize: "22px", color: "#64748b" }}>flyfast.app</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
