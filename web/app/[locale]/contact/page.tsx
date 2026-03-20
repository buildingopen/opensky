import { getTranslations, setRequestLocale } from "next-intl/server";
import { TableOfContents } from "@/components/TableOfContents";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("title"), description: t("description"), alternates: { canonical: `${siteUrl}/${locale}/contact` } };
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "Is FlyFast free?", acceptedAnswer: { "@type": "Answer", text: "Yes. No login, no ads, no premium tier. You get 10 searches per hour." } },
    { "@type": "Question", name: "Does FlyFast sell tickets?", acceptedAnswer: { "@type": "Answer", text: "No. FlyFast finds and ranks flights. When you click a result, you book directly with the airline or via Google Flights." } },
    { "@type": "Question", name: "How accurate is the conflict zone data?", acceptedAnswer: { "@type": "Answer", text: "The dataset is updated regularly and covers active conflict zones, restricted airspace, and aviation advisories. It may not reflect changes from the last few days. Always check official government advisories before booking." } },
    { "@type": "Question", name: "Can I use FlyFast data in my app?", acceptedAnswer: { "@type": "Answer", text: "The code is open source under the MIT license. For questions or collaboration, email hello@buildingopen.org." } },
  ],
};

export default async function ContactPage() {
  const t = await getTranslations("contact");

  const tocItems = [
    { id: "get-in-touch", label: t("tocGetInTouch") },
    { id: "open-source", label: t("tocOpenSource") },
    { id: "common-questions", label: t("tocCommonQuestions") },
  ];

  const emailLink = (chunks: React.ReactNode) => (
    <a className="text-[var(--color-interactive)] hover:underline" href="mailto:hello@buildingopen.org">{chunks}</a>
  );

  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("heading")}</h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        {t.rich("intro", {
          link: (chunks) => <a className="text-[var(--color-interactive)] hover:underline" href="https://buildingopen.org" target="_blank" rel="noopener noreferrer">{chunks}</a>
        })}
      </p>

      <div className="lg:grid lg:grid-cols-[1fr_180px] lg:gap-12 mt-10">
        <section className="space-y-8 text-sm text-[var(--color-text-muted)]">

          {/* Get in touch */}
          <div id="get-in-touch">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">{t("getInTouchHeading")}</h2>
            <div className="space-y-4">
              <div className="bg-[var(--color-surface-2)] rounded-lg p-4">
                <p className="text-[var(--color-text)] font-medium">{t("generalTitle")}</p>
                <p className="mt-1">
                  {t.rich("generalBody", { email: emailLink })}
                </p>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-lg p-4">
                <p className="text-[var(--color-text)] font-medium">{t("bugsTitle")}</p>
                <p className="mt-1">
                  {t.rich("bugsBody", {
                    github: (chunks) => <a className="text-[var(--color-interactive)] hover:underline" href="https://github.com/buildingopen/opensky/issues" target="_blank" rel="noopener noreferrer">{chunks}</a>
                  })}
                </p>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-lg p-4">
                <p className="text-[var(--color-text)] font-medium">{t("partnershipsTitle")}</p>
                <p className="mt-1">
                  {t.rich("partnershipsBody", { email: emailLink })}
                </p>
              </div>
            </div>
          </div>

          {/* Open source */}
          <div id="open-source">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">{t("openSourceHeading")}</h2>
            <p>
              {t.rich("openSourceBody", {
                repo: (chunks) => <a className="text-[var(--color-interactive)] hover:underline" href="https://github.com/buildingopen/opensky" target="_blank" rel="noopener noreferrer">{chunks}</a>
              })}
            </p>
          </div>

          {/* FAQ */}
          <div id="common-questions">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">{t("commonQuestionsHeading")}</h2>
            <div className="space-y-4">
              <div>
                <p className="text-[var(--color-text)] font-medium">{t("faqFreeQ")}</p>
                <p className="mt-1">{t("faqFreeA")}</p>
              </div>
              <div>
                <p className="text-[var(--color-text)] font-medium">{t("faqTicketsQ")}</p>
                <p className="mt-1">{t("faqTicketsA")}</p>
              </div>
              <div>
                <p className="text-[var(--color-text)] font-medium">{t("faqAccuracyQ")}</p>
                <p className="mt-1">{t("faqAccuracyA")}</p>
              </div>
              <div>
                <p className="text-[var(--color-text)] font-medium">{t("faqApiQ")}</p>
                <p className="mt-1">
                  {t.rich("faqApiA", { email: emailLink })}
                </p>
              </div>
            </div>
          </div>
        </section>

        <TableOfContents items={tocItems} />
      </div>
    </main>
  );
}
