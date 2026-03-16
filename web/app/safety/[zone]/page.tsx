import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getZones,
  getZoneById,
  COUNTRY_NAMES,
  RISK_CONFIG,
  TRAVELER_ADVICE,
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
  if (!zone) return { title: "Zone Not Found - FlyFast" };
  return {
    title: `Is it safe to fly over ${zone.name}? - FlyFast`,
    description: `${zone.details} Current risk level: ${RISK_CONFIG[zone.risk_level].label}. Updated ${zone.updated}.`,
    openGraph: {
      title: `Is it safe to fly over ${zone.name}? - FlyFast`,
      description: `${zone.details} Current risk level: ${RISK_CONFIG[zone.risk_level].label}.`,
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

  const risk = RISK_CONFIG[zone.risk_level];
  const advice = TRAVELER_ADVICE[zone.risk_level];

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
        &larr; All conflict zones
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <span
          className="text-sm font-semibold px-3 py-1 rounded-full"
          style={{
            backgroundColor: `${risk.color}20`,
            color: risk.color,
          }}
        >
          {risk.label}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {(ZONE_FLAGS[zone.id] || []).map((code) => (
          <img
            key={code}
            src={`https://flagcdn.com/32x24/${code}.png`}
            srcSet={`https://flagcdn.com/64x48/${code}.png 2x`}
            width={32}
            height={24}
            alt=""
            className="rounded-sm"
          />
        ))}
        <h1 className="text-3xl font-bold text-[var(--color-text)]">
          {zone.name}
        </h1>
      </div>

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text-muted)]">
        {/* Current status */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            Current status
          </h2>
          <p>{zone.details}</p>
        </div>

        {/* Source */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            Source
          </h2>
          <p>{zone.source}</p>
        </div>

        {/* Affected countries/airports */}
        {(countryNames.length > 0 || zone.airports.length > 0) && (
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
              Affected {countryNames.length > 0 ? "countries" : "airports"}
            </h2>
            {countryNames.length > 0 && (
              <p>
                {countryNames.join(", ")} (
                {zone.countries.join(", ")})
              </p>
            )}
            {zone.airports.length > 0 && (
              <p className={countryNames.length > 0 ? "mt-2" : ""}>
                Airports: {zone.airports.join(", ")}
              </p>
            )}
          </div>
        )}

        {/* What this means for travelers */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            What this means for travelers
          </h2>
          <p>{advice}</p>
        </div>

        {/* Last checked */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            Last checked
          </h2>
          <p>
            {zone.updated}. Data refreshed daily from EASA, FAA, and
            safeairspace.net.
          </p>
        </div>

        {/* CTA */}
        <div className="border-t border-[var(--color-border)] pt-8">
          <Link
            href={`/?q=${encodeURIComponent(`flights avoiding ${zone.name}`)}`}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            Search flights avoiding {zone.name}
          </Link>
        </div>
      </section>
    </main>
  );
}
