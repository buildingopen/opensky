import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "../../../i18n/navigation";
import { locales } from "../../../i18n/config";
import {
  ROUTES,
  getAirportCity,
  getAirportCountry,
  getRouteMeta,
  formatFlightTime,
} from "../../../lib/routes";
import { getAllRouteCache } from "../../../lib/route-cache";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations("flights");

  const title = t("indexTitle");
  const description = t("indexDescription");

  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `${siteUrl}/${l}/flights`;
  }
  languages["x-default"] = `${siteUrl}/en/flights`;

  const ogUrl = new URL("/api/og", siteUrl);
  ogUrl.searchParams.set("route", "All Flight Routes");

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${locale}/flights`,
      languages,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${locale}/flights`,
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

function breadcrumbSchema(locale: string, homeLabel: string, flightsLabel: string) {
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
    ],
  };
}

function itemListSchema(locale: string, listName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: ROUTES.length,
    itemListElement: ROUTES.map((route, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/${locale}/flights/${route.slug}`,
    })),
  };
}

export default async function FlightsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("flights");

  // Fetch all cached prices
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

  // Group routes by origin city
  const grouped = new Map<string, typeof ROUTES>();
  for (const route of ROUTES) {
    const city = getAirportCity(route.origin, locale);
    if (!grouped.has(city)) grouped.set(city, []);
    grouped.get(city)!.push(route);
  }

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema(locale, t("breadcrumbHome"), t("breadcrumbFlights"))),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListSchema(locale, t("indexHeading"))),
        }}
      />

      <nav className="text-sm text-[var(--color-text-muted)] flex items-center gap-1.5">
        <Link
          href="/"
          className="hover:text-[var(--color-interactive)] transition-colors"
        >
          {t("breadcrumbHome")}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-text)]">
          {t("breadcrumbFlights")}
        </span>
      </nav>

      <h1 className="mt-6 text-3xl font-bold text-[var(--color-text)]">
        {t("indexHeading")}
      </h1>
      <p className="mt-3 text-sm text-[var(--color-text-muted)]">
        {t("indexDescription")}
      </p>

      <div className="mt-10 space-y-8">
        {[...grouped.entries()].map(([city, routes]) => (
          <section key={city}>
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">
              {t("routesFrom", { city })}
            </h2>
            <div className="grid gap-2">
              {routes.map((route) => {
                const destCity = getAirportCity(route.destination, locale);
                const destCountry =
                  getAirportCountry(route.destination).toLowerCase();
                const meta = getRouteMeta(route.slug);
                const cached = priceMap.get(
                  `${route.origin}-${route.destination}`,
                );
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
                    </div>
                    <div className="flex items-center gap-3">
                      {cached?.price_min != null && (
                        <span className="text-xs font-semibold text-[var(--color-interactive)]">
                          {t("priceFrom", {
                            price: formatPrice(
                              cached.price_min,
                              cached.currency,
                            ),
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
          </section>
        ))}
      </div>
    </main>
  );
}
