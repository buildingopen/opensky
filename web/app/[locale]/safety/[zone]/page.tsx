import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "../../../../i18n/navigation";
import {
  getZones,
  getZoneById,
  COUNTRY_NAMES,
  RISK_CONFIG,
  ZONE_FLAGS,
} from "../zones-data";

export const revalidate = 3600;

export async function generateStaticParams() {
  const zones = await getZones();
  return zones.map((z) => ({ zone: z.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ zone: string }>;
}): Promise<Metadata> {
  const { zone: zoneId } = await params;
  const zone = await getZoneById(zoneId);
  const t = await getTranslations("safety");
  if (!zone) return { title: t("zone.notFound") };
  const title = t("zone.safeToFlyTitle", { zone: zone.name });
  const description = t("zone.safeToFlyDescription", { details: zone.details, level: t(`groupLabels.${zone.risk_level}` as "groupLabels.do_not_fly"), updated: zone.updated });
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://flyfast.app/safety/${zone.id}`,
    },
  };
}

const faqSchema = (zone: { name: string; risk_level: string; details: string }) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: `Is it safe to fly over ${zone.name}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text:
          zone.risk_level === "do_not_fly"
            ? `No. ${zone.name} airspace is classified as Do Not Fly. ${zone.details} Airlines automatically reroute flights around this zone.`
            : zone.risk_level === "high_risk"
              ? `${zone.name} is classified as High Risk. ${zone.details} Most airlines avoid this airspace.`
              : `${zone.name} is classified as Caution. ${zone.details} Airports operate normally but flights may be rerouted near conflict zones.`,
      },
    },
  ],
});

export default async function ZonePage({
  params,
}: {
  params: Promise<{ zone: string }>;
}) {
  const { zone: zoneId } = await params;
  const zone = await getZoneById(zoneId);
  if (!zone) notFound();

  const t = await getTranslations("safety");
  const risk = RISK_CONFIG[zone.risk_level];
  const advice = t(`travelerAdvice.${zone.risk_level}` as "travelerAdvice.do_not_fly");

  const countryNames = zone.countries
    .map((c) => COUNTRY_NAMES[c] || c)
    .filter(Boolean);

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(zone)) }}
      />

      <Link
        href="/safety"
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
      >
        &larr; {t("backToAll")}
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <span
          className="text-sm font-semibold px-3 py-1 rounded-full"
          style={{
            backgroundColor: `${risk.color}20`,
            color: risk.color,
          }}
        >
          {t(`groupLabels.${zone.risk_level}` as "groupLabels.do_not_fly")}
        </span>
      </div>

      {(() => {
        const flags = ZONE_FLAGS[zone.id] || [];
        const singleFlag = flags.length === 1;
        return singleFlag ? (
          <div className="mt-4 flex items-center gap-3">
            <img
              src={`https://flagcdn.com/40x30/${flags[0]}.png`}
              srcSet={`https://flagcdn.com/80x60/${flags[0]}.png 2x`}
              width={40}
              height={30}
              alt=""
              className="rounded-sm shrink-0"
            />
            <h1 className="text-3xl font-bold text-[var(--color-text)]">
              {zone.name}
            </h1>
          </div>
        ) : (
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-[var(--color-text)]">
              {zone.name}
            </h1>
            {flags.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5">
                {flags.map((code) => (
                  <img
                    key={code}
                    src={`https://flagcdn.com/24x18/${code}.png`}
                    srcSet={`https://flagcdn.com/48x36/${code}.png 2x`}
                    width={24}
                    height={18}
                    alt=""
                    className="rounded-sm"
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text-muted)]">
        {/* Current status */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            {t("zone.currentStatus")}
          </h2>
          <p>{zone.details}</p>
        </div>

        {/* Source */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            {t("zone.source")}
          </h2>
          <p>{zone.source}</p>
        </div>

        {/* Affected countries/airports */}
        {(countryNames.length > 0 || zone.airports.length > 0) && (
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
              {countryNames.length > 0 ? t("zone.affectedCountries") : t("zone.affectedAirports")}
            </h2>
            {countryNames.length > 0 && (
              <p>
                {countryNames.join(", ")} (
                {zone.countries.join(", ")})
              </p>
            )}
            {zone.airports.length > 0 && (
              <p className={countryNames.length > 0 ? "mt-2" : ""}>
                {t("zone.airports")}: {zone.airports.join(", ")}
              </p>
            )}
          </div>
        )}

        {/* What this means for travelers */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            {t("zone.whatThisMeans")}
          </h2>
          <p>{advice}</p>
        </div>

        {/* Last checked */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            {t("zone.lastChecked")}
          </h2>
          <p>
            {zone.updated}. {t("zone.dataRefreshed")}
          </p>
        </div>

        {/* CTA */}
        <div className="border-t border-[var(--color-border)] pt-8">
          <Link
            href={`/?q=${encodeURIComponent(`flights avoiding ${zone.name}`)}`}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {t("zone.searchAvoiding", { zone: zone.name })}
          </Link>
        </div>
      </section>
    </main>
  );
}
