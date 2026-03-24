import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "../i18n/config";
import { getZones } from "./[locale]/safety/zones-data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

function localeAlternates(path: string): Record<string, string> {
  const alts: Record<string, string> = {};
  for (const locale of locales) {
    alts[locale] = `${siteUrl}/${locale}${path}`;
  }
  alts["x-default"] = `${siteUrl}/${defaultLocale}${path}`;
  return alts;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/privacy", "/terms", "/methodology", "/contact", "/imprint", "/api-access"];
  const now = new Date();

  const staticPages = pages.flatMap((path) => {
    const changeFrequency: "daily" | "monthly" = path === "" ? "daily" : "monthly";
    const priority = path === "" ? 1 : 0.7;
    return locales.map((locale) => ({
      url: `${siteUrl}/${locale}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages: localeAlternates(path) },
    }));
  });

  const zones = await getZones();

  const safetyPages = locales.flatMap((locale) => [
    {
      url: `${siteUrl}/${locale}/safety`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
      alternates: { languages: localeAlternates("/safety") },
    },
    ...zones.map((zone) => ({
      url: `${siteUrl}/${locale}/safety/${zone.id}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
      alternates: { languages: localeAlternates(`/safety/${zone.id}`) },
    })),
  ]);

  return [...staticPages, ...safetyPages];
}
