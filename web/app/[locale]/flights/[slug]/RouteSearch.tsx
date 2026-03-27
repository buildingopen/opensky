"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useCurrency } from "../../../../components/CurrencyProvider";
import { airlineName } from "../../../../components/AirlineFilter";
import {
  FlightOut,
  AttributionParams,
  formatDuration,
  formatDate,
  currencySymbol,
  flightDisplayDate,
  safeUrl,
  flightCompareUrl,
  appendAttribution,
} from "../../../../lib/flight-types";

interface RouteSearchProps {
  origin: string;
  destination: string;
  originCity: string;
  destCity: string;
}

type Phase = "idle" | "searching" | "done" | "error";

const SEARCH_TIMEOUT = 150_000;
const MAX_RESULTS = 5;

const ATTRIBUTION: AttributionParams = {
  utm_source: "seo",
  utm_medium: "route_page",
  utm_campaign: "programmatic",
};

export function RouteSearch({ origin, destination, originCity, destCity }: RouteSearchProps) {
  const t = useTranslations("flights");
  const locale = useLocale();
  const { currency: userCurrency } = useCurrency();

  const [phase, setPhase] = useState<Phase>("idle");
  const [flights, setFlights] = useState<FlightOut[]>([]);
  const [previewFlights, setPreviewFlights] = useState<FlightOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState(`${originCity} to ${destCity}`);
  const [editing, setEditing] = useState(false);
  const [rateLimitMins, setRateLimitMins] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const doSearch = useCallback(async (text: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("searching");
    setFlights([]);
    setPreviewFlights([]);
    setError(null);
    setEditing(false);
    setRateLimitMins(0);

    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);
    let gotResults = false;

    try {
      const resp = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          currency: userCurrency,
          locale,
        }),
        signal: controller.signal,
      });

      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get("Retry-After") || "", 10);
        const mins = retryAfter > 0 ? Math.ceil(retryAfter / 60) : 5;
        setRateLimitMins(mins);
        setPhase("error");
        setError(t("rateLimited", { mins: String(mins) }));
        return;
      }

      if (!resp.ok) {
        setPhase("error");
        setError(t("searchError"));
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
              setPhase("searching");
            } else if (msg.type === "progress") {
              if (msg.preview_flights?.length) {
                setPreviewFlights(msg.preview_flights.slice(0, MAX_RESULTS));
              }
            } else if (msg.type === "results") {
              gotResults = true;
              const results = (msg.flights || []).slice(0, MAX_RESULTS);
              setFlights(results);
              setPhase("done");
            }
          } catch {}
        }
      }

      // Stream ended without a results event
      if (!gotResults) {
        setPhase("done");
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setPhase("error");
      setError(t("searchError"));
    } finally {
      clearTimeout(timeout);
    }
  }, [userCurrency, locale, t]);

  const handleSearch = () => {
    doSearch(searchText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      doSearch(searchText);
    }
  };

  const displayFlights = flights.length > 0 ? flights : previewFlights;

  return (
    <div>
      {/* Search input area */}
      {phase === "idle" || editing ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={t("searchCta", { origin: originCity, destination: destCity })}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-interactive)] focus:outline-none focus:ring-1 focus:ring-[var(--color-interactive)]"
            placeholder={`${originCity} to ${destCity}`}
          />
          <button
            onClick={handleSearch}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-interactive)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-interactive-hover)] transition-colors"
          >
            {t("searchButton")}
          </button>
        </div>
      ) : null}

      {/* Searching state */}
      {phase === "searching" && !editing && (
        <div>
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-4">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t("searching")}
          </div>
          {displayFlights.length > 0 && (
            <FlightResults flights={displayFlights} locale={locale} currency={userCurrency} origin={origin} destination={destination} t={t} isPreview />
          )}
        </div>
      )}

      {/* Done state */}
      {phase === "done" && !editing && (
        <div>
          {displayFlights.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--color-text-muted)]">
                  {t("resultsCount", { count: String(displayFlights.length) })}
                </span>
                <button
                  onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
                  className="text-sm text-[var(--color-interactive)] hover:underline"
                >
                  {t("editSearch")}
                </button>
              </div>
              <FlightResults flights={displayFlights} locale={locale} currency={userCurrency} origin={origin} destination={destination} t={t} />
            </>
          ) : (
            <div className="rounded-lg border border-[var(--color-border)] p-5 text-center">
              <p className="text-sm text-[var(--color-text-muted)] mb-3">{t("noResults")}</p>
              <button
                onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
                className="text-sm text-[var(--color-interactive)] hover:underline"
              >
                {t("editSearch")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {phase === "error" && !editing && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-700 dark:text-red-300 mb-3">
            {error || t("searchError")}
          </p>
          <button
            onClick={() => { setPhase("idle"); setEditing(false); }}
            className="text-sm font-medium text-[var(--color-interactive)] hover:underline"
          >
            {rateLimitMins > 0 ? t("editSearch") : t("searchButton")}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact flight card list
// ---------------------------------------------------------------------------
interface FlightResultsProps {
  flights: FlightOut[];
  locale: string;
  currency: string;
  origin: string;
  destination: string;
  t: ReturnType<typeof useTranslations<"flights">>;
  isPreview?: boolean;
}

function FlightResults({ flights, locale, currency, origin, destination, t, isPreview }: FlightResultsProps) {
  return (
    <div className={`space-y-2 ${isPreview ? "opacity-70" : ""}`}>
      {flights.map((flight, i) => (
        <CompactFlightCard
          key={`${flight.origin}-${flight.destination}-${flight.date}-${i}`}
          flight={flight}
          locale={locale}
          currency={currency}
          routeOrigin={origin}
          routeDestination={destination}
          t={t}
        />
      ))}
    </div>
  );
}

interface CompactFlightCardProps {
  flight: FlightOut;
  locale: string;
  currency: string;
  routeOrigin: string;
  routeDestination: string;
  t: ReturnType<typeof useTranslations<"flights">>;
}

function CompactFlightCard({ flight, locale, currency, routeOrigin, routeDestination, t }: CompactFlightCardProps) {
  const displayDate = flightDisplayDate(flight);
  const airline = flight.legs?.[0]?.airline;
  const airlineLabel = airline ? airlineName(airline) : "";
  const sym = currencySymbol(flight.currency || currency);
  const stopsLabel = flight.stops === 0
    ? t("direct")
    : flight.stops === 1
      ? t("oneStop")
      : t("multiStop", { count: flight.stops });

  let bookUrl: string;
  if (flight.booking_exact && flight.booking_url) {
    bookUrl = appendAttribution(flight.booking_url, ATTRIBUTION);
  } else {
    bookUrl = flightCompareUrl(
      flight.origin || routeOrigin,
      flight.destination || routeDestination,
      displayDate,
      flight.currency || currency,
      "economy",
      flight.legs,
      locale,
    );
  }

  const bookLabel = flight.booking_exact ? t("bookDirect") : t("compareFlights");

  return (
    <div className="rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {airline && (
              <span className="font-medium text-[var(--color-text)]">{airline}</span>
            )}
            {airlineLabel && airline !== airlineLabel && (
              <span className="text-[var(--color-text-muted)] truncate">{airlineLabel}</span>
            )}
            <span className="text-[var(--color-text-muted)]">
              {flight.origin || routeOrigin} &rarr; {flight.destination || routeDestination}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] flex-wrap">
            <span>{formatDate(displayDate, locale)}</span>
            <span>&middot;</span>
            <span>{formatDuration(flight.duration_minutes)}</span>
            <span>&middot;</span>
            <span>{stopsLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-base font-semibold text-[var(--color-text)]">
            {sym}{Math.round(flight.price)}
          </span>
          {bookUrl && safeUrl(bookUrl) && (
            <a
              href={bookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-[var(--color-interactive)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-interactive-hover)] transition-colors whitespace-nowrap"
            >
              {bookLabel} &rarr;
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
