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
import { ThemeProvider } from "../../components/ThemeProvider";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { CookieConsent } from "../../components/CookieConsent";
import { themeScript } from "../../lib/theme-script";
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
  const t = await getTranslations({ locale, namespace: "metadata" });
  const dir = isRtl(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#f8faff" />
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
              mainEntity: [1, 2, 3, 4, 5, 6, 7].map((n) => ({
                "@type": "Question",
                name: t(`faq.q${n}` as "faq.q1"),
                acceptedAnswer: { "@type": "Answer", text: t(`faq.a${n}` as "faq.a1") },
              })),
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
              logo: `${siteUrl}/apple-touch-icon.png`,
              contactPoint: { "@type": "ContactPoint", email: "hello@buildingopen.org", contactType: "customer support" },
              sameAs: ["https://github.com/buildingopen"],
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} ${spaceGrotesk.variable} antialiased min-h-screen flex flex-col`}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
          <CurrencyProvider>
          <AnalyticsProvider />
          <CloudsBackground />
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-[var(--color-interactive)] focus:text-black focus:rounded focus:text-sm focus:font-medium">
            {(messages as any)?.common?.skipToContent || "Skip to main content"}
          </a>
          <SiteHeader />
          {children}
          <SiteFooter />
          <CookieConsent />
          </CurrencyProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
