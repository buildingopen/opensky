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

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${locale}/flights`,
      languages,
    },
  };
}

function breadcrumbSchema(locale: string) {
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
        name: "Flights",
        item: `${siteUrl}/${locale}/flights`,
      },
    ],
  };
}

function itemListSchema(locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Flight Routes",
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

  // Group routes by origin city
  const grouped = new Map<string, typeof ROUTES>();
  for (const route of ROUTES) {
    const city = getAirportCity(route.origin);
    if (!grouped.has(city)) grouped.set(city, []);
    grouped.get(city)!.push(route);
  }

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema(locale)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListSchema(locale)),
        }}
      />

      <nav className="text-sm text-[var(--color-text-muted)] flex items-center gap-1.5">
        <Link
          href="/"
          className="hover:text-[var(--color-interactive)] transition-colors"
        >
          Home
        </Link>
        <span>/</span>
        <span className="text-[var(--color-text)]">
          {t("breadcrumbFlights")}
        </span>
      </nav>

      <h1 className="mt-6 text-3xl font-bold text-[var(--color-text)]">
        {t("indexTitle")}
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
                const destCity = getAirportCity(route.destination);
                const destCountry =
                  getAirportCountry(route.destination).toLowerCase();
                const meta = getRouteMeta(route.slug);
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
                    {meta && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatFlightTime(meta.flightTimeMin)} &middot;{" "}
                        {meta.distanceKm.toLocaleString()} km
                      </span>
                    )}
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
