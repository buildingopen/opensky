import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "../../../../../i18n/navigation";
import { locales } from "../../../../../i18n/config";
import {
  ORIGIN_HUBS,
  getHubByCity,
  getRoutesForOrigin,
  getAirportCity,
  getAirportCountry,
  getRouteMeta,
  formatFlightTime,
  ROUTE_SAFETY_ZONES,
} from "../../../../../lib/routes";
import { getAllRouteCache } from "../../../../../lib/route-cache";

export const revalidate = 3600;

export async function generateStaticParams() {
  return ORIGIN_HUBS.map((hub) => ({ city: hub.city }));
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; city: string }>;
}): Promise<Metadata> {
  const { locale, city } = await params;
  const hub = getHubByCity(city);
  if (!hub) return { title: "Not Found" };

  const t = await getTranslations("flights");
  const cityName = getAirportCity(hub.iata, locale);
  const routes = getRoutesForOrigin(hub.iata);

  const title = t("hubMetaTitle", { city: cityName, count: routes.length });
  const description = t("hubMetaDescription", { city: cityName, count: routes.length });

  const ogUrl = new URL("/api/og", siteUrl);
  ogUrl.searchParams.set("route", t("hubHeading", { city: cityName }));

  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `${siteUrl}/${l}/flights/from/${city}`;
  }
  languages["x-default"] = `${siteUrl}/en/flights/from/${city}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${locale}/flights/from/${city}`,
      languages,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${locale}/flights/from/${city}`,
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

function breadcrumbSchema(
  cityName: string,
  city: string,
  locale: string,
  homeLabel: string,
  flightsLabel: string,
  hubLabel: string,
) {
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
        name: hubLabel,
        item: `${siteUrl}/${locale}/flights/from/${city}`,
      },
    ],
  };
}

function faqSchema(
  faqs: Array<{ question: string; answer: string }>,
  baseUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq, i) => ({
      "@type": "Question",
      "@id": `${baseUrl}#faq-${i + 1}`,
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        "@id": `${baseUrl}#faq-${i + 1}-answer`,
        text: faq.answer,
      },
    })),
  };
}

export default async function HubPage({
  params,
}: {
  params: Promise<{ locale: string; city: string }>;
}) {
  const { locale, city } = await params;
  const hub = getHubByCity(city);
  if (!hub) notFound();

  const t = await getTranslations("flights");
  const cityName = getAirportCity(hub.iata, locale);
  const routes = getRoutesForOrigin(hub.iata);

  const allCached = await getAllRouteCache();
  const priceMap = new Map(
    allCached.map((c) => [`${c.origin}-${c.destination}`, c]),
  );

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

  const faqs = [
    {
      question: t("hubFaq1Q", { city: cityName }),
      answer: t("hubFaq1A", { city: cityName, count: routes.length }),
    },
    {
      question: t("hubFaq2Q", { city: cityName }),
      answer: t("hubFaq2A", { city: cityName }),
    },
    {
      question: t("hubFaq3Q", { city: cityName }),
      answer: t("hubFaq3A", { city: cityName }),
    },
  ];

  const pageUrl = `${siteUrl}/${locale}/flights/from/${city}`;
  const hubBreadcrumb = t("hubBreadcrumb", { city: cityName });

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema(cityName, city, locale, t("breadcrumbHome"), t("breadcrumbFlights"), hubBreadcrumb),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema(faqs, pageUrl)),
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
        <span className="text-[var(--color-text)]">{hubBreadcrumb}</span>
      </nav>

      {/* H1 */}
      <h1 className="mt-6 text-3xl font-bold text-[var(--color-text)]">
        {t("hubHeading", { city: cityName })}
      </h1>

      {/* Intro */}
      <p className="mt-3 text-sm text-[var(--color-text-muted)]">
        {t("hubIntro", { city: cityName, count: routes.length })}
      </p>

      {/* Route cards grid */}
      <div className="mt-8 grid gap-2">
        {routes.map((route) => {
          const destCity = getAirportCity(route.destination, locale);
          const destCountry = getAirportCountry(route.destination).toLowerCase();
          const meta = getRouteMeta(route.slug);
          const cached = priceMap.get(`${route.origin}-${route.destination}`);
          const hasSafety = (ROUTE_SAFETY_ZONES[route.slug]?.length ?? 0) > 0;

          return (
            <Link
              key={route.slug}
              href={`/flights/${route.slug}`}
              className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3 hover:bg-[var(--color-surface)] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <img
                  src={`https://flagcdn.com/20x15/${destCountry}.png`}
                  srcSet={`https://flagcdn.com/40x30/${destCountry}.png 2x`}
                  width={20}
                  height={15}
                  alt=""
                  className="rounded-sm"
                />
                <span className="font-medium text-[var(--color-text)]">
                  {destCity}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {route.origin} &rarr; {route.destination}
                </span>
                {hasSafety && (
                  <span className="text-xs text-amber-600">&#9888;</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {cached?.price_min != null && (
                  <span className="text-xs font-semibold text-[var(--color-interactive)]">
                    {t("priceFrom", {
                      price: formatPrice(cached.price_min, cached.currency),
                    })}
                  </span>
                )}
                {meta && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {formatFlightTime(meta.flightTimeMin)}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* FAQ */}
      <section className="mt-12">
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
          {t("faqHeading")}
        </h2>
        <dl className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i}>
              <dt className="font-medium text-[var(--color-text)]">
                {faq.question}
              </dt>
              <dd className="mt-1 text-sm text-[var(--color-text-muted)]">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
