import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SearchPage from "./SearchPage";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

const currencySymbols: Record<string, string> = {
  EUR: "\u20ac", USD: "$", GBP: "\u00a3", INR: "\u20b9",
  JPY: "\u00a5", AUD: "A$", CAD: "C$", CHF: "CHF",
};

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "metadata" });
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const price = typeof sp.price === "string" ? sp.price : undefined;
  const route = typeof sp.route === "string" ? sp.route : undefined;
  const codes = typeof sp.codes === "string" ? sp.codes : undefined;
  const currency = typeof sp.currency === "string" ? sp.currency : "EUR";
  const safety = typeof sp.safety === "string" ? sp.safety : "safe";
  const stops = typeof sp.stops === "string" ? sp.stops : undefined;

  // Build dynamic OG image URL
  const ogUrl = new URL("/api/og", siteUrl);
  if (route) ogUrl.searchParams.set("route", route);
  if (codes) ogUrl.searchParams.set("codes", codes);
  if (price) ogUrl.searchParams.set("price", price);
  if (currency) ogUrl.searchParams.set("currency", currency);
  if (safety) ogUrl.searchParams.set("safety", safety);
  if (stops) ogUrl.searchParams.set("stops", stops);

  const sym = currencySymbols[currency.toUpperCase()] || currency;

  // Route label is already "Mumbai to Frankfurt" from share URL
  const hasFlightData = route && price;
  const routeLabel = route || "";
  const title = hasFlightData
    ? t("flightTitle", { route: routeLabel, price: `${sym}${price}` })
    : t("title");
  const description = hasFlightData
    ? t("flightDescription", { route: routeLabel, price: `${sym}${price}` })
    : t("description");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "FlyFast",
      url: q ? `/?q=${encodeURIComponent(q)}` : "/",
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: hasFlightData ? `${routeLabel} from ${sym}${price}` : t("ogAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl.toString()],
    },
  };
}

export default function Page() {
  return <SearchPage />;
}
