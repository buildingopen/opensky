"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "../i18n/navigation";
import { locales } from "../i18n/config";
import { useCurrency, CURRENCIES, CURRENCY_SYMBOLS } from "./CurrencyProvider";

export function SiteHeader() {
  const t = useTranslations("header");
  const tLocale = useTranslations("locale");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [gitHubStars, setGitHubStars] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [localePickerOpen, setLocalePickerOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const { currency, setCurrency } = useCurrency();
  const currencyPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/github-stars")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stars != null) setGitHubStars(d.stars);
      })
      .catch(() => {});
  }, []);

  // Lock body scroll when menu open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Close locale picker on outside click
  useEffect(() => {
    if (!localePickerOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-locale-picker]")) setLocalePickerOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [localePickerOpen]);

  // Close currency picker on outside click
  useEffect(() => {
    if (!currencyPickerOpen) return;
    const close = (e: MouseEvent) => {
      if (currencyPickerRef.current && !currencyPickerRef.current.contains(e.target as Node)) setCurrencyPickerOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [currencyPickerOpen]);

  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
    setLocalePickerOpen(false);
    setMenuOpen(false);
  };

  const navLinks = [
    { href: "/methodology" as const, label: t("howItWorks") },
    { href: "/safety" as const, label: t("safety") },
    { href: "/contact" as const, label: t("contact") },
  ];

  return (
    <>
    <header className="sticky top-0 z-40 bg-transparent backdrop-blur-md [transform:translateZ(0)]">
      <div className="max-w-[min(64rem,92vw)] mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
            <path d="M9 27V11L15 4" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
            <path d="M19 27V11L25 4" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
            <line x1="4" y1="15" x2="26" y2="15" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" />
          </svg>
          <span className="text-lg font-semibold tracking-tighter font-[family-name:var(--font-brand)]">
            <span className="text-[var(--color-accent)]">fly</span><span className="text-[var(--color-text)]">fast</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/buildingopen/opensky"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors inline-flex items-center gap-1.5"
          >
            GitHub
            {gitHubStars !== null && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-1.5 py-0.5 rounded-full tabular-nums text-[var(--color-text-muted)]">
                <svg viewBox="0 0 16 16" className="w-3 h-3 fill-[var(--color-text-muted)]">
                  <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
                </svg>
                {gitHubStars}
              </span>
            )}
          </a>

          {/* Locale picker */}
          <div className="relative" data-locale-picker>
            <button
              onClick={() => setLocalePickerOpen((v) => !v)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1.5 inline-flex items-center gap-1"
              aria-label={tLocale("switchLanguage")}
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
                <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.497-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium uppercase">{locale}</span>
            </button>
            {localePickerOpen && (
              <div className="absolute end-0 top-full mt-1 w-40 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden z-50">
                {locales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => switchLocale(loc)}
                    className={`w-full text-start px-4 py-2 text-sm transition-colors ${
                      loc === locale
                        ? "text-[var(--color-interactive)] bg-[var(--color-interactive)]/10 font-medium"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                    }`}
                  >
                    {tLocale(loc)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Currency picker */}
          <div className="relative" ref={currencyPickerRef}>
            <button
              onClick={() => setCurrencyPickerOpen((v) => !v)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-xs font-medium px-1.5 py-1"
              aria-label={t("selectCurrency")}
            >
              {CURRENCY_SYMBOLS[currency] || ""} {currency}
            </button>
            {currencyPickerOpen && (
              <div className="absolute end-0 top-full mt-1 w-48 max-h-64 overflow-y-auto bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl z-50">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCurrency(c); setCurrencyPickerOpen(false); }}
                    className={`w-full text-start px-4 py-2 text-sm transition-colors ${
                      c === currency
                        ? "text-[var(--color-interactive)] bg-[var(--color-interactive)]/10 font-medium"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                    }`}
                  >
                    {CURRENCY_SYMBOLS[c] || ""} {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Mobile hamburger button */}
        <div className="flex items-center gap-1 md:hidden">
          {/* Mobile locale picker */}
          <div className="relative" data-locale-picker>
            <button
              onClick={() => setLocalePickerOpen((v) => !v)}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors inline-flex items-center gap-1"
              aria-label={tLocale("switchLanguage")}
            >
              <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
                <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.497-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium uppercase">{locale}</span>
            </button>
            {localePickerOpen && (
              <div className="absolute end-0 top-full mt-1 w-40 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden z-50">
                {locales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => switchLocale(loc)}
                    className={`w-full text-start px-4 py-2 text-sm transition-colors ${
                      loc === locale
                        ? "text-[var(--color-interactive)] bg-[var(--color-interactive)]/10 font-medium"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                    }`}
                  >
                    {tLocale(loc)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile currency picker */}
          <button
            onClick={() => setCurrencyPickerOpen((v) => !v)}
            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-xs font-medium"
            aria-label={t("selectCurrency")}
          >
            {CURRENCY_SYMBOLS[currency] || ""} {currency}
          </button>

          <button
            onClick={() => setMenuOpen(true)}
            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            aria-label={t("openMenu")}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

    </header>

    {/* Mobile slide-in panel – rendered outside <header> so iOS Safari's
        [transform:translateZ(0)] doesn't break position:fixed */}
    {menuOpen && (
      <div className="fixed inset-0 z-50 md:hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/80 transition-opacity"
          onClick={() => setMenuOpen(false)}
        />
        {/* Panel */}
        <div className="absolute end-0 top-0 h-full w-64 bg-[var(--color-surface)] border-s border-[var(--color-border)] shadow-xl flex flex-col animate-slide-in-right">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
                <path d="M9 27V11L15 4" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
                <path d="M19 27V11L25 4" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
                <line x1="4" y1="15" x2="26" y2="15" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" />
              </svg>
              <span className="text-lg font-semibold tracking-tighter font-[family-name:var(--font-brand)]">
                <span className="text-[var(--color-accent)]">fly</span><span className="text-[var(--color-text)]">fast</span>
              </span>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              aria-label={t("closeMenu")}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex flex-col py-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://github.com/buildingopen/opensky"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="px-4 py-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors inline-flex items-center gap-1.5"
            >
              GitHub
              {gitHubStars !== null && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-1.5 py-0.5 rounded-full tabular-nums text-[var(--color-text-muted)]">
                  <svg viewBox="0 0 16 16" className="w-3 h-3 fill-[var(--color-text-muted)]">
                    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
                  </svg>
                  {gitHubStars}
                </span>
              )}
            </a>
          </nav>
        </div>
      </div>
    )}
    </>
  );
}
