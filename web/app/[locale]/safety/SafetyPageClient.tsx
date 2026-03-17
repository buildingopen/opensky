"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "../../../i18n/navigation";
import { ConflictMapLoader } from "./ConflictMapLoader";
import { RISK_CONFIG, type ConflictZone } from "./zones-data";
import { ZoneAlertForm } from "./ZoneAlertForm";

const GROUP_ORDER: Array<"do_not_fly" | "high_risk" | "caution"> = [
  "do_not_fly",
  "high_risk",
  "caution",
];

interface ZoneMapData {
  id: string;
  name: string;
  risk_level: string;
  details: string;
  flags: string[];
  countries: string[];
}

function FlagImg({ code }: { code: string }) {
  return (
    <img
      src={`https://flagcdn.com/24x18/${code}.png`}
      srcSet={`https://flagcdn.com/48x36/${code}.png 2x`}
      width={24}
      height={18}
      alt=""
      className="rounded-sm shrink-0"
      loading="lazy"
    />
  );
}

interface Props {
  zones: ConflictZone[];
  countryRiskMap: Record<string, string>;
  zoneMapData: ZoneMapData[];
  countryToZone: Record<string, string>;
  zoneFlags: Record<string, string[]>;
}

export function SafetyPageClient({ zones, countryRiskMap, zoneMapData, countryToZone, zoneFlags }: Props) {
  const t = useTranslations("safety");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);

  const handleCountryHover = useCallback((zoneId: string | null) => {
    setHoveredZoneId(zoneId);
  }, []);

  const toggleFilter = (level: string) => {
    setActiveFilter((prev) => (prev === level ? null : level));
  };

  const grouped = GROUP_ORDER.map((level) => ({
    level,
    label: t(`groupLabels.${level}` as "groupLabels.do_not_fly"),
    color: RISK_CONFIG[level].color,
    zones: zones.filter((z) => z.risk_level === level),
  }));

  return (
    <>
      {/* Filter pills */}
      <nav className="flex flex-wrap gap-2 mt-8 mb-4">
        {grouped.map((group) => {
          const isActive = activeFilter === group.level;
          return (
            <button
              key={group.level}
              onClick={() => toggleFilter(group.level)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                isActive
                  ? "border-transparent text-white"
                  : "border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
              }`}
              style={isActive ? { backgroundColor: group.color } : undefined}
            >
              {!isActive && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: group.color }}
                />
              )}
              {group.label}
              <span className={isActive ? "text-white/70" : "text-[var(--color-text-muted)]"}>
                {group.zones.length}
              </span>
            </button>
          );
        })}
        {activeFilter && (
          <button
            onClick={() => setActiveFilter(null)}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2 py-1.5 transition-colors"
          >
            {t("clear")}
          </button>
        )}
      </nav>

      {/* Desktop: side-by-side (list + sticky map). Mobile: stacked (map then list). */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-8">
        {/* Map: on mobile shows first, on desktop shows right and sticky */}
        <div className="order-1 lg:order-2 mb-6 lg:mb-0">
          <div className="lg:sticky lg:top-4">
            <ConflictMapLoader
              countryRiskMap={countryRiskMap}
              zones={zoneMapData}
              countryToZone={countryToZone}
              activeFilter={activeFilter}
              onCountryHover={handleCountryHover}
            />
          </div>
        </div>

        {/* Zone list */}
        <div className="order-2 lg:order-1 space-y-10">
          {grouped.map((group) => {
            const isHidden = activeFilter && activeFilter !== group.level;
            return (
              <div
                key={group.level}
                id={group.level}
                className="scroll-mt-6"
                style={{ display: isHidden ? "none" : undefined }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">
                    {group.label}
                  </h2>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    ({group.zones.length})
                  </span>
                </div>
                <div className="grid gap-2">
                  {group.zones.map((zone) => {
                    const flags = zoneFlags[zone.id] || [];
                    const isHovered = hoveredZoneId === zone.id;
                    return (
                      <Link
                        key={zone.id}
                        href={`/safety/${zone.id}`}
                        className={`flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-[var(--color-surface-2)] transition-all ${
                          isHovered
                            ? "border-[var(--color-interactive)] bg-[var(--color-surface-2)] shadow-[0_0_0_1px_var(--color-interactive)]"
                            : "border-[var(--color-border)]"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {flags.length > 0 && (
                            <div className="flex items-center gap-1 shrink-0">
                              {flags.slice(0, 3).map((code) => (
                                <FlagImg key={code} code={code} />
                              ))}
                              {flags.length > 3 && (
                                <span className="text-[10px] text-[var(--color-text-muted)]">
                                  +{flags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-[var(--color-text)]">
                              {t(`zoneNames.${zone.id}` as "zoneNames.ukraine") || zone.name}
                            </span>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
                              {t(`riskDescriptions.${zone.risk_level}` as "riskDescriptions.do_not_fly")}
                            </p>
                          </div>
                        </div>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-4"
                          style={{
                            backgroundColor: `${group.color}20`,
                            color: group.color,
                          }}
                        >
                          {group.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zone alert subscription */}
      <ZoneAlertForm
        zones={zones.map((z) => ({ id: z.id, name: z.name, risk_level: z.risk_level }))}
      />
    </>
  );
}
