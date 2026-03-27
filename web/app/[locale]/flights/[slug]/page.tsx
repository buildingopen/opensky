import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "../../../../i18n/navigation";
import { locales } from "../../../../i18n/config";
import {
  ROUTES,
  getRouteBySlug,
  getAirportCity,
  getAirportCountry,
  getRouteMeta,
  getReverseRouteSlug,
  formatFlightTime,
  getAirlineName,
  ROUTE_SAFETY_ZONES,
} from "../../../../lib/routes";
import { getRouteCache } from "../../../../lib/route-cache";
import { getZoneById, RISK_CONFIG } from "../../safety/zones-data";

export const revalidate = 3600;
export const dynamicParams = true;

/** Pre-render top 12 routes by search volume; rest via ISR on-demand. */
export async function generateStaticParams() {
  return ROUTES.slice(0, 12).map((r) => ({ slug: r.slug }));
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const route = getRouteBySlug(slug);
  if (!route) return { title: "Not Found" };

  const t = await getTranslations("flights");
  const originCity = getAirportCity(route.origin, locale);
  const destCity = getAirportCity(route.destination, locale);
  const meta = getRouteMeta(slug);

  const title = t("metaTitle", { origin: originCity, destination: destCity });
  const description = t("metaDescription", { origin: originCity, destination: destCity });

  const ogUrl = new URL("/api/og", siteUrl);
  ogUrl.searchParams.set("route", `${getAirportCity(route.origin)} to ${getAirportCity(route.destination)}`);
  ogUrl.searchParams.set("codes", `${route.origin}-${route.destination}`);
  if (meta) ogUrl.searchParams.set("stops", String(meta.typicalStops));
  const safetyZones = ROUTE_SAFETY_ZONES[slug];
  if (safetyZones?.length) ogUrl.searchParams.set("safety", "caution");

  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `${siteUrl}/${l}/flights/${slug}`;
  }
  languages["x-default"] = `${siteUrl}/en/flights/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${locale}/flights/${slug}`,
      languages,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${locale}/flights/${slug}`,
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

function breadcrumbSchema(routeName: string, slug: string, locale: string, homeLabel: string, flightsLabel: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: homeLabel,
        item: `${siteUrl}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: flightsLabel,
        item: `${siteUrl}/${locale}/flights`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: routeName,
        item: `${siteUrl}/${locale}/flights/${slug}`,
      },
    ],
  };
}

export default async function RoutePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const route = getRouteBySlug(slug);
  if (!route) notFound();

  const meta = getRouteMeta(slug);
  if (!meta) notFound();

  const t = await getTranslations("flights");
  const tSafety = await getTranslations("safety");
  const originCity = getAirportCity(route.origin, locale);
  const destCity = getAirportCity(route.destination, locale);
  const originCountry = getAirportCountry(route.origin).toLowerCase();
  const destCountry = getAirportCountry(route.destination).toLowerCase();
  const duration = formatFlightTime(meta.flightTimeMin);

  // Fetch cached price data (may be null if cron hasn't run yet)
  const cached = await getRouteCache(route.origin, route.destination);

  // Format helpers
  const formatPrice = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${Math.round(amount)}`;
    }
  };
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  // Safety zone data
  const safetyZoneIds = ROUTE_SAFETY_ZONES[slug] ?? [];
  const safetyZones = (
    await Promise.all(safetyZoneIds.map((id) => getZoneById(id)))
  ).filter(Boolean);
  const hasSafetyAngle = safetyZones.length > 0;

  // Translate zone name and risk level using safety namespace
  const getZoneName = (zone: NonNullable<(typeof safetyZones)[0]>) =>
    tSafety(`zoneNames.${zone.id}` as "zoneNames.ukraine") || zone.name;
  const getRiskLabel = (zone: NonNullable<(typeof safetyZones)[0]>) =>
    tSafety(`groupLabels.${zone.risk_level}` as "groupLabels.do_not_fly");

  // Reverse route
  const reverseSlug = getReverseRouteSlug(slug);

  // Build FAQ
  const stopsLabel =
    meta.typicalStops === 0
      ? t("direct")
      : meta.typicalStops === 1
        ? t("oneStop")
        : t("multiStop", { count: meta.typicalStops });

  const airlinesText =
    cached?.airlines?.length
      ? cached.airlines.map(getAirlineName).join(", ")
      : t("airlinesGeneric");

  const safetyFaqKey = hasSafetyAngle
    ? safetyZones[0]!.risk_level === "high_risk" ||
      safetyZones[0]!.risk_level === "do_not_fly"
      ? "faq4A_high_risk"
      : "faq4A_caution"
    : "faq4A_safe";

  const faqs = [
    {
      question: t("faq1Q", { origin: originCity, destination: destCity }),
      answer: t("faq1A", {
        origin: originCity,
        destination: destCity,
        duration,
      }),
    },
    {
      question: t("faq2Q", { origin: originCity, destination: destCity }),
      answer: t("faq2A", {
        origin: originCity,
        destination: destCity,
        airlines: airlinesText,
      }),
    },
    {
      question: t("faq3Q", { origin: originCity, destination: destCity }),
      answer: t("faq3A", { origin: originCity, destination: destCity }),
    },
    {
      question: t("faq4Q", { origin: originCity, destination: destCity }),
      answer: t(safetyFaqKey as "faq4A_safe", {
        zone: hasSafetyAngle ? getZoneName(safetyZones[0]!) : "",
      }),
    },
  ];

  const routeName = `${originCity} – ${destCity}`;

  // Intro text
  const introKey = hasSafetyAngle ? "introSafety" : "intro";
  const introText = t(introKey as "intro", {
    origin: originCity,
    destination: destCity,
    duration,
    zone: hasSafetyAngle ? getZoneName(safetyZones[0]!) : "",
  });

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(faqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema(routeName, slug, locale, t("breadcrumbHome"), t("breadcrumbFlights"))),
        }}
      />

      {/* Breadcrumb */}
      <nav className="text-sm text-[var(--color-text-muted)] flex items-center gap-1.5">
        <Link
          href="/"
          className="hover:text-[var(--color-interactive)] transition-colors"
        >
          {t("breadcrumbHome")}
        </Link>
        <span>/</span>
        <Link
          href="/flights"
          className="hover:text-[var(--color-interactive)] transition-colors"
        >
          {t("breadcrumbFlights")}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-text)]">{routeName}</span>
      </nav>

      {/* H1 with flags */}
      <div className="mt-6 flex items-center gap-3">
        <img
          src={`https://flagcdn.com/24x18/${originCountry}.png`}
          srcSet={`https://flagcdn.com/48x36/${originCountry}.png 2x`}
          width={24}
          height={18}
          alt=""
          className="rounded-sm"
        />
        <h1 className="text-3xl font-bold text-[var(--color-text)]">
          {t("title", { origin: originCity, destination: destCity })}
        </h1>
        <img
          src={`https://flagcdn.com/24x18/${destCountry}.png`}
          srcSet={`https://flagcdn.com/48x36/${destCountry}.png 2x`}
          width={24}
          height={18}
          alt=""
          className="rounded-sm"
        />
      </div>

      {/* Intro paragraph */}
      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
        {introText}
      </p>

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text)]">
        {/* Route info card */}
        <div className="rounded-lg border border-[var(--color-border)] p-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-[var(--color-text-muted)] mb-1">
                {t("flightTime")}
              </div>
              <div className="text-lg font-semibold">{duration}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-muted)] mb-1">
                {t("distance")}
              </div>
              <div className="text-lg font-semibold">
                {meta.distanceKm.toLocaleString()} km
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-muted)] mb-1">
                {t("typicalStops")}
              </div>
              <div className="text-lg font-semibold">{stopsLabel}</div>
            </div>
          </div>
        </div>

        {/* Price card (only if cached data exists) */}
        {cached && cached.price_min != null && (
          <div className="rounded-lg border border-[var(--color-border)] p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-bold text-[var(--color-interactive)]">
                  {t("priceFrom", {
                    price: formatPrice(cached.price_min!, cached.currency),
                  })}
                </span>
                {cached.price_max != null &&
                  cached.price_max !== cached.price_min && (
                    <span className="ml-2 text-[var(--color-text-muted)]">
                      {t("priceRange", {
                        min: formatPrice(cached.price_min!, cached.currency),
                        max: formatPrice(cached.price_max, cached.currency),
                      })}
                    </span>
                  )}
              </div>
              {cached.updated_at && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {t("updatedAt", { date: formatDate(cached.updated_at) })}
                </span>
              )}
            </div>

            {/* Airline pills */}
            {cached.airlines?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {cached.airlines.map((code) => (
                  <span
                    key={code}
                    className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]"
                  >
                    {getAirlineName(code)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No price yet */}
        {(!cached || cached.price_min == null) && (
          <div className="rounded-lg border border-[var(--color-border)] p-5 text-center text-[var(--color-text-muted)]">
            {hasSafetyAngle &&
              (safetyZones[0]!.risk_level === "high_risk" ||
                safetyZones[0]!.risk_level === "do_not_fly")
              ? t("noPriceConflict")
              : t("noPriceYet")}
          </div>
        )}

        {/* Safety section */}
        {hasSafetyAngle ? (
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
              {t("safetyNote")}
            </h2>
            {safetyZones.map((zone) => {
              const risk = RISK_CONFIG[zone!.risk_level];
              return (
                <div
                  key={zone!.id}
                  className="rounded-lg p-4 mb-2"
                  style={{
                    backgroundColor: `${risk.color}10`,
                    borderLeft: `3px solid ${risk.color}`,
                  }}
                >
                  <p>
                    {t("safetyWarning", {
                      zone: getZoneName(zone!),
                      level: getRiskLabel(zone!),
                    })}
                  </p>
                  <Link
                    href={`/safety/${zone!.id}`}
                    className="text-[var(--color-interactive)] hover:underline mt-1 inline-block"
                  >
                    {t("learnMore")} &rarr;
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
              {t("safetyNote")}
            </h2>
            <p className="text-[var(--color-text-muted)]">{t("safetyOk")}</p>
          </div>
        )}

        {/* Airlines section */}
        {cached?.airlines?.length ? (
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
              {t("airlines")}
            </h2>
            <p>{cached.airlines.map(getAirlineName).join(", ")}</p>
          </div>
        ) : null}

        {/* FAQ */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            {t("faqHeading")}
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

        {/* Reverse route link */}
        {reverseSlug && (
          <div className="text-sm">
            <Link
              href={`/flights/${reverseSlug}`}
              className="text-[var(--color-interactive)] hover:underline"
            >
              {t("reverseRoute", {
                origin: getAirportCity(
                  getRouteBySlug(reverseSlug)!.origin, locale,
                ),
                destination: getAirportCity(
                  getRouteBySlug(reverseSlug)!.destination, locale,
                ),
              })}
            </Link>
          </div>
        )}

        {/* CTA */}
        <div className="border-t border-[var(--color-border)] pt-8">
          <Link
            href={`/?q=${route.origin}+to+${route.destination}&utm_source=seo&utm_medium=route_page&utm_campaign=programmatic`}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-interactive)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-interactive-hover)] transition-colors"
          >
            {t("searchCta", { origin: originCity, destination: destCity })}
          </Link>
        </div>
      </section>
    </main>
  );
}
