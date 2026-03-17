"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { currencyMap, type Locale } from "../i18n/config";

const COOKIE_NAME = "flyfast-currency";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "\u20ac", GBP: "\u00a3", BRL: "R$", CNY: "\u00a5", SAR: "\ufdfc",
  INR: "\u20b9", JPY: "\u00a5", KRW: "\u20a9", TRY: "\u20ba", AUD: "A$", CAD: "C$",
  CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr", PLN: "z\u0142", CZK: "K\u010d",
  HUF: "Ft", THB: "\u0e3f", SGD: "S$", HKD: "HK$", NZD: "NZ$", MXN: "MX$",
  ARS: "AR$", CLP: "CL$", COP: "CO$", PEN: "S/", ZAR: "R", AED: "\u062f.\u0625",
  ILS: "\u20aa", EGP: "E\u00a3", NGN: "\u20a6", KES: "KSh", PHP: "\u20b1",
  IDR: "Rp", MYR: "RM", VND: "\u20ab", TWD: "NT$", PKR: "\u20a8",
};

export const CURRENCIES = [
  "USD", "EUR", "GBP", "BRL", "CNY", "SAR", "INR", "JPY", "KRW", "TRY",
  "AUD", "CAD", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "THB",
  "SGD", "HKD", "NZD", "MXN", "ARS", "CLP", "COP", "PEN", "ZAR", "AED",
  "ILS", "EGP", "NGN", "KES", "PHP", "IDR", "MYR", "VND", "TWD", "PKR",
] as const;

interface CurrencyContextValue {
  currency: string;
  setCurrency: (c: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "EUR",
  setCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const locale = useLocale() as Locale;
  const defaultCurrency = currencyMap[locale] || "EUR";

  const [currency, setCurrencyState] = useState<string>(() => {
    return getCookie(COOKIE_NAME) || defaultCurrency;
  });

  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c);
    setCookie(COOKIE_NAME, c);
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
