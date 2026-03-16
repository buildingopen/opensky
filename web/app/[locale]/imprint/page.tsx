import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "imprint" });
  return { title: t("title"), description: t("description") };
}

export default async function ImprintPage() {
  const t = await getTranslations("imprint");
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("heading")}</h1>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t("legalBasis")}</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)] italic">{t("germanAuthoritative")}</p>

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text-muted)]">

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("infoHeading")}</h2>
          <p>
            {t("companyName")}<br />
            {t("personName")}<br />
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("contactHeading")}</h2>
          <p>
            {t("emailLabel")}:{" "}
            <a className="text-[var(--color-accent)] hover:underline" href={`mailto:${t("contactEmail")}`}>
              {t("contactEmail")}
            </a>
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            {t("responsibleHeading")}
          </h2>
          <p>{t("responsiblePerson")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("disclaimerHeading")}</h2>

          <h3 className="font-medium text-[var(--color-text)] mt-4 mb-1">{t("contentLiabilityHeading")}</h3>
          <p>{t("contentLiabilityText")}</p>

          <h3 className="font-medium text-[var(--color-text)] mt-4 mb-1">{t("linkLiabilityHeading")}</h3>
          <p>{t("linkLiabilityText")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("disputeHeading")}</h2>
          <p>
            {t("disputeTextBefore")}{" "}
            <a
              className="text-[var(--color-accent)] hover:underline"
              href={t("disputeUrl")}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("disputeUrl")}
            </a>
            . {t("disputeTextAfter")}
          </p>
        </div>

      </section>
    </main>
  );
}
