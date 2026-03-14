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
  title: "FlyFast - Find the safest flight",
  description:
    "Type your trip in plain English. FlyFast searches flights across multiple providers, filters conflict zones, flags risky airspace, and finds the safest route to your destination.",
  keywords: ["flights", "flight search", "safe flights", "conflict zones", "flight safety", "cheap flights"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "FlyFast - Find the safest flight",
    description:
      "Search flights that automatically avoid conflict zones and risky airspace. Free, no login required.",
    type: "website",
    siteName: "FlyFast",
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FlyFast — find the safest flight",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlyFast - Find the safest flight",
    description:
      "Search flights that automatically avoid conflict zones and risky airspace.",
    images: ["/og-image.png"],
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
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} antialiased`}>
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
