import { getTranslations, setRequestLocale } from "next-intl/server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flyfast.app";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "terms" });
  return { title: t("title"), description: t("description"), alternates: { canonical: `${siteUrl}/${locale}/terms` } };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terms");
  const localizedDate = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(2026, 2));

  const link = (href: string, opts?: { mailto?: boolean }) => {
    function RichLink(chunks: React.ReactNode) {
      return (
        <a
          className="text-[var(--color-interactive)] hover:underline"
          href={opts?.mailto ? `mailto:${href}` : href}
          target={opts?.mailto ? undefined : "_blank"}
          rel={opts?.mailto ? undefined : "noopener noreferrer"}
        >
          {chunks}
        </a>
      );
    }

    return RichLink;
  };

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">{t("heading")}</h1>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t("lastUpdated", { date: localizedDate })}</p>
      <p className="mt-4 text-[var(--color-text)]">
        {t.rich("intro", { link: link("https://buildingopen.org") })}
      </p>

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text)]">

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("serviceHeading")}</h2>
          <p>{t("serviceBody")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("accuracyHeading")}</h2>
          <p>{t("accuracyBody")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("conflictHeading")}</h2>
          <p>{t("conflictBody")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("alertsHeading")}</h2>
          <p>{t("alertsBody")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("useHeading")}</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>{t("useItem1")}</li>
            <li>{t("useItem2")}</li>
            <li>{t("useItem3")}</li>
          </ul>
          <p className="mt-2">{t("useBlockNotice")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("ipHeading")}</h2>
          <p>
            {t.rich("ipBody", { link: link("https://github.com/buildingopen/opensky") })}
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("liabilityHeading")}</h2>
          <p>{t("liabilityBody")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("changesHeading")}</h2>
          <p>{t("changesBody")}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">{t("contactHeading")}</h2>
          <p>
            {t.rich("contactBody", { link: link("hello@buildingopen.org", { mailto: true }) })}
          </p>
        </div>
      </section>

    </main>
  );
}
