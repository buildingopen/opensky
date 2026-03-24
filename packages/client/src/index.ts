// @flyfast/client - FlyFast API client with SSE streaming

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlightLeg {
  airline: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  duration_minutes: number;
}

export interface RiskDetail {
  zone: string;
  risk_level: string;
  detail?: string;
}

export interface FlightResult {
  price: number;
  currency: string;
  duration_minutes: number;
  stops: number;
  route: string;
  risk_level: string;
  risk_details: RiskDetail[];
  score: number;
  legs: FlightLeg[];
  provider: string;
  booking_url: string;
  booking_label: string;
  booking_exact: boolean;
  origin: string;
  destination: string;
}

export interface RoundTripResult {
  outbound: FlightResult;
  inbound: FlightResult;
  total_price: number;
  currency: string;
  risk_level: string;
  risk_details: RiskDetail[];
  score: number;
}

export interface ParsedSearch {
  origins: string[];
  destinations: string[];
  dates: string[];
  return_dates: string[];
  max_price: number;
  currency: string;
  cabin: string;
  stops: string;
  safe_only: boolean;
  total_routes: number;
  airport_names: Record<string, string>;
}

export interface SearchProgress {
  type: "progress";
  done: number;
  total: number;
  filtered: number;
  route?: string;
  date?: string;
  preview_flights?: FlightResult[];
}

export interface DestinationSummary {
  destination: string;
  city: string;
  min_price: number;
  avg_price: number;
  flight_count: number;
  risk_level: string;
}

export interface SearchSummary {
  total_flights: number;
  cheapest_price: number;
  currency: string;
  best_destinations?: DestinationSummary[];
}

export interface SearchResult {
  parsed: ParsedSearch;
  flights: FlightResult[];
  return_flights: FlightResult[] | null;
  round_trip_results: RoundTripResult[] | null;
  zones_warning: string | null;
  summary: SearchSummary | null;
  no_results_reason: string | null;
}

export interface ConflictZone {
  id: string;
  name: string;
  risk_level: string;
  countries: string[];
  airports: string[];
  source: string;
  details: string;
  updated: string;
}

export interface ZonesResult {
  zones: ConflictZone[];
  warning: string | null;
}

export interface AlertParams {
  email: string;
  query: string;
  origins: string[];
  destinations: string[];
  max_price?: number;
  currency?: string;
}

export interface AlertResult {
  id: string;
  message: string;
}

export interface SearchOptions {
  currency?: string;
  maxResults?: number;
  onParsed?: (parsed: ParsedSearch) => void;
  onProgress?: (progress: SearchProgress) => void;
  signal?: AbortSignal;
}

export interface ClientConfig {
  baseUrl?: string;
  apiKey?: string;
  internalToken?: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class FlyfastClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private internalToken: string | undefined;

  constructor(config: ClientConfig = {}) {
    this.baseUrl = (config.baseUrl || "https://api.flyfast.app").replace(
      /\/$/,
      ""
    );
    this.apiKey = config.apiKey;
    this.internalToken = config.internalToken;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.internalToken) h["X-Internal-API-Token"] = this.internalToken;
    if (this.apiKey) h["X-API-Key"] = this.apiKey;
    return h;
  }

  // ---- Search (SSE stream) ----

  async search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
    const body: Record<string, unknown> = { prompt: query };
    if (opts.currency) body.currency = opts.currency;
    if (opts.maxResults) body.max_results = opts.maxResults;

    const resp = await fetch(`${this.baseUrl}/api/search`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      throw new Error(
        err?.detail || `Search failed with status ${resp.status}`
      );
    }

    const reader = resp.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";

    let parsed: ParsedSearch | null = null;
    let result: SearchResult | null = null;

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
            parsed = msg.parsed;
            if (opts.onParsed) opts.onParsed(msg.parsed);
          } else if (msg.type === "progress") {
            if (opts.onProgress) opts.onProgress(msg as SearchProgress);
          } else if (msg.type === "results") {
            result = {
              parsed: parsed || msg.parsed,
              flights: msg.flights || [],
              return_flights: msg.return_flights || null,
              round_trip_results: msg.round_trip_results || null,
              zones_warning: msg.zones_warning || null,
              summary: msg.summary || null,
              no_results_reason: msg.no_results_reason || null,
            };
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    if (!result) {
      throw new Error("Search stream ended without results");
    }
    return result;
  }

  // ---- Zones ----

  async listZones(): Promise<ZonesResult> {
    const resp = await fetch(`${this.baseUrl}/api/zones`, {
      headers: this.headers(),
    });
    if (!resp.ok) {
      throw new Error(`Failed to fetch zones: ${resp.status}`);
    }
    return resp.json() as Promise<ZonesResult>;
  }

  // ---- Alerts ----

  async createAlert(params: AlertParams): Promise<AlertResult> {
    const resp = await fetch(`${this.baseUrl}/api/alerts`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        email: params.email,
        query: params.query,
        origins: params.origins,
        destinations: params.destinations,
        max_price: params.max_price ?? 0,
        currency: params.currency ?? "EUR",
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => null);
      throw new Error(
        err?.detail || `Alert creation failed with status ${resp.status}`
      );
    }
    return resp.json() as Promise<AlertResult>;
  }
}
