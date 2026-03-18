"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "flyfast_consent";
const EVENT_NAME = "flyfast_consent_change";

export function CookieConsent() {
  const t = useTranslations("consent");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);

    const onConsentChange = () => {
      const val = localStorage.getItem(STORAGE_KEY);
      setVisible(!val);
    };
    window.addEventListener(EVENT_NAME, onConsentChange);
    return () => window.removeEventListener(EVENT_NAME, onConsentChange);
  }, []);

  if (!visible) return null;

  const respond = (choice: "accepted" | "declined") => {
    localStorage.setItem(STORAGE_KEY, choice);
    setVisible(false);
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-[var(--color-surface)] border-t border-[var(--color-border)] shadow-lg card-surface">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm text-[var(--color-text-muted)]">
        <p className="flex-1">{t("message")}</p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => respond("declined")}
            className="px-4 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            {t("decline")}
          </button>
          <button
            onClick={() => respond("accepted")}
            className="px-4 py-1.5 rounded bg-[var(--color-interactive)] text-black font-medium hover:opacity-90 transition-opacity"
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
