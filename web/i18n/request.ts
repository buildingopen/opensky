import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    onError(error) {
      if (error.code === "MISSING_MESSAGE") {
        // In dev, log missing keys. In prod, silently fall back.
        if (process.env.NODE_ENV === "development") {
          console.warn(`[next-intl] Missing: ${error.message}`);
        }
      } else {
        console.error("[next-intl]", error);
      }
    },
    getMessageFallback({ namespace, key }) {
      return `${namespace}.${key}`;
    },
  };
});
