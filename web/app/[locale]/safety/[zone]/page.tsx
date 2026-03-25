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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; zone: string }>;
}): Promise<Metadata> {
  const { locale, zone: zoneId } = await params;
  const zone = await getZoneById(zoneId);
  const t = await getTranslations("safety");
  if (!zone) return { title: t("zone.notFound") };
  const zoneName = t(`zoneNames.${zone.id}` as "zoneNames.ukraine") || zone.name;
  const title = t("zone.safeToFlyTitle", { zone: zoneName });
  const riskDesc = t(`riskDescriptions.${zone.risk_level}` as "riskDescriptions.do_not_fly");
  const description = t("zone.safeToFlyDescription", { details: riskDesc, level: t(`groupLabels.${zone.risk_level}` as "groupLabels.do_not_fly"), updated: zone.updated });

  const ogUrl = new URL("/api/og", siteUrl);
  ogUrl.searchParams.set("route", zoneName);
  ogUrl.searchParams.set("safety", zone.risk_level);

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${locale}/safety/${zone.id}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${locale}/safety/${zone.id}`,
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
  };
}

function faqSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

function breadcrumbSchema(zoneName: string, zoneId: string, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${siteUrl}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Safety",
        item: `${siteUrl}/${locale}/safety`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: zoneName,
        item: `${siteUrl}/${locale}/safety/${zoneId}`,
      },
    ],
  };
}

export default async function ZonePage({
  params,
}: {
  params: Promise<{ locale: string; zone: string }>;
}) {
  const { locale, zone: zoneId } = await params;
  const zone = await getZoneById(zoneId);
  if (!zone) notFound();

  const t = await getTranslations("safety");
  const tSearch = await getTranslations("search");
  const risk = RISK_CONFIG[zone.risk_level];
  const advice = t(`travelerAdvice.${zone.risk_level}` as "travelerAdvice.do_not_fly");
  const zoneName = t(`zoneNames.${zone.id}` as "zoneNames.ukraine") || zone.name;
  const riskDesc = t(`riskDescriptions.${zone.risk_level}` as "riskDescriptions.do_not_fly");

  // Build all FAQ items
  const riskKey = zone.risk_level as "do_not_fly" | "high_risk" | "caution";
  const faqs = [
    {
      question: t("zone.faqQuestion", { zone: zoneName }),
      answer: t(`zone.faqAnswer_${riskKey}` as "zone.faqAnswer_do_not_fly", { zone: zoneName, details: riskDesc }),
    },
    {
      question: t("zone.faqAirlinesQuestion", { zone: zoneName }),
      answer: t(`zone.faqAirlinesAnswer_${riskKey}` as "zone.faqAirlinesAnswer_do_not_fly", { zone: zoneName }),
    },
    {
      question: t("zone.faqRouteQuestion", { zone: zoneName }),
      answer: t(`zone.faqRouteAnswer_${riskKey}` as "zone.faqRouteAnswer_do_not_fly", { zone: zoneName }),
    },
    {
      question: t("zone.faqCheckQuestion", { zone: zoneName }),
      answer: t("zone.faqCheckAnswer", { zone: zoneName }),
    },
  ];

  const countryNames = zone.countries
    .map((c) => {
      const key = `countryNames.${c}` as "countryNames.US";
      const val = tSearch(key);
      // next-intl returns "search.countryNames.XX" when key is missing
      return /^search\.countryNames\./.test(val) ? (COUNTRY_NAMES[c] || c) : val;
    })
    .filter(Boolean);

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema(zoneName, zone.id, locale)) }}
      />

      <Link
        href="/safety"
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-interactive)] transition-colors"
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
              {zoneName}
            </h1>
          </div>
        ) : (
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-[var(--color-text)]">
              {zoneName}
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

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text)]">
        {/* Current status */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            {t("zone.currentStatus")}
          </h2>
          <p>{t(`riskDescriptions.${zone.risk_level}` as "riskDescriptions.do_not_fly")}</p>
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

        {/* Common Questions */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            {t("zone.commonQuestions")}
          </h2>
          <dl className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i}>
                <dt className="font-medium text-[var(--color-text)]">
                  {faq.question}
                </dt>
                <dd className="mt-1 text-[var(--color-text-muted)]">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* CTA */}
        <div className="border-t border-[var(--color-border)] pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-interactive)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-interactive-hover)] transition-colors"
          >
            {t("zone.searchSafe")}
          </Link>
        </div>
      </section>
    </main>
  );
}
