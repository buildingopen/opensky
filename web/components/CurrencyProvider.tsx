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
