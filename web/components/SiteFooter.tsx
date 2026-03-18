"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "../i18n/navigation";

const ZONES_UPDATED_YEAR = 2026;
const ZONES_UPDATED_MONTH = 2; // 0-indexed: March

function getLocalizedDate(locale: string): string {
  const date = new Date(ZONES_UPDATED_YEAR, ZONES_UPDATED_MONTH);
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}

export function SiteFooter() {
  const t = useTranslations("footer");
  const locale = useLocale();

  return (
    <footer className="border-t border-[var(--color-border)] mt-auto">
      <div className="max-w-[min(64rem,92vw)] mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[var(--color-text-muted)]">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold tracking-tighter font-[family-name:var(--font-brand)]">
            <span className="text-[var(--color-accent)]">fly</span><span className="text-[var(--color-text)]">fast</span>
          </span>
          <span>
            {t("builtBy")}{" "}
            <a href="https://buildingopen.org" className="text-[var(--color-text)] hover:text-[var(--color-interactive)]">
              Building Open
            </a>
          </span>
        </div>
        <div className="flex flex-col sm:items-end gap-2">
          <span>{t("zonesUpdated", { date: getLocalizedDate(locale) })}</span>
          <span className="flex flex-wrap justify-center gap-3">
            <Link href="/privacy" className="hover:text-[var(--color-text)]">{t("privacy")}</Link>
            <Link href="/terms" className="hover:text-[var(--color-text)]">{t("terms")}</Link>
            <Link href="/imprint" className="hover:text-[var(--color-text)]">{t("imprint")}</Link>
            <Link href="/methodology" className="hover:text-[var(--color-text)]">{t("methodology")}</Link>
            <Link href="/contact" className="hover:text-[var(--color-text)]">{t("contact")}</Link>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("flyfast_consent");
                window.dispatchEvent(new CustomEvent("flyfast_consent_change"));
              }}
              className="hover:text-[var(--color-text)]"
            >
              {t("cookieSettings")}
            </button>
          </span>
        </div>
      </div>
    </footer>
  );
}
