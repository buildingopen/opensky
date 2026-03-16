"use client";

import React, { Component, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../lib/analytics";
import { AirportAutocomplete } from "../components/AirportAutocomplete";
import { useSavedSearches, SavedSearchesList } from "../components/SavedSearches";
import { useAirlineFilter, AirlineFilterChips, AIRLINE_NAMES, airlineName } from "../components/AirlineFilter";
import { AIRPORTS } from "../lib/airports";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const AIRPORTS_BY_CODE = Object.fromEntries(AIRPORTS.map((a) => [a.iata, a]));
function flagUrl(iata: string, countries?: Record<string, string>): string | null {
  const a = AIRPORTS_BY_CODE[iata];
  if (a) return `https://flagcdn.com/w20/${a.country.toLowerCase()}.png`;
  const cc = countries?.[iata];
  if (cc) return `https://flagcdn.com/w20/${cc}.png`;
  return null;
}
const ZONES_UPDATED_AT = process.env.NEXT_PUBLIC_ZONES_UPDATED_AT || "March 2026";

// ---------------------------------------------------------------------------
// Query Preview: lookup maps (built once from AIRPORTS)
// ---------------------------------------------------------------------------
// Country code -> display name. Covers every code in AIRPORTS.
const COUNTRY_NAMES: Record<string, string> = {
  AE: "UAE", AG: "Antigua", AL: "Albania", AM: "Armenia", AR: "Argentina",
  AT: "Austria", AU: "Australia", BD: "Bangladesh", BE: "Belgium", BG: "Bulgaria",
  BH: "Bahrain", BO: "Bolivia", BR: "Brazil", BS: "Bahamas", CA: "Canada",
  CH: "Switzerland", CI: "Ivory Coast", CL: "Chile", CN: "China", CO: "Colombia",
  CR: "Costa Rica", CU: "Cuba", CW: "Curacao", CY: "Cyprus", CZ: "Czechia",
  DE: "Germany", DK: "Denmark", DO: "Dominican Republic", DZ: "Algeria",
  EC: "Ecuador", EE: "Estonia", EG: "Egypt", ES: "Spain", ET: "Ethiopia",
  FI: "Finland", FJ: "Fiji", FR: "France", GB: "UK", GD: "Grenada",
  GE: "Georgia", GH: "Ghana", GR: "Greece", GT: "Guatemala", GU: "Guam",
  HK: "Hong Kong", HR: "Croatia", HT: "Haiti", HU: "Hungary", ID: "Indonesia",
  IE: "Ireland", IL: "Israel", IN: "India", IS: "Iceland", IT: "Italy",
  JM: "Jamaica", JO: "Jordan", JP: "Japan", KE: "Kenya", KH: "Cambodia",
  KR: "South Korea", KW: "Kuwait", KZ: "Kazakhstan", LA: "Laos", LB: "Lebanon",
  LK: "Sri Lanka", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MA: "Morocco",
  MM: "Myanmar", MN: "Mongolia", MO: "Macau", MT: "Malta", MU: "Mauritius",
  MV: "Maldives", MX: "Mexico", MY: "Malaysia", MZ: "Mozambique", NG: "Nigeria",
  NL: "Netherlands", NO: "Norway", NP: "Nepal", NZ: "New Zealand", OM: "Oman",
  PA: "Panama", PE: "Peru", PF: "French Polynesia", PH: "Philippines", PK: "Pakistan",
  PL: "Poland", PR: "Puerto Rico", PT: "Portugal", PY: "Paraguay", QA: "Qatar",
  RO: "Romania", RS: "Serbia", RU: "Russia", SA: "Saudi Arabia", SC: "Seychelles",
  SE: "Sweden", SG: "Singapore", SI: "Slovenia", SK: "Slovakia", SN: "Senegal",
  SX: "St. Maarten", TH: "Thailand", TN: "Tunisia", TR: "Turkey", TT: "Trinidad",
  TW: "Taiwan", TZ: "Tanzania", UA: "Ukraine", UG: "Uganda", US: "USA",
  UY: "Uruguay", UZ: "Uzbekistan", VE: "Venezuela", VN: "Vietnam", ZA: "South Africa",
  ZM: "Zambia",
};
// Auto-build: lowercase country name -> { code, name } from every code in AIRPORTS
const COUNTRY_LOOKUP: Record<string, { code: string; name: string }> = {};
for (const a of AIRPORTS) {
  const name = COUNTRY_NAMES[a.country];
  if (name && !COUNTRY_LOOKUP[name.toLowerCase()]) {
    COUNTRY_LOOKUP[name.toLowerCase()] = { code: a.country, name };
  }
}
// Aliases for common alternate names
const COUNTRY_ALIASES: Record<string, string> = {
  "united kingdom": "GB", england: "GB", uk: "GB", britain: "GB",
  "united states": "US", america: "US", usa: "US",
  korea: "KR", "south korea": "KR",
  uae: "AE", "united arab emirates": "AE",
  czechia: "CZ", "czech republic": "CZ",
  holland: "NL",
};
for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
  const name = COUNTRY_NAMES[code];
  if (name && !COUNTRY_LOOKUP[alias]) {
    COUNTRY_LOOKUP[alias] = { code, name };
  }
}

const IATA_SET = new Set(AIRPORTS.map((a) => a.iata));
const CITY_DISPLAY = new Map<string, string>();
const COUNTRY_AIRPORT_COUNT = new Map<string, number>();
const CITY_AIRPORT_COUNT = new Map<string, number>();
for (const a of AIRPORTS) {
  const cl = a.city.toLowerCase();
  CITY_DISPLAY.set(cl, a.city);
  COUNTRY_AIRPORT_COUNT.set(a.country, (COUNTRY_AIRPORT_COUNT.get(a.country) || 0) + 1);
  CITY_AIRPORT_COUNT.set(cl, (CITY_AIRPORT_COUNT.get(cl) || 0) + 1);
}

// City aliases: common names that differ from airport data city names
const CITY_ALIASES: Record<string, string> = {
  delhi: "new delhi", nyc: "new york", sf: "san francisco", la: "los angeles",
  "ho chi minh": "ho chi minh city", "saigon": "ho chi minh city",
  "bombay": "mumbai", "calcutta": "kolkata", "madras": "chennai",
  "peking": "beijing", "cologne": "cologne", "nuremberg": "nuremberg",
};
for (const [alias, city] of Object.entries(CITY_ALIASES)) {
  if (CITY_DISPLAY.has(city) && !CITY_DISPLAY.has(alias)) {
    CITY_DISPLAY.set(alias, CITY_DISPLAY.get(city)!);
    CITY_AIRPORT_COUNT.set(alias, CITY_AIRPORT_COUNT.get(city) || 1);
  }
}

const AMBIGUOUS_CITIES = new Set(["nice", "mobile", "split", "reading", "bath", "chester", "orange"]);
const SKIP_REGIONS = new Set(["anywhere", "europe", "asia", "africa", "south america", "north america", "middle east"]);

const MONTH_NAMES = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function resolveDate(phrase: string): string | null {
  const now = new Date();
  const p = phrase.toLowerCase().trim();
  if (p === "tomorrow") {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  }
  if (p === "today") {
    return `${MONTH_SHORT[now.getMonth()]} ${now.getDate()}`;
  }
  if (p === "next week") {
    const d = new Date(now);
    const dayOfWeek = d.getDay(); // 0=Sun
    const daysUntilMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    d.setDate(d.getDate() + daysUntilMon);
    const mon = new Date(d);
    const sun = new Date(d); sun.setDate(sun.getDate() + 6);
    if (mon.getMonth() === sun.getMonth()) return `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()}-${sun.getDate()}`;
    return `${MONTH_SHORT[mon.getMonth()]} ${mon.getDate()} - ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;
  }
  if (p === "this weekend") {
    const d = new Date(now);
    const dayOfWeek = d.getDay();
    const daysUntilSat = dayOfWeek === 6 ? 0 : (6 - dayOfWeek);
    d.setDate(d.getDate() + daysUntilSat);
    const sat = new Date(d);
    const sun = new Date(d); sun.setDate(sun.getDate() + 1);
    if (sat.getMonth() === sun.getMonth()) return `${MONTH_SHORT[sat.getMonth()]} ${sat.getDate()}-${sun.getDate()}`;
    return `${MONTH_SHORT[sat.getMonth()]} ${sat.getDate()} - ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;
  }
  if (p === "next weekend") {
    const d = new Date(now);
    const dayOfWeek = d.getDay();
    // Next Saturday (skip this weekend)
    const daysUntilNextSat = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7);
    d.setDate(d.getDate() + daysUntilNextSat);
    const sat = new Date(d);
    const sun = new Date(d); sun.setDate(sun.getDate() + 1);
    if (sat.getMonth() === sun.getMonth()) return `${MONTH_SHORT[sat.getMonth()]} ${sat.getDate()}-${sun.getDate()}`;
    return `${MONTH_SHORT[sat.getMonth()]} ${sat.getDate()} - ${MONTH_SHORT[sun.getMonth()]} ${sun.getDate()}`;
  }
  if (p === "next month") {
    const m = (now.getMonth() + 1) % 12;
    const y = m === 0 ? now.getFullYear() + 1 : (now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear());
    return `${MONTH_SHORT[m]} ${y}`;
  }
  // Day names: "monday", "tuesday", etc.
  const dayIdx = DAY_NAMES.indexOf(p);
  if (dayIdx >= 0) {
    const d = new Date(now);
    let diff = dayIdx - d.getDay();
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  }
  // Month names: "july" -> "Jul 2026", "in july" already stripped
  const monthIdx = MONTH_NAMES.indexOf(p);
  if (monthIdx >= 0) {
    const y = monthIdx < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
    return `${MONTH_SHORT[monthIdx]} ${y}`;
  }
  // "march 15" or "15 march"
  for (let mi = 0; mi < MONTH_NAMES.length; mi++) {
    const mn = MONTH_NAMES[mi];
    const m1 = p.match(new RegExp(`^${mn}\\s+(\\d{1,2})$`));
    if (m1) return `${MONTH_SHORT[mi]} ${parseInt(m1[1])}`;
    const m2 = p.match(new RegExp(`^(\\d{1,2})\\s+${mn}$`));
    if (m2) return `${MONTH_SHORT[mi]} ${parseInt(m2[1])}`;
  }
  return null;
}

interface QueryPreview { origin: string; dest: string; date: string | null }

// Pre-sorted arrays for prefix search (built once)
const CITY_KEYS = Array.from(CITY_DISPLAY.keys()).sort();
const COUNTRY_KEYS = Object.keys(COUNTRY_LOOKUP).sort();

function prefixMatch(keys: string[], prefix: string): string | null {
  // Binary search for first key starting with prefix
  let lo = 0, hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid] < prefix) lo = mid + 1; else hi = mid;
  }
  if (lo >= keys.length || !keys[lo].startsWith(prefix)) return null;
  // Only return if unique match (next key doesn't also start with prefix)
  if (lo + 1 < keys.length && keys[lo + 1].startsWith(prefix)) return null;
  return keys[lo];
}

function matchLocation(phrase: string, hasContext: boolean): { display: string; count: number } | null {
  const p = phrase.toLowerCase().trim();
  if (!p || p.length < 2 || SKIP_REGIONS.has(p)) return null;
  // IATA code (3 uppercase letters)
  const upper = phrase.trim().toUpperCase();
  if (upper.length === 3 && IATA_SET.has(upper)) {
    return { display: upper, count: 1 };
  }
  // Country (exact)
  const country = COUNTRY_LOOKUP[p];
  if (country) {
    const cnt = COUNTRY_AIRPORT_COUNT.get(country.code) || 0;
    return { display: country.name, count: cnt };
  }
  // City (exact)
  if (CITY_DISPLAY.has(p)) {
    if (AMBIGUOUS_CITIES.has(p) && !hasContext) return null;
    const cnt = CITY_AIRPORT_COUNT.get(p) || 1;
    return { display: CITY_DISPLAY.get(p)!, count: cnt };
  }
  // Prefix matching (only if >= 4 chars to avoid false positives)
  if (p.length >= 4) {
    const cityKey = prefixMatch(CITY_KEYS, p);
    if (cityKey) {
      if (AMBIGUOUS_CITIES.has(cityKey) && !hasContext) return null;
      const cnt = CITY_AIRPORT_COUNT.get(cityKey) || 1;
      return { display: CITY_DISPLAY.get(cityKey)!, count: cnt };
    }
    const countryKey = prefixMatch(COUNTRY_KEYS, p);
    if (countryKey) {
      const c = COUNTRY_LOOKUP[countryKey];
      const cnt = COUNTRY_AIRPORT_COUNT.get(c.code) || 0;
      return { display: c.name, count: cnt };
    }
  }
  return null;
}

function formatLocationDisplay(loc: { display: string; count: number }): string {
  return loc.count > 1 ? `${loc.display} (${loc.count} airports)` : loc.display;
}

function extractOriginDest(lower: string): { originPhrase: string; destPhrase: string } | null {
  // Strategy: find "from" and "to" anchors, extract phrases between them.
  // Handles: "from X to Y", "X to Y", "to Y from X", "flights from X to Y",
  // "I want a cheap flight from Berlin to Tokyo next week", etc.
  const NOISE = /^(?:(?:flights?|cheapest|cheap|direct|nonstop|i\s+want\s+(?:a\s+)?|find\s+(?:me\s+)?|search\s+(?:for\s+)?|show\s+(?:me\s+)?|get\s+(?:me\s+)?|book\s+(?:a\s+)?|looking\s+for\s+(?:a\s+)?|a\s+|the\s+)\s*)+/i;

  // Pattern 1: explicit "from X to Y"
  const fromTo = lower.match(/\bfrom\s+([\w\s/.'-]+?)\s+to\s+([\w\s/.'-]+?)(?:\s+(?:in|on|next|this|tomorrow|today|under|below|around|for|with|during|before|after|cheap|cheapest|direct|nonstop|non-stop|business|first|economy|premium|\d|€|\$|£).*)?$/);
  if (fromTo) {
    const orig = fromTo[1].replace(NOISE, "").trim();
    let dest = fromTo[2].trim();
    dest = dest.replace(/\s+(?:in|on|next|this|tomorrow|today|under|below|around|for|with|during|before|after|cheap|cheapest|direct|nonstop|non-stop|business|first|economy|premium)$/i, "").trim();
    if (orig && dest) return { originPhrase: orig, destPhrase: dest };
  }

  // Pattern 2: "to Y from X"
  const toFrom = lower.match(/\bto\s+([\w\s/.'-]+?)\s+from\s+([\w\s/.'-]+?)(?:\s+(?:in|on|next|this|tomorrow|today|under|below|around|for|with|during|before|after|cheap|cheapest|direct|nonstop|non-stop|business|first|economy|premium|\d|€|\$|£).*)?$/);
  if (toFrom) {
    const dest = toFrom[1].trim();
    const orig = toFrom[2].replace(NOISE, "").trim();
    if (orig && dest) return { originPhrase: orig, destPhrase: dest };
  }

  // Pattern 3: simple "X to Y" (no "from" keyword)
  const simple = lower.match(/([\w\s/.'-]+?)\s+to\s+([\w\s/.'-]+?)(?:\s+(?:in|on|next|this|tomorrow|today|under|below|around|for|with|during|before|after|cheap|cheapest|direct|nonstop|non-stop|business|first|economy|premium|\d|€|\$|£).*)?$/);
  if (simple) {
    const orig = simple[1].replace(NOISE, "").trim();
    let dest = simple[2].trim();
    dest = dest.replace(/\s+(?:in|on|next|this|tomorrow|today|under|below|around|for|with|during|before|after|cheap|cheapest|direct|nonstop|non-stop|business|first|economy|premium)$/i, "").trim();
    if (orig && dest) return { originPhrase: orig, destPhrase: dest };
  }

  return null;
}

function useQueryPreview(prompt: string): QueryPreview | null {
  return useMemo(() => {
    if (!prompt || prompt.length < 5) return null;
    const lower = prompt.toLowerCase();

    const extracted = extractOriginDest(lower);
    if (!extracted) return null;
    const { originPhrase, destPhrase } = extracted;

    // Handle "X or Y to Z" pattern for multiple origins
    const orParts = originPhrase.split(/\s+or\s+/);
    const origins: { display: string; count: number }[] = [];
    for (const part of orParts) {
      const loc = matchLocation(part.trim(), orParts.length > 1 || !!destPhrase);
      if (loc) origins.push(loc);
    }
    if (origins.length === 0) return null;

    const dest = matchLocation(destPhrase, true);
    if (!dest) return null;

    const originStr = origins.map(formatLocationDisplay).join(", ");
    const destStr = formatLocationDisplay(dest);

    // Date detection
    let date: string | null = null;
    const datePatterns = [
      /\b(tomorrow|today)\b/i,
      /\b(next week)\b/i,
      /\b(next weekend)\b/i,
      /\b(this weekend)\b/i,
      /\b(next month)\b/i,
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/i,
      /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
      /\bin\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    ];
    for (const pat of datePatterns) {
      const m = lower.match(pat);
      if (m) {
        // For "in july" pattern, extract just the month
        if (pat.source.startsWith("\\bin\\s+")) {
          date = resolveDate(m[1]);
        } else if (m[2] && /^\d+$/.test(m[2])) {
          // "march 15"
          date = resolveDate(m[0]);
        } else if (m[2] && MONTH_NAMES.includes(m[2].toLowerCase())) {
          // "15 march"
          date = resolveDate(m[0]);
        } else {
          date = resolveDate(m[1] || m[0]);
        }
        if (date) break;
      }
    }

    return { origin: originStr, dest: destStr, date };
  }, [prompt]);
}

// Context for airport country codes (avoids prop drilling for flags)
const AirportCountriesCtx = createContext<Record<string, string>>({});
const useAirportCountries = () => useContext(AirportCountriesCtx);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ParsedSearch {
  origins: string[];
  destinations: string[];
  dates: string[];
  return_dates: string[];
  max_price: number;
  currency: string;
  cabin: string;
  stops: string;
  safe_only?: boolean;
  total_routes: number;
  airport_names: Record<string, string>;
}

interface FlightLeg {
  airline: string;
  flight_number: string;
  from: string;
  to: string;
  departs: string;
  arrives: string;
  duration_minutes: number;
}

interface FlightOut {
  price: number;
  currency: string;
  duration_minutes: number;
  stops: number;
  route: string;
  risk_level: string;
  risk_details: { airport: string; country: string; zone: string; risk: string }[];
  score: number;
  legs: FlightLeg[];
  provider: string;
  booking_url: string;
  booking_label: string;
  booking_exact: boolean;
  origin: string;
  destination: string;
  date: string;
}

interface RoundTripOut {
  outbound: FlightOut;
  inbound: FlightOut;
  total_price: number;
  currency: string;
  risk_level: string;
  risk_details: { airport: string; country: string; zone: string; risk: string }[];
  score: number;
}

interface ScanSummaryData {
  best_destinations: FlightOut[];
  price_matrix: {
    destinations: string[];
    dates: string[];
    prices: Record<string, number | null>;
    cheapest_per_dest: Record<string, number>;
  };
  stats: {
    total_flights: number;
    destinations: number;
    origins: number;
    dates: number;
    min_price: number;
    max_price: number;
  };
}

type SortKey = "score" | "price" | "duration" | "stops";
type AttributionParams = { utm_source?: string; utm_medium?: string; utm_campaign?: string; ref?: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatTime(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso.slice(11, 16);
  }
}
function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
function currencySymbol(c: string): string {
  return c === "EUR" ? "\u20AC" : c === "USD" ? "$" : c === "GBP" ? "\u00A3" : c;
}
// Fix 1: Extract display date from flight legs (actual departure date, not search date)
function flightDisplayDate(flight: FlightOut): string {
  const departs = flight.legs?.[0]?.departs;
  if (departs) return departs.slice(0, 10);
  return flight.date;
}
function priceToColor(price: number | null, min: number, max: number): string {
  if (price == null || min === max) return "transparent";
  const ratio = Math.min(1, Math.max(0, (price - min) / (max - min)));
  // green -> amber -> red
  if (ratio <= 0.5) {
    const t = ratio * 2;
    const r = Math.round(34 + t * (234 - 34));
    const g = Math.round(197 + t * (179 - 197));
    const b = Math.round(94 + t * (8 - 94));
    return `rgb(${r},${g},${b})`;
  }
  const t = (ratio - 0.5) * 2;
  const r = Math.round(234 + t * (239 - 234));
  const g = Math.round(179 + t * (68 - 179));
  const b = Math.round(8 + t * (68 - 8));
  return `rgb(${r},${g},${b})`;
}

function safeUrl(url: string): string | null {
  if (!url) return null;
  try {
    const p = new URL(url);
    if (p.protocol === "https:" || p.protocol === "http:") return url;
  } catch {}
  return null;
}
// Google Flights protobuf-based ?tfs= URL builder
const SEAT_PB: Record<string, number> = { economy: 1, premium_economy: 2, business: 3, first: 4 };
function _pbVarint(n: number): number[] {
  const out: number[] = [];
  while (n > 0x7f) { out.push((n & 0x7f) | 0x80); n >>>= 7; }
  out.push(n);
  return out;
}
function _pbTag(field: number, wireType: number): number[] { return _pbVarint((field << 3) | wireType); }
function _pbString(field: number, s: string): number[] {
  const bytes = new TextEncoder().encode(s);
  return [..._pbTag(field, 2), ...(_pbVarint(bytes.length)), ...bytes];
}
function _pbBytes(field: number, data: number[]): number[] { return [..._pbTag(field, 2), ...(_pbVarint(data.length)), ...data]; }
function _pbLeg(origin: string, dest: string, date: string, airline: string, flightNum: string): number[] {
  // Field 1: origin, Field 2: date, Field 3: dest, Field 5: airline, Field 6: flight number
  return [..._pbString(1, origin), ..._pbString(2, date), ..._pbString(3, dest), ..._pbString(5, airline), ..._pbString(6, flightNum)];
}
function _pbSlice(date: string, origin: string, dest: string, legs: { from: string; to: string; date: string; airline: string; flight_number: string }[]): number[] {
  // Field 2: departure date, Field 4 (repeated): individual flight legs, Field 13/14: origin/dest airports
  const inner = [
    ..._pbString(2, date),
    ...legs.flatMap((l) => _pbBytes(4, _pbLeg(l.from, l.to, l.date, l.airline, l.flight_number))),
    ..._pbBytes(13, _pbString(2, origin)),
    ..._pbBytes(14, _pbString(2, dest)),
  ];
  return _pbBytes(3, inner);
}
function _pbRouteOnly(origin: string, dest: string, date: string): number[] {
  // Fallback: simple route search (no specific flight)
  const inner = [..._pbString(2, date), ..._pbBytes(13, _pbString(2, origin)), ..._pbBytes(14, _pbString(2, dest))];
  return _pbBytes(3, inner);
}
function googleFlightsUrl(origin: string, dest: string, date: string, currency: string, cabin?: string, legs?: FlightLeg[]): string {
  const cur = (currency || "EUR").toUpperCase().slice(0, 3);
  const seat = SEAT_PB[cabin || ""] || 1;
  const hasLegs = legs && legs.length > 0 && legs.every((l) => l.airline && l.airline !== "ZZ" && l.flight_number);
  let slice: number[];
  if (hasLegs) {
    const legData = legs!.map((l) => ({ from: l.from, to: l.to, date: l.departs.slice(0, 10), airline: l.airline, flight_number: l.flight_number }));
    slice = _pbSlice(date, origin, dest, legData);
  } else {
    slice = _pbRouteOnly(origin, dest, date);
  }
  const tfs = [...slice, ..._pbBytes(8, [0x01]), ..._pbTag(9, 0), seat, ..._pbTag(19, 0), 2];
  const bytes = new Uint8Array(tfs);
  const b64 = btoa(String.fromCharCode(...bytes));
  return `https://www.google.com/travel/flights/search?tfs=${encodeURIComponent(b64)}&hl=en&curr=${cur}`;
}
function appendAttribution(url: string, params: AttributionParams): string {
  const s = safeUrl(url);
  if (!s) return "";
  const u = new URL(s);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}


function formatAirlines(codes: string): string {
  if (!codes) return "";
  return codes.split(", ").map((c) => airlineName(c.trim())).join(", ");
}

function AirlineLogos({ codes }: { codes: string }) {
  if (!codes) return null;
  const list = codes.split(", ").map((c) => c.trim()).filter(Boolean);
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {list.map((code) => (
        <span key={code} className="inline-flex items-center gap-1">
          <img
            src={`https://images.kiwi.com/airlines/64/${code}.png`}
            alt=""
            width={16}
            height={16}
            loading="lazy"
            className="w-4 h-4 rounded-sm object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span>{airlineName(code)}</span>
        </span>
      ))}
    </span>
  );
}

function consumerRouteLabel(route: string, names: Record<string, string>): string {
  return route.split(" -> ").map((code) => {
    const city = names[code.trim()];
    return city ? `${city} (${code.trim()})` : code.trim();
  }).join(" \u2192 ");
}

function RouteWithFlags({ route, names }: { route: string; names: Record<string, string> }) {
  const countries = useAirportCountries();
  const segments = route.split(" -> ").map((c) => c.trim());
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {segments.map((code, i) => {
        const city = names[code];
        const flag = flagUrl(code, countries);
        return (
          <React.Fragment key={code + i}>
            {i > 0 && <span className="text-[var(--color-text-muted)] mx-0.5">{"\u2192"}</span>}
            {flag && (
              <img
                src={flag}
                alt=""
                width={16}
                height={12}
                loading="lazy"
                className="w-4 h-3 rounded-[1px] object-cover inline-block"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <span>{city ? `${city} (${code})` : code}</span>
          </React.Fragment>
        );
      })}
    </span>
  );
}

const ExternalLinkIcon = () => (
  <svg viewBox="0 0 12 12" className="w-3 h-3 inline" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3.5 3.5h5v5M8.5 3.5L3.5 8.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function sortFlights(flights: FlightOut[], key: SortKey): FlightOut[] {
  return [...flights].sort((a, b) => {
    if (key === "price") return (a.price || Infinity) - (b.price || Infinity);
    if (key === "duration") return a.duration_minutes - b.duration_minutes;
    if (key === "stops") return a.stops - b.stops || (a.price || Infinity) - (b.price || Infinity);
    return a.score - b.score;
  });
}

// ---------------------------------------------------------------------------
// Recommendation logic
// ---------------------------------------------------------------------------
type RecLabel = "Recommended" | "Cheapest" | "Fastest" | "Lowest stress";

function getRecommendationReason(flight: FlightOut, all: FlightOut[], label: RecLabel): string {
  const sym = currencySymbol(flight.currency);
  const price = `${sym}${Math.round(flight.price)}`;
  const dur = formatDuration(flight.duration_minutes);
  const stopsLabel = flight.stops === 0 ? "direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`;
  const safe = flight.risk_level === "safe";
  const via = flight.stops > 0 && flight.route ? flight.route.split(" -> ").slice(1, -1).join(", ") : "";

  if (label === "Recommended") {
    const parts = [price, dur, stopsLabel + (via ? ` via ${via}` : "")];
    if (safe) parts.push("safe route");
    return parts.join(", ") + ".";
  }
  if (label === "Cheapest") {
    const avgPrice = all.length > 0 ? all.reduce((s, f) => s + f.price, 0) / all.length : 0;
    const saving = avgPrice > flight.price ? Math.round(avgPrice - flight.price) : 0;
    return saving > 0 ? `${price}, ${sym}${saving} below average.` : `${price}.`;
  }
  if (label === "Fastest") {
    const slowest = all.length > 0 ? Math.max(...all.map((f) => f.duration_minutes)) : flight.duration_minutes;
    const saved = slowest - flight.duration_minutes;
    return saved > 60 ? `${dur} ${stopsLabel}, ${formatDuration(saved)} faster than slowest.` : `${dur} ${stopsLabel}.`;
  }
  return `${stopsLabel}, ${dur}, ${price}.`;
}

// ---------------------------------------------------------------------------
// Risk Badge
// ---------------------------------------------------------------------------
function RiskBadge({ level }: { level: string }) {
  const [showTip, setShowTip] = useState(false);
  const c: Record<string, { bg: string; text: string; border: string; label: string; icon: string; tooltip: string }> = {
    safe: { bg: "bg-[var(--color-safe)]/15", text: "text-[var(--color-safe)]", border: "border-[var(--color-safe)]/25", label: "Safe route", icon: "\u2713", tooltip: "Route avoids all known conflict zones and restricted airspace." },
    caution: { bg: "bg-[var(--color-caution)]/15", text: "text-[var(--color-caution)]", border: "border-[var(--color-caution)]/25", label: "Caution", icon: "\u26A0", tooltip: "Route passes near a lower-risk conflict area. Review details before booking." },
    high_risk: { bg: "bg-[var(--color-high-risk)]/15", text: "text-[var(--color-high-risk)]", border: "border-[var(--color-high-risk)]/25", label: "High Risk", icon: "\u26A0", tooltip: "Route crosses high-risk airspace. Consider safer alternatives." },
    do_not_fly: { bg: "bg-[var(--color-danger)]/15", text: "text-[var(--color-danger)]", border: "border-[var(--color-danger)]/25", label: "Do Not Fly", icon: "\u2717", tooltip: "Route crosses active conflict zone or restricted airspace. Strongly recommend avoiding." },
  };
  if (!level || !c[level]) return null;
  const x = c[level];
  return (
    <span
      className={`relative inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border cursor-help ${x.bg} ${x.text} ${x.border}`}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onClick={() => setShowTip((v) => !v)}
    >
      <span className="text-[10px]">{x.icon}</span>{x.label}
      {showTip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg text-[11px] leading-relaxed text-[var(--color-text-muted)] whitespace-nowrap z-50 pointer-events-none animate-in fade-in">
          {x.tooltip}
        </span>
      )}
    </span>
  );
}

function FlightCard({
  flight,
  label,
  reason,
  airportNames,
  attributionParams,
  onOutboundClick,
  cabin,
}: {
  flight: FlightOut;
  label?: RecLabel;
  reason?: string;
  airportNames: Record<string, string>;
  attributionParams: AttributionParams;
  onOutboundClick: (provider: "booking" | "google", f: FlightOut) => void;
  cabin?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];
  const airlines = flight.legs.length > 0
    ? [...new Set(flight.legs.map((l) => l.airline).filter((a) => a && a !== "ZZ"))].join(", ")
    : "";
  const bookingUrl = appendAttribution(flight.booking_url, attributionParams);
  const googleUrl = appendAttribution(
    googleFlightsUrl(flight.origin, flight.destination, flight.date, flight.currency, cabin, flight.legs),
    attributionParams
  );
  return (
    <div className={`bg-[var(--color-surface)] border rounded-xl p-4 sm:p-5 hover:border-[var(--color-accent)]/30 transition-colors ${
      label === "Recommended"
        ? "border-[var(--color-accent)]/40 ring-1 ring-[var(--color-accent)]/20"
        : "border-[var(--color-border)]"
    }`}>
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">{label}</span>
          {reason && <span className="text-xs text-[var(--color-text-muted)]">{reason}</span>}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--color-text)]"><RouteWithFlags route={flight.route} names={airportNames} /></div>
          {airlines && <div className="text-xs text-[var(--color-text-muted)] mt-0.5"><AirlineLogos codes={airlines} /></div>}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
            <span>{formatDate(flightDisplayDate(flight))}</span>
            {firstLeg && lastLeg && (
              <span className="text-[var(--color-text)]">
                {formatTime(firstLeg.departs)} – {formatTime(lastLeg.arrives)}
              </span>
            )}
            <span>{flight.stops === 0 ? "Direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}</span>
            <span>{formatDuration(flight.duration_minutes)}</span>
            <RiskBadge level={flight.risk_level} />
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-2">
          {flight.price > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold text-[var(--color-text)]">
                {currencySymbol(flight.currency)}{Math.round(flight.price)}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              {flight.booking_exact && bookingUrl ? (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onOutboundClick("booking", flight)}
                  aria-label="Book direct"
                  className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-sm font-medium rounded-lg transition-colors"
                >
                  Book direct
                </a>
              ) : (
                <>
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onOutboundClick("google", flight)}
                    aria-label="View on Google Flights"
                    className="px-3 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-sm font-medium rounded-lg transition-colors"
                  >
                    Google Flights <ExternalLinkIcon />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {flight.legs.length > 1 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : `Show ${flight.legs.length} segments`}
        </button>
      )}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2">
          {flight.legs.map((leg, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-[var(--color-accent)] w-14 inline-flex items-center gap-1">
                {leg.airline && leg.airline !== "ZZ" && (
                  <img
                    src={`https://images.kiwi.com/airlines/64/${leg.airline}.png`}
                    alt=""
                    width={16}
                    height={16}
                    loading="lazy"
                    className="w-4 h-4 rounded-sm object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                {leg.airline && leg.airline !== "ZZ" ? `${leg.airline}${leg.flight_number}` : leg.flight_number || "---"}
              </span>
              <span className="text-[var(--color-text-muted)]">{leg.from}</span>
              <span className="text-xs">{formatTime(leg.departs)}</span>
              <span className="text-[var(--color-text-muted)]">→</span>
              <span className="text-[var(--color-text-muted)]">{leg.to}</span>
              <span className="text-xs">{formatTime(leg.arrives)}</span>
              <span className="text-xs text-[var(--color-text-muted)] ml-auto">{formatDuration(leg.duration_minutes)}</span>
            </div>
          ))}
          {flight.risk_details?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Risk factors:</p>
              {flight.risk_details.map((rd, i) => (
                <div key={i} className="text-xs text-[var(--color-caution)]">
                  {rd.airport} ({rd.country}) – {rd.zone}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoundTripCard
// ---------------------------------------------------------------------------
function RoundTripFlightRow({
  flight,
  label,
  airportNames,
  attributionParams,
  onOutboundClick,
  cabin,
}: {
  flight: FlightOut;
  label: string;
  airportNames: Record<string, string>;
  attributionParams: AttributionParams;
  onOutboundClick: (provider: "booking" | "google", f: FlightOut) => void;
  cabin?: string;
}) {
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];
  const airlines = flight.legs.length > 0
    ? [...new Set(flight.legs.map((l) => l.airline).filter((a) => a && a !== "ZZ"))].join(", ")
    : "";
  const bookingUrl = appendAttribution(flight.booking_url, attributionParams);
  const googleUrl = appendAttribution(
    googleFlightsUrl(flight.origin, flight.destination, flight.date, flight.currency, cabin, flight.legs),
    attributionParams
  );

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-sm font-medium text-[var(--color-text)]">
          <RouteWithFlags route={flight.route} names={airportNames} />
        </div>
        {airlines && <div className="text-xs text-[var(--color-text-muted)] mt-0.5"><AirlineLogos codes={airlines} /></div>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-[var(--color-text-muted)] leading-relaxed">
          <span>{formatDate(flightDisplayDate(flight))}</span>
          {firstLeg && lastLeg && (
            <span className="text-[var(--color-text)]">
              {formatTime(firstLeg.departs)} &ndash; {formatTime(lastLeg.arrives)}
            </span>
          )}
          <span>{flight.stops === 0 ? "Direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}</span>
          <span>{formatDuration(flight.duration_minutes)}</span>
          {flight.risk_level === "safe" ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-safe)] bg-[var(--color-safe)]/10 border border-[var(--color-safe)]/20 rounded px-1.5 py-0.5">
              Safe route
            </span>
          ) : (
            <RiskBadge level={flight.risk_level} />
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {flight.booking_exact && bookingUrl ? (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOutboundClick("booking", flight)}
            className="px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-xs font-medium rounded-lg transition-colors"
          >
            Book <ExternalLinkIcon />
          </a>
        ) : (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOutboundClick("google", flight)}
            className="px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-xs font-medium rounded-lg transition-colors"
          >
            Google Flights <ExternalLinkIcon />
          </a>
        )}
      </div>
    </div>
  );
}

function RoundTripCard({
  result,
  airportNames,
  attributionParams,
  onOutboundClick,
  cabin,
}: {
  result: RoundTripOut;
  airportNames: Record<string, string>;
  attributionParams: AttributionParams;
  onOutboundClick: (provider: "booking" | "google", f: FlightOut) => void;
  cabin?: string;
}) {
  const { outbound, inbound, total_price, currency, risk_level } = result;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5 hover:border-[var(--color-accent)]/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-4 shrink-0">
              <div className="w-5 h-5 rounded-full bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 flex items-center justify-center text-[10px] font-bold text-[var(--color-accent)]">1</div>
              <div className="w-px flex-1 bg-[var(--color-border)] my-1" />
              <div className="w-5 h-5 rounded-full bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/40 flex items-center justify-center text-[10px] font-bold text-[var(--color-accent)]">2</div>
            </div>
            <div className="flex-1 divide-y divide-[var(--color-border)]">
              <RoundTripFlightRow flight={outbound} label="Step 1: Book outbound" airportNames={airportNames} attributionParams={attributionParams} onOutboundClick={onOutboundClick} cabin={cabin} />
              <RoundTripFlightRow flight={inbound} label="Step 2: Book return" airportNames={airportNames} attributionParams={attributionParams} onOutboundClick={onOutboundClick} cabin={cabin} />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 pt-2 shrink-0">
          {total_price > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold text-[var(--color-accent)]">
                {currencySymbol(currency)}{Math.round(total_price)}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">combined total</div>
            </div>
          )}
          {risk_level !== "safe" && <RiskBadge level={risk_level} />}
          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">Two bookings required</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------
interface ProgressInfo {
  done: number;
  total: number;
  route: string;
  date: string;
}

function SearchingState({ parsed, progress, filteredCount }: { parsed: ParsedSearch | null; progress: ProgressInfo | null; filteredCount: number }) {
  const totalRoutes = progress?.total ?? parsed?.total_routes ?? 0;
  const workers = Math.min(16, totalRoutes);
  const manualMinutes = Math.ceil(totalRoutes * 2.5); // ~2.5 min per manual Google Flights search (navigate, enter airports, pick date, wait, compare)
  const manualLabel = manualMinutes >= 60
    ? `${Math.floor(manualMinutes / 60)}h ${manualMinutes % 60}min`
    : `${manualMinutes} min`;

  const estimateSeconds = progress && progress.total > 0
    ? Math.ceil((progress.total - progress.done) / 3)
    : totalRoutes
      ? Math.ceil(totalRoutes / 3)
      : null;

  const timeLabel = estimateSeconds != null
    ? estimateSeconds < 5
      ? "Almost done..."
      : `~${estimateSeconds}s remaining`
    : null;

  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center gap-3 mb-4">
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: "0.3s" }} />
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: "0.6s" }} />
      </div>
      {progress && parsed ? (
        <>
          <p className="text-[var(--color-text)]">
            {workers} agents checking {progress.total} combinations on Google Flights
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 font-mono">{progress.route} on {formatDate(progress.date)}</p>
          <div className="mt-4 mx-auto max-w-xs h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            {progress.done}/{progress.total} checked {timeLabel ? `· ${timeLabel}` : ""}
          </p>
          {manualMinutes >= 2 && (
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              Saving you ~{manualLabel} of manual searching
            </p>
          )}
          {filteredCount > 0 && (
            <p className="text-[11px] text-[var(--color-caution)] mt-1">{filteredCount} route{filteredCount !== 1 ? "s" : ""} filtered for safety</p>
          )}
        </>
      ) : parsed ? (
        <>
          <p className="text-[var(--color-text)]">
            {workers} agents checking {totalRoutes} combinations on Google Flights
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            {manualMinutes >= 2
              ? `This would take ~${manualLabel} manually. We'll be done in seconds.`
              : "Fetching live prices..."}
          </p>
        </>
      ) : (
        <>
          <p className="text-[var(--color-text-muted)]">Understanding your trip...</p>
          <div className="mt-4 mx-auto max-w-xs h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-accent)] opacity-60 rounded-full shimmer-bar" />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact flight row for compare-all list
// ---------------------------------------------------------------------------
function CompactFlightRow({
  flight,
  sym,
  airportNames,
  cabin,
}: {
  flight: FlightOut;
  sym: string;
  airportNames: Record<string, string>;
  cabin?: string;
}) {
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];
  const airline = flight.legs.length > 0
    ? [...new Set(flight.legs.map((l) => l.airline).filter((a) => a && a !== "ZZ"))].join(", ")
    : "";
  const googleUrl = googleFlightsUrl(flight.origin, flight.destination, flight.date, flight.currency, cabin, flight.legs);
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[var(--color-text)] truncate"><RouteWithFlags route={flight.route} names={airportNames} /></div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mt-0.5">
          {airline && <span><AirlineLogos codes={airline} /></span>}
          <span>{formatDate(flightDisplayDate(flight))}</span>
          {firstLeg && lastLeg && (
            <span className="hidden sm:inline">{formatTime(firstLeg.departs)} – {formatTime(lastLeg.arrives)}</span>
          )}
          <span>{flight.stops === 0 ? "Direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold text-[var(--color-accent)]">
          {flight.price > 0 ? `${sym}${Math.round(flight.price)}` : "-"}
        </span>
        <a
          href={safeUrl(googleUrl) || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          Google <ExternalLinkIcon />
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan Summary (progressive disclosure)
// ---------------------------------------------------------------------------
function ScanSummaryCollapsed({
  summary,
  currency,
  onExpand,
  flights,
}: {
  summary: ScanSummaryData;
  currency: string;
  onExpand: () => void;
  flights?: FlightOut[];
}) {
  const { stats } = summary;
  const sym = currencySymbol(currency);
  // Use live flight count/prices if available (e.g. after expand merge)
  const totalFlights = flights && flights.length > stats.total_flights ? flights.length : stats.total_flights;
  const destCount = flights && flights.length > 0 ? new Set(flights.map(f => f.destination)).size : stats.destinations;
  const minPrice = flights && flights.length > 0 ? Math.min(...flights.filter(f => f.price > 0).map(f => f.price)) : stats.min_price;
  const maxPrice = flights && flights.length > 0 ? Math.max(...flights.filter(f => f.price > 0).map(f => f.price)) : stats.max_price;
  return (
    <div className="mt-4">
      <button
        onClick={onExpand}
        className="text-sm text-[var(--color-accent)] hover:underline"
      >
        Compare all options ({totalFlights} flight{totalFlights !== 1 ? "s" : ""}, {destCount} destination{destCount !== 1 ? "s" : ""})
      </button>
      {minPrice > 0 && (
        <span className="ml-2 text-xs text-[var(--color-text-muted)]">
          {sym}{Math.round(minPrice)} – {sym}{Math.round(maxPrice)}
        </span>
      )}
    </div>
  );
}

function ScanSummaryExpanded({
  summary,
  currency,
  airportNames,
  flights,
  onCollapse,
  cabin,
}: {
  summary: ScanSummaryData;
  currency: string;
  airportNames: Record<string, string>;
  flights: FlightOut[];
  onCollapse: () => void;
  cabin?: string;
}) {
  const { best_destinations, price_matrix, stats } = summary;
  const sym = currencySymbol(currency);
  const isMultiDest = best_destinations.length > 1;
  const isMultiOrigin = stats.origins > 1;
  const showMatrix = isMultiDest && price_matrix.dates.length > 1 && Object.values(price_matrix.prices).some((v) => v != null);

  // Compute global min/max for heatmap coloring
  const allPrices = Object.values(price_matrix.prices).filter((v): v is number => v != null);
  const globalMin = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const globalMax = allPrices.length > 0 ? Math.max(...allPrices) : 0;

  // Price bars: sorted cheapest first. When multi-origin, group by route instead of just dest.
  const sortedDests = (() => {
    if (!isMultiDest) return [];
    if (isMultiOrigin) {
      // Build best per route from flights
      const routeBest = new Map<string, FlightOut>();
      for (const f of flights) {
        const key = `${f.origin}-${f.destination}`;
        if (!routeBest.has(key) || f.score < routeBest.get(key)!.score) routeBest.set(key, f);
      }
      return [...routeBest.values()].filter((f) => f.price > 0).sort((a, b) => a.price - b.price);
    }
    return [...best_destinations].filter((f) => f.price > 0).sort((a, b) => a.price - b.price);
  })();
  const barMax = sortedDests.length > 0 ? sortedDests[sortedDests.length - 1].price : 1;

  return (
    <div className="mt-4 space-y-4">
      <button onClick={onCollapse} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
        Hide comparison
      </button>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
        <span><span className="text-[var(--color-text)] font-semibold">{stats.total_flights}</span> flights</span>
        <span><span className="text-[var(--color-text)] font-semibold">{stats.destinations}</span> destinations</span>
        {stats.min_price > 0 && (
          <span>{sym}{Math.round(stats.min_price)} – {sym}{Math.round(stats.max_price)}</span>
        )}
      </div>

      {/* Price bars per destination */}
      {sortedDests.length > 1 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] uppercase">{isMultiOrigin ? "Best price per route" : "Best price per destination"}</div>
          <div className="px-4 py-3 space-y-2">
            {sortedDests.map((f, i) => {
              const pct = Math.max(8, (f.price / barMax) * 100);
              const barColor = priceToColor(f.price, sortedDests[0].price, barMax);
              const gfUrl = safeUrl(googleFlightsUrl(f.origin, f.destination, f.date, f.currency, cabin, f.legs));
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="font-mono font-medium shrink-0" style={{ width: isMultiOrigin ? "5.5rem" : "2.5rem" }}>
                    {isMultiOrigin ? `${f.origin} → ${f.destination}` : f.destination}
                  </span>
                  <span className="text-[var(--color-text-muted)] text-xs truncate hidden sm:inline w-24 shrink-0">{airportNames[f.destination] || ""}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-5 rounded" style={{ width: `${pct}%`, backgroundColor: barColor, minWidth: "2rem" }}>
                      <span className="px-1.5 text-xs font-semibold text-white leading-5 whitespace-nowrap">{sym}{Math.round(f.price)}</span>
                    </div>
                  </div>
                  <span className="text-[var(--color-text-muted)] text-xs shrink-0">{formatDate(f.date)}</span>
                  {gfUrl && (
                    <a href={gfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent)] hover:underline shrink-0">
                      Google <ExternalLinkIcon />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isMultiDest && flights.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">All {flights.length} options</div>
          <div className="divide-y divide-[var(--color-border)]">
            {[...flights].sort((a, b) => a.score - b.score).map((f, i) => (
              <CompactFlightRow key={i} flight={f} sym={sym} airportNames={airportNames} cabin={cabin} />
            ))}
          </div>
        </div>
      )}

      {/* Fare heatmap */}
      {showMatrix && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] uppercase">Fare heatmap</div>
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            {(() => {
              // When multi-origin, build route-level matrix from flights data
              const routeRows = isMultiOrigin
                ? (() => {
                    const routeMap = new Map<string, { origin: string; dest: string; byDate: Record<string, number> }>();
                    for (const f of flights) {
                      const key = `${f.origin}-${f.destination}`;
                      if (!routeMap.has(key)) routeMap.set(key, { origin: f.origin, dest: f.destination, byDate: {} });
                      const entry = routeMap.get(key)!;
                      if (!entry.byDate[f.date] || f.price < entry.byDate[f.date]) entry.byDate[f.date] = f.price;
                    }
                    return [...routeMap.values()].sort((a, b) => a.origin.localeCompare(b.origin) || a.dest.localeCompare(b.dest));
                  })()
                : null;

              return (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)] sticky left-0 z-10 bg-[var(--color-surface)]">{isMultiOrigin ? "Route" : "Dest"}</th>
                      {price_matrix.dates.map((d) => (
                        <th key={d} className="px-2 py-2 text-center font-mono text-[var(--color-text-muted)] min-w-[60px]">{d.slice(5)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {routeRows
                      ? routeRows.map((row) => (
                          <tr key={`${row.origin}-${row.dest}`}>
                            <td className="px-3 py-1.5 font-mono font-medium sticky left-0 z-10 bg-[var(--color-surface)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                              {row.origin} → {row.dest} <span className="font-sans text-[var(--color-text-muted)] hidden sm:inline">{airportNames[row.dest] || ""}</span>
                            </td>
                            {price_matrix.dates.map((dt) => {
                              const price = row.byDate[dt] ?? null;
                              const bg = priceToColor(price, globalMin, globalMax);
                              const gfLink = `https://www.google.com/travel/flights?q=flights+from+${row.origin}+to+${row.dest}+on+${dt}`;
                              return (
                                <td key={dt} className="px-1 py-1">
                                  {price != null ? (
                                    <a href={gfLink} target="_blank" rel="noopener noreferrer" className="block px-2 py-1.5 text-center text-xs font-mono font-semibold rounded-md transition-opacity hover:opacity-80" style={{ backgroundColor: bg, color: "#fff" }}>
                                      {sym}{Math.round(price)}
                                    </a>
                                  ) : (
                                    <span className="block px-2 py-1.5 text-center text-xs font-mono text-[var(--color-text-muted)]">---</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      : price_matrix.destinations.map((dest) => (
                          <tr key={dest}>
                            <td className="px-3 py-1.5 font-mono font-medium sticky left-0 z-10 bg-[var(--color-surface)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">
                              {dest} <span className="font-sans text-[var(--color-text-muted)] hidden sm:inline">{airportNames[dest] || ""}</span>
                            </td>
                            {price_matrix.dates.map((dt) => {
                              const price = price_matrix.prices[`${dest}|${dt}`];
                              const bg = priceToColor(price, globalMin, globalMax);
                              const gfLink = `https://www.google.com/travel/flights?q=flights+from+${best_destinations.find((d) => d.destination === dest)?.origin || ""}+to+${dest}+on+${dt}`;
                              return (
                                <td key={dt} className="px-1 py-1">
                                  {price != null ? (
                                    <a href={gfLink} target="_blank" rel="noopener noreferrer" className="block px-2 py-1.5 text-center text-xs font-mono font-semibold rounded-md transition-opacity hover:opacity-80" style={{ backgroundColor: bg, color: "#fff" }}>
                                      {sym}{Math.round(price)}
                                    </a>
                                  ) : (
                                    <span className="block px-2 py-1.5 text-center text-xs font-mono text-[var(--color-text-muted)]">---</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
          {/* Color legend */}
          <div className="px-4 py-2.5 border-t border-[var(--color-border)] flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Cheapest</span>
            <div className="flex-1 h-2 rounded-full" style={{ background: "linear-gradient(to right, var(--color-safe), var(--color-caution), var(--color-danger))" }} />
            <span className="text-xs text-[var(--color-text-muted)]">Most expensive</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Price Alert Section
// ---------------------------------------------------------------------------
function PriceAlertSection({
  parsed,
  cheapestPrice,
}: {
  parsed: ParsedSearch;
  cheapestPrice: number;
}) {
  const [email, setEmail] = useState("");
  const [threshold, setThreshold] = useState(cheapestPrice > 0 ? String(Math.round(cheapestPrice)) : "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const sym = currencySymbol(parsed.currency);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const resp = await fetch(`${API_URL}/api/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          query: `${parsed.origins.join(",")} to ${parsed.destinations.join(",")}`,
          origins: parsed.origins,
          destinations: parsed.destinations,
          max_price: parseFloat(threshold) || 0,
          currency: parsed.currency,
          cabin: parsed.cabin,
          is_round_trip: parsed.return_dates?.length > 0,
          current_price: cheapestPrice > 0 ? cheapestPrice : null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatus("error");
        setMessage(data.detail || "Something went wrong.");
      } else {
        setStatus("success");
        setMessage(data.message || "Check your email to confirm the alert.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className="mt-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3">
        <p className="text-sm text-[var(--color-text)]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block mr-1 text-[var(--color-safe)] -mt-0.5"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
          Price alert created. Check your email to confirm.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 space-y-2">
      <p className="text-sm font-medium text-[var(--color-text)]">Get notified when prices drop</p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[180px] px-3 py-1.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        <div className="flex items-center gap-1">
          <span className="text-sm text-[var(--color-text-muted)]">{sym}</span>
          <input
            type="number"
            placeholder="Max price"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-24 px-3 py-1.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={status === "loading" || !email.trim()}
          className="px-4 py-1.5 text-sm font-medium bg-[var(--color-accent)] text-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {status === "loading" ? "Setting..." : "Set alert"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-[var(--color-danger)]">{message}</p>
      )}
      <p className="text-xs text-[var(--color-text-muted)]">We&apos;ll send a confirmation email. Daily check, 90-day expiry, one-click unsubscribe.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fix 2: Parsed Config chips
// ---------------------------------------------------------------------------
function ParsedConfig({ parsed, cacheAgeSeconds, onRefresh, safeCount, totalCount }: { parsed: ParsedSearch; cacheAgeSeconds: number | null; onRefresh: () => void; safeCount?: number; totalCount?: number }) {
  const { origins, destinations, dates, return_dates, max_price, currency, cabin, stops, airport_names } = parsed;
  const sym = currencySymbol(currency);
  const isRoundTrip = return_dates && return_dates.length > 0;
  const [datesExpanded, setDatesExpanded] = useState(false);

  const originLabel = origins.map((o) => airport_names?.[o] ? `${airport_names[o]} (${o})` : o).join(", ");
  const destLabel = destinations.map((d) => airport_names?.[d] ? `${airport_names[d]} (${d})` : d).join(", ");

  const collapsedDates = dates.length <= 2 ? dates.map((d) => formatDate(d)).join(", ") : `${formatDate(dates[0])} + ${dates.length - 1} more dates`;
  const canExpandDates = dates.length > 2;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-[var(--color-text)]">{originLabel}</span>
        <span className="text-[var(--color-text-muted)]">→</span>
        <span className="font-medium text-[var(--color-text)]">{destLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
        {canExpandDates ? (
          <button
            onClick={() => setDatesExpanded(!datesExpanded)}
            className="hover:text-[var(--color-text)] transition-colors underline decoration-dotted underline-offset-2"
          >
            {datesExpanded ? dates.map((d) => formatDate(d)).join(", ") : collapsedDates}
          </button>
        ) : (
          <span>{collapsedDates}</span>
        )}
        {isRoundTrip && (
          <span className="px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium">
            Round trip → {return_dates.length <= 2 ? return_dates.map((d) => formatDate(d)).join(", ") : `${formatDate(return_dates[0])} + ${return_dates.length - 1} more`}
          </span>
        )}
        {cabin && <span className="capitalize">{cabin.replace(/_/g, " ")}</span>}
        {stops && stops !== "any" && (
          <span>{stops === "non_stop" ? "Direct only" : stops === "one_stop_or_fewer" ? "1 stop max" : "2 stops max"}</span>
        )}
        {max_price > 0 && <span>Max {sym}{Math.round(max_price)}</span>}
        {parsed.safe_only && (
          <span className="px-1.5 py-0.5 rounded bg-[var(--color-safe)]/10 border border-[var(--color-safe)]/20 text-[var(--color-safe)] font-medium">Safe only</span>
        )}
        {totalCount != null && totalCount > 0 && !parsed.safe_only && (
          <span className={`px-1.5 py-0.5 rounded font-medium ${
            safeCount === totalCount
              ? "bg-[var(--color-safe)]/10 border border-[var(--color-safe)]/20 text-[var(--color-safe)]"
              : "bg-[var(--color-caution)]/10 border border-[var(--color-caution)]/20 text-[var(--color-caution)]"
          }`}>
            {safeCount === totalCount ? "All safe" : `${safeCount}/${totalCount} safe`}
          </span>
        )}
        {cacheAgeSeconds !== null && (
          <>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span>Prices from ~{Math.round(cacheAgeSeconds / 60)} min ago.{" "}
              <button onClick={onRefresh} className="underline hover:text-[var(--color-text)] transition-colors">Refresh</button>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2">Something went wrong</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">Please refresh the page.</p>
            <button onClick={() => { this.setState({ error: null }); window.location.reload(); }} className="px-4 py-2 bg-[var(--color-accent)] text-black text-sm font-medium rounded-lg">
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Structured search form state
// ---------------------------------------------------------------------------
interface SearchFormState {
  from: string;
  to: string;
  depart: string;
  returnDate: string;
  roundTrip: boolean;
  flexibleDates: boolean;
  maxPrice: string;
  directOnly: boolean;
  cabin: string;
  safeOnly: boolean;
}

function buildPromptFromForm(f: SearchFormState): string {
  const parts: string[] = [];
  parts.push(`${f.from.trim()} to ${f.to.trim()}`);
  if (f.roundTrip && f.returnDate) {
    parts.push(`round trip ${f.depart} returning ${f.returnDate}`);
  } else {
    parts.push(f.depart);
  }
  if (f.flexibleDates) parts.push("flexible +/- 3 days");
  if (f.cabin && f.cabin !== "economy") parts.push(f.cabin.replace("_", " "));
  if (f.maxPrice && parseInt(f.maxPrice, 10) > 0) parts.push(`under $${f.maxPrice}`);
  if (f.directOnly) parts.push("direct only");
  if (f.safeOnly) parts.push("safe routes only");
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------
const EXAMPLES = [
  "India to Germany, next week, safe routes only",
  "JFK to London, next week, under $500",
  "New York to Tokyo, business class, under $3000",
  "Berlin to anywhere in Europe, July, under 100",
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
function HomePage() {
  const [searchMode, setSearchMode] = useState<"structured" | "natural">("natural");
  const [form, setForm] = useState<SearchFormState>({
    from: "",
    to: "",
    depart: "",
    returnDate: "",
    roundTrip: false,
    flexibleDates: false,
    maxPrice: "",
    directOnly: false,
    cabin: "economy",
    safeOnly: true,
  });
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "parsing" | "searching" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [parsed, setParsed] = useState<ParsedSearch | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [flights, setFlights] = useState<FlightOut[]>([]);
  const [returnFlights, setReturnFlights] = useState<FlightOut[] | null>(null);
  const [roundTripResults, setRoundTripResults] = useState<RoundTripOut[] | null>(null);
  const [zonesWarning, setZonesWarning] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummaryData | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [attributionParams, setAttributionParams] = useState<AttributionParams>({ ref: "organic" });
  const [noResultsReason, setNoResultsReason] = useState<string | null>(null);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const [safetyFilteredCount, setSafetyFilteredCount] = useState<number>(0);
  const [autoSearchQuery, setAutoSearchQuery] = useState<string | null>(null);
  const [cacheAgeSeconds, setCacheAgeSeconds] = useState<number | null>(null);
  const [isPartial, setIsPartial] = useState(false);
  const [previewFlights, setPreviewFlights] = useState<FlightOut[]>([]);
  const [tripTab, setTripTab] = useState<"roundtrip" | "oneway">("roundtrip");
  const [rtShowCount, setRtShowCount] = useState(5);
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
  const [shareCTADismissed, setShareCTADismissed] = useState(false);
  const [showAlertPopup, setShowAlertPopup] = useState(false);
  const [alertPopupDismissed, setAlertPopupDismissed] = useState(false);
  const [popupEmail, setPopupEmail] = useState("");
  const [popupThreshold, setPopupThreshold] = useState("");
  const [popupStatus, setPopupStatus] = useState<"idle" | "loading" | "success">("idle");
  const [expandPhase, setExpandPhase] = useState<"idle" | "expanding" | "done">("idle");
  const [expandCount, setExpandCount] = useState(0);
  const [expandError, setExpandError] = useState<string | null>(null);
  const [expansionInfo, setExpansionInfo] = useState<string | null>(null);
  const [expandProgress, setExpandProgress] = useState<{ done: number; total: number } | null>(null);
  const expandAbortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const savedSearches = useSavedSearches();
  const [minutesSaved, setMinutesSaved] = useState(0);

  const hasResults = phase === "done" || phase === "searching" || phase === "parsing";
  const [extraAirportNames, setExtraAirportNames] = useState<Record<string, string>>({});
  const [airportCountries, setAirportCountries] = useState<Record<string, string>>({});
  const airportNames = { ...(parsed?.airport_names || {}), ...extraAirportNames };

  useEffect(() => {
    if (searchMode === "natural") inputRef.current?.focus();
  }, [searchMode]);

  useEffect(() => {
    try { setMinutesSaved(parseInt(localStorage.getItem("flyfast_minutes_saved") || "0", 10)); } catch {}
  }, []);

  useEffect(() => {
    const restore = () => { if (!document.hidden) document.title = "FlyFast - The smartest flight search"; };
    document.addEventListener("visibilitychange", restore);
    return () => document.removeEventListener("visibilitychange", restore);
  }, []);

  // Price alert popup: show 2s after results, auto-dismiss 10s
  useEffect(() => {
    if (phase !== "done" || flights.length === 0 || alertPopupDismissed) {
      setShowAlertPopup(false);
      return;
    }
    const showTimer = setTimeout(() => setShowAlertPopup(true), 2000);
    return () => clearTimeout(showTimer);
  }, [phase, flights.length, alertPopupDismissed]);

  useEffect(() => {
    if (!showAlertPopup) return;
    const dismissTimer = setTimeout(() => {
      setShowAlertPopup(false);
      setAlertPopupDismissed(true);
    }, 10000);
    return () => clearTimeout(dismissTimer);
  }, [showAlertPopup]);

  // Reset popup on new search
  useEffect(() => {
    if (phase === "parsing") {
      setAlertPopupDismissed(false);
      setShowAlertPopup(false);
      setPopupStatus("idle");
      setPopupEmail("");
      setPopupThreshold("");
    }
  }, [phase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    setAttributionParams({
      utm_source: p.get("utm_source") || undefined,
      utm_medium: p.get("utm_medium") || undefined,
      utm_campaign: p.get("utm_campaign") || undefined,
      ref: p.get("ref") || "organic",
    });
    // Fix 12: auto-populate and search from share URL
    const q = p.get("q");
    if (q) {
      setPrompt(q);
      setSearchMode("natural");
      setAutoSearchQuery(q);
    }
  }, []);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [prompt]);

  useEffect(() => {
    if ((phase === "done" || error) && resultsRef.current) resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase, error]);

  useEffect(() => {
    if (rateLimitReset === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitReset - Date.now()) / 1000));
      setRateLimitCountdown(remaining);
      if (remaining <= 0) setRateLimitReset(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [rateLimitReset]);

  // Fix 12: auto-search when ?q= param present on page load
  useEffect(() => {
    if (autoSearchQuery) {
      const q = autoSearchQuery;
      setAutoSearchQuery(null);
      search(q);
    }
  }, [autoSearchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSearchPrompt = (): string => {
    if (searchMode === "natural") return prompt.trim();
    return buildPromptFromForm(form);
  };

  const returnDateInvalid = form.roundTrip && form.returnDate && form.depart && form.returnDate < form.depart;

  const canSearch = (): boolean => {
    if (searchMode === "natural") return prompt.trim().length >= 3;
    if (returnDateInvalid) return false;
    return form.from.trim().length >= 2 && form.to.trim().length >= 2 && form.depart.length >= 8;
  };

  const search = async (q?: string) => {
    const text = q ?? getSearchPrompt();
    if (!text.trim()) return;
    trackEvent("search_submitted", {
      prompt_length: text.trim().length,
      mode: searchMode,
      ref: attributionParams.ref || "organic",
      utm_source: attributionParams.utm_source || undefined,
    });
    // Request notification permission for background tab alerts
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    setPhase("parsing");
    setError(null);
    setSuggestions(null);
    setParsed(null);
    setProgress(null);
    setFlights([]);
    setReturnFlights(null);
    setRoundTripResults(null);
    setZonesWarning(null);
    setSummary(null);
    setShowCompare(false);
    setNoResultsReason(null);
    setSearchWarning(null);
    setSafetyFilteredCount(0);
    setCacheAgeSeconds(null);
    setPreviewFlights([]);
    setIsPartial(false);
    setTripTab("roundtrip");
    setExpandPhase("idle");
    setExpandCount(0);
    setExpandError(null);
    setExpansionInfo(null);
    setExpandProgress(null);
    expandAbortRef.current?.abort();
    setRtShowCount(5);

    // Update browser URL so refresh/back restores the search (C6)
    // Keep ref/utm_source when arriving from a share URL (first search only)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("q", text.trim());
      const isShareVisit = url.searchParams.get("ref") === "share";
      if (!isShareVisit) {
        url.searchParams.delete("ref");
        url.searchParams.delete("utm_source");
        setAttributionParams((prev) => ({ ...prev, ref: "organic", utm_source: undefined }));
      }
      window.history.pushState({}, "", url.toString());
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 150_000);

    try {
      const resp = await fetch(`${API_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get("Retry-After") || "", 10);
        if (retryAfter > 0) {
          setRateLimitReset(Date.now() + retryAfter * 1000);
        }
        const mins = retryAfter > 0 ? Math.ceil(retryAfter / 60) : 60;
        setError(`You've used all 10 free searches this hour. Next search available in ~${mins} minute${mins !== 1 ? "s" : ""}.`);
        trackEvent("rate_limit_hit", { ref: attributionParams.ref || "organic" });
        setPhase("idle");
        return;
      }
      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        setError(body?.detail || `Search failed (${resp.status})`);
        if (body?.suggestions?.length) setSuggestions(body.suggestions);
        trackEvent("search_error", { status_code: resp.status, stage: "http" });
        setPhase("idle");
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "parsed") {
              setParsed(msg.parsed);
              if (msg.warning) setSearchWarning(msg.warning);
              setPhase("searching");
            } else if (msg.type === "progress") {
              setProgress(msg);
              if (msg.filtered > 0) setSafetyFilteredCount(msg.filtered);
              if (msg.preview_flights?.length) {
                // For round-trip previews, use combined price if available
                const previews = msg.preview_flights.map((f: FlightOut & { _combined_price?: number }) => {
                  if (f._combined_price && f._combined_price > 0) {
                    return { ...f, price: f._combined_price, _isRoundTripPrice: true };
                  }
                  return f;
                });
                setPreviewFlights(previews);
              }
            } else if (msg.type === "results") {
              setFlights(msg.flights || []);
              setReturnFlights(msg.return_flights || null);
              setRoundTripResults(msg.round_trip_results || null);
              if (msg.round_trip_results?.length) {
                setTripTab("roundtrip");
              } else {
                setTripTab("oneway");
              }
              setZonesWarning(msg.zones_warning || null);
              setSummary(msg.summary || null);
              if (msg.summary?.best_destinations?.length > 1) setShowCompare(true);
              setNoResultsReason(msg.no_results_reason || null);
              setSearchWarning(msg.warning || null);
              setCacheAgeSeconds(msg.cache_age_seconds ?? null);
              if (msg.safety_filtered_count > 0) setSafetyFilteredCount(msg.safety_filtered_count);
              if (msg.airport_names) setExtraAirportNames(prev => ({ ...prev, ...msg.airport_names }));
              if (msg.airport_countries) setAirportCountries(prev => ({ ...prev, ...msg.airport_countries }));
              if (msg.partial) setIsPartial(true);
              setPhase("done");
              // Notify user if tab is in background
              if (document.hidden) {
                document.title = `✓ Results ready - FlyFast`;
                if ("Notification" in window && Notification.permission === "granted") {
                  new Notification("FlyFast", { body: `Found ${(msg.flights || []).length} flights`, icon: "/favicon.ico" });
                }
              }
              savedSearches.save(text);
              // Accumulate time saved
              const routes = parsed?.total_routes ?? 0;
              if (routes > 0) {
                const added = Math.ceil(routes * 2.5);
                try {
                  const prev = parseInt(localStorage.getItem("flyfast_minutes_saved") || "0", 10);
                  const next = prev + added;
                  localStorage.setItem("flyfast_minutes_saved", String(next));
                  setMinutesSaved(next);
                } catch {}
              }
              trackEvent("search_results_received", { count: (msg.flights || []).length, has_round_trip: Boolean(msg.round_trip_results?.length), has_return: Boolean(msg.return_flights?.length) });
            } else if (msg.type === "error") {
              setError(msg.detail);
              trackEvent("search_error", { stage: "stream", detail: String(msg.detail || "") });
              setPhase("idle");
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Use callback form to read current flights without stale closure
        setFlights((current) => {
          if (current.length > 0) {
            setIsPartial(true);
            setPhase("done");
            trackEvent("search_timeout_partial", { stage: "client", count: current.length });
          } else {
            setNoResultsReason("timeout");
            setPhase("done");
            trackEvent("search_error", { stage: "client", type: "abort_no_results" });
          }
          return current;
        });
      } else {
        setError("Could not reach the search API. Please try again.");
        trackEvent("search_error", { stage: "client", type: "network" });
        setPhase("idle");
      }
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setPhase((p) => (p === "parsing" || p === "searching" ? "idle" : p));
    }
  };

  const cancelSearch = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setError(null);
  };

  const expandSearch = async () => {
    if (!parsed || expandPhase !== "idle") return;
    setExpandPhase("expanding");
    setExpandCount(0);
    setExpandError(null);
    setExpansionInfo(null);
    setExpandProgress(null);
    // Scroll to top of results so user sees the progress bar
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    trackEvent("expand_search_clicked", { original_results: flights.length });

    const controller = new AbortController();
    expandAbortRef.current = controller;

    try {
      const resp = await fetch(`${API_URL}/api/expand-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt || "",
          original_parsed: {
            origins: parsed.origins,
            destinations: parsed.destinations,
            dates: parsed.dates,
            return_dates: parsed.return_dates || [],
            max_price: parsed.max_price,
            currency: parsed.currency,
            cabin: parsed.cabin,
            stops: parsed.stops,
            safe_only: parsed.safe_only,
          },
        }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get("Retry-After") || "", 10);
        if (retryAfter > 0) setRateLimitReset(Date.now() + retryAfter * 1000);
        const mins = retryAfter > 0 ? Math.ceil(retryAfter / 60) : 60;
        setExpandError(`Search limit reached. Try again in ~${mins}m.`);
        setExpandPhase("done");
        return;
      }
      if (!resp.ok) {
        setExpandError("Expansion failed. Try again later.");
        setExpandPhase("done");
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setExpandPhase("done"); return; }
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === "parsed") {
              if (msg.expansion_info) setExpansionInfo(msg.expansion_info);
            } else if (msg.type === "progress") {
              setExpandProgress({ done: msg.done, total: msg.total });
            } else if (msg.type === "results") {
              const expandedFlights: FlightOut[] = msg.flights || [];
              const expandedRT: RoundTripOut[] = msg.round_trip_results || [];

              // Merge one-way flights
              if (expandedFlights.length > 0) {
                setFlights(prev => {
                  const existingKeys = new Set(prev.map(f => `${f.route}|${f.date}|${f.stops}`));
                  const newOnes = expandedFlights.filter(f => !existingKeys.has(`${f.route}|${f.date}|${f.stops}`));
                  setExpandCount(newOnes.length);
                  if (newOnes.length === 0) return prev;
                  const merged = [...prev, ...newOnes];
                  merged.sort((a, b) => a.score - b.score);
                  return merged;
                });
              }

              // Merge round-trip results
              if (expandedRT.length > 0 && roundTripResults) {
                setRoundTripResults(prev => {
                  if (!prev) return expandedRT;
                  const existingKeys = new Set(prev.map(r => `${r.outbound.route}|${r.outbound.date}|${r.inbound.route}|${r.inbound.date}`));
                  const newOnes = expandedRT.filter(r => !existingKeys.has(`${r.outbound.route}|${r.outbound.date}|${r.inbound.route}|${r.inbound.date}`));
                  if (!expandedFlights.length) setExpandCount(newOnes.length);
                  if (newOnes.length === 0) return prev;
                  const merged = [...prev, ...newOnes];
                  merged.sort((a, b) => a.score - b.score);
                  return merged;
                });
              } else if (expandedRT.length > 0 && !roundTripResults) {
                setRoundTripResults(expandedRT);
                if (!expandedFlights.length) setExpandCount(expandedRT.length);
              }

              setExpandPhase("done");
              trackEvent("expand_search_results", { new_flights: expandedFlights.length, new_rt: expandedRT.length });
            } else if (msg.type === "error") {
              setExpandError(msg.detail || "Expansion search failed.");
              setExpandPhase("done");
            }
          } catch {}
        }
      }
    } catch {
      setExpandError("Could not reach search API.");
      setExpandPhase("done");
    } finally {
      expandAbortRef.current = null;
      setExpandPhase(p => p === "expanding" ? "done" : p);
    }
  };

  const handleOutboundClick = (provider: "booking" | "google", flight: FlightOut) => {
    trackEvent("outbound_click", {
      provider,
      route: flight.route,
      ref: attributionParams.ref || "organic",
      utm_source: attributionParams.utm_source || undefined,
    });
  };

  const getShareUrl = (): string | null => {
    const currentPrompt = getSearchPrompt();
    if (!currentPrompt) return null;
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("q", currentPrompt);
    url.searchParams.set("ref", "share");
    url.searchParams.set("utm_source", "share");
    // Encode best flight data for dynamic OG preview
    const best = flights[0];
    if (best) {
      url.searchParams.set("price", String(Math.round(best.price)));
      // Use city names for readable OG titles (fall back to IATA codes)
      const codes = best.route.split(" -> ").map((c) => c.trim());
      const cityRoute = codes.map((c) => airportNames[c] || c).join(" to ");
      url.searchParams.set("route", cityRoute);
      url.searchParams.set("codes", codes.join("-"));
      url.searchParams.set("currency", best.currency || parsed?.currency || "EUR");
      url.searchParams.set("safety", best.risk_level || "safe");
      url.searchParams.set("stops", String(best.stops));
    }
    return url.toString();
  };

  const [shareOpen, setShareOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shareOpen) return;
    const close = (e: MouseEvent) => { if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [shareOpen]);

  const handleCopyLink = async () => {
    const shareUrl = getShareUrl();
    if (!shareUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
      trackEvent("results_shared", { method: "copy" });
    } catch {}
  };

  const handleNativeShare = async () => {
    if (!parsed) return;
    const shareUrl = getShareUrl();
    if (!shareUrl) return;
    const best = flights[0];
    const sym = currencySymbol(best?.currency || parsed.currency);
    const codes = best?.route.split(" -> ").map((c) => c.trim()) || [];
    const cityRoute = codes.map((c) => airportNames[c] || c).join(" to ");
    const shareTitle = best ? `${cityRoute} from ${sym}${Math.round(best.price)}` : "Flight search results";
    const shareText = best ? `Found ${cityRoute} from ${sym}${Math.round(best.price)} on FlyFast` : "Check out these flights on FlyFast";
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
      trackEvent("results_shared", { method: "native" });
      setShareOpen(false);
    } catch {}
  };

  const isLoading = phase === "parsing" || phase === "searching";
  const queryPreview = useQueryPreview(prompt);

  // Airline filter (post-results)
  const airlineFilter = useAirlineFilter(flights);
  const displayFlights = airlineFilter.filtered;

  // Use only priced flights for recommendations (unpriced can appear in list but not labeled)
  const pricedFlights = displayFlights.filter((f) => f.price > 0);
  const recEligible = pricedFlights.length > 0 ? pricedFlights : flights;
  // "Recommended" only applies to safe routes — if no safe flights exist, suppress the label
  const safeFlights = recEligible.filter((f) => f.risk_level === "safe");
  const recommended = safeFlights.length > 0 ? sortFlights(safeFlights, "score")[0] : null;
  const cheapest = sortFlights(recEligible, "price")[0];
  const fastest = sortFlights(recEligible, "duration")[0];
  const lowestStress = [...recEligible].sort((a, b) => {
    const stressA = a.stops * 100 + (a.risk_level !== "safe" ? 50 : 0);
    const stressB = b.stops * 100 + (b.risk_level !== "safe" ? 50 : 0);
    return stressA - stressB || a.price - b.price;
  })[0];

  const recs: { label: RecLabel; flight: FlightOut }[] = [];
  const seen = new Set<string>();
  for (const { label, flight } of [
    { label: "Recommended" as RecLabel, flight: recommended },
    { label: "Cheapest" as RecLabel, flight: cheapest },
    { label: "Fastest" as RecLabel, flight: fastest },
    { label: "Lowest stress" as RecLabel, flight: lowestStress },
  ]) {
    if (flight && !seen.has(`${flight.route}|${flight.date}|${flight.provider}`)) {
      seen.add(`${flight.route}|${flight.date}|${flight.provider}`);
      recs.push({ label, flight });
    }
  }

  // Round-trip best pair total
  const roundTripTotal =
    roundTripResults && roundTripResults.length > 0
      ? (roundTripResults.find((r) => r.total_price > 0)?.total_price ?? null)
      : returnFlights && returnFlights.length > 0 && flights.length > 0
        ? (() => {
            const cheapOut = flights.filter((f) => f.price > 0).reduce((m, f) => (f.price < m ? f.price : m), Infinity);
            const cheapRet = returnFlights.filter((f) => f.price > 0).reduce((m, f) => (f.price < m ? f.price : m), Infinity);
            return cheapOut < Infinity && cheapRet < Infinity ? cheapOut + cheapRet : null;
          })()
        : null;

  return (
    <AirportCountriesCtx.Provider value={airportCountries}>
    <div className="flex-1 flex flex-col">
      {/* Referred-visit message */}
      {attributionParams.ref === "share" && (() => {
        const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const sharedRoute = sp?.get("route");
        const sharedPrice = sp?.get("price");
        const sharedCurrency = sp?.get("currency") || "EUR";
        const sym = currencySymbol(sharedCurrency);
        return (
          <div className="max-w-3xl mx-auto px-4 pt-4">
            <div className="text-sm bg-[var(--color-surface)] border border-[var(--color-accent)]/20 rounded-lg px-4 py-3 flex items-start gap-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg>
              <div>
                <p className="text-[var(--color-text)] font-medium">
                  {sharedRoute && sharedPrice
                    ? `A friend found ${sharedRoute} from ${sym}${sharedPrice}`
                    : "Someone shared a flight with you"}
                </p>
                <p className="text-[var(--color-text-muted)] mt-0.5">Search below to compare options and find your own deals.</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hero - outcome-focused */}
      <section className={`max-w-3xl mx-auto px-4 w-full transition-all duration-300 ${hasResults ? "pt-6 pb-4 text-left" : "pt-16 sm:pt-24 pb-6 text-center"}`}>
        <h1 className={`font-bold tracking-tight transition-all duration-300 ${hasResults ? "text-2xl" : "text-4xl sm:text-5xl"}`}>
          Describe your{" "}
          <span className="text-[var(--color-accent)]">trip.</span>
        </h1>
        {!hasResults && (
          <p className="mt-4 text-[var(--color-text-muted)] text-base sm:text-lg max-w-xl mx-auto">
            Search every flight on Google Flights. AI-powered, conflict zones filtered. Free, no login.
          </p>
        )}

        {/* Search surface */}
        <div className={`${hasResults ? "mt-4" : "mt-8"} bg-[var(--color-surface)] border border-white/[0.06] rounded-2xl ${hasResults ? "px-4 py-3 sm:px-5" : "p-5 sm:p-6"} search-surface transition-all duration-300`}>
          {hasResults ? (
            /* Compact mode: single-line query display with action button */
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--color-text)]/70 truncate">{prompt || [form.from, form.to, form.depart].filter(Boolean).join(" → ")}</p>
              </div>
              {isLoading ? (
                <button
                  onClick={cancelSearch}
                  aria-label="Cancel search"
                  className="shrink-0 px-4 py-1.5 text-sm font-medium rounded-lg border border-white/[0.08] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-white/[0.15] transition-all duration-200"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => { setPhase("idle"); setFlights([]); setRoundTripResults(null); setPrompt(""); setTimeout(() => inputRef.current?.focus(), 0); }}
                  aria-label="New search"
                  className="shrink-0 px-4 py-1.5 text-sm font-medium rounded-lg border border-white/[0.08] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-white/[0.15] transition-all duration-200"
                >
                  New search
                </button>
              )}
            </div>
          ) : (
            /* Full mode: textarea + controls */
            <>
              {searchMode === "structured" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <AirportAutocomplete
                      id="from"
                      label="From"
                      placeholder="JFK, London..."
                      value={form.from}
                      onChange={(v) => setForm((f) => ({ ...f, from: v }))}
                      disabled={isLoading}
                    />
                    <AirportAutocomplete
                      id="to"
                      label="To"
                      placeholder="LHR, Paris..."
                      value={form.to}
                      onChange={(v) => setForm((f) => ({ ...f, to: v }))}
                      disabled={isLoading}
                    />
                    <div>
                      <label htmlFor="depart" className="block text-[11px] font-medium text-[var(--color-text-muted)]/70 mb-1.5 uppercase tracking-wider">Depart</label>
                      <input
                        id="depart"
                        type="date"
                        value={form.depart}
                        onChange={(e) => setForm((f) => ({ ...f, depart: e.target.value }))}
                        disabled={isLoading}
                        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
                      />
                      <label className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[var(--color-text-muted)] cursor-pointer select-none">
                        <input type="checkbox" checked={form.flexibleDates} onChange={(e) => setForm((f) => ({ ...f, flexibleDates: e.target.checked }))} disabled={isLoading} className="rounded accent-[var(--color-accent)]" aria-label="Search flexible dates" />
                        +/- 3 days
                      </label>
                    </div>
                    <div>
                      <label htmlFor="return" className="block text-[11px] font-medium text-[var(--color-text-muted)]/70 mb-1.5 uppercase tracking-wider">Return</label>
                      <input
                        id="return"
                        type="date"
                        value={form.returnDate}
                        onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))}
                        disabled={isLoading || !form.roundTrip}
                        className={`w-full bg-[var(--color-background)] border rounded-lg px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors disabled:opacity-30 ${returnDateInvalid ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"}`}
                      />
                      {returnDateInvalid && (
                        <p className="mt-1 text-[11px] text-[var(--color-danger)]">Return must be after departure</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] cursor-pointer select-none">
                      <input type="checkbox" checked={form.roundTrip} onChange={(e) => setForm((f) => ({ ...f, roundTrip: e.target.checked }))} disabled={isLoading} className="rounded accent-[var(--color-accent)]" />
                      Round trip
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] cursor-pointer select-none">
                      <input type="checkbox" checked={form.directOnly} onChange={(e) => setForm((f) => ({ ...f, directOnly: e.target.checked }))} disabled={isLoading} className="rounded accent-[var(--color-accent)]" />
                      Direct only
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-accent)] cursor-pointer select-none" title="Filter out routes through conflict zones">
                      <input type="checkbox" checked={form.safeOnly} onChange={(e) => setForm((f) => ({ ...f, safeOnly: e.target.checked }))} disabled={isLoading} className="rounded accent-[var(--color-accent)]" />
                      Safe routes only
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={form.cabin}
                        onChange={(e) => setForm((f) => ({ ...f, cabin: e.target.value }))}
                        disabled={isLoading}
                        className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50 cursor-pointer"
                      >
                        <option value="economy">Economy</option>
                        <option value="premium_economy">Premium</option>
                        <option value="business">Business</option>
                        <option value="first">First</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="maxPrice" className="text-sm text-[var(--color-text-muted)]">Max $</label>
                      <input
                        id="maxPrice"
                        type="number"
                        placeholder="any"
                        value={form.maxPrice}
                        onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value }))}
                        disabled={isLoading}
                        className="w-20 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-accent)]/50"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <textarea
                    ref={inputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), canSearch() && search())}
                    placeholder="e.g. JFK to London next week under $500, business class"
                    disabled={isLoading}
                    rows={2}
                    className="w-full bg-transparent border-none px-1 py-2 text-base leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none resize-none"
                    aria-label="Describe your trip in plain English"
                  />
                </div>
              )}

              <div className={`${searchMode === "structured" ? "mt-3" : "mt-1 pt-3 border-t border-white/[0.04]"} flex items-center justify-between`}>
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSearchMode((m) => (m === "structured" ? "natural" : "structured"))}
                    className="text-xs text-[var(--color-text-muted)]/60 hover:text-[var(--color-text-muted)] transition-colors duration-200 shrink-0"
                  >
                    {searchMode === "structured" ? "Describe your trip instead" : "Use search form instead"}
                  </button>
                  {searchMode === "natural" && !isLoading && queryPreview && (
                    <p className="text-[11px] text-[var(--color-text-muted)]/50 truncate transition-opacity duration-300">
                      {queryPreview.origin}
                      {queryPreview.dest && <> <span className="opacity-60">{"\u2192"}</span> {queryPreview.dest}</>}
                      {queryPreview.date && <> <span className="opacity-40">{"\u00B7"}</span> {queryPreview.date}</>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {searchMode === "natural" && !isLoading && <span className="text-[11px] text-[var(--color-text-muted)]/25 hidden sm:inline">Enter to search</span>}
                  <button
                    onClick={() => search()}
                    disabled={!canSearch()}
                    aria-label="Search flights"
                    className="px-6 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-25 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-xl transition-all duration-200 hover:shadow-[0_0_28px_rgba(34,197,94,0.2)]"
                  >
                    Search
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Example prompts */}
        {phase === "idle" && flights.length === 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => {
                  setSearchMode("natural");
                  setPrompt(ex);
                  trackEvent("example_prompt_clicked", { prompt: ex });
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="text-[13px] px-4 py-2 rounded-full border border-white/[0.05] bg-[var(--color-surface)] text-[var(--color-text-muted)]/80 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] hover:border-white/[0.1] transition-all duration-200 whitespace-nowrap hover:-translate-y-px"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {/* Recent searches */}
        {phase === "idle" && flights.length === 0 && savedSearches.searches.length > 0 && (
          <SavedSearchesList
            searches={savedSearches.searches}
            onSelect={(q) => { setSearchMode("natural"); setPrompt(q); setTimeout(() => inputRef.current?.focus(), 0); }}
            onClear={savedSearches.clear}
          />
        )}

        {/* Time saved */}
        {phase === "idle" && flights.length === 0 && minutesSaved > 0 && (
          <p className="text-[11px] text-[var(--color-text-muted)]/50 mt-3 text-center">
            FlyFast saved you ~{minutesSaved >= 60 ? `${Math.floor(minutesSaved / 60)}h ${minutesSaved % 60}m` : `${minutesSaved} min`} of manual searching
          </p>
        )}
      </section>

      {/* Results */}
      <section id="main-content" ref={resultsRef} aria-live="polite" className="max-w-3xl mx-auto px-4 py-4 w-full flex-1">
        {error && (
          <div role="alert" className="mb-4">
            <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
              {rateLimitCountdown > 0 && (
                <span className="block mt-1 text-xs font-mono">
                  {Math.floor(rateLimitCountdown / 60)}:{String(rateLimitCountdown % 60).padStart(2, "0")} remaining
                </span>
              )}
            </div>
            {suggestions && suggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">Try one of these instead:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setSearchMode("natural"); setPrompt(s); search(s); }}
                      className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <>
            {parsed && (
              <ParsedConfig parsed={parsed} cacheAgeSeconds={null} onRefresh={() => search()} />
            )}
            <SearchingState parsed={parsed} progress={progress} filteredCount={safetyFilteredCount} />
            <div className="mt-6 space-y-4">
              {previewFlights.length > 0 ? (
                <div className="animate-[fadeIn_0.3s_ease-in]">
                  <p className="text-xs text-[var(--color-text-muted)] text-center mb-3">Best so far (updating as we search)</p>
                  {previewFlights.map((f: FlightOut & { _isRoundTripPrice?: boolean }, i: number) => (
                    <div key={`preview-${i}`} className="opacity-70 pointer-events-none mb-4 relative">
                      <FlightCard
                        flight={f}
                        airportNames={airportNames}
                        attributionParams={attributionParams}
                        onOutboundClick={() => {}}
                        cabin={parsed?.cabin}
                      />
                      {f._isRoundTripPrice && (
                        <span className="absolute top-3 right-3 text-[10px] text-[var(--color-text-muted)]">round trip</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="animate-pulse overflow-hidden">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5 mb-4 overflow-hidden">
                      <div className="flex justify-between gap-4">
                        <div className="flex-1 space-y-2.5">
                          <div className="h-4 bg-[var(--color-border)] rounded w-3/4" />
                          <div className="h-3 bg-[var(--color-border)] rounded w-1/3" />
                          <div className="h-3 bg-[var(--color-border)] rounded w-1/2 mt-2" />
                        </div>
                        <div className="space-y-2 w-24">
                          <div className="h-7 bg-[var(--color-border)] rounded" />
                          <div className="h-9 bg-[var(--color-border)] rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {phase === "done" && parsed && (
          <>
            {/* Fix 2: Parsed config chips */}
            {(() => {
              const items = (tripTab === "roundtrip" && roundTripResults?.length) ? roundTripResults : flights;
              const safeCount = items.filter((f: any) => f.risk_level === "safe").length;
              return <ParsedConfig parsed={parsed} cacheAgeSeconds={cacheAgeSeconds} onRefresh={() => search()} safeCount={safeCount} totalCount={items.length} />;
            })()}

            {/* Expand search progress (shown at top of results) */}
            {expandPhase === "expanding" && (
              <div className="mt-3 w-full bg-[var(--color-surface)] border border-[var(--color-accent)]/30 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[var(--color-text)]">Expanding search{expansionInfo ? `: ${expansionInfo}` : "..."}</span>
                    {expandProgress && (
                      <div className="mt-1.5 h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((expandProgress.done / expandProgress.total) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Fix 5: Show warning if return date was before departure */}
            {searchWarning && (
              <div className="mt-2 text-xs text-[var(--color-caution)] bg-[var(--color-caution)]/10 border border-[var(--color-caution)]/20 rounded-lg px-3 py-2">
                {searchWarning}
              </div>
            )}

            {/* Round-trip total */}
            {roundTripTotal != null && (
              <div className="mt-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-lg px-4 py-3 text-sm">
                <span className="text-[var(--color-accent)] font-semibold">Round trip from {currencySymbol(parsed.currency)}{Math.round(roundTripTotal)}</span>
              </div>
            )}

            {flights.length === 0 && (!returnFlights || returnFlights.length === 0) && (!roundTripResults || roundTripResults.length === 0) ? (
              <div className="mt-6 text-center py-12 space-y-3">
                {noResultsReason === "timeout" ? (
                  <>
                    <p className="text-lg font-medium text-[var(--color-text)]">Search timed out</p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      Google Flights was slow to respond. This usually works on a second try.
                    </p>
                    <div className="flex flex-col items-center gap-2 mt-2">
                      <button onClick={() => search()} className="px-4 py-2 text-sm font-medium bg-[var(--color-accent)] text-black rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors">
                        Try again
                      </button>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Tip: try fewer dates, a single destination, or search at off-peak hours.
                      </p>
                    </div>
                  </>
                ) : noResultsReason === "provider_error" ? (
                  <>
                    <p className="text-lg font-medium text-[var(--color-text)]">Providers are having a moment</p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      Flight data sources returned an error. Give it a minute and try again.
                    </p>
                  </>
                ) : noResultsReason === "safety_filtered" ? (
                  <>
                    <p className="text-lg font-medium text-[var(--color-text)]">Every route crosses a conflict zone</p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      We couldn&apos;t find a safe path. Try a nearby departure airport, different dates, or add a layover city to route around the zone.
                    </p>
                  </>
                ) : noResultsReason === "no_routes" ? (
                  <>
                    <p className="text-lg font-medium text-[var(--color-text)]">No airlines fly this route</p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      This city pair doesn&apos;t have scheduled service. Try a nearby hub airport, flexible dates, or describe your trip in plain English and we&apos;ll suggest alternatives.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium text-[var(--color-text)]">Nothing matched</p>
                    <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
                      No flights for this route and date. Try nearby airports, shift the dates by a day or two, or relax your filters.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                {flights.every((f) => f.price === 0) && (
                  <div className="mt-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-muted)]">
                    These routes exist but live pricing isn&apos;t available right now. Click any flight to check current prices on the provider&apos;s site.
                  </div>
                )}


                {/* Round-trip degradation warning */}
                {parsed && parsed.return_dates.length > 0 && roundTripResults !== null && roundTripResults.length === 0 && flights.length > 0 && (
                  <div className="mt-4 bg-[var(--color-caution)]/10 border border-[var(--color-caution)]/30 rounded-lg px-4 py-3 text-sm text-[var(--color-caution)]">
                    No paired round-trip options found for these dates. Showing outbound flights only; search separately for return flights.
                  </div>
                )}

                {/* Partial results banner */}
                {isPartial && flights.length > 0 && (
                  <div className="mt-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-lg px-4 py-3 flex items-center justify-between">
                    <p className="text-sm text-[var(--color-text-muted)]">
                      We found {flights.length} flight{flights.length !== 1 ? "s" : ""} but couldn&apos;t check all dates. Some options may be missing.
                    </p>
                    <button onClick={() => search()} className="text-sm font-medium text-[var(--color-accent)] hover:underline whitespace-nowrap ml-4">
                      Try again
                    </button>
                  </div>
                )}

                {/* Trip type tabs: show when both RT and one-way results exist */}
                {roundTripResults && roundTripResults.length > 0 && flights.length > 0 && (
                  <div className="flex gap-2 mt-4 mb-2">
                    <button
                      onClick={() => setTripTab("roundtrip")}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        tripTab === "roundtrip"
                          ? "bg-[var(--color-accent)] text-black font-medium"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      Round trips ({roundTripResults.length})
                    </button>
                    <button
                      onClick={() => setTripTab("oneway")}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        tripTab === "oneway"
                          ? "bg-[var(--color-accent)] text-black font-medium"
                          : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      One-way ({flights.length})
                    </button>
                  </div>
                )}

                {/* One-way results: show when no RT exists, or when one-way tab active */}
                {((!roundTripResults?.length) || tripTab === "oneway") && flights.length > 0 && (
                  <>
                    {/* Airline filter */}
                    <AirlineFilterChips
                      airlines={airlineFilter.airlines}
                      selected={airlineFilter.selected}
                      toggle={airlineFilter.toggle}
                      clearFilter={airlineFilter.clearFilter}
                      totalCount={flights.length}
                      filteredCount={displayFlights.length}
                    />

                    {/* Compare all + share (above recommendations so users see before clicking) */}
                    {summary && summary.stats.total_flights > 0 && (
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          {!showCompare && (
                            <ScanSummaryCollapsed summary={summary} currency={parsed.currency} onExpand={() => setShowCompare(true)} flights={flights} />
                          )}
                          <button
                            onClick={handleCopyLink}
                            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors ml-auto"
                          >
                            {copyFeedback ? (
                              <>
                                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[var(--color-accent)]" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M13.5 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM15 3a3 3 0 0 1-5.133 2.107L5.4 7.4a3.014 3.014 0 0 1 0 1.2l4.467 2.293A3 3 0 1 1 8.8 12.4L4.333 10.107a3 3 0 1 1 0-4.214L8.8 3.6A3.015 3.015 0 0 1 9 3a3 3 0 0 1 6 0zM4.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM13.5 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>
                                Share results
                              </>
                            )}
                          </button>
                        </div>
                        {showCompare && (
                          <ScanSummaryExpanded summary={summary} currency={parsed.currency} airportNames={airportNames} flights={flights} onCollapse={() => setShowCompare(false)} cabin={parsed?.cabin} />
                        )}
                      </div>
                    )}

                    {/* Recommendation stack */}
                    <div className="mt-6 space-y-4">
                      <h2 className="text-sm font-semibold text-[var(--color-text)]">Our recommendations</h2>
                      {recs.slice(0, 4).map(({ label, flight }, i) => (
                        <FlightCard
                          key={i}
                          flight={flight}
                          label={label}
                          reason={getRecommendationReason(flight, flights, label)}
                          airportNames={airportNames}
                          attributionParams={attributionParams}
                          onOutboundClick={handleOutboundClick}
                          cabin={parsed?.cabin}
                        />
                      ))}
                    </div>

                    {/* More flights */}
                    {(() => {
                      const recKeys = new Set(recs.map((r) => `${r.flight.route}|${r.flight.date}|${r.flight.provider}`));
                      const moreFlights = sortFlights(pricedFlights.length > 0 ? pricedFlights : flights, "score").filter(
                        (f) => !recKeys.has(`${f.route}|${f.date}|${f.provider}`)
                      );
                      if (moreFlights.length === 0) return null;
                      return (
                        <div className="mt-8 space-y-3">
                          <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">More flights</h3>
                          {moreFlights.slice(0, 6).map((f, i) => (
                            <FlightCard
                              key={`more-${i}`}
                              flight={f}
                              airportNames={airportNames}
                              attributionParams={attributionParams}
                              onOutboundClick={handleOutboundClick}
                              cabin={parsed?.cabin}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* Round-trip paired results: show when no one-way exists, or RT tab active */}
                {roundTripResults && roundTripResults.length > 0 && ((!flights.length) || tripTab === "roundtrip") && (
                  <div className="mt-6">
                    <p className="text-xs text-[var(--color-text-muted)] mb-4">
                      Each option shows outbound + return. Prices are combined; you&apos;ll complete two separate bookings.
                    </p>
                    <div className="space-y-4">
                      {roundTripResults.slice(0, rtShowCount).map((rt, i) => (
                        <RoundTripCard
                          key={i}
                          result={rt}
                          airportNames={airportNames}
                          attributionParams={attributionParams}
                          onOutboundClick={handleOutboundClick}
                          cabin={parsed?.cabin}
                        />
                      ))}
                    </div>
                    {rtShowCount < roundTripResults.length && (
                      <button
                        onClick={() => setRtShowCount((c) => c + 5)}
                        className="w-full py-3 mt-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                      >
                        Show {Math.min(5, roundTripResults.length - rtShowCount)} more round trips
                      </button>
                    )}
                  </div>
                )}

                {/* Fallback: separate return flights (legacy, when round_trip_results absent) */}
                {!roundTripResults && returnFlights && returnFlights.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Return options</h3>
                    <div className="space-y-3">
                      {sortFlights(returnFlights, "score").slice(0, 5).map((f, i) => (
                        <FlightCard
                          key={i}
                          flight={f}
                          airportNames={airportNames}
                          attributionParams={attributionParams}
                          onOutboundClick={handleOutboundClick}
                          cabin={parsed?.cabin}
                        />
                      ))}
                    </div>
                  </div>
                )}


                {/* Expand search */}
                {parsed && phase === "done" && flights.length > 0 && (
                  <div className="mt-6">
                    {expandPhase === "idle" && (
                      <button
                        onClick={expandSearch}
                        className="w-full flex items-center justify-between gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 hover:border-[var(--color-accent)]/40 transition-colors group"
                      >
                        <div className="text-left">
                          <span className="text-sm font-medium text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">Expand search</span>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Find more options with nearby airports and flexible dates</p>
                        </div>
                        <svg viewBox="0 0 20 20" className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors shrink-0" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    {expandPhase === "done" && expandError && (
                      <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm">
                        <span className="text-[var(--color-caution)]">{expandError}</span>
                      </div>
                    )}
                    {expandPhase === "done" && !expandError && expandCount > 0 && (
                      <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm">
                        <span className="text-[var(--color-accent)]">+{expandCount} flight{expandCount !== 1 ? "s" : ""} added from nearby airports</span>
                      </div>
                    )}
                  </div>
                )}


                {/* Price alert */}
                {parsed && phase === "done" && flights.length > 0 && (
                  <PriceAlertSection parsed={parsed} cheapestPrice={summary?.stats?.min_price || flights[0]?.price || 0} />
                )}

                {/* Share CTA - show once per session after results */}
                {parsed && phase === "done" && flights.length > 0 && !shareCTADismissed && (() => {
                  const destCode = summary?.best_destinations?.[0]?.destination || flights[0]?.destination;
                  const destName = destCode ? (airportNames[destCode] || destCode) : null;
                  return (
                    <div className="mt-4 flex items-center justify-between gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5">
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {destName ? `Know someone flying to ${destName}?` : "Know someone who might want these flights?"}{" "}
                        <button onClick={() => { handleCopyLink(); setShareCTADismissed(true); }} className="text-[var(--color-accent)] hover:underline font-medium">
                          Share these results
                        </button>
                      </p>
                      <button onClick={() => setShareCTADismissed(true)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] shrink-0" aria-label="Dismiss">
                        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
                      </button>
                    </div>
                  );
                })()}

                {/* Bottom bar: share + trust */}
                <div className="mt-8 pt-5 border-t border-[var(--color-border)]/50 flex flex-wrap items-center justify-between gap-3">
                  <div ref={shareRef} className="relative">
                    <button
                      onClick={() => setShareOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M13.5 3a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM15 3a3 3 0 0 1-5.133 2.107L5.4 7.4a3.014 3.014 0 0 1 0 1.2l4.467 2.293A3 3 0 1 1 8.8 12.4L4.333 10.107a3 3 0 1 1 0-4.214L8.8 3.6A3.015 3.015 0 0 1 9 3a3 3 0 0 1 6 0zM4.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM13.5 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>
                      Share
                    </button>
                    {shareOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden z-50">
                        <button
                          onClick={handleCopyLink}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors text-left"
                        >
                          {copyFeedback ? (
                            <>
                              <svg viewBox="0 0 16 16" className="w-4 h-4 text-[var(--color-accent)] shrink-0" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
                              <span className="text-[var(--color-accent)] font-medium">Copied!</span>
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 16 16" className="w-4 h-4 opacity-50 shrink-0" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25z"/></svg>
                              Copy link
                            </>
                          )}
                        </button>
                        {typeof navigator !== "undefined" && "share" in navigator && (
                          <button
                            onClick={handleNativeShare}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors text-left border-t border-[var(--color-border)]/50"
                          >
                            <svg viewBox="0 0 16 16" className="w-4 h-4 opacity-50 shrink-0" fill="currentColor"><path d="M3.5 5.75a.25.25 0 0 1 .25-.25h8.5a.25.25 0 0 1 .25.25v7.5a.25.25 0 0 1-.25.25h-8.5a.25.25 0 0 1-.25-.25v-7.5zm.25-1.75A1.75 1.75 0 0 0 2 5.75v7.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0 0 14 13.25v-7.5A1.75 1.75 0 0 0 12.25 4h-8.5zM8 1a.75.75 0 0 1 .75.75v5.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06l1.72 1.72V1.75A.75.75 0 0 1 8 1z"/></svg>
                            Share via...
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    You book with the provider, not us.{" "}
                    <a href="/methodology" className="text-[var(--color-accent)] hover:underline">How we rank</a>
                  </span>
                  {/* zonesWarning is dev/CLI info, not user-facing */}
                </div>
              </>
            )}
          </>
        )}

        {/* New search */}
        {phase === "done" && flights.length > 0 && (
          <div className="text-center mt-6 mb-4">
            <button
              onClick={() => {
                trackEvent("new_search_clicked", { previous_results: flights.length });
                setPhase("idle");
                setPrompt("");
                setFlights([]);
                setReturnFlights(null);
                setRoundTripResults(null);
                setParsed(null);
                setSummary(null);
                setForm({ from: "", to: "", depart: "", returnDate: "", roundTrip: false, flexibleDates: false, maxPrice: "", directOnly: false, cabin: "economy", safeOnly: true });
                setAttributionParams((prev) => ({ ...prev, ref: "organic", utm_source: undefined }));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              New search
            </button>
          </div>
        )}

        {/* Empty state spacer (trust microcopy is in hero section) */}
      </section>

      {/* Floating price alert popup */}
      {showAlertPopup && parsed && (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl p-4 animate-fade-in">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Price drop alert</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Get emailed when fares drop</p>
            </div>
            <button
              onClick={() => { setShowAlertPopup(false); setAlertPopupDismissed(true); }}
              className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
            </button>
          </div>
          {popupStatus === "success" ? (
            <p className="text-sm text-[var(--color-accent)]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block mr-1 -mt-0.5"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              Alert set! We&apos;ll email you.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                value={popupEmail}
                onChange={(e) => setPopupEmail(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
              />
              <div className="flex gap-2">
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-sm text-[var(--color-text-muted)]">{currencySymbol(parsed.currency)}</span>
                  <input
                    type="number"
                    placeholder={flights[0] ? String(Math.round(flights[0].price)) : "Max"}
                    value={popupThreshold}
                    onChange={(e) => setPopupThreshold(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <button
                  disabled={!popupEmail.trim() || popupStatus === "loading"}
                  onClick={async () => {
                    if (!popupEmail.trim()) return;
                    setPopupStatus("loading");
                    try {
                      await fetch(`${API_URL}/api/alerts`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          email: popupEmail.trim(),
                          query: `${parsed.origins.join(",")} to ${parsed.destinations.join(",")}`,
                          origins: parsed.origins,
                          destinations: parsed.destinations,
                          max_price: parseFloat(popupThreshold) || 0,
                          currency: parsed.currency,
                          cabin: parsed.cabin,
                          is_round_trip: parsed.return_dates?.length > 0,
                          current_price: flights[0]?.price || null,
                        }),
                      });
                      setPopupStatus("success");
                      trackEvent("alert_created", { source: "popup" });
                      setTimeout(() => { setShowAlertPopup(false); setAlertPopupDismissed(true); }, 3000);
                    } catch {
                      setPopupStatus("idle");
                    }
                  }}
                  className="px-3 py-1.5 text-sm font-medium bg-[var(--color-accent)] text-black rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {popupStatus === "loading" ? "..." : "Set alert"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
    </AirportCountriesCtx.Provider>
  );
}

export default function SearchPage() {
  return (
    <ErrorBoundary>
      <HomePage />
    </ErrorBoundary>
  );
}
