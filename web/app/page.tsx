import type { Metadata } from "next";
import SearchPage from "./SearchPage";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

const currencySymbols: Record<string, string> = {
  EUR: "\u20ac", USD: "$", GBP: "\u00a3", INR: "\u20b9",
  JPY: "\u00a5", AUD: "A$", CAD: "C$", CHF: "CHF",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const price = typeof params.price === "string" ? params.price : undefined;
  const route = typeof params.route === "string" ? params.route : undefined; // "Mumbai to Frankfurt"
  const codes = typeof params.codes === "string" ? params.codes : undefined; // "BOM-FRA"
  const currency = typeof params.currency === "string" ? params.currency : "EUR";
  const safety = typeof params.safety === "string" ? params.safety : "safe";
  const stops = typeof params.stops === "string" ? params.stops : undefined;

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
    ? `${routeLabel} from ${sym}${price} - FlyFast`
    : "FlyFast - The smartest flight search";
  const description = hasFlightData
    ? `Found ${routeLabel} from ${sym}${price}. Conflict zones filtered. Search your own flights on FlyFast.`
    : "Describe your trip in plain English. FlyFast searches Google Flights, filters conflict zones, and finds the safest, cheapest route. Free, no login.";

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
          alt: hasFlightData ? `${routeLabel} from ${sym}${price}` : "FlyFast: describe your trip, we find the best flight",
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
