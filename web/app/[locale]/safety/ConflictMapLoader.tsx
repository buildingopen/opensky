"use client";

import dynamic from "next/dynamic";

const ConflictMap = dynamic(
  () => import("./ConflictMap").then((m) => m.ConflictMap),
  { ssr: false }
);

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
  countryToZone: Record<string, string>;
  activeFilter: string | null;
  onCountryHover?: (zoneId: string | null) => void;
}

export function ConflictMapLoader({ countryRiskMap, zones, countryToZone, activeFilter, onCountryHover }: Props) {
  return (
    <ConflictMap
      countryRiskMap={countryRiskMap}
      zones={zones}
      countryToZone={countryToZone}
      activeFilter={activeFilter}
      onCountryHover={onCountryHover}
    />
  );
}
