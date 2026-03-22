import { getTranslations } from "next-intl/server";
import { Link } from "../../i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main id="main-content" className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <svg viewBox="0 0 32 32" className="w-12 h-12 mb-6" fill="none">
        <path d="M9 27V11L15 4" stroke="var(--color-interactive)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" opacity={0.3} />
        <path d="M19 27V11L25 4" stroke="var(--color-interactive)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" opacity={0.3} />
        <line x1="4" y1="15" x2="26" y2="15" stroke="var(--color-interactive)" strokeWidth="2.8" strokeLinecap="square" opacity={0.3} />
      </svg>
      <h1 className="text-5xl font-bold tracking-tight text-[var(--color-text)] mb-3">{t("title")}</h1>
      <p className="text-lg text-[var(--color-text-muted)] mb-8">
        {t("message")}
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-[var(--color-interactive)] hover:bg-[var(--color-interactive-hover)] text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
      >
        <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none">
          <path d="M9 27V11L15 4" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M19 27V11L25 4" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
          <line x1="4" y1="15" x2="26" y2="15" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square" />
        </svg>
        {t("searchFlights")}
      </Link>
    </main>
  );
}
