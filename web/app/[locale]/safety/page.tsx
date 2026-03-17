import { getTranslations } from "next-intl/server";
import { Link } from "../../../i18n/navigation";
import { getZones, ZONE_FLAGS, ZONE_COUNTRIES } from "./zones-data";
import { SafetyPageClient } from "./SafetyPageClient";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const { setRequestLocale } = await import("next-intl/server");
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "safety" });
  return { title: t("title"), description: t("description") };
}

const itemListSchema = (zoneIds: string[]) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Conflict Zone Airspace Status",
  numberOfItems: zoneIds.length,
  itemListElement: zoneIds.map((id, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `https://flyfast.app/safety/${id}`,
  })),
});

export default async function SafetyIndexPage() {
  const t = await getTranslations("safety");
  const zones = await getZones();

  // Build country -> risk level map (highest priority wins)
  const countryRiskMap: Record<string, string> = {};
  const riskPriority: Record<string, number> = { do_not_fly: 3, high_risk: 2, caution: 1 };
  for (const zone of zones) {
    const codes = ZONE_COUNTRIES[zone.id] || [];
    for (const code of codes) {
      if (!countryRiskMap[code] || (riskPriority[zone.risk_level] || 0) > (riskPriority[countryRiskMap[code]] || 0)) {
        countryRiskMap[code] = zone.risk_level;
      }
    }
  }

  // Build country -> zone id map (for click navigation)
  const countryToZone: Record<string, string> = {};
  for (const zone of zones) {
    const codes = ZONE_COUNTRIES[zone.id] || [];
    for (const code of codes) {
      if (!countryToZone[code] || (riskPriority[zone.risk_level] || 0) > (riskPriority[countryRiskMap[code]] || 0)) {
        countryToZone[code] = zone.id;
      }
    }
  }

  // Build zone map data for the map component
  const zoneMapData = zones.map((z) => ({
    id: z.id,
    name: z.name,
    risk_level: z.risk_level,
    details: z.details,
    flags: ZONE_FLAGS[z.id] || [],
    countries: ZONE_COUNTRIES[z.id] || [],
  }));

  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListSchema(zones.map((z) => z.id))),
        }}
      />
      <h1 className="text-3xl font-bold text-[var(--color-text)]">
        {t("heading")}
      </h1>
      <p className="mt-4 text-[var(--color-text-muted)] max-w-2xl">
        {t("subtitle")}
      </p>

      <SafetyPageClient
        zones={zones}
        countryRiskMap={countryRiskMap}
        zoneMapData={zoneMapData}
        countryToZone={countryToZone}
        zoneFlags={ZONE_FLAGS}
      />

      <p className="mt-12 text-xs text-[var(--color-text-muted)]">
        {t("dataSource")}{" "}
        <Link
          href="/methodology"
          className="text-[var(--color-interactive)] hover:underline"
        >
          {t("learnMore")}
        </Link>
        .
      </p>
    </main>
  );
}
