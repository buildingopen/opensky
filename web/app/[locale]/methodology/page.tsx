import { getTranslations, setRequestLocale } from "next-intl/server";
import { TableOfContents } from "@/components/TableOfContents";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "methodology" });
  return { title: t("title"), description: t("description"), alternates: { canonical: `${siteUrl}/${locale}/methodology` } };
}

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to search for safe flights using FlyFast",
  description: "Use natural language to search every available flight, filter conflict zones, and book directly.",
  step: [
    { "@type": "HowToStep", name: "Describe your trip", text: "Go to flyfast.app and type your trip in plain English. For example: 'Berlin to anywhere warm under $300' or 'London to Tokyo next month, business class'." },
    { "@type": "HowToStep", name: "Review results", text: "FlyFast searches every available flight, filters conflict zones, and ranks by price, duration, stops, and route safety. Each flight shows a safety badge: Safe, Caution, High Risk, or Do Not Fly." },
    { "@type": "HowToStep", name: "Book your flight", text: "Click any result to go directly to the airline to compare and book. FlyFast does not sell tickets; you book with the provider." },
  ],
  tool: { "@type": "HowToTool", name: "FlyFast (flyfast.app)" },
};

export default async function MethodologyPage() {
  const t = await getTranslations("methodology");

  const tocItems = [
    { id: "describe", label: t("toc.describe") },
    { id: "parse", label: t("toc.parse") },
    { id: "search", label: t("toc.search") },
    { id: "safety", label: t("toc.safety") },
    { id: "rank", label: t("toc.rank") },
    { id: "book", label: t("toc.book") },
    { id: "data-sources", label: t("toc.dataSources") },
    { id: "comparison", label: t("toc.comparison") },
    { id: "limitations", label: t("toc.limitations") },
  ];

  return (
    <main id="main-content" className="max-w-5xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("heading")}</h1>
      <p className="mt-4 text-[var(--color-text)]">
        {t("intro")}
      </p>

      <div className="lg:grid lg:grid-cols-[1fr_180px] lg:gap-12 mt-10">
        <section className="space-y-8 text-sm text-[var(--color-text)]">

          {/* Step 1 */}
          <div id="describe">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("step1.heading")}</h2>
            <p>
              {t("step1.body")}
            </p>
            <div className="mt-3 bg-[var(--color-surface-2)] rounded-lg p-4 space-y-2 font-mono text-xs">
              <p className="text-[var(--color-text)]">&quot;{t("step1.example1")}&quot;</p>
              <p className="text-[var(--color-text)]">&quot;{t("step1.example2")}&quot;</p>
              <p className="text-[var(--color-text)]">&quot;{t("step1.example3")}&quot;</p>
              <p className="text-[var(--color-text)]">&quot;{t("step1.example4")}&quot;</p>
            </div>
            <p className="mt-3">
              {t("step1.nearbyAirports")}
            </p>
          </div>

          {/* Step 2 */}
          <div id="parse">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("step2.heading")}</h2>
            <p>
              {t("step2.body")}
            </p>
            <p className="mt-2">
              {t("step2.tooBroad")}
            </p>
          </div>

          {/* Step 3 */}
          <div id="search">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("step3.heading")}</h2>
            <p>
              {t("step3.body")}
            </p>
            <p className="mt-2">
              {t("step3.streaming")}
            </p>
          </div>

          {/* Step 4 */}
          <div id="safety">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("step4.heading")}</h2>
            <p>
              {t("step4.body")}
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[var(--color-safe)] shrink-0" />
                <span><span className="text-[var(--color-text)] font-medium">{t("step4.safe")}</span>: {t("step4.safeDesc")}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[var(--color-caution)] shrink-0" />
                <span><span className="text-[var(--color-text)] font-medium">{t("step4.caution")}</span>: {t("step4.cautionDesc")}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[var(--color-high-risk)] shrink-0" />
                <span><span className="text-[var(--color-text)] font-medium">{t("step4.highRisk")}</span>: {t("step4.highRiskDesc")}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[var(--color-danger)] shrink-0" />
                <span><span className="text-[var(--color-text)] font-medium">{t("step4.doNotFly")}</span>: {t("step4.doNotFlyDesc")}</span>
              </div>
            </div>
            <p className="mt-3">
              {t("step4.filtered")}
            </p>
          </div>

          {/* Step 5 */}
          <div id="rank">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("step5.heading")}</h2>
            <p>
              {t("step5.body")}
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><span className="text-[var(--color-text)] font-medium">{t("step5.price")}</span>: {t("step5.priceDesc")}</li>
              <li><span className="text-[var(--color-text)] font-medium">{t("step5.duration")}</span>: {t("step5.durationDesc")}</li>
              <li><span className="text-[var(--color-text)] font-medium">{t("step5.stops")}</span>: {t("step5.stopsDesc")}</li>
              <li><span className="text-[var(--color-text)] font-medium">{t("step5.safety")}</span>: {t("step5.safetyDesc")}</li>
            </ul>
            <p className="mt-3">
              {t("step5.labelsIntro")}
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><span className="text-[var(--color-text)] font-medium">{t("step5.recommended")}</span>: {t("step5.recommendedDesc")}</li>
              <li><span className="text-[var(--color-text)] font-medium">{t("step5.cheapest")}</span>: {t("step5.cheapestDesc")}</li>
              <li><span className="text-[var(--color-text)] font-medium">{t("step5.fastest")}</span>: {t("step5.fastestDesc")}</li>
              <li><span className="text-[var(--color-text)] font-medium">{t("step5.lowestStress")}</span>: {t("step5.lowestStressDesc")}</li>
            </ul>
          </div>

          {/* Step 6 */}
          <div id="book">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("step6.heading")}</h2>
            <p>
              {t("step6.body")}
            </p>
          </div>

          {/* Data sources */}
          <div id="data-sources" className="border-t border-[var(--color-border)] pt-8">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("dataSources.heading")}</h2>
            <ul className="space-y-2">
              <li>
                <span className="text-[var(--color-text)] font-medium">{t("dataSources.flightData")}</span> {t("dataSources.flightDataDesc")}
              </li>
              <li>
                <span className="text-[var(--color-text)] font-medium">{t("dataSources.conflictData")}</span> {t("dataSources.conflictDataDesc")}
              </li>
              <li>
                <span className="text-[var(--color-text)] font-medium">{t("dataSources.queryParsing")}</span> {t("dataSources.queryParsingDesc")}
              </li>
            </ul>
          </div>

          {/* Comparison */}
          <div id="comparison" className="border-t border-[var(--color-border)] pt-8">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("comparison.heading")}</h2>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-start">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="py-2 pe-4 text-[var(--color-text)] font-medium" />
                    <th className="py-2 px-4 text-[var(--color-text)] font-medium">{t("comparison.colFlyFast")}</th>
                    <th className="py-2 px-4 text-[var(--color-text)] font-medium">{t("comparison.colTraditional")}</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  <tr className="border-b border-[var(--color-border)]/30">
                    <td className="py-2.5 pe-4 text-[var(--color-text)]">{t("comparison.rowInput")}</td>
                    <td className="py-2.5 px-4">{t("comparison.flyFastInput")}</td>
                    <td className="py-2.5 px-4">{t("comparison.traditionalInput")}</td>
                  </tr>
                  <tr className="border-b border-[var(--color-border)]/30">
                    <td className="py-2.5 pe-4 text-[var(--color-text)]">{t("comparison.rowSafety")}</td>
                    <td className="py-2.5 px-4">{t("comparison.flyFastSafety")}</td>
                    <td className="py-2.5 px-4">{t("comparison.traditionalSafety")}</td>
                  </tr>
                  <tr className="border-b border-[var(--color-border)]/30">
                    <td className="py-2.5 pe-4 text-[var(--color-text)]">{t("comparison.rowMultiCity")}</td>
                    <td className="py-2.5 px-4">{t("comparison.flyFastMultiCity")}</td>
                    <td className="py-2.5 px-4">{t("comparison.traditionalMultiCity")}</td>
                  </tr>
                  <tr className="border-b border-[var(--color-border)]/30">
                    <td className="py-2.5 pe-4 text-[var(--color-text)]">{t("comparison.rowFlexDates")}</td>
                    <td className="py-2.5 px-4">{t("comparison.flyFastFlexDates")}</td>
                    <td className="py-2.5 px-4">{t("comparison.traditionalFlexDates")}</td>
                  </tr>
                  <tr className="border-b border-[var(--color-border)]/30">
                    <td className="py-2.5 pe-4 text-[var(--color-text)]">{t("comparison.rowLogin")}</td>
                    <td className="py-2.5 px-4">{t("comparison.flyFastLogin")}</td>
                    <td className="py-2.5 px-4">{t("comparison.traditionalLogin")}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pe-4 text-[var(--color-text)]">{t("comparison.rowPrice")}</td>
                    <td className="py-2.5 px-4">{t("comparison.flyFastPrice")}</td>
                    <td className="py-2.5 px-4">{t("comparison.traditionalPrice")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Limitations */}
          <div id="limitations" className="border-t border-[var(--color-border)] pt-8">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("limitations.heading")}</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>{t("limitations.notAdvice")}</li>
              <li>{t("limitations.priceChange")}</li>
              <li>{t("limitations.dataLag")}</li>
              <li>{t("limitations.rateLimit")}</li>
            </ul>
          </div>
        </section>

        <TableOfContents items={tocItems} />
      </div>
    </main>
  );
}
