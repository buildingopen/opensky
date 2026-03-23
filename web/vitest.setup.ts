import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = () => {};

const translations: Record<string, string> = {
  "savedSearches.recentSearches": "Recent searches",
  "savedSearches.clear": "Clear",
  "savedSearches.clearHistory": "Clear search history",
  "savedSearches.searchLabel": "Search: {query}",
  "search.airlineFilter.ariaLabel": "Filter by airline",
  "search.airlineFilter.showing": "Showing {filtered} of {total} flights",
};

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace?: string) =>
    (key: string, values?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      let template = translations[fullKey] || fullKey;
      if (values) {
        for (const [name, value] of Object.entries(values)) {
          template = template.replace(`{${name}}`, String(value));
        }
      }
      return template;
    },
  useLocale: () => "en",
}));
