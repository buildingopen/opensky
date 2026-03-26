"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "../i18n/navigation";
import { locales } from "../i18n/config";
import { useCurrency, CURRENCIES, CURRENCY_SYMBOLS } from "./CurrencyProvider";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "./ThemeProvider";

function MobileThemeSelect() {
  const { mode, setMode } = useTheme();
  const t = useTranslations("header");
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]/60 mb-1 block">{t("theme")}</label>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as "light" | "dark" | "system")}
        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm text-[var(--color-text)]"
      >
        <option value="system">{t("themeSystem")}</option>
        <option value="light">{t("themeLight")}</option>
        <option value="dark">{t("themeDark")}</option>
      </select>
    </div>
  );
}

export function SiteHeader() {
  const t = useTranslations("header");
  const tLocale = useTranslations("locale");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [localePickerOpen, setLocalePickerOpen] = useState(false);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const { currency, setCurrency } = useCurrency();

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
      const target = e.target as HTMLElement;
      if (!target.closest("[data-currency-picker]")) setCurrencyPickerOpen(false);
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
    { href: "/flights" as const, label: t("flights") },
    { href: "/methodology" as const, label: t("howItWorks") },
    { href: "/safety" as const, label: t("safety") },
    { href: "/contact" as const, label: t("contact") },
  ];

  return (
    <>
    <header className="sticky top-0 z-40 bg-transparent backdrop-blur-md [transform:translateZ(0)]">
      <div className="max-w-[min(64rem,92vw)] mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="FlyFast home">
          <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
            <path d="M9 27V11L15 4" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
            <path d="M19 27V11L25 4" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
            <line x1="4" y1="15" x2="26" y2="15" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" />
          </svg>
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
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            GitHub
          </a>

          <ThemeToggle />

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
          <div className="relative" data-currency-picker>
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
          <ThemeToggle />

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
          <div className="relative" data-currency-picker>
            <button
              onClick={() => setCurrencyPickerOpen((v) => !v)}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-xs font-medium"
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
        <div className="absolute end-0 top-0 h-full w-64 bg-[var(--color-background)] border-s border-[var(--color-border)] shadow-xl flex flex-col animate-slide-in-right">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center">
              <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
                <path d="M9 27V11L15 4" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
                <path d="M19 27V11L25 4" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
                <line x1="4" y1="15" x2="26" y2="15" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" />
              </svg>
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
          <nav className="flex flex-col py-2 flex-1">
            {navLinks.map((link) => {
              const icons: Record<string, React.ReactNode> = {
                "/flights": <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.926A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95l16.97-7.723a.75.75 0 000-1.378L3.105 2.289z"/></svg>,
                "/methodology": <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M10 1a.75.75 0 01.75.75v1.5a3.5 3.5 0 01-1.072 2.524l-.678.633A1.5 1.5 0 008.5 7.5v.5a.75.75 0 00.75.75h1.5a.75.75 0 00.75-.75v-.5a1.5 1.5 0 00-.5-1.093l-.678-.633A3.5 3.5 0 019.25 3.25v-1.5A.75.75 0 0110 1zM8.5 10.75a.75.75 0 00-.75.75v1a.75.75 0 00.75.75h3a.75.75 0 00.75-.75v-1a.75.75 0 00-.75-.75h-3zM8.75 15a.75.75 0 000 1.5h2.5a.75.75 0 000-1.5h-2.5z"/></svg>,
                "/safety": <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="currentColor"><path fillRule="evenodd" d="M9.661 2.237a.75.75 0 01.678 0 12.2 12.2 0 006.024 2.193.75.75 0 01.665.734c.066 2.416-.46 4.678-1.45 6.434-1.003 1.778-2.539 3.14-4.508 3.47a.75.75 0 01-.24 0c-1.97-.33-3.506-1.692-4.509-3.47C5.33 9.862 4.805 7.6 4.872 5.164a.75.75 0 01.665-.734 12.2 12.2 0 006.024-2.193zM10 6.5a.75.75 0 01.75.75v2a.75.75 0 01-1.5 0v-2A.75.75 0 0110 6.5zm.75 5.75a.75.75 0 00-1.5 0v.01a.75.75 0 001.5 0v-.01z" clipRule="evenodd"/></svg>,
                "/contact": <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.161V6a2 2 0 00-2-2H3z"/><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z"/></svg>,
              };
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`px-5 py-3.5 text-sm transition-colors inline-flex items-center gap-3 ${
                    isActive
                      ? "text-[var(--color-interactive)] bg-[var(--color-interactive)]/10 border-s-2 border-[var(--color-interactive)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] border-s-2 border-transparent"
                  }`}
                >
                  {icons[link.href] || null}
                  {link.label}
                </Link>
              );
            })}

            {/* Separator */}
            <div className="mx-4 my-2 border-t border-[var(--color-border)]" />

            <a
              href="https://github.com/buildingopen/opensky"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="px-5 py-3.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors inline-flex items-center gap-3 border-s-2 border-transparent"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4 shrink-0 fill-current"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              GitHub
            </a>

            {/* Locale, Currency & Theme pickers inside panel */}
            <div className="mt-auto px-5 py-4 border-t border-[var(--color-border)] flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]/60 mb-1 block">{tLocale("switchLanguage")}</label>
                  <select
                    value={locale}
                    onChange={(e) => switchLocale(e.target.value)}
                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm text-[var(--color-text)]"
                  >
                    {locales.map((loc) => (
                      <option key={loc} value={loc}>{tLocale(loc)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]/60 mb-1 block">{t("selectCurrency")}</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-2 py-1.5 text-sm text-[var(--color-text)]"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{CURRENCY_SYMBOLS[c] || ""} {c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <MobileThemeSelect />
            </div>
          </nav>
        </div>
      </div>
    )}
    </>
  );
}
