"use client";

import React, { useEffect, useRef, useState } from "react";
import { AIRPORTS, Airport } from "../lib/airports";

interface AirportAutocompleteProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function AirportAutocomplete({ id, label, placeholder, value, onChange, disabled }: AirportAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const matches = query.length >= 1
    ? AIRPORTS.filter((a) => {
        const q = query.toLowerCase();
        return a.iata.toLowerCase().startsWith(q)
          || a.city.toLowerCase().includes(q)
          || a.name.toLowerCase().includes(q)
          || a.country.toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  const showDropdown = open && matches.length > 0;

  const select = (airport: Airport) => {
    onChange(airport.iata);
    setQuery(airport.iata);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(matches[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.children[activeIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-[11px] font-medium text-[var(--color-text-muted)]/70 mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-interactive)]/50 transition-colors"
      />
      {showDropdown && (
        <ul
          id={`${id}-listbox`}
          ref={listRef}
          role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-y-auto max-h-48 airport-dropdown"
        >
          {matches.map((a, i) => (
            <li
              key={a.iata}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); select(a); }}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                i === activeIndex
                  ? "bg-[var(--color-interactive)]/10 text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              <span className="font-mono font-semibold text-[var(--color-interactive)] w-10">{a.iata}</span>
              <img
                src={`https://flagcdn.com/w20/${a.country.toLowerCase()}.png`}
                alt=""
                width={16}
                height={12}
                loading="lazy"
                className="w-4 h-3 rounded-[1px] object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <span className="truncate">{a.city}, {a.country}</span>
              <span className="text-xs text-[var(--color-text-muted)] ml-auto truncate hidden sm:inline">{a.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
