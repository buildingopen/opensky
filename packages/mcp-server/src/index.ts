#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  FlyfastClient,
  type FlightResult,
  type RoundTripResult,
  type ConflictZone,
} from "@flyfast/client";

const client = new FlyfastClient({
  baseUrl: process.env.FLYFAST_API_URL || "https://api.flyfast.app",
  apiKey: process.env.FLYFAST_API_KEY,
  internalToken: process.env.FLYFAST_INTERNAL_TOKEN,
});

// ---------------------------------------------------------------------------
// Formatters (human-readable text output)
// ---------------------------------------------------------------------------

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatFlight(f: FlightResult, idx: number): string {
  const stops = f.stops === 0 ? "Direct" : `${f.stops} stop${f.stops > 1 ? "s" : ""}`;
  const safety =
    f.risk_level === "safe"
      ? ""
      : ` [${f.risk_level.toUpperCase()}]`;
  return `${idx}. ${f.route} | ${f.currency} ${f.price} | ${formatDuration(f.duration_minutes)} | ${stops}${safety}`;
}

function formatRoundTrip(rt: RoundTripResult, idx: number): string {
  const out = rt.outbound;
  const inb = rt.inbound;
  return (
    `${idx}. ${out.route} + ${inb.route} | ${rt.currency} ${rt.total_price} round trip\n` +
    `   Out: ${formatDuration(out.duration_minutes)}, ${out.stops === 0 ? "direct" : out.stops + " stop(s)"}\n` +
    `   Return: ${formatDuration(inb.duration_minutes)}, ${inb.stops === 0 ? "direct" : inb.stops + " stop(s)"}`
  );
}

function formatZone(zone: ConflictZone): string {
  return `- ${zone.name} (${zone.risk_level}) -- ${zone.countries.join(", ")}`;
}

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], ...(isError ? { isError: true } : {}) };
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SearchSchema = z.object({
  query: z.string().describe("Natural language flight search query"),
  currency: z.string().optional().describe("3-letter currency code (e.g. EUR, USD, GBP)"),
}).shape;

const AlertSchema = z.object({
  email: z.string().describe("Email to notify"),
  query: z.string().describe("Natural language search query"),
  origins: z.array(z.string()).describe("Origin IATA codes (e.g. ['BER', 'TXL'])"),
  destinations: z.array(z.string()).describe("Destination IATA codes (e.g. ['LHR', 'STN'])"),
  max_price: z.number().optional().describe("Maximum price threshold"),
  currency: z.string().optional().describe("3-letter currency code (default: EUR)"),
}).shape;

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleSearch(args: { query: string; currency?: string }) {
  try {
    const result = await client.search(args.query, { currency: args.currency });
    const lines: string[] = [];

    if (result.parsed) {
      const p = result.parsed;
      lines.push(
        `Search: ${p.origins.join(", ")} -> ${p.destinations.join(", ")}`,
        `Dates: ${p.dates.join(", ")}${p.return_dates.length ? ` (return: ${p.return_dates.join(", ")})` : ""}`,
        `${p.total_routes} route combinations checked`,
        ""
      );
    }

    if (result.no_results_reason) {
      lines.push(`No results: ${result.no_results_reason}`);
      return textResult(lines.join("\n"));
    }

    if (result.round_trip_results?.length) {
      lines.push(`Round trips (${result.round_trip_results.length}):`);
      for (let i = 0; i < Math.min(result.round_trip_results.length, 10); i++) {
        lines.push(formatRoundTrip(result.round_trip_results[i], i + 1));
      }
      if (result.round_trip_results.length > 10) {
        lines.push(`... and ${result.round_trip_results.length - 10} more`);
      }
    } else if (result.flights.length) {
      lines.push(`Flights (${result.flights.length}):`);
      for (let i = 0; i < Math.min(result.flights.length, 10); i++) {
        lines.push(formatFlight(result.flights[i], i + 1));
      }
      if (result.flights.length > 10) {
        lines.push(`... and ${result.flights.length - 10} more`);
      }
    }

    if (result.zones_warning) {
      lines.push("", `Safety note: ${result.zones_warning}`);
    }

    if (result.summary?.best_destinations?.length) {
      lines.push("", "Best destinations:");
      for (const d of result.summary.best_destinations) {
        lines.push(
          `  ${d.city}: from ${result.summary.currency} ${d.min_price} (${d.flight_count} flights, ${d.risk_level})`
        );
      }
    }

    return textResult(lines.join("\n"));
  } catch (err) {
    return textResult(`Search failed: ${err instanceof Error ? err.message : String(err)}`, true);
  }
}

async function handleListZones() {
  try {
    const result = await client.listZones();
    const lines = [`${result.zones.length} conflict zones tracked:`, ""];
    for (const zone of result.zones) {
      lines.push(formatZone(zone));
    }
    if (result.warning) {
      lines.push("", result.warning);
    }
    return textResult(lines.join("\n"));
  } catch (err) {
    return textResult(`Failed to fetch zones: ${err instanceof Error ? err.message : String(err)}`, true);
  }
}

async function handleCreateAlert(args: {
  email: string;
  query: string;
  origins: string[];
  destinations: string[];
  max_price?: number;
  currency?: string;
}) {
  try {
    const result = await client.createAlert({
      email: args.email,
      query: args.query,
      origins: args.origins,
      destinations: args.destinations,
      max_price: args.max_price,
      currency: args.currency,
    });
    return textResult(`Alert created. ${result.message || "Check your email to confirm."}`);
  } catch (err) {
    return textResult(`Alert creation failed: ${err instanceof Error ? err.message : String(err)}`, true);
  }
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "flyfast",
  version: "0.1.0",
});

/* eslint-disable @typescript-eslint/no-explicit-any */
// MCP SDK 1.x has TS2589 with complex ZodRawShape overloads; cast to work around
(server as any).tool(
  "search_flights",
  "Search flights using natural language (e.g. 'Berlin to London next week under 200 EUR'). Returns ranked results with prices, durations, and safety ratings.",
  SearchSchema,
  (args: { query: string; currency?: string }) => handleSearch(args),
);

(server as any).tool(
  "list_conflict_zones",
  "List all 19 tracked aviation conflict zones with risk levels and affected countries.",
  {},
  () => handleListZones(),
);

(server as any).tool(
  "create_price_alert",
  "Set up a price drop alert. Sends an email when prices drop below the threshold. Requires email confirmation.",
  AlertSchema,
  (args: { email: string; query: string; origins: string[]; destinations: string[]; max_price?: number; currency?: string }) =>
    handleCreateAlert(args),
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
