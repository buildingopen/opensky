import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "privacy" });
  return { title: t("title"), description: t("description") };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");
  const localizedDate = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(2026, 2));

  const bold = (chunks: React.ReactNode) => (
    <span className="text-[var(--color-text)] font-medium">{chunks}</span>
  );

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("heading")}</h1>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t("lastUpdated", { date: localizedDate })}</p>
      <p className="mt-4 text-[var(--color-text-muted)]">
        {t.rich("intro", {
          link: (chunks) => <a className="text-[var(--color-accent)] hover:underline" href="https://buildingopen.org" target="_blank" rel="noopener noreferrer">{chunks}</a>
        })}
      </p>

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text-muted)]">

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("whatWeCollectHeading")}</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>{t.rich("whatWeCollectSearchQueries", { bold })}</li>
            <li>{t.rich("whatWeCollectAnalytics", { bold })}</li>
            <li>{t.rich("whatWeCollectRateLimit", { bold })}</li>
            <li>{t.rich("whatWeCollectEmail", { bold })}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("whatWeDoNotCollectHeading")}</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>{t("whatWeDoNotCollect1")}</li>
            <li>{t("whatWeDoNotCollect2")}</li>
            <li>{t("whatWeDoNotCollect3")}</li>
            <li>{t("whatWeDoNotCollect4")}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("thirdPartyHeading")}</h2>
          <p>{t("thirdPartyIntro")}</p>
          <ul className="mt-2 space-y-2 list-disc list-inside">
            <li>{t.rich("thirdPartyGoogleFlights", { bold })}</li>
            <li>{t.rich("thirdPartyGemini", { bold })}</li>
            <li>{t.rich("thirdPartyPostHog", { bold })}</li>
            <li>{t.rich("thirdPartyVercel", { bold })}</li>
            <li>{t.rich("thirdPartyResend", { bold })}</li>
          </ul>
          <p className="mt-2">{t("thirdPartyOutro")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("dataRetentionHeading")}</h2>
          <p>{t("dataRetention")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("yourRightsHeading")}</h2>
          <p>
            {t.rich("yourRights", {
              emailLink: (chunks) => <a className="text-[var(--color-accent)] hover:underline" href="mailto:hello@buildingopen.org">{chunks}</a>
            })}
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("openSourceHeading")}</h2>
          <p>
            {t.rich("openSource", {
              repoLink: (chunks) => <a className="text-[var(--color-accent)] hover:underline" href="https://github.com/buildingopen/opensky" target="_blank" rel="noopener noreferrer">{chunks}</a>
            })}
          </p>
        </div>
      </section>

    </main>
  );
}
