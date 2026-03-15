"use client";

import React, { Component, useEffect, useRef, useState } from "react";
import { trackEvent } from "../lib/analytics";
import { AirportAutocomplete } from "../components/AirportAutocomplete";
import { useSavedSearches, SavedSearchesList } from "../components/SavedSearches";
import { useAirlineFilter, AirlineFilterChips, AIRLINE_NAMES, airlineName } from "../components/AirlineFilter";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ZONES_UPDATED_AT = process.env.NEXT_PUBLIC_ZONES_UPDATED_AT || "March 2026";

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

function consumerRouteLabel(route: string, names: Record<string, string>): string {
  return route.split(" -> ").map((code) => {
    const city = names[code.trim()];
    return city ? `${city} (${code.trim()})` : code.trim();
  }).join(" \u2192 ");
}

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
  const x = c[level] || c.safe;
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
  const routeLabel = consumerRouteLabel(flight.route, airportNames);

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
          <div className="text-sm font-medium text-[var(--color-text)]">{routeLabel}</div>
          {airlines && <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{formatAirlines(airlines)}</div>}
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-[var(--color-text-muted)]">
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
                    Google Flights ↗
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
              <span className="font-mono text-xs text-[var(--color-accent)] w-14">
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
          {flight.risk_details.length > 0 && (
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
          {consumerRouteLabel(flight.route, airportNames)}
        </div>
        {airlines && <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{formatAirlines(airlines)}</div>}
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--color-text-muted)]">
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
            Book ↗
          </a>
        ) : (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOutboundClick("google", flight)}
            className="px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-xs font-medium rounded-lg transition-colors"
          >
            Google Flights ↗
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
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center gap-3 mb-4">
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: "0.3s" }} />
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" style={{ animationDelay: "0.6s" }} />
      </div>
      {progress && parsed ? (
        <>
          <p className="text-[var(--color-text)]">Scanning route {progress.done}/{progress.total}</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 font-mono">{progress.route} on {formatDate(progress.date)}</p>
          <div className="mt-4 mx-auto max-w-xs h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Comparing prices and filtering routes...</p>
          {filteredCount > 0 && (
            <p className="text-[11px] text-[var(--color-caution)] mt-1">{filteredCount} route{filteredCount !== 1 ? "s" : ""} filtered for safety</p>
          )}
        </>
      ) : parsed ? (
        <>
          <p className="text-[var(--color-text)]">Scanning {parsed.total_routes} routes...</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">Comparing prices across airlines...</p>
        </>
      ) : (
        <p className="text-[var(--color-text-muted)]">Understanding your trip...</p>
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
        <div className="font-medium text-[var(--color-text)] truncate">{consumerRouteLabel(flight.route, airportNames)}</div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mt-0.5">
          {airline && <span>{formatAirlines(airline)}</span>}
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
          Google ↗
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
}: {
  summary: ScanSummaryData;
  currency: string;
  onExpand: () => void;
}) {
  const { stats } = summary;
  const sym = currencySymbol(currency);
  return (
    <div className="mt-4">
      <button
        onClick={onExpand}
        className="text-sm text-[var(--color-accent)] hover:underline"
      >
        Compare all options ({stats.total_flights} flight{stats.total_flights !== 1 ? "s" : ""}, {stats.destinations} destination{stats.destinations !== 1 ? "s" : ""})
      </button>
      {stats.min_price > 0 && (
        <span className="ml-2 text-xs text-[var(--color-text-muted)]">
          {sym}{Math.round(stats.min_price)} – {sym}{Math.round(stats.max_price)}
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
  const showMatrix = isMultiDest && price_matrix.dates.length > 1 && Object.values(price_matrix.prices).some((v) => v != null);

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
      {isMultiDest && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] uppercase">Best per destination</div>
          <div className="divide-y divide-[var(--color-border)]">
            {best_destinations.map((f, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-4 text-sm">
                <span className="font-mono font-medium w-10">{f.destination}</span>
                <span className="text-[var(--color-text-muted)] truncate hidden sm:inline w-32">{airportNames[f.destination] || ""}</span>
                <span className="text-[var(--color-accent)] font-semibold w-16 text-right">{f.price > 0 ? `${sym}${Math.round(f.price)}` : "-"}</span>
                <span className="text-[var(--color-text-muted)] text-xs">{formatDate(f.date)}</span>
                <span className="text-[var(--color-text-muted)] text-xs">{formatDuration(f.duration_minutes)}</span>
                <div className="ml-auto text-xs">
                  <a href={safeUrl(googleFlightsUrl(f.origin, f.destination, f.date, f.currency, cabin, f.legs)) || "#"} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">Google Flights ↗</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showMatrix && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-x-auto">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] uppercase">Price by date</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)] sticky left-0 z-10 bg-[var(--color-surface)]">Dest</th>
                {price_matrix.dates.map((d) => (
                  <th key={d} className="px-2 py-2 text-right font-mono text-[var(--color-text-muted)]">{d.slice(5)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {price_matrix.destinations.map((dest) => (
                <tr key={dest}>
                  <td className="px-3 py-2 font-mono font-medium sticky left-0 z-10 bg-[var(--color-surface)] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]">{dest} <span className="font-sans text-[var(--color-text-muted)] hidden sm:inline">{airportNames[dest] || ""}</span></td>
                  {price_matrix.dates.map((dt) => {
                    const price = price_matrix.prices[`${dest}|${dt}`];
                    const isCheapest = price != null && price === price_matrix.cheapest_per_dest[dest];
                    return (
                      <td key={dt} className={`px-2 py-2 text-right font-mono ${price == null ? "text-[var(--color-text-muted)]" : isCheapest ? "text-[var(--color-accent)] font-semibold" : "text-[var(--color-text)]"}`}>
                        {price != null ? `${sym}${Math.round(price)}` : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fix 2: Parsed Config chips
// ---------------------------------------------------------------------------
function ParsedConfig({ parsed, cacheAgeSeconds, onRefresh }: { parsed: ParsedSearch; cacheAgeSeconds: number | null; onRefresh: () => void }) {
  const { origins, destinations, dates, return_dates, max_price, currency, cabin, stops, airport_names } = parsed;
  const sym = currencySymbol(currency);
  const isRoundTrip = return_dates && return_dates.length > 0;
  const [datesExpanded, setDatesExpanded] = useState(false);

  const originLabel = origins.map((o) => airport_names?.[o] ? `${airport_names[o]} (${o})` : o).join(", ");
  const destLabel = destinations.map((d) => airport_names?.[d] ? `${airport_names[d]} (${d})` : d).join(", ");

  const collapsedDates = dates.length <= 2 ? dates.map(formatDate).join(", ") : `${formatDate(dates[0])} + ${dates.length - 1} more dates`;
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
            {datesExpanded ? dates.map(formatDate).join(", ") : collapsedDates}
          </button>
        ) : (
          <span>{collapsedDates}</span>
        )}
        {isRoundTrip && (
          <span className="px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium">
            Round trip → {return_dates.length <= 2 ? return_dates.map(formatDate).join(", ") : `${formatDate(return_dates[0])} + ${return_dates.length - 1} more`}
          </span>
        )}
        {cabin && <span className="capitalize">{cabin.replace(/_/g, " ")}</span>}
        {stops && stops !== "any" && (
          <span>{stops === "non_stop" ? "Direct only" : stops === "one_stop_or_fewer" ? "1 stop max" : "2 stops max"}</span>
        )}
        {max_price > 0 && <span>Max {sym}{Math.round(max_price)}</span>}
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
  "JFK to London, next week, under $500",
  "Barcelona to Paris, round trip April 10",
  "New York to Tokyo, business class, under $3000",
  "Berlin to anywhere in Europe, cheapest week in July",
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
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number>(0);
  const [gitHubStars, setGitHubStars] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const savedSearches = useSavedSearches();

  const hasResults = phase === "done" || phase === "searching" || phase === "parsing";
  const airportNames = parsed?.airport_names || {};

  useEffect(() => {
    if (searchMode === "natural") inputRef.current?.focus();
  }, [searchMode]);

  useEffect(() => {
    fetch("https://api.github.com/repos/buildingopen/opensky", { headers: { Accept: "application/vnd.github.v3+json" } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.stargazers_count != null) setGitHubStars(d.stargazers_count); })
      .catch(() => {});
  }, []);

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

    // Update browser URL so refresh/back restores the search (C6)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("q", text.trim());
      url.searchParams.delete("ref");
      url.searchParams.delete("utm_source");
      window.history.pushState({}, "", url.toString());
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

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
            } else if (msg.type === "results") {
              setFlights(msg.flights || []);
              setReturnFlights(msg.return_flights || null);
              setRoundTripResults(msg.round_trip_results || null);
              setZonesWarning(msg.zones_warning || null);
              setSummary(msg.summary || null);
              setNoResultsReason(msg.no_results_reason || null);
              setSearchWarning(msg.warning || null);
              setCacheAgeSeconds(msg.cache_age_seconds ?? null);
              if (msg.safety_filtered_count > 0) setSafetyFilteredCount(msg.safety_filtered_count);
              setPhase("done");
              savedSearches.save(text);
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
        setError("Search timed out. Try a narrower search.");
        trackEvent("search_error", { stage: "client", type: "abort" });
      } else {
        setError("Could not reach the search API. Please try again.");
        trackEvent("search_error", { stage: "client", type: "network" });
      }
      setPhase("idle");
    } finally {
      clearTimeout(timeout);
      setPhase((p) => (p === "parsing" || p === "searching" ? "idle" : p));
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
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-[var(--color-accent)] focus:text-black focus:rounded focus:text-sm focus:font-medium">
        Skip to main content
      </a>

      {/* Header - trust nav */}
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--color-accent)]" fill="currentColor">
              <path d="M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 2.59 4.49L21 11.49c.81-.23 1.28-1.05 1.07-1.85z" />
            </svg>
            <span className="text-lg font-semibold">
              <span className="text-[var(--color-accent)]">fly</span>fast
            </span>
          </div>
          <nav className="flex items-center gap-3 sm:gap-4 text-sm">
            <a href="/methodology" className="hidden sm:inline text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              How it works
            </a>
            <a href="/contact" className="hidden sm:inline text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              Contact
            </a>
            <a href="https://github.com/buildingopen/opensky" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors inline-flex items-center gap-1.5">
              GitHub
              {gitHubStars !== null && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-1.5 py-0.5 rounded-full tabular-nums text-[var(--color-text-muted)]">
                  <svg viewBox="0 0 16 16" className="w-3 h-3 fill-[var(--color-caution)]"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z"/></svg>
                  {gitHubStars}
                </span>
              )}
            </a>
          </nav>
        </div>
      </header>

      {/* Referred-visit message */}
      {attributionParams.ref === "share" && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <p className="text-sm text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2">
            Someone shared a flight with you. Search below to compare options.
          </p>
        </div>
      )}

      {/* Hero - outcome-focused */}
      <section className={`max-w-3xl mx-auto px-4 w-full text-center transition-all duration-300 ${hasResults ? "pt-6 pb-4" : "pt-16 sm:pt-24 pb-6"}`}>
        <h1 className={`font-bold tracking-tight transition-all duration-300 ${hasResults ? "text-2xl" : "text-4xl sm:text-5xl"}`}>
          Describe your{" "}
          <span className="text-[var(--color-accent)]">trip.</span>
        </h1>
        {!hasResults && (
          <p className="mt-4 text-[var(--color-text-muted)] text-base sm:text-lg max-w-xl mx-auto">
            Compare 500+ airlines, find the best route. Conflict zones filtered automatically. Free, no login, AI-powered.
          </p>
        )}

        {/* Trust microcopy */}
        {!hasResults && (
          <div className="mt-6 grid grid-cols-2 sm:flex sm:justify-center gap-x-6 gap-y-1.5 text-xs text-[var(--color-text-muted)] text-center">
            <span>Free, no login</span>
            <span>500+ airlines</span>
            <span>Conflict zones filtered</span>
            <span>AI-powered search</span>
          </div>
        )}

        {/* Search surface */}
        <div className={`${hasResults ? "mt-4" : "mt-8"} bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 sm:p-6 search-surface transition-all duration-200`}>
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
                className="w-full bg-transparent border-none px-0 py-1 text-[15px] leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 focus:outline-none resize-none"
                aria-label="Describe your trip in plain English"
              />
            </div>
          )}

          <div className={`${searchMode === "structured" ? "mt-3" : "mt-3 pt-3 border-t border-[var(--color-border)]/50"} flex items-center justify-between`}>
            <button
              type="button"
              onClick={() => setSearchMode((m) => (m === "structured" ? "natural" : "structured"))}
              className="text-xs text-[var(--color-text-muted)]/60 hover:text-[var(--color-text-muted)] transition-colors"
            >
              {searchMode === "structured" ? "Describe your trip instead" : "Use search form instead"}
            </button>
            <div className="flex items-center gap-3">
              {searchMode === "natural" && !isLoading && <span className="text-[11px] text-[var(--color-text-muted)]/30 hidden sm:inline">Enter to search</span>}
              <button
                onClick={() => search()}
                disabled={isLoading || !canSearch()}
                aria-label={isLoading ? "Searching" : "Search flights"}
                aria-busy={isLoading}
                className="px-5 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg transition-all duration-150 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]"
              >
                {isLoading ? "Searching..." : "Search"}
              </button>
            </div>
          </div>
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
                className={`text-[13px] px-3.5 py-1.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] transition-all duration-150 whitespace-nowrap ${i >= 2 ? "hidden sm:inline-flex" : ""}`}
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
            onSelect={(q) => { setSearchMode("natural"); setPrompt(q); search(q); }}
            onClear={savedSearches.clear}
          />
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
                      className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-accent)]/40 text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
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
            <SearchingState parsed={parsed} progress={progress} filteredCount={safetyFilteredCount} />
            <div className="mt-6 space-y-4 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5">
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
          </>
        )}

        {phase === "done" && parsed && (
          <>
            {/* Fix 2: Parsed config chips */}
            <ParsedConfig parsed={parsed} cacheAgeSeconds={cacheAgeSeconds} onRefresh={() => search()} />

            {/* Safety value prop badge */}
            {flights.length > 0 && (() => {
              const safeCount = flights.filter((f) => f.risk_level === "safe").length;
              const total = flights.length;
              const allSafe = safeCount === total;
              return (
                <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  allSafe
                    ? "bg-[var(--color-safe)]/10 border-[var(--color-safe)]/20 text-[var(--color-safe)]"
                    : "bg-[var(--color-caution)]/10 border-[var(--color-caution)]/20 text-[var(--color-caution)]"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${allSafe ? "bg-[var(--color-safe)]" : "bg-[var(--color-caution)]"}`} />
                  {allSafe ? `All ${total} routes verified safe` : `${safeCount} of ${total} routes are safe`}
                </div>
              );
            })()}

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
                {noResultsReason === "provider_error" ? (
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

                {/* Airline filter */}
                <AirlineFilterChips
                  airlines={airlineFilter.airlines}
                  selected={airlineFilter.selected}
                  toggle={airlineFilter.toggle}
                  clearFilter={airlineFilter.clearFilter}
                  totalCount={flights.length}
                  filteredCount={displayFlights.length}
                />

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

                {/* Round-trip paired results */}
                {roundTripResults && roundTripResults.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider mb-3">Round-trip options</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mb-4">
                      Each option shows outbound + return. Prices are combined; you&apos;ll complete two separate bookings.
                    </p>
                    <div className="space-y-4">
                      {roundTripResults.slice(0, 10).map((rt, i) => (
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

                {/* Progressive disclosure: compare all */}
                {summary && summary.stats.total_flights > 0 && (
                  <div className="mt-8">
                    {showCompare ? (
                      <ScanSummaryExpanded summary={summary} currency={parsed.currency} airportNames={airportNames} flights={flights} onCollapse={() => setShowCompare(false)} cabin={parsed?.cabin} />
                    ) : (
                      <ScanSummaryCollapsed summary={summary} currency={parsed.currency} onExpand={() => setShowCompare(true)} />
                    )}
                  </div>
                )}

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
                  {zonesWarning && <span className="text-xs text-[var(--color-caution)]">{zonesWarning}</span>}
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
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              New search
            </button>
          </div>
        )}

        {/* Empty state - user benefits */}
        {phase === "idle" && flights.length === 0 && !error && (
          <div className="text-center py-8">
            <div className="flex flex-wrap justify-center gap-6 text-xs text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                500+ airlines
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                Conflict zones filtered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                AI-powered search
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                Free, no account needed
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] mt-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[var(--color-text-muted)]">
          <span>
            Built by <a href="https://buildingopen.org" className="text-[var(--color-text)] hover:text-[var(--color-accent)]">Building Open</a>
          </span>
          <div className="flex flex-col sm:items-end gap-2">
            <span>Conflict zones updated {ZONES_UPDATED_AT}. Decision support, not official travel advice.</span>
            <span className="flex flex-wrap justify-center gap-3">
              <a href="/privacy" className="hover:text-[var(--color-text)]">Privacy</a>
              <a href="/terms" className="hover:text-[var(--color-text)]">Terms</a>
              <a href="/methodology" className="hover:text-[var(--color-text)]">Methodology</a>
              <a href="/contact" className="hover:text-[var(--color-text)]">Contact</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function SearchPage() {
  return (
    <ErrorBoundary>
      <HomePage />
    </ErrorBoundary>
  );
}
