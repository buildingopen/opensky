import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenSky - Find flights that avoid conflict zones",
  description:
    "Search flights across multiple providers. Automatically filters routes through conflict zones, flags risky airspace, and finds the safest path to your destination.",
  openGraph: {
    title: "OpenSky - Find flights that avoid conflict zones",
    description:
      "Search flights that automatically avoid conflict zones and risky airspace. Free, open source.",
    type: "website",
    siteName: "OpenSky",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenSky - Find flights that avoid conflict zones",
    description:
      "Search flights that automatically avoid conflict zones and risky airspace.",
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
