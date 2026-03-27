import { airlineName } from "../components/AirlineFilter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface FlightLeg {
  airline: string;
  flight_number: string;
  from: string;
  to: string;
  departs: string;
  arrives: string;
  duration_minutes: number;
}

export interface FlightOut {
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

export interface RoundTripOut {
  outbound: FlightOut;
  inbound: FlightOut;
  total_price: number;
  currency: string;
  risk_level: string;
  risk_details: { airport: string; country: string; zone: string; risk: string }[];
  score: number;
}

export interface ScanSummaryData {
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

export type AttributionParams = { utm_source?: string; utm_medium?: string; utm_campaign?: string; ref?: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
export function formatTime(iso: string, loc?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(loc || "en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso.slice(11, 16);
  }
}
export function formatDate(iso: string, loc?: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(loc || "en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
export function currencySymbol(c: string): string {
  try {
    const parts = new Intl.NumberFormat("en", { style: "currency", currency: c }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? c;
  } catch { return c; }
}
export function flightDisplayDate(flight: FlightOut): string {
  const departs = flight.legs?.[0]?.departs;
  if (departs) return departs.slice(0, 10);
  return flight.date;
}

export function safeUrl(url: string): string | null {
  if (!url) return null;
  try {
    const p = new URL(url);
    if (p.protocol === "https:" || p.protocol === "http:") return url;
  } catch {}
  return null;
}

// Flight comparison deep link URL builder
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
  return [..._pbString(1, origin), ..._pbString(2, date), ..._pbString(3, dest), ..._pbString(5, airline), ..._pbString(6, flightNum)];
}
function _pbSlice(date: string, origin: string, dest: string, legs: { from: string; to: string; date: string; airline: string; flight_number: string }[]): number[] {
  const inner = [
    ..._pbString(2, date),
    ...legs.flatMap((l) => _pbBytes(4, _pbLeg(l.from, l.to, l.date, l.airline, l.flight_number))),
    ..._pbBytes(13, _pbString(2, origin)),
    ..._pbBytes(14, _pbString(2, dest)),
  ];
  return _pbBytes(3, inner);
}
function _pbRouteOnly(origin: string, dest: string, date: string): number[] {
  const inner = [..._pbString(2, date), ..._pbBytes(13, _pbString(2, origin)), ..._pbBytes(14, _pbString(2, dest))];
  return _pbBytes(3, inner);
}
export function flightCompareUrl(origin: string, dest: string, date: string, currency: string, cabin?: string, legs?: FlightLeg[], locale?: string): string {
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
  const hl = locale || (typeof window !== "undefined" ? document.documentElement.lang || "en" : "en");
  return `https://www.google.com/travel/flights/search?tfs=${encodeURIComponent(b64)}&hl=${hl}&curr=${cur}`;
}
export function appendAttribution(url: string, params: AttributionParams): string {
  const s = safeUrl(url);
  if (!s) return "";
  const u = new URL(s);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

export function formatAirlines(codes: string): string {
  if (!codes) return "";
  return codes.split(", ").map((c) => airlineName(c.trim())).join(", ");
}
