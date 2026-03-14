"use client";

import React, { Component, useEffect, useRef, useState } from "react";
import { trackEvent } from "../lib/analytics";

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
function googleFlightsUrl(origin: string, dest: string, date: string, currency: string): string {
  const u = new URL("https://www.google.com/travel/flights");
  u.searchParams.set("q", `Flights from ${origin} to ${dest} on ${date}`);
  u.searchParams.set("curr", (currency || "EUR").toUpperCase().slice(0, 3));
  u.searchParams.set("hl", "en");
  return u.toString();
}
function appendAttribution(url: string, params: AttributionParams): string {
  const s = safeUrl(url);
  if (!s) return "";
  const u = new URL(s);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

const AIRLINE_NAMES: Record<string, string> = {
  "5F": "Fly One", "6E": "IndiGo", "9W": "Jet Airways", A3: "Aegean", AA: "American", AC: "Air Canada",
  AF: "Air France", AI: "Air India", AK: "AirAsia", AS: "Alaska", AY: "Finnair", AZ: "ITA Airways",
  B6: "JetBlue", BA: "British Airways", BR: "EVA Air", CX: "Cathay Pacific", DL: "Delta", DY: "Norwegian",
  EK: "Emirates", ET: "Ethiopian", EW: "Eurowings", EY: "Etihad", FI: "Icelandair", FR: "Ryanair",
  IB: "Iberia", JL: "JAL", KE: "Korean Air", KL: "KLM", LH: "Lufthansa", LO: "LOT", LX: "SWISS",
  NH: "ANA", NZ: "Air New Zealand", OS: "Austrian", QF: "Qantas", QR: "Qatar Airways", SQ: "Singapore Airlines",
  TK: "Turkish Airlines", TP: "TAP Portugal", U2: "easyJet", UA: "United", VS: "Virgin Atlantic",
  VY: "Vueling", W6: "Wizz Air", WN: "Southwest",
};
function airlineName(code: string): string {
  return AIRLINE_NAMES[code] || code;
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
  const cheapest = sortFlights(all, "price")[0];
  const fastest = sortFlights(all, "duration")[0];
  if (label === "Recommended") {
    if (flight.stops === 0 && flight.risk_level === "safe")
      return "Direct, safe route with a good balance of price and time.";
    if (flight.risk_level === "safe")
      return "Best balance of price, time, and safety for this route.";
    return "Safest option among available routes.";
  }
  if (label === "Cheapest")
    return cheapest?.price ? `Lowest price at ${currencySymbol(flight.currency)}${Math.round(flight.price)}.` : "Lowest price.";
  if (label === "Fastest") {
    const diff = fastest ? flight.duration_minutes - fastest.duration_minutes : 0;
    return diff === 0 ? "Shortest travel time." : `${formatDuration(Math.abs(diff))} longer than fastest.`;
  }
  return "Fewest stops and lowest stress.";
}

// ---------------------------------------------------------------------------
// Risk Badge
// ---------------------------------------------------------------------------
function RiskBadge({ level }: { level: string }) {
  const c: Record<string, { bg: string; text: string; label: string }> = {
    safe: { bg: "bg-[var(--color-safe)]/15", text: "text-[var(--color-safe)]", label: "Safe" },
    caution: { bg: "bg-[var(--color-caution)]/15", text: "text-[var(--color-caution)]", label: "Caution" },
    high_risk: { bg: "bg-[var(--color-high-risk)]/15", text: "text-[var(--color-high-risk)]", label: "High Risk" },
    do_not_fly: { bg: "bg-[var(--color-danger)]/15", text: "text-[var(--color-danger)]", label: "Do Not Fly" },
  };
  const x = c[level] || c.safe;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${x.bg} ${x.text}`}>
      {x.label}
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
}: {
  flight: FlightOut;
  label?: RecLabel;
  reason?: string;
  airportNames: Record<string, string>;
  attributionParams: AttributionParams;
  onOutboundClick: (provider: "booking" | "google", f: FlightOut) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];
  const airlines = flight.legs.length > 0
    ? [...new Set(flight.legs.map((l) => l.airline).filter((a) => a && a !== "ZZ"))].join(", ")
    : "";
  const bookingUrl = appendAttribution(flight.booking_url, attributionParams);
  const googleUrl = appendAttribution(
    googleFlightsUrl(flight.origin, flight.destination, flight.date, flight.currency),
    attributionParams
  );
  const routeLabel = consumerRouteLabel(flight.route, airportNames);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5 hover:border-[var(--color-accent)]/30 transition-colors">
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
                {formatTime(firstLeg.departs)} \u2013 {formatTime(lastLeg.arrives)}
              </span>
            )}
            <span>{flight.stops === 0 ? "Direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}</span>
            <span>{formatDuration(flight.duration_minutes)}</span>
            {flight.risk_level !== "safe" && <RiskBadge level={flight.risk_level} />}
          </div>
        </div>
        <div className="flex flex-col sm:items-end gap-2">
          {flight.price > 0 && (
            <div className="text-right">
              <div className="text-lg font-semibold text-[var(--color-text)]">
                {currencySymbol(flight.currency)}{Math.round(flight.price)}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] capitalize">{flight.provider}</div>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              {bookingUrl ? (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onOutboundClick("booking", flight)}
                  aria-label={flight.booking_exact ? "Book direct" : "Search on Skyscanner"}
                  title={flight.booking_exact
                    ? "Direct booking link — takes you straight to checkout"
                    : "Opens a Skyscanner search — you\u2019ll need to find this exact flight again"}
                  className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-sm font-medium rounded-lg transition-colors"
                >
                  {flight.booking_exact ? "Book direct" : "Skyscanner"}
                </a>
              ) : (
                <span className="px-4 py-2 bg-[var(--color-accent)]/40 text-black/70 text-sm rounded-lg cursor-not-allowed">
                  Unavailable
                </span>
              )}
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onOutboundClick("google", flight)}
                aria-label="Search on Google Flights"
                title="Search this route on Google Flights"
                className="px-4 py-2 border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text)] text-sm font-medium rounded-lg transition-colors"
              >
                Google
              </a>
            </div>
            {bookingUrl && !flight.booking_exact && (
              <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">
                Opens a search — you&apos;ll need to find this flight again on Skyscanner
              </p>
            )}
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
              <span className="text-[var(--color-text-muted)]">\u2192</span>
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
                  {rd.airport} ({rd.country}) \u2013 {rd.zone}
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
}: {
  flight: FlightOut;
  label: string;
  airportNames: Record<string, string>;
  attributionParams: AttributionParams;
  onOutboundClick: (provider: "booking" | "google", f: FlightOut) => void;
}) {
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];
  const airlines = flight.legs.length > 0
    ? [...new Set(flight.legs.map((l) => l.airline).filter((a) => a && a !== "ZZ"))].join(", ")
    : "";
  const bookingUrl = appendAttribution(flight.booking_url, attributionParams);
  const googleUrl = appendAttribution(
    googleFlightsUrl(flight.origin, flight.destination, flight.date, flight.currency),
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
        </div>
      </div>
      <div className="flex items-center gap-2">
        {bookingUrl ? (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOutboundClick("booking", flight)}
            title={flight.booking_exact
              ? "Direct booking link — takes you straight to checkout"
              : "Opens a Skyscanner search — you&apos;ll need to find this exact flight again"}
            className="px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-xs font-medium rounded-lg transition-colors"
          >
            {flight.booking_exact ? "Book" : "Skyscanner"}
          </a>
        ) : null}
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOutboundClick("google", flight)}
          title="Search on Google Flights"
          className="px-3 py-1.5 border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text)] text-xs font-medium rounded-lg transition-colors"
        >
          Google
        </a>
      </div>
    </div>
  );
}

function RoundTripCard({
  result,
  airportNames,
  attributionParams,
  onOutboundClick,
}: {
  result: RoundTripOut;
  airportNames: Record<string, string>;
  attributionParams: AttributionParams;
  onOutboundClick: (provider: "booking" | "google", f: FlightOut) => void;
}) {
  const { outbound, inbound, total_price, currency, risk_level } = result;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5 hover:border-[var(--color-accent)]/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 divide-y divide-[var(--color-border)]">
          <RoundTripFlightRow flight={outbound} label="Outbound" airportNames={airportNames} attributionParams={attributionParams} onOutboundClick={onOutboundClick} />
          <RoundTripFlightRow flight={inbound} label="Return" airportNames={airportNames} attributionParams={attributionParams} onOutboundClick={onOutboundClick} />
        </div>
        <div className="flex flex-col items-end gap-1 pt-2 shrink-0">
          {total_price > 0 && (
            <div className="text-right">
              <div className="text-lg font-semibold text-[var(--color-text)]">
                {currencySymbol(currency)}{Math.round(total_price)}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">total</div>
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

function SearchingState({ parsed, progress }: { parsed: ParsedSearch | null; progress: ProgressInfo | null }) {
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
        </>
      ) : parsed ? (
        <>
          <p className="text-[var(--color-text)]">Scanning {parsed.total_routes} routes...</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">Filtering out conflict zones.</p>
        </>
      ) : (
        <p className="text-[var(--color-text-muted)]">Understanding your trip...</p>
      )}
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
        Compare all options ({stats.total_flights} flights, {stats.destinations} destinations)
      </button>
      {stats.min_price > 0 && (
        <span className="ml-2 text-xs text-[var(--color-text-muted)]">
          {sym}{Math.round(stats.min_price)} \u2013 {sym}{Math.round(stats.max_price)}
        </span>
      )}
    </div>
  );
}

function ScanSummaryExpanded({
  summary,
  currency,
  airportNames,
  onCollapse,
}: {
  summary: ScanSummaryData;
  currency: string;
  airportNames: Record<string, string>;
  onCollapse: () => void;
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
          <span>{sym}{Math.round(stats.min_price)} \u2013 {sym}{Math.round(stats.max_price)}</span>
        )}
      </div>
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
                <div className="ml-auto flex gap-2 text-xs">
                  <a href={safeUrl(f.booking_url) || "#"} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">Book</a>
                  <a href={safeUrl(googleFlightsUrl(f.origin, f.destination, f.date, f.currency)) || "#"} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">Compare</a>
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
                <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">Dest</th>
                {price_matrix.dates.map((d) => (
                  <th key={d} className="px-2 py-2 text-right font-mono text-[var(--color-text-muted)]">{d.slice(5)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {price_matrix.destinations.map((dest) => (
                <tr key={dest}>
                  <td className="px-3 py-2 font-mono font-medium">{dest} <span className="font-sans text-[var(--color-text-muted)] hidden sm:inline">{airportNames[dest] || ""}</span></td>
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
function ParsedConfig({ parsed }: { parsed: ParsedSearch }) {
  const { origins, destinations, dates, return_dates, max_price, currency, cabin, stops, airport_names } = parsed;
  const sym = currencySymbol(currency);
  const isRoundTrip = return_dates && return_dates.length > 0;

  const formatDatesChip = (ds: string[]) => {
    if (ds.length === 0) return null;
    if (ds.length <= 3) return ds.map(formatDate).join(", ");
    return `${formatDate(ds[0])} +${ds.length - 1} more`;
  };

  const chipClass = "px-2 py-0.5 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] font-mono text-xs";
  const labelClass = "px-2 py-0.5 rounded text-xs";

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {origins.map((o) => (
          <span key={o} className={chipClass} title={airport_names?.[o] || o}>{o}</span>
        ))}
        <span className="text-[var(--color-text-muted)] text-xs mx-0.5">\u2192</span>
        {destinations.map((d) => (
          <span key={d} className={chipClass} title={airport_names?.[d] || d}>{d}</span>
        ))}
        <span className="text-[var(--color-border)] mx-1">|</span>
        <span className="text-[var(--color-text-muted)] text-xs">{formatDatesChip(dates)}</span>
        {isRoundTrip && (
          <>
            <span className={`${labelClass} bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium`}>
              Round trip
            </span>
            <span className="text-[var(--color-text-muted)] text-xs">\u2192 {formatDatesChip(return_dates)}</span>
          </>
        )}
        {cabin && (
          <span className={`${labelClass} bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] capitalize`}>
            {cabin.replace(/_/g, " ")}
          </span>
        )}
        {stops && stops !== "any" && (
          <span className={`${labelClass} bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)]`}>
            {stops === "non_stop" ? "Direct only" : stops === "one_stop_or_fewer" ? "\u22641 stop" : "\u22642 stops"}
          </span>
        )}
        {max_price > 0 && (
          <span className={`${labelClass} bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)]`}>
            Max {sym}{Math.round(max_price)}
          </span>
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
  maxPrice: string;
  directOnly: boolean;
}

function buildPromptFromForm(f: SearchFormState): string {
  const parts: string[] = [];
  parts.push(`${f.from.trim()} to ${f.to.trim()}`);
  if (f.roundTrip && f.returnDate) {
    parts.push(`round trip ${f.depart} returning ${f.returnDate}`);
  } else {
    parts.push(f.depart);
  }
  if (f.maxPrice && parseInt(f.maxPrice, 10) > 0) parts.push(`under $${f.maxPrice}`);
  if (f.directOnly) parts.push("direct only");
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------
const EXAMPLES = [
  "JFK to London, next week, under $500",
  "Barcelona to Paris, round trip April 10 returning April 17",
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
    maxPrice: "",
    directOnly: false,
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
  const [showCopyLink, setShowCopyLink] = useState(false);
  const [noResultsReason, setNoResultsReason] = useState<string | null>(null);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const [autoSearchQuery, setAutoSearchQuery] = useState<string | null>(null);
  const [cacheAgeSeconds, setCacheAgeSeconds] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const hasResults = phase === "done" || phase === "searching" || phase === "parsing";
  const airportNames = parsed?.airport_names || {};

  useEffect(() => {
    if (searchMode === "natural") inputRef.current?.focus();
  }, [searchMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    setAttributionParams({
      utm_source: p.get("utm_source") || undefined,
      utm_medium: p.get("utm_medium") || undefined,
      utm_campaign: p.get("utm_campaign") || undefined,
      ref: p.get("ref") || "organic",
    });
    setShowCopyLink(!navigator.share);
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

  const canSearch = (): boolean => {
    if (searchMode === "natural") return prompt.trim().length >= 3;
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
        setError("Rate limit reached. Try again in an hour.");
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
            } else if (msg.type === "results") {
              setFlights(msg.flights || []);
              setReturnFlights(msg.return_flights || null);
              setRoundTripResults(msg.round_trip_results || null);
              setZonesWarning(msg.zones_warning || null);
              setSummary(msg.summary || null);
              setNoResultsReason(msg.no_results_reason || null);
              setSearchWarning(msg.warning || null);
              setCacheAgeSeconds(msg.cache_age_seconds ?? null);
              setPhase("done");
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
    return url.toString();
  };

  const handleShareResults = async () => {
    if (!parsed) return;
    const shareUrl = getShareUrl();
    if (!shareUrl) return;
    const shareText = `I found safer flight options on OpenSky: ${parsed.origins.join(",")} \u2192 ${parsed.destinations.join(",")}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "OpenSky results", text: shareText, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
      trackEvent("results_shared", { has_web_share: Boolean(navigator.share) });
    } catch {}
  };

  const handleCopyLink = async () => {
    const shareUrl = getShareUrl();
    if (!shareUrl || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      trackEvent("results_shared", { has_web_share: false });
    } catch {}
  };

  const isLoading = phase === "parsing" || phase === "searching";

  // Use only priced flights for recommendations (unpriced can appear in list but not labeled)
  const pricedFlights = flights.filter((f) => f.price > 0);
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
              <span className="text-[var(--color-accent)]">open</span>sky
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/methodology" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              How it works
            </a>
            <a href="/contact" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              Contact
            </a>
            <a href="https://github.com/buildingopen/opensky" target="_blank" rel="noopener noreferrer" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      {/* Referred-visit message */}
      {attributionParams.ref === "share" && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <p className="text-sm text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2">
            You were shared a recommendation. Search below to see safer flight options for your trip.
          </p>
        </div>
      )}

      {/* Hero - outcome-focused */}
      <section className={`max-w-3xl mx-auto px-4 w-full text-center transition-all duration-300 ${hasResults ? "pt-6 pb-4" : "pt-16 sm:pt-24 pb-6"}`}>
        <h1 className={`font-bold tracking-tight transition-all duration-300 ${hasResults ? "text-2xl" : "text-4xl sm:text-5xl"}`}>
          Find the safest practical{" "}
          <span className="text-[var(--color-accent)]">flight.</span>
        </h1>
        {!hasResults && (
          <p className="mt-4 text-[var(--color-text-muted)] text-base sm:text-lg max-w-lg mx-auto">
            We recommend the best route for your trip, filter out conflict zones, and explain why. No login required.
          </p>
        )}

        {/* Trust microcopy */}
        {!hasResults && (
          <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-[var(--color-text-muted)]">
            <span>No login required</span>
            <span>Powered by Duffel + Google</span>
            <span>Safety data updated {ZONES_UPDATED_AT}</span>
          </div>
        )}

        {/* Search surface */}
        <div className={`${hasResults ? "mt-4" : "mt-8"} bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 focus-within:border-[var(--color-accent)] focus-within:ring-1 focus-within:ring-[var(--color-accent)]/30 transition-colors`}>
          {searchMode === "structured" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="from" className="block text-xs text-[var(--color-text-muted)] mb-1">From</label>
                  <input
                    id="from"
                    type="text"
                    placeholder="e.g. JFK, London"
                    value={form.from}
                    onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
                    disabled={isLoading}
                    className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label htmlFor="to" className="block text-xs text-[var(--color-text-muted)] mb-1">To</label>
                  <input
                    id="to"
                    type="text"
                    placeholder="e.g. LHR, Paris"
                    value={form.to}
                    onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                    disabled={isLoading}
                    className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label htmlFor="depart" className="block text-xs text-[var(--color-text-muted)] mb-1">Depart</label>
                  <input
                    id="depart"
                    type="date"
                    value={form.depart}
                    onChange={(e) => setForm((f) => ({ ...f, depart: e.target.value }))}
                    disabled={isLoading}
                    className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label htmlFor="return" className="block text-xs text-[var(--color-text-muted)] mb-1">Return</label>
                  <input
                    id="return"
                    type="date"
                    value={form.returnDate}
                    onChange={(e) => setForm((f) => ({ ...f, returnDate: e.target.value }))}
                    disabled={isLoading || !form.roundTrip}
                    className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <input type="checkbox" checked={form.roundTrip} onChange={(e) => setForm((f) => ({ ...f, roundTrip: e.target.checked }))} disabled={isLoading} className="rounded" />
                  Round trip
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <input type="checkbox" checked={form.directOnly} onChange={(e) => setForm((f) => ({ ...f, directOnly: e.target.checked }))} disabled={isLoading} className="rounded" />
                  Direct only
                </label>
                <div className="flex items-center gap-2">
                  <label htmlFor="maxPrice" className="text-sm text-[var(--color-text-muted)]">Max $</label>
                  <input
                    id="maxPrice"
                    type="number"
                    placeholder="optional"
                    value={form.maxPrice}
                    onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value }))}
                    disabled={isLoading}
                    className="w-24 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), canSearch() && search())}
                placeholder="e.g. JFK to London next week under $500"
                disabled={isLoading}
                rows={2}
                className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
                aria-label="Describe your trip in plain English"
              />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSearchMode((m) => (m === "structured" ? "natural" : "structured"))}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
            >
              {searchMode === "structured" ? "Describe your trip instead" : "Use search form instead"}
            </button>
            <button
              onClick={() => search()}
              disabled={isLoading || !canSearch()}
              aria-label={isLoading ? "Searching" : "Search flights"}
              aria-busy={isLoading}
              className="px-5 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg transition-colors"
            >
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {/* Example prompts */}
        {phase === "idle" && flights.length === 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => {
                  setSearchMode("natural");
                  setPrompt(ex);
                  trackEvent("example_prompt_clicked", { prompt: ex });
                  search(ex);
                }}
                className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text)] transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Results */}
      <section id="main-content" ref={resultsRef} aria-live="polite" className="max-w-3xl mx-auto px-4 py-4 w-full flex-1">
        {error && (
          <div role="alert" className="mb-4">
            <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
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

        {isLoading && <SearchingState parsed={parsed} progress={progress} />}

        {phase === "done" && parsed && (
          <>
            {/* Fix 2: Parsed config chips */}
            <ParsedConfig parsed={parsed} />

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
              <div className="mt-6 text-center py-12">
                {noResultsReason === "provider_error" ? (
                  <>
                    <p className="text-[var(--color-text-muted)]">Flight data unavailable right now.</p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                      The flight data providers returned an error. Try again in a moment.
                    </p>
                  </>
                ) : noResultsReason === "safety_filtered" ? (
                  <>
                    <p className="text-[var(--color-text-muted)]">All routes pass through conflict zones.</p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                      Try different routing, nearby airports, or a different date range.
                    </p>
                  </>
                ) : noResultsReason === "no_routes" ? (
                  <>
                    <p className="text-[var(--color-text-muted)]">No flights found on this route.</p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                      This route may not have direct airline service. Try nearby airports or different dates.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[var(--color-text-muted)]">No flights found.</p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-2">
                      No flights match this route and date. Try nearby airports or different dates.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                {flights.every((f) => f.price === 0) && (
                  <div className="mt-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-muted)]">
                    Routes found but live prices unavailable. Use the links to check current prices.
                  </div>
                )}

                {/* Fix 10: Price staleness warning */}
                {cacheAgeSeconds !== null && cacheAgeSeconds > 1800 && (
                  <div className="mt-4 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2">
                    Prices from ~{Math.round(cacheAgeSeconds / 60)} min ago — may have changed.{" "}
                    <button
                      onClick={() => search()}
                      className="underline hover:text-[var(--color-text)] transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                )}

                {/* Round-trip degradation warning */}
                {parsed && parsed.return_dates.length > 0 && roundTripResults !== null && roundTripResults.length === 0 && flights.length > 0 && (
                  <div className="mt-4 bg-[var(--color-caution)]/10 border border-[var(--color-caution)]/30 rounded-lg px-4 py-3 text-sm text-[var(--color-caution)]">
                    No paired round-trip options found for these dates. Showing outbound flights only — search separately for return flights.
                  </div>
                )}

                {/* Recommendation stack */}
                <div className="mt-6 space-y-4">
                  <h2 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider">Our recommendations</h2>
                  {recs.slice(0, 4).map(({ label, flight }, i) => (
                    <FlightCard
                      key={i}
                      flight={flight}
                      label={label}
                      reason={getRecommendationReason(flight, flights, label)}
                      airportNames={airportNames}
                      attributionParams={attributionParams}
                      onOutboundClick={handleOutboundClick}
                    />
                  ))}
                </div>

                {/* Round-trip paired results */}
                {roundTripResults && roundTripResults.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-[var(--color-text)] uppercase tracking-wider mb-3">Round-trip options</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mb-4">
                      Each option shows outbound + return. Prices are combined — you&apos;ll complete two separate bookings.
                    </p>
                    <div className="space-y-4">
                      {roundTripResults.slice(0, 10).map((rt, i) => (
                        <RoundTripCard
                          key={i}
                          result={rt}
                          airportNames={airportNames}
                          attributionParams={attributionParams}
                          onOutboundClick={handleOutboundClick}
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
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Progressive disclosure: compare all */}
                {summary && summary.stats.total_flights > 0 && (
                  <div className="mt-8">
                    {showCompare ? (
                      <ScanSummaryExpanded summary={summary} currency={parsed.currency} airportNames={airportNames} onCollapse={() => setShowCompare(false)} />
                    ) : (
                      <ScanSummaryCollapsed summary={summary} currency={parsed.currency} onExpand={() => setShowCompare(true)} />
                    )}
                  </div>
                )}

                <div className="mt-6 space-y-2">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Share this recommendation — help a friend find a safer flight.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleShareResults}
                      className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-sm font-medium rounded-lg transition-colors"
                    >
                      Share results
                    </button>
                    {showCopyLink && (
                      <button
                        onClick={handleCopyLink}
                        className="px-4 py-2 border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text)] text-sm font-medium rounded-lg transition-colors"
                      >
                        Copy link
                      </button>
                    )}
                    {zonesWarning && <span className="text-xs text-[var(--color-caution)]">{zonesWarning}</span>}
                  </div>
                </div>

                {/* Trust at decision time */}
                <div className="mt-6 text-xs text-[var(--color-text-muted)]">
                  Safety zones updated {ZONES_UPDATED_AT}. You always book with the provider, not through us.{" "}
                  <a href="/methodology" className="text-[var(--color-accent)] hover:underline">How we rank flights</a>
                </div>
              </>
            )}
          </>
        )}

        {/* New search */}
        {phase === "done" && flights.length > 0 && (
          <div className="text-center mt-8 mb-4">
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
                setForm({ from: "", to: "", depart: "", returnDate: "", roundTrip: false, maxPrice: "", directOnly: false });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="px-5 py-2 text-sm border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text)] transition-colors"
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
                No login required
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                Free to use
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                Safe routes only
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                Compare providers
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
            <span>Flights from Duffel + Google. Conflict zones updated {ZONES_UPDATED_AT}. Decision support, not official travel advice.</span>
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

export default function Home() {
  return (
    <ErrorBoundary>
      <HomePage />
    </ErrorBoundary>
  );
}
