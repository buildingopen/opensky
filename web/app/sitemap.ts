import type { MetadataRoute } from "next";
import { getZones } from "./safety/zones-data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/privacy", "/terms", "/methodology", "/contact"];
  const now = new Date();

  const staticPages = pages.map((path) => {
    const changeFrequency: "daily" | "monthly" = path === "" ? "daily" : "monthly";
    return {
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency,
      priority: path === "" ? 1 : 0.7,
    };
  });

  const zones = await getZones();

  const safetyIndex = {
    url: `${siteUrl}/safety`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  };

  const safetyPages = zones.map((zone) => ({
    url: `${siteUrl}/safety/${zone.id}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, safetyIndex, ...safetyPages];
}
