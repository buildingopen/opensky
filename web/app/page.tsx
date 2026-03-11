"use client";

import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  origin: string;
  destination: string;
  date: string;
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

interface SearchResponse {
  parsed: ParsedSearch;
  flights: FlightOut[];
  return_flights: FlightOut[] | null;
  count: number;
  remaining_searches: number;
  zones_warning: string | null;
  summary: ScanSummaryData | null;
}

// ---------------------------------------------------------------------------
// Risk Badge
// ---------------------------------------------------------------------------
function RiskBadge({ level }: { level: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    safe: { bg: "bg-[var(--color-safe)]/15", text: "text-[var(--color-safe)]", label: "Safe" },
    caution: { bg: "bg-[var(--color-caution)]/15", text: "text-[var(--color-caution)]", label: "Caution" },
    high_risk: { bg: "bg-[var(--color-high-risk)]/15", text: "text-[var(--color-high-risk)]", label: "High Risk" },
    do_not_fly: { bg: "bg-[var(--color-danger)]/15", text: "text-[var(--color-danger)]", label: "Do Not Fly" },
  };
  const c = config[level] || config.safe;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
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

const AIRLINE_NAMES: Record<string, string> = {
  "5F": "Fly One", "6E": "IndiGo", "9W": "Jet Airways", A3: "Aegean", AA: "American", AC: "Air Canada",
  AF: "Air France", AI: "Air India", AK: "AirAsia", AS: "Alaska",
  AZ: "ITA Airways", BA: "British Airways", BR: "EVA Air", CX: "Cathay Pacific",
  DL: "Delta", EK: "Emirates", ET: "Ethiopian", EW: "Eurowings",
  EN: "Air Dolomiti", EY: "Etihad", FI: "Icelandair", FR: "Ryanair", G9: "Air Arabia",
  GA: "Garuda", GF: "Gulf Air", HA: "Hawaiian",
  HG: "NIKI", IB: "Iberia", J2: "Azerbaijan Airlines", JL: "JAL",
  KC: "Air Astana", KE: "Korean Air", KL: "KLM", LH: "Lufthansa", LO: "LOT",
  LX: "SWISS", MH: "Malaysia Airlines", MS: "EgyptAir", NH: "ANA",
  NZ: "Air New Zealand", OS: "Austrian", OZ: "Asiana", PK: "PIA",
  QF: "Qantas", QR: "Qatar Airways", RJ: "Royal Jordanian", SA: "South African", SK: "SAS",
  SN: "Brussels Airlines", SQ: "Singapore Airlines", SU: "Aeroflot",
  TF: "Braathens Regional", TG: "Thai Airways", TK: "Turkish Airlines", TP: "TAP Portugal",
  UA: "United", UX: "Air Europa", VN: "Vietnam Airlines", VS: "Virgin Atlantic",
  VL: "Mediterranean Airways", VY: "Vueling", WN: "Southwest", WY: "Oman Air",
};

function airlineName(code: string): string {
  return AIRLINE_NAMES[code] || code;
}

function formatAirlines(codes: string): string {
  if (!codes) return "";
  return codes.split(", ").map(c => airlineName(c.trim())).join(", ");
}

// ---------------------------------------------------------------------------
// Parsed Search Summary
// ---------------------------------------------------------------------------
function airportLabel(code: string, names: Record<string, string>): string {
  const city = names[code];
  return city ? `${code} (${city})` : code;
}

function ParsedSummary({ parsed }: { parsed: ParsedSearch }) {
  const dateRange = parsed.dates.length > 1
    ? `${formatDate(parsed.dates[0])} - ${formatDate(parsed.dates[parsed.dates.length - 1])}`
    : formatDate(parsed.dates[0]);
  const isRoundTrip = parsed.return_dates && parsed.return_dates.length > 0;
  const returnDateRange = isRoundTrip
    ? parsed.return_dates.length > 1
      ? `${formatDate(parsed.return_dates[0])} - ${formatDate(parsed.return_dates[parsed.return_dates.length - 1])}`
      : formatDate(parsed.return_dates[0])
    : "";
  const names = parsed.airport_names || {};

  // Detect flexible date search: dates span more than 14 days
  const isFlexible = parsed.dates.length > 1 && (() => {
    const first = new Date(parsed.dates[0] + "T00:00:00");
    const last = new Date(parsed.dates[parsed.dates.length - 1] + "T00:00:00");
    return (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24) > 14;
  })();

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--color-text-muted)]">
        <span>
          <span className="text-[var(--color-text)] font-medium">{parsed.origins.map(o => airportLabel(o, names)).join(", ")}</span>
          {isRoundTrip ? " \u21C4 " : " \u2192 "}
          <span className="text-[var(--color-text)] font-medium">{parsed.destinations.map(d => airportLabel(d, names)).join(", ")}</span>
        </span>
        {isFlexible && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
            Flexible dates
          </span>
        )}
        <span>{dateRange}{isRoundTrip ? ` / return ${returnDateRange}` : ""}</span>
        <span className="capitalize">{parsed.cabin}</span>
        {parsed.max_price > 0 && (
          <span>Max {currencySymbol(parsed.currency)}{parsed.max_price}</span>
        )}
        {parsed.stops !== "any" && (
          <span className="capitalize">{parsed.stops.replace(/_/g, " ")}</span>
        )}
        <span className="ml-auto font-mono text-xs text-[var(--color-accent)]">
          {parsed.total_routes} combination{parsed.total_routes !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scan Summary (best per destination + price matrix)
// ---------------------------------------------------------------------------
function ScanSummary({ summary, currency, airportNames }: { summary: ScanSummaryData; currency: string; airportNames: Record<string, string> }) {
  const { best_destinations, price_matrix, stats } = summary;
  const sym = currencySymbol(currency);
  const isMultiDest = best_destinations.length > 1;
  const isMultiDate = price_matrix.dates.length > 1;
  const showMatrix = isMultiDest && isMultiDate && Object.values(price_matrix.prices).some(v => v != null);

  return (
    <div className="space-y-4 mb-6">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
        <span><span className="text-[var(--color-text)] font-semibold">{stats.total_flights}</span> flights</span>
        <span><span className="text-[var(--color-text)] font-semibold">{stats.destinations}</span> destination{stats.destinations !== 1 ? "s" : ""}</span>
        <span><span className="text-[var(--color-text)] font-semibold">{stats.dates}</span> date{stats.dates !== 1 ? "s" : ""}</span>
        {stats.min_price > 0 && (
          <span>
            {stats.min_price === stats.max_price
              ? <>{sym}<span className="text-[var(--color-accent)] font-semibold">{Math.round(stats.min_price)}</span></>
              : <>{sym}<span className="text-[var(--color-accent)] font-semibold">{Math.round(stats.min_price)}</span> - {sym}{Math.round(stats.max_price)}</>
            }
          </span>
        )}
      </div>

      {/* Best per destination table */}
      {isMultiDest && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Best per destination</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {best_destinations.map((f, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-4 text-sm">
                <span className="font-mono text-[var(--color-text)] font-medium w-10 shrink-0">{f.destination}</span>
                <span className="text-[var(--color-text-muted)] text-xs w-32 truncate hidden sm:inline" title={airportNames[f.destination] || ""}>{airportNames[f.destination] || ""}</span>
                <span className="text-[var(--color-accent)] font-semibold w-16 text-right">
                  {f.price > 0 ? `${sym}${Math.round(f.price)}` : "-"}
                </span>
                <span className="text-[var(--color-text-muted)] text-xs">{formatDate(f.date)}</span>
                <span className="text-[var(--color-text-muted)] text-xs">{formatDuration(f.duration_minutes)}</span>
                <span className="text-[var(--color-text-muted)] text-xs hidden sm:inline">{f.route.replace(/ -> /g, " \u2192 ")}</span>
                {f.risk_level !== "safe" && <RiskBadge level={f.risk_level} />}
                <a
                  href={f.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-[var(--color-accent)] hover:underline"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Date x Destination price matrix */}
      {showMatrix && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-x-auto">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)]">
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Price by date</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--color-text-muted)]">Dest</th>
                {price_matrix.dates.map(d => (
                  <th key={d} className="px-2 py-2 text-right font-mono font-normal text-[var(--color-text-muted)]">
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {price_matrix.destinations.map(dest => (
                <tr key={dest}>
                  <td className="px-3 py-2 font-mono font-medium text-[var(--color-text)]">
                    {dest} <span className="font-sans font-normal text-[var(--color-text-muted)] hidden sm:inline">{airportNames[dest] || ""}</span>
                  </td>
                  {price_matrix.dates.map(dt => {
                    const price = price_matrix.prices[`${dest}|${dt}`];
                    const isCheapest = price != null && price === price_matrix.cheapest_per_dest[dest];
                    return (
                      <td key={dt} className={`px-2 py-2 text-right font-mono ${
                        price == null
                          ? "text-[var(--color-text-muted)]"
                          : isCheapest
                            ? "text-[var(--color-accent)] font-semibold"
                            : "text-[var(--color-text)]"
                      }`}>
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
// Flight Card
// ---------------------------------------------------------------------------
function FlightCard({ flight }: { flight: FlightOut }) {
  const [expanded, setExpanded] = useState(false);
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];
  const airlines = flight.legs.length > 0
    ? [...new Set(flight.legs.map(l => l.airline).filter(a => a && a !== "ZZ"))].join(", ")
    : "";
  const departTime = firstLeg ? formatTime(firstLeg.departs) : "";
  const arriveTime = lastLeg ? formatTime(lastLeg.arrives) : "";

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5 hover:border-[var(--color-accent)]/30 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-[var(--color-text)] tracking-wide">
              {flight.route.replace(/ -> /g, " \u2192 ")}
            </span>
            {airlines && (
              <span className="text-xs text-[var(--color-text-muted)]">{formatAirlines(airlines)}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatDate(flight.date)}
            </span>
            {departTime && arriveTime && (
              <span className="text-xs text-[var(--color-text)]">
                {departTime} - {arriveTime}
              </span>
            )}
            <span className="text-xs text-[var(--color-text-muted)]">
              {flight.stops === 0 ? "Direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatDuration(flight.duration_minutes)}
            </span>
            {flight.risk_level !== "safe" && <RiskBadge level={flight.risk_level} />}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {flight.price > 0 ? (
            <>
              <div className="text-right">
                <div className="text-lg font-semibold text-[var(--color-text)]">
                  {currencySymbol(flight.currency)}{Math.round(flight.price)}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] capitalize">{flight.provider}</div>
              </div>
              <a
                href={flight.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-sm font-medium rounded-lg transition-colors"
              >
                Compare prices
              </a>
            </>
          ) : (
            <a
              href={flight.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-sm font-medium rounded-lg transition-colors"
            >
              See prices
            </a>
          )}
        </div>
      </div>

      {flight.legs.length > 1 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          {expanded ? "Hide details" : `Show ${flight.legs.length} segments`}
        </button>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2">
          {flight.legs.map((leg, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-[var(--color-accent)] w-14 shrink-0">
                {leg.airline && leg.airline !== "ZZ" ? `${leg.airline}${leg.flight_number}` : leg.flight_number || "---"}
              </span>
              <span className="text-[var(--color-text-muted)]">{leg.from}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{formatTime(leg.departs)}</span>
              <svg className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
              <span className="text-[var(--color-text-muted)]">{leg.to}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{formatTime(leg.arrives)}</span>
              <span className="text-xs text-[var(--color-text-muted)] ml-auto">{formatDuration(leg.duration_minutes)}</span>
            </div>
          ))}
          {flight.risk_details.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Risk factors:</p>
              {flight.risk_details.map((rd, i) => (
                <div key={i} className="text-xs text-[var(--color-caution)]">
                  {rd.airport} ({rd.country}) - {rd.zone} [{rd.risk}]
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
// Loading states
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
          <p className="text-[var(--color-text)]">
            Scanning route {progress.done}/{progress.total}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 font-mono">
            {progress.route} on {formatDate(progress.date)}
          </p>
          {/* Progress bar */}
          <div className="mt-4 mx-auto max-w-xs h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </>
      ) : parsed ? (
        <>
          <p className="text-[var(--color-text)]">
            Scanning {parsed.total_routes} routes across {parsed.origins.length} origin{parsed.origins.length > 1 ? "s" : ""} and {parsed.destinations.length} destination{parsed.destinations.length > 1 ? "s" : ""}...
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            Filtering out conflict zones.
          </p>
        </>
      ) : (
        <p className="text-[var(--color-text-muted)]">Understanding your search...</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------
type SortKey = "score" | "price" | "duration" | "stops";

function sortFlights(flights: FlightOut[], key: SortKey): FlightOut[] {
  return [...flights].sort((a, b) => {
    if (key === "price") return (a.price || Infinity) - (b.price || Infinity);
    if (key === "duration") return a.duration_minutes - b.duration_minutes;
    if (key === "stops") return a.stops - b.stops || (a.price || Infinity) - (b.price || Infinity);
    return a.score - b.score; // "score" = best value
  });
}

// ---------------------------------------------------------------------------
// Example prompts
// ---------------------------------------------------------------------------
const EXAMPLES = [
  "Bangalore to Hamburg, next week, under \u20AC500",
  "Bangkok, Delhi, Mumbai to Frankfurt, Berlin, Amsterdam, March 20-25, economy",
  "JFK to London round trip, April 10 returning April 17, under $800",
  "New York to Tokyo, business class, under $3000",
  "Barcelona to anywhere in Europe, cheapest week in July",
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "parsing" | "searching" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedSearch | null>(null);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [flights, setFlights] = useState<FlightOut[]>([]);
  const [returnFlights, setReturnFlights] = useState<FlightOut[] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [zonesWarning, setZonesWarning] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummaryData | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const hasResults = phase === "done" || phase === "searching" || phase === "parsing";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (phase === "done" && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  const search = async (text?: string) => {
    const q = text || prompt;
    if (!q.trim()) return;

    setPhase("parsing");
    setError(null);
    setParsed(null);
    setProgress(null);
    setFlights([]);
    setReturnFlights(null);
    setRemaining(null);
    setTotalCount(0);
    setZonesWarning(null);
    setSummary(null);
    setSortKey("score");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000); // 90s total timeout

    try {
      const resp = await fetch(`${API_URL}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: q }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        setError("Rate limit reached. Try again in an hour.");
        setPhase("idle");
        return;
      }

      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        setError(body?.detail || `Search failed (${resp.status})`);
        setPhase("idle");
        return;
      }

      // Read SSE stream
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
              setPhase("searching");
            } else if (msg.type === "progress") {
              setProgress(msg);
            } else if (msg.type === "results") {
              setFlights(msg.flights);
              setReturnFlights(msg.return_flights || null);
              setTotalCount(msg.count);
              setRemaining(msg.remaining_searches);
              setZonesWarning(msg.zones_warning);
              setSummary(msg.summary || null);
              setPhase("done");
            } else if (msg.type === "error") {
              setError(msg.detail);
              setPhase("idle");
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Search timed out. The flight providers may be slow. Try a narrower search.");
      } else {
        setError("Could not reach the search API. Please try again.");
      }
      setPhase("idle");
    } finally {
      clearTimeout(timeout);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      search();
    }
  };

  const handleExample = (ex: string) => {
    setPrompt(ex);
    inputRef.current?.focus();
  };

  const isLoading = phase === "parsing" || phase === "searching";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
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
          <a
            href="https://github.com/buildingopen/opensky"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Hero + Prompt */}
      <section className={`max-w-3xl mx-auto px-4 w-full text-center transition-all duration-300 ${hasResults ? "pt-6 pb-4" : "pt-16 sm:pt-24 pb-6"}`}>
        <h1 className={`font-bold tracking-tight transition-all duration-300 ${hasResults ? "text-2xl" : "text-4xl sm:text-5xl"}`}>
          Prompt to{" "}
          <span className="text-[var(--color-accent)]">fly.</span>
        </h1>
        {!hasResults && (
          <p className="mt-4 text-[var(--color-text-muted)] text-base sm:text-lg max-w-lg mx-auto">
            Describe your trip in plain English. We search hundreds of routes across multiple providers, filtering out conflict zones automatically.
          </p>
        )}

        {/* Prompt Input */}
        <div className={`flex items-start ${hasResults ? "mt-4" : "mt-8"} bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2 focus-within:border-[var(--color-accent)] focus-within:ring-1 focus-within:ring-[var(--color-accent)]/30 transition-colors`}>
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Where do you want to fly?"
            disabled={isLoading}
            rows={1}
            className="flex-1 bg-transparent py-1.5 text-base text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none disabled:opacity-50 resize-none overflow-hidden"
          />
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {!isLoading && prompt.trim() && (
              <kbd className="hidden sm:inline text-[10px] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded px-1.5 py-0.5">
                Enter
              </kbd>
            )}
            <button
              onClick={() => search()}
              disabled={isLoading || !prompt.trim()}
              className="px-5 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg transition-colors"
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
                onClick={() => handleExample(ex)}
                className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text)] transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Results */}
      <section ref={resultsRef} className="max-w-3xl mx-auto px-4 py-4 w-full flex-1">
        {error && (
          <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg px-4 py-3 text-sm text-[var(--color-danger)] mb-4">
            {error}
          </div>
        )}

        {isLoading && <SearchingState parsed={parsed} progress={progress} />}

        {phase === "done" && parsed && (
          <>
            <ParsedSummary parsed={parsed} />

            {summary && summary.stats && summary.stats.total_flights > 0 && (
              <div className="mt-4">
                <ScanSummary summary={summary} currency={parsed.currency} airportNames={parsed.airport_names || {}} />
              </div>
            )}

            {/* Round-trip total price hint */}
            {returnFlights && returnFlights.length > 0 && flights.length > 0 && (() => {
              const cheapOut = flights.filter(f => f.price > 0).reduce((min, f) => f.price < min ? f.price : min, Infinity);
              const cheapRet = returnFlights.filter(f => f.price > 0).reduce((min, f) => f.price < min ? f.price : min, Infinity);
              if (cheapOut < Infinity && cheapRet < Infinity) {
                const sym = currencySymbol(flights[0]?.currency || "EUR");
                return (
                  <div className="mt-4 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-lg px-4 py-3 text-sm">
                    <span className="text-[var(--color-accent)] font-semibold">Round trip from {sym}{Math.round(cheapOut + cheapRet)}</span>
                    <span className="text-[var(--color-text-muted)] ml-2">({sym}{Math.round(cheapOut)} out + {sym}{Math.round(cheapRet)} return)</span>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 mb-3 gap-2">
              <p className="text-sm text-[var(--color-text-muted)]">
                {returnFlights
                  ? `${flights.length} outbound + ${returnFlights.length} return flights`
                  : totalCount > flights.length
                    ? `Top ${flights.length} of ${totalCount} flights`
                    : `${flights.length} flight${flights.length !== 1 ? "s" : ""} found`
                }
                {remaining !== null && (
                  <span className="ml-2 text-xs">({remaining} search{remaining !== 1 ? "es" : ""} left this hour)</span>
                )}
              </p>
              <div className="flex items-center gap-1.5">
                {zonesWarning && (
                  <p className="text-xs text-[var(--color-caution)] mr-3">{zonesWarning}</p>
                )}
                <span className="text-xs text-[var(--color-text-muted)] mr-1">Sort:</span>
                {(["score", "price", "duration", "stops"] as SortKey[]).map(k => (
                  <button
                    key={k}
                    onClick={() => setSortKey(k)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      sortKey === k
                        ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-medium"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {k === "score" ? "Best" : k === "price" ? "Price" : k === "duration" ? "Time" : "Stops"}
                  </button>
                ))}
              </div>
            </div>

            {flights.length === 0 && (!returnFlights || returnFlights.length === 0) ? (
              <div className="text-center py-12">
                <p className="text-[var(--color-text-muted)]">No safe flights found.</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                  All available routes pass through conflict zones, or no flights match your criteria. Try different dates or destinations.
                </p>
              </div>
            ) : (
              <>
                {flights.every(f => f.price === 0) && (
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-muted)] mb-3">
                    We found routes but couldn&apos;t fetch live prices for this search. Click the link on any flight to see current prices and book on Google Flights.
                  </div>
                )}

                {/* Outbound section */}
                {returnFlights && (
                  <h3 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Outbound</h3>
                )}
                <div className="space-y-3">
                  {sortFlights(flights, sortKey).map((flight, i) => (
                    <FlightCard key={`out-${i}`} flight={flight} />
                  ))}
                </div>

                {/* Return section */}
                {returnFlights && returnFlights.length > 0 && (
                  <>
                    <h3 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mt-6 mb-2">Return</h3>
                    <div className="space-y-3">
                      {sortFlights(returnFlights, sortKey).map((flight, i) => (
                        <FlightCard key={`ret-${i}`} flight={flight} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* New search button after results */}
        {phase === "done" && flights.length > 0 && (
          <div className="text-center mt-8 mb-4">
            <button
              onClick={() => {
                setPhase("idle");
                setPrompt("");
                setFlights([]);
                setReturnFlights(null);
                setParsed(null);
                setSummary(null);
                setTotalCount(0);
                setZonesWarning(null);
                setSortKey("score");
                if (inputRef.current) {
                  inputRef.current.style.height = "auto";
                  inputRef.current.focus();
                }
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="px-5 py-2 text-sm border border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text)] transition-colors"
            >
              New search
            </button>
          </div>
        )}

        {/* Empty state */}
        {phase === "idle" && flights.length === 0 && !error && (
          <div className="text-center py-8">
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                Multi-city search
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                Round-trip support
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                Flexible dates
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                Safety filtering
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-safe)]" />
                Open source
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] mt-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
          <span>
            Built by{" "}
            <a href="https://buildingopen.org" className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors">
              Building Open
            </a>
          </span>
          <span>
            Flights from Duffel &amp; Google. Conflict zones updated March 2026. Prices via Skyscanner.
          </span>
        </div>
      </footer>
    </div>
  );
}
