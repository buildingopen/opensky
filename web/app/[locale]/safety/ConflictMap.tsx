"use client";

import { memo, useState, useCallback, useEffect, useRef, useMemo } from "react";
// @ts-expect-error -- react-simple-maps has no types
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { RISK_CONFIG, ZOOM_REGIONS, NUMERIC_TO_ALPHA2, type ConflictZone } from "./zones-data";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const GEO_URL = "/countries-110m.json";

// ISO alpha-2 -> ISO 3166-1 numeric for matching topojson (conflict zone countries only)
const ISO_NUMERIC: Record<string, string> = {
  UA: "804", IR: "364", IQ: "368", SY: "760", IL: "376", LB: "422",
  YE: "887", LY: "434", SO: "706", AF: "004", KP: "408", SD: "729",
  ER: "232", ET: "231", ML: "466", NE: "562", AE: "784", QA: "634",
  BH: "048", KW: "414", OM: "512", PK: "586", RU: "643",
};

interface ZoneMapData {
  id: string;
  name: string;
  risk_level: string;
  details: string;
  flags: string[];
  countries: string[];
}

interface Props {
  countryRiskMap: Record<string, string>;
  zones: ZoneMapData[];
  countryToZone: Record<string, string>; // alpha-2 -> zone id
  activeFilter: string | null;
  onCountryHover?: (zoneId: string | null) => void;
}

interface TooltipData {
  x: number;
  y: number;
  zone: ZoneMapData | null;
  countryName: string;
  countryAlpha2: string | null;
}

function ConflictMapInner({ countryRiskMap, zones, countryToZone, activeFilter, onCountryHover }: Props) {
  const router = useRouter();
  const t = useTranslations("safety");
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const tooltipZoneRef = useRef<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [30, 25],
    zoom: 1,
  });

  // Detect touch device (state so tooltip text re-renders)
  useEffect(() => {
    const onTouch = () => { setIsTouch(true); };
    window.addEventListener("touchstart", onTouch, { once: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, []);

  // Close tooltip on tap outside (mobile)
  useEffect(() => {
    if (!tooltip) return;
    const handler = (e: TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setTooltip(null);
        tooltipZoneRef.current = null;
        onCountryHover?.(null);
      }
    };
    document.addEventListener("touchstart", handler);
    return () => document.removeEventListener("touchstart", handler);
  }, [tooltip, onCountryHover]);

  // Auto-zoom when filter changes
  useEffect(() => {
    let frame = 0;
    if (activeFilter && ZOOM_REGIONS[activeFilter]) {
      const region = ZOOM_REGIONS[activeFilter];
      frame = window.requestAnimationFrame(() => {
        setPosition({ coordinates: region.center, zoom: region.zoom });
      });
    } else if (!activeFilter) {
      frame = window.requestAnimationFrame(() => {
        setPosition({ coordinates: [30, 25], zoom: 1 });
      });
    }
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [activeFilter]);

  // Build numeric code -> color map
  const colorMap: Record<string, string> = {};
  for (const [alpha2, risk] of Object.entries(countryRiskMap)) {
    const num = ISO_NUMERIC[alpha2];
    if (!num) continue;
    colorMap[num] = RISK_CONFIG[risk]?.color || "#3f3f46";
  }

  // Dimmed set: when filter active, dim countries not in this risk level
  const dimmedSet = new Set<string>();
  if (activeFilter) {
    for (const [alpha2, risk] of Object.entries(countryRiskMap)) {
      if (risk !== activeFilter) {
        const num = ISO_NUMERIC[alpha2];
        if (num) dimmedSet.add(num);
      }
    }
  }

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);

  const getFill = (geoId: string) => {
    const base = colorMap[geoId] || "var(--color-geo-default)";
    if (dimmedSet.has(geoId)) return "var(--color-geo-default)";
    return base;
  };

  const resolveZone = useCallback(
    (geoId: string): { zoneId: string; zone: ZoneMapData } | null => {
      const alpha = NUMERIC_TO_ALPHA2[geoId]?.toUpperCase();
      if (!alpha) return null;
      const zoneId = countryToZone[alpha];
      if (!zoneId) return null;
      const zone = zoneMap.get(zoneId);
      if (!zone) return null;
      return { zoneId, zone };
    },
    [countryToZone, zoneMap],
  );

  const updateTooltip = useCallback(
    (data: Omit<TooltipData, "x" | "y">, event: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const TOOLTIP_W = 240;
      const TOOLTIP_H = 120;

      let x = event.clientX - rect.left;
      let y = event.clientY - rect.top;

      x = Math.max(TOOLTIP_W / 2, Math.min(x, rect.width - TOOLTIP_W / 2));
      if (y < TOOLTIP_H + 16) {
        y = event.clientY - rect.top + TOOLTIP_H + 8;
      }

      setTooltip({ ...data, x, y });
    },
    [],
  );

  const buildTooltipData = useCallback(
    (geoId: string, geoName: string): Omit<TooltipData, "x" | "y"> => {
      const result = resolveZone(geoId);
      if (result) {
        return { zone: result.zone, countryName: result.zone.name, countryAlpha2: null };
      }
      const alpha2 = NUMERIC_TO_ALPHA2[geoId] || null;
      return { zone: null, countryName: geoName, countryAlpha2: alpha2 };
    },
    [resolveZone],
  );

  const handleGeoMouseEnter = useCallback(
    (geoId: string, geoName: string, event: React.MouseEvent) => {
      if (isTouch) return;
      const result = resolveZone(geoId);
      tooltipZoneRef.current = result?.zoneId || null;
      onCountryHover?.(result?.zoneId || null);
      const data = buildTooltipData(geoId, geoName);
      if (data.countryName) updateTooltip(data, event);
    },
    [isTouch, resolveZone, onCountryHover, updateTooltip, buildTooltipData],
  );

  const handleGeoMouseMove = useCallback(
    (geoId: string, geoName: string, event: React.MouseEvent) => {
      if (isTouch) return;
      const data = buildTooltipData(geoId, geoName);
      if (data.countryName) updateTooltip(data, event);
    },
    [isTouch, buildTooltipData, updateTooltip],
  );

  const handleGeoMouseLeave = useCallback(() => {
    if (isTouch) return;
    setTooltip(null);
    tooltipZoneRef.current = null;
    onCountryHover?.(null);
  }, [isTouch, onCountryHover]);

  const handleGeoClick = useCallback(
    (geoId: string, geoName: string, event: React.MouseEvent) => {
      const result = resolveZone(geoId);

      if (isTouch) {
        // Zone country: first tap = tooltip, second tap = navigate
        if (result) {
          if (tooltipZoneRef.current === result.zoneId) {
            router.push(`/safety/${result.zoneId}`);
          } else {
            tooltipZoneRef.current = result.zoneId;
            onCountryHover?.(result.zoneId);
            updateTooltip(buildTooltipData(geoId, geoName), event);
          }
          return;
        }
        // Non-zone country: just show tooltip
        const data = buildTooltipData(geoId, geoName);
        if (data.countryName) {
          tooltipZoneRef.current = null;
          onCountryHover?.(null);
          updateTooltip(data, event);
        }
        return;
      }

      // Desktop click: navigate to zone page if it's a zone country
      if (result) {
        router.push(`/safety/${result.zoneId}`);
      }
    },
    [resolveZone, router, isTouch, onCountryHover, updateTooltip, buildTooltipData],
  );

  const handleZoomIn = () => {
    setPosition((p) => ({ ...p, zoom: Math.min(p.zoom * 1.5, 8) }));
  };

  const handleZoomOut = () => {
    setPosition((p) => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) }));
  };

  const handleReset = () => {
    setPosition({ coordinates: [30, 25], zoom: 1 });
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden h-[350px] lg:h-[600px]">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 140, center: [30, 25] }}
          width={800}
          height={450}
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <ZoomableGroup
            center={position.coordinates}
            zoom={position.zoom}
            onMoveEnd={({ coordinates, zoom }: { coordinates: [number, number]; zoom: number }) => {
              setPosition({ coordinates, zoom });
            }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }: { geographies: Array<{ rsmKey: string; id: string; properties?: { name?: string } }> }) =>
                geographies.map((geo) => {
                  const fill = getFill(geo.id);
                  const isZoneCountry = !!colorMap[geo.id] && !dimmedSet.has(geo.id);
                  const geoName = geo.properties?.name || "";
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke="var(--color-geo-stroke)"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none", cursor: isZoneCountry ? "pointer" : "default" },
                        hover: {
                          outline: "none",
                          fill: isZoneCountry ? fill : fill === "var(--color-geo-default)" ? "var(--color-geo-hover)" : fill,
                          opacity: isZoneCountry ? 0.8 : 1,
                          cursor: isZoneCountry ? "pointer" : "default",
                        },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={(e: React.MouseEvent) => handleGeoMouseEnter(geo.id, geoName, e)}
                      onMouseMove={(e: React.MouseEvent) => handleGeoMouseMove(geo.id, geoName, e)}
                      onMouseLeave={handleGeoMouseLeave}
                      onClick={(e: React.MouseEvent) => handleGeoClick(geo.id, geoName, e)}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors text-lg font-medium"
          aria-label={t("zoomIn")}
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-11 h-11 flex items-center justify-center rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors text-lg font-medium"
          aria-label={t("zoomOut")}
        >
          -
        </button>
        {position.zoom > 1 && (
          <button
            onClick={handleReset}
            className="w-11 h-11 flex items-center justify-center rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
            aria-label={t("resetZoom")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
            </svg>
          </button>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl px-3 py-2.5 min-w-[200px] max-w-[280px]">
            {tooltip.zone ? (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  {tooltip.zone.flags.length > 0 && (
                    <div className="flex gap-1 shrink-0">
                      {tooltip.zone.flags.slice(0, 2).map((code) => (
                        <img
                          key={code}
                          src={`https://flagcdn.com/24x18/${code}.png`}
                          width={24}
                          height={18}
                          alt=""
                          className="rounded-sm"
                        />
                      ))}
                    </div>
                  )}
                  <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                    {t(`zoneNames.${tooltip.zone.id}` as "zoneNames.ukraine") || tooltip.zone.name}
                  </span>
                </div>
                <span
                  className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mb-1.5"
                  style={{
                    backgroundColor: `${RISK_CONFIG[tooltip.zone.risk_level]?.color || "#666"}20`,
                    color: RISK_CONFIG[tooltip.zone.risk_level]?.color || "#666",
                  }}
                >
                  {t(`groupLabels.${tooltip.zone.risk_level}` as "groupLabels.do_not_fly")}
                </span>
                <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2 leading-relaxed">
                  {t(`riskDescriptions.${tooltip.zone.risk_level}` as "riskDescriptions.do_not_fly")}
                </p>
                <p className="text-[10px] text-[var(--color-interactive)] mt-1.5">
                  {isTouch ? t("tapToView") : t("clickToView")}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  {tooltip.countryAlpha2 && (
                    <img
                      src={`https://flagcdn.com/24x18/${tooltip.countryAlpha2}.png`}
                      width={24}
                      height={18}
                      alt=""
                      className="rounded-sm shrink-0"
                    />
                  )}
                  <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                    {tooltip.countryName}
                  </span>
                </div>
                <span
                  className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${RISK_CONFIG.safe.color}20`,
                    color: RISK_CONFIG.safe.color,
                  }}
                >
                  {t("groupLabels.safe")}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
        {(["do_not_fly", "high_risk", "caution"] as const).map((level) => (
          <span key={level} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: RISK_CONFIG[level].color }}
            />
            {t(`groupLabels.${level}` as "groupLabels.do_not_fly")}
          </span>
        ))}
      </div>
    </div>
  );
}

export const ConflictMap = memo(ConflictMapInner);
