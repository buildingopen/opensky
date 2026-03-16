import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "../../i18n/routing";
import { isRtl } from "../../i18n/config";
import { AnalyticsProvider } from "../../components/AnalyticsProvider";
import { CloudsBackground } from "../../components/CloudsBackground";
import { CurrencyProvider } from "../../components/CurrencyProvider";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-brand",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "metadata" });
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${siteUrl}/${l}`;
  }
  languages["x-default"] = `${siteUrl}/en`;
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t("title"),
      template: "%s",
    },
    description: t("description"),
    keywords: ["flights", "flight search", "Google Flights search", "natural language flights", "conflict zones", "cheap flights", "AI flight search"],
    alternates: {
      canonical: `${siteUrl}/${locale}`,
      languages,
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#22c55e" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "FlyFast",
              url: siteUrl,
              description: "Describe your trip in plain English. FlyFast searches Google Flights, filters conflict zones, and finds the safest, cheapest route. Free, no login.",
              applicationCategory: "TravelApplication",
              operatingSystem: "All",
              browserRequirements: "Requires JavaScript",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              author: { "@type": "Organization", name: "Building Open", url: "https://buildingopen.org" },
              featureList: [
                "Natural language flight search",
                "Conflict zone and restricted airspace filtering",
                "Every airline on Google Flights",
                "Safety risk scoring per route",
                "Multi-city and flexible date search",
                "Direct booking links to airlines",
                "No login or account required",
                "Open source",
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "How does FlyFast work?",
                  acceptedAnswer: { "@type": "Answer", text: "Type your trip in plain English, like 'Mumbai to Hamburg next week under $300'. FlyFast searches every flight on Google Flights, filters conflict zones, and ranks by price, duration, and route safety. You book directly with the airline." },
                },
                {
                  "@type": "Question",
                  name: "Is FlyFast free?",
                  acceptedAnswer: { "@type": "Answer", text: "Yes. FlyFast is completely free with no login required. You get 10 searches per hour. There are no ads and no premium tier." },
                },
                {
                  "@type": "Question",
                  name: "How does FlyFast filter conflict zones?",
                  acceptedAnswer: { "@type": "Answer", text: "FlyFast maintains a dataset of active conflict zones, restricted airspace, and regions with aviation advisories. Every flight route is checked against these zones. High-risk routes are removed from results. Caution-level routes are flagged so you can decide. The data is updated regularly." },
                },
                {
                  "@type": "Question",
                  name: "Is it safe to fly over conflict zones?",
                  acceptedAnswer: { "@type": "Answer", text: "Some airspace over conflict zones is closed or restricted by aviation authorities (NOTAMs). Airlines reroute around these areas, which can add flight time and cost. FlyFast automatically checks which routes cross conflict airspace and filters or flags them. Always check official government travel advisories before booking." },
                },
                {
                  "@type": "Question",
                  name: "How do I find cheap flights that avoid conflict zones?",
                  acceptedAnswer: { "@type": "Answer", text: "On FlyFast, type a natural language query like 'cheapest flight from London to Bangkok avoiding conflict zones'. FlyFast searches every flight on Google Flights, removes routes through high-risk airspace, and ranks the remaining options by price. You can also specify flexible dates to find the cheapest day to fly." },
                },
                {
                  "@type": "Question",
                  name: "What airlines does FlyFast search?",
                  acceptedAnswer: { "@type": "Answer", text: "FlyFast searches every flight on Google Flights, covering all major carriers, low-cost airlines, and multi-airline itineraries worldwide." },
                },
                {
                  "@type": "Question",
                  name: "Can I search for multi-city or complex routes?",
                  acceptedAnswer: { "@type": "Answer", text: "Yes. FlyFast handles multi-city searches, flexible dates, nearby airports, and budget constraints. For example: 'Mumbai to Hamburg or Berlin, any day next week, under 300 euros'. It will search all origin-destination-date combinations and rank the best options." },
                },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Building Open",
              url: "https://buildingopen.org",
              logo: `${siteUrl}/favicon.svg`,
              contactPoint: { "@type": "ContactPoint", email: "hello@buildingopen.org", contactType: "customer support" },
              sameAs: ["https://github.com/buildingopen"],
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} ${spaceGrotesk.variable} antialiased min-h-screen flex flex-col`}>
        <NextIntlClientProvider messages={messages}>
          <CurrencyProvider>
          <AnalyticsProvider />
          <CloudsBackground />
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-[var(--color-accent)] focus:text-black focus:rounded focus:text-sm focus:font-medium">
            {(messages as any)?.common?.skipToContent || "Skip to main content"}
          </a>
          <SiteHeader />
          {children}
          <SiteFooter />
          </CurrencyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
