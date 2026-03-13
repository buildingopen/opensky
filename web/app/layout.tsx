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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://opensky.buildingopen.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "OpenSky - Find flights that avoid conflict zones",
  description:
    "Search flights across multiple providers. Automatically filters routes through conflict zones, flags risky airspace, and finds the safest path to your destination.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "OpenSky - Find flights that avoid conflict zones",
    description:
      "Search flights that automatically avoid conflict zones and risky airspace. Free, open source.",
    type: "website",
    siteName: "OpenSky",
    url: "/",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "OpenSky flight safety search",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenSky - Find flights that avoid conflict zones",
    description:
      "Search flights that automatically avoid conflict zones and risky airspace.",
    images: ["/og-image.svg"],
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
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2322c55e'><path d='M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 2.59 4.49L21 11.49c.81-.23 1.28-1.05 1.07-1.85z'/></svg>"
        />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} antialiased`}>
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
