"use client";

import { useTheme } from "./ThemeProvider";
import { useTranslations } from "next-intl";

const CYCLE: Array<"system" | "light" | "dark"> = ["system", "light", "dark"];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const t = useTranslations("header");

  const next = () => {
    const idx = CYCLE.indexOf(mode);
    setMode(CYCLE[(idx + 1) % CYCLE.length]);
  };

  const label =
    mode === "system" ? t("themeSystem") : mode === "light" ? t("themeLight") : t("themeDark");

  return (
    <button
      onClick={next}
      className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1.5"
      aria-label={`${t("theme")}: ${label}`}
      title={label}
    >
      {mode === "system" && (
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
          <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z" clipRule="evenodd" />
        </svg>
      )}
      {mode === "light" && (
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
          <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.06l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 5.404a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 14.596a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z" />
        </svg>
      )}
      {mode === "dark" && (
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
          <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}
