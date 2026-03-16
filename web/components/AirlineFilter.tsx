"use client";

import { useState } from "react";

interface HasLegs {
  legs: { airline: string }[];
}

export const AIRLINE_NAMES: Record<string, string> = {
  // Existing
  "5F": "Fly One", "6E": "IndiGo", "9W": "Jet Airways", A3: "Aegean", AA: "American", AC: "Air Canada",
  AF: "Air France", AI: "Air India", AK: "AirAsia", AS: "Alaska", AY: "Finnair", AZ: "ITA Airways",
  B6: "JetBlue", BA: "British Airways", BR: "EVA Air", CX: "Cathay Pacific", DL: "Delta", DY: "Norwegian",
  EK: "Emirates", ET: "Ethiopian", EW: "Eurowings", EY: "Etihad", FI: "Icelandair", FR: "Ryanair",
  IB: "Iberia", JL: "JAL", KE: "Korean Air", KL: "KLM", LH: "Lufthansa", LO: "LOT", LX: "SWISS",
  NH: "ANA", NZ: "Air New Zealand", OS: "Austrian", QF: "Qantas", QR: "Qatar Airways", SQ: "Singapore Airlines",
  TK: "Turkish Airlines", TP: "TAP Portugal", U2: "easyJet", UA: "United", VS: "Virgin Atlantic",
  VY: "Vueling", W6: "Wizz Air", WN: "Southwest",
  // Asia-Pacific
  "3K": "Jetstar Asia", "5J": "Cebu Pacific", "7C": "Jeju Air", CA: "Air China", CI: "China Airlines",
  CZ: "China Southern", FD: "Thai AirAsia", GA: "Garuda Indonesia", HU: "Hainan Airlines",
  JQ: "Jetstar", MH: "Malaysia Airlines", MU: "China Eastern", OZ: "Asiana Airlines",
  PG: "Bangkok Airways", PR: "Philippine Airlines", SL: "Thai Lion Air", TG: "Thai Airways",
  TR: "Scoot", VJ: "VietJet Air", VN: "Vietnam Airlines",
  // Middle East & Africa
  GF: "Gulf Air", KQ: "Kenya Airways", KU: "Kuwait Airways", MS: "EgyptAir",
  PC: "Pegasus Airlines", RJ: "Royal Jordanian", SA: "South African Airways", SV: "Saudia", WY: "Oman Air",
  // Americas
  AM: "Aeromexico", AR: "Aerolineas Argentinas", AV: "Avianca", CM: "Copa Airlines",
  F9: "Frontier Airlines", G3: "Gol", HA: "Hawaiian Airlines", LA: "LATAM Airlines",
  NK: "Spirit Airlines", SY: "Sun Country Airlines",
  // Europe
  BT: "airBaltic", DE: "Condor", EI: "Aer Lingus", HV: "Transavia", LL: "Level",
  OK: "Czech Airlines", SK: "SAS", SN: "Brussels Airlines", UX: "Air Europa", XR: "Corendon Airlines",
};

export function airlineName(code: string): string {
  return AIRLINE_NAMES[code] || code;
}

export function useAirlineFilter<T extends HasLegs>(flights: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const airlines = [...new Set(
    flights.flatMap((f) => f.legs.map((l) => l.airline).filter((a) => a && a !== "ZZ"))
  )].sort();

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const clearFilter = () => setSelected(new Set());

  const filtered = selected.size === 0
    ? flights
    : flights.filter((f) =>
        f.legs.some((l) => selected.has(l.airline))
      );

  return { airlines, selected, toggle, clearFilter, filtered };
}

export function AirlineFilterChips({
  airlines,
  selected,
  toggle,
  clearFilter,
  totalCount,
  filteredCount,
}: {
  airlines: string[];
  selected: Set<string>;
  toggle: (code: string) => void;
  clearFilter: () => void;
  totalCount: number;
  filteredCount: number;
}) {
  if (airlines.length <= 1) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div role="group" aria-label="Filter by airline" className="flex flex-wrap gap-1.5">
          {airlines.map((code) => (
            <button
              key={code}
              onClick={() => toggle(code)}
              aria-pressed={selected.has(code)}
              className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors inline-flex items-center gap-1.5 ${
                selected.has(code)
                  ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent)]"
                  : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/30"
              }`}
            >
              <img
                src={`https://images.kiwi.com/airlines/64/${code}.png`}
                alt=""
                width={16}
                height={16}
                loading="lazy"
                className="w-4 h-4 rounded-sm object-contain inline-block"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              {airlineName(code)}
            </button>
          ))}
        </div>
        {selected.size > 0 && (
          <button onClick={clearFilter} className="text-[11px] text-[var(--color-text-muted)]/50 hover:text-[var(--color-text-muted)] transition-colors ml-2 shrink-0">
            Clear
          </button>
        )}
      </div>
      {selected.size > 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Showing {filteredCount} of {totalCount} flights
        </p>
      )}
    </div>
  );
}
