"use client";

import dynamic from "next/dynamic";

const ConflictMap = dynamic(
  () => import("./ConflictMap").then((m) => m.ConflictMap),
  { ssr: false }
);

export function ConflictMapLoader({ countryRiskMap }: { countryRiskMap: Record<string, string> }) {
  return <ConflictMap countryRiskMap={countryRiskMap} />;
}
