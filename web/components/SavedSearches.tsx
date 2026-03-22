"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "flyfast_history";
const MAX_ITEMS = 10;

interface SavedSearch {
  query: string;
  timestamp: number;
}

export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSearches(JSON.parse(raw));
    } catch {}
  }, []);

  const save = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearches((prev) => {
      const filtered = prev.filter((s) => s.query !== trimmed);
      const next = [{ query: trimmed, timestamp: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clear = () => {
    setSearches([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  return { searches, save, clear };
}

export function SavedSearchesList({ searches, onSelect, onClear }: { searches: SavedSearch[]; onSelect: (q: string) => void; onClear: () => void }) {
  const t = useTranslations("savedSearches");

  if (searches.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--color-text-muted)]">{t("recentSearches")}</span>
        <button onClick={onClear} className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" aria-label={t("clearHistory")}>
          {t("clear")}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {searches.map((s, i) => (
          <button
            key={s.timestamp}
            onClick={() => onSelect(s.query)}
            title={s.query}
            aria-label={t("searchLabel", { query: s.query })}
            className={`text-[13px] px-3.5 py-1.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] transition-all duration-150 whitespace-nowrap max-w-[min(200px,calc(100vw-4rem))] truncate${i >= 4 ? " hidden sm:inline-flex" : ""}`}
          >
            {s.query}
          </button>
        ))}
      </div>
    </div>
  );
}
