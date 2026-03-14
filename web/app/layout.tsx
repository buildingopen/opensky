import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AnalyticsProvider } from "../components/AnalyticsProvider";
import "./globals.css";

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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FlyFast - The smartest flight search",
    template: "%s",
  },
  description:
    "Describe your trip in plain English. FlyFast compares 500+ airlines, filters conflict zones, and finds the best route. Free, no login, AI-powered.",
  keywords: ["flights", "flight search", "safe flights", "conflict zones", "flight safety", "cheap flights", "AI flight search"],
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "FlyFast",
              url: siteUrl,
              description: "Describe your trip in plain English. FlyFast compares 500+ airlines, filters conflict zones, and finds the best route.",
              applicationCategory: "TravelApplication",
              operatingSystem: "All",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              author: { "@type": "Organization", name: "Building Open", url: "https://buildingopen.org" },
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
                  acceptedAnswer: { "@type": "Answer", text: "Describe your trip in plain English. FlyFast uses AI to parse your query, searches 500+ airlines, filters conflict zones, and ranks results by safety and value." },
                },
                {
                  "@type": "Question",
                  name: "Is FlyFast free?",
                  acceptedAnswer: { "@type": "Answer", text: "Yes. FlyFast is free to use with no login required. You get 10 searches per hour." },
                },
                {
                  "@type": "Question",
                  name: "How does FlyFast filter conflict zones?",
                  acceptedAnswer: { "@type": "Answer", text: "FlyFast maintains a database of active conflict zones and restricted airspace. Every flight route is checked against these zones, and risky routes are flagged or filtered." },
                },
              ],
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} antialiased`}>
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
