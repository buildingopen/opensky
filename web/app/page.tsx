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
  const names = parsed.airport_names || {};

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--color-text-muted)]">
        <span>
          <span className="text-[var(--color-text)] font-medium">{parsed.origins.map(o => airportLabel(o, names)).join(", ")}</span>
          {" "}&rarr;{" "}
          <span className="text-[var(--color-text)] font-medium">{parsed.destinations.map(d => airportLabel(d, names)).join(", ")}</span>
        </span>
        <span>{dateRange}</span>
        <span className="capitalize">{parsed.cabin}</span>
        {parsed.max_price > 0 && (
          <span>Max {currencySymbol(parsed.currency)}{parsed.max_price}</span>
        )}
        {parsed.stops !== "any" && (
          <span className="capitalize">{parsed.stops.replace(/_/g, " ")}</span>
        )}
        <span className="ml-auto font-mono text-xs text-[var(--color-accent)]">
          {parsed.total_routes} combinations
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
                <span className="text-[var(--color-text-muted)] text-xs hidden sm:inline">{f.route}</span>
                <RiskBadge level={f.risk_level} />
                <a
                  href={f.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-[var(--color-accent)] hover:underline"
                >
                  Book
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
              {flight.route}
            </span>
            {airlines && (
              <span className="text-xs text-[var(--color-text-muted)]">{airlines}</span>
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
            <RiskBadge level={flight.risk_level} />
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {flight.price > 0 ? (
            <>
              <div className="text-right">
                <div className="text-lg font-semibold text-[var(--color-text)]">
                  {currencySymbol(flight.currency)} {Math.round(flight.price)}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {airlines || flight.provider}
                </div>
              </div>
              <a
                href={flight.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black text-sm font-medium rounded-lg transition-colors"
              >
                Book
              </a>
            </>
          ) : (
            <a
              href={flight.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-5 py-2 border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 text-sm font-medium rounded-lg transition-colors"
            >
              Check on Google
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
                {leg.airline}{leg.flight_number}
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
// Example prompts
// ---------------------------------------------------------------------------
const EXAMPLES = [
  "Bangalore to Hamburg, next week, under \u20AC500",
  "Bangkok, Delhi, Mumbai to Frankfurt, Berlin, Amsterdam, March 20-25, economy",
  "Nairobi to London, April 1-7, direct flights only",
  "New York to Tokyo, business class, under $3000",
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
  const [remaining, setRemaining] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [zonesWarning, setZonesWarning] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanSummaryData | null>(null);
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
    setRemaining(null);
    setTotalCount(0);
    setZonesWarning(null);
    setSummary(null);

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
        <div className={`relative ${hasResults ? "mt-4" : "mt-8"}`}>
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Where do you want to fly?"
            disabled={isLoading}
            rows={hasResults ? 1 : 2}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-5 py-4 pr-24 text-base text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-colors resize-none disabled:opacity-50"
          />
          <button
            onClick={() => search()}
            disabled={isLoading || !prompt.trim()}
            className="absolute right-3 bottom-3 px-5 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg transition-colors"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
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

            {summary && summary.stats.total_flights > 0 && (
              <div className="mt-4">
                <ScanSummary summary={summary} currency={parsed.currency} airportNames={parsed.airport_names || {}} />
              </div>
            )}

            <div className="flex items-center justify-between mt-4 mb-3">
              <p className="text-sm text-[var(--color-text-muted)]">
                {totalCount > flights.length
                  ? `Top ${flights.length} of ${totalCount} flights, sorted by best value`
                  : `${flights.length} flight${flights.length !== 1 ? "s" : ""} found, sorted by best value`
                }
                {remaining !== null && (
                  <span className="ml-2 text-xs">({remaining} searches left this hour)</span>
                )}
              </p>
              {zonesWarning && (
                <p className="text-xs text-[var(--color-caution)]">{zonesWarning}</p>
              )}
            </div>

            {flights.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[var(--color-text-muted)]">No safe flights found.</p>
                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                  All available routes pass through conflict zones, or no flights match your criteria. Try different dates or destinations.
                </p>
              </div>
            ) : (
              <>
                {flights.every(f => f.price === 0) && (
                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-xs text-[var(--color-text-muted)] mb-3">
                    Prices not available for this route from our providers. Click "Check on Google" for current pricing on Google Flights.
                  </div>
                )}
                <div className="space-y-3">
                  {flights.map((flight, i) => (
                    <FlightCard key={i} flight={flight} />
                  ))}
                </div>
              </>
            )}
          </>
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
            Conflict zone data updated March 2026. Flights from Duffel and Google.
          </span>
        </div>
      </footer>
    </div>
  );
}
