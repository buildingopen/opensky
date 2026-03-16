export const locales = ["en", "de", "es", "fr", "it", "pt", "zh", "ar", "hi", "ja", "ko", "tr"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const rtlLocales: Locale[] = ["ar"];

export const currencyMap: Record<Locale, string> = {
  en: "USD",
  de: "EUR",
  es: "EUR",
  fr: "EUR",
  it: "EUR",
  pt: "BRL",
  zh: "CNY",
  ar: "SAR",
  hi: "INR",
  ja: "JPY",
  ko: "KRW",
  tr: "TRY",
};

export function isRtl(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}
