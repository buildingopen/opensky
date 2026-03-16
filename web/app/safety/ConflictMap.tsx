"use client";

import { memo } from "react";
// @ts-expect-error -- react-simple-maps has no types
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { RISK_CONFIG } from "./zones-data";

const GEO_URL = "/countries-110m.json";

// ISO alpha-2 -> ISO 3166-1 numeric for matching topojson
const ISO_NUMERIC: Record<string, string> = {
  UA: "804", IR: "364", IQ: "368", SY: "760", IL: "376", LB: "422",
  YE: "887", LY: "434", SO: "706", AF: "004", KP: "408", SD: "729",
  ER: "232", ET: "231", ML: "466", NE: "562", AE: "784", QA: "634",
  BH: "048", KW: "414", OM: "512", PK: "586", RU: "643",
};

interface Props {
  countryRiskMap: Record<string, string>; // ISO alpha-2 -> risk level
}

function ConflictMapInner({ countryRiskMap }: Props) {
  // Build numeric code -> color map
  const colorMap: Record<string, string> = {};
  const riskPriority: Record<string, number> = { do_not_fly: 3, high_risk: 2, caution: 1 };

  for (const [alpha2, risk] of Object.entries(countryRiskMap)) {
    const num = ISO_NUMERIC[alpha2];
    if (!num) continue;
    const existing = colorMap[num];
    if (!existing || (riskPriority[risk] || 0) > (riskPriority[Object.entries(countryRiskMap).find(([a]) => ISO_NUMERIC[a] === num)?.[1] || ""] || 0)) {
      colorMap[num] = RISK_CONFIG[risk]?.color || "#334155";
    }
  }

  return (
    <div className="mt-6 mb-2">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 140, center: [30, 25] }}
          width={800}
          height={400}
          style={{ width: "100%", height: "auto" }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: Array<{ rsmKey: string; id: string }> }) =>
                geographies.map((geo) => {
                  const fill = colorMap[geo.id] || "#1e293b";
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="#0f172a"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", fill: fill === "#1e293b" ? "#334155" : fill, opacity: 0.85 },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
        {(["do_not_fly", "high_risk", "caution"] as const).map((level) => (
          <span key={level} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: RISK_CONFIG[level].color }}
            />
            {RISK_CONFIG[level].label}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConflictMap = memo(ConflictMapInner);
