import type { Metadata } from "next";
import Link from "next/link";
import { getZones, RISK_CONFIG } from "./zones-data";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Conflict Zone Airspace Map - FlyFast",
  description:
    "Live status of 19 conflict zones affecting commercial aviation. Updated daily with EASA, FAA, and safeairspace.net data.",
};

const itemListSchema = (zoneIds: string[]) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Conflict Zone Airspace Status",
  numberOfItems: zoneIds.length,
  itemListElement: zoneIds.map((id, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `https://flyfast.app/safety/${id}`,
  })),
});

const GROUP_ORDER: Array<"do_not_fly" | "high_risk" | "caution"> = [
  "do_not_fly",
  "high_risk",
  "caution",
];

const GROUP_LABELS: Record<string, string> = {
  do_not_fly: "Do Not Fly",
  high_risk: "High Risk",
  caution: "Caution",
};

export default async function SafetyIndexPage() {
  const zones = await getZones();

  const grouped = GROUP_ORDER.map((level) => ({
    level,
    label: GROUP_LABELS[level],
    color: RISK_CONFIG[level].color,
    zones: zones.filter((z) => z.risk_level === level),
  }));

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListSchema(zones.map((z) => z.id))),
        }}
      />
      <h1 className="text-3xl font-bold text-[var(--color-text)]">
        Conflict Zone Airspace Map
      </h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        Live status of {zones.length} conflict zones affecting commercial
        aviation. FlyFast checks every flight against this data and filters
        unsafe routes automatically.
      </p>

      <section className="mt-10 space-y-10">
        {grouped.map((group) => (
          <div key={group.level}>
            <div className="flex items-center gap-2 mb-4">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: group.color }}
              />
              <h2 className="text-lg font-semibold text-[var(--color-text)]">
                {group.label}
              </h2>
              <span className="text-xs text-[var(--color-text-muted)]">
                ({group.zones.length})
              </span>
            </div>
            <div className="grid gap-2">
              {group.zones.map((zone) => (
                <Link
                  key={zone.id}
                  href={`/safety/${zone.id}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3 hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <div>
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {zone.name}
                    </span>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
                      {zone.details}
                    </p>
                  </div>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-4"
                    style={{
                      backgroundColor: `${group.color}20`,
                      color: group.color,
                    }}
                  >
                    {group.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <p className="mt-12 text-xs text-[var(--color-text-muted)]">
        Data from EASA Conflict Zone Information Bulletins, FAA NOTAMs, and
        safeairspace.net. Refreshed daily.{" "}
        <Link
          href="/methodology"
          className="text-[var(--color-accent)] hover:underline"
        >
          Learn how FlyFast uses this data
        </Link>
        .
      </p>
    </main>
  );
}
