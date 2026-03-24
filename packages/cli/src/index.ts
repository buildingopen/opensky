#!/usr/bin/env node

import { Command } from "commander";
import {
  FlyfastClient,
  type FlightResult,
  type RoundTripResult,
  type SearchProgress,
  type ConflictZone,
} from "@flyfast/client";

const client = new FlyfastClient({
  baseUrl: process.env.FLYFAST_API_URL || "https://api.flyfast.app",
  apiKey: process.env.FLYFAST_API_KEY,
  internalToken: process.env.FLYFAST_INTERNAL_TOKEN,
});

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pad(s: string, len: number): string {
  return s.length >= len ? s : s + " ".repeat(len - s.length);
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function stopsLabel(n: number): string {
  return n === 0 ? "Direct" : `${n} stop${n > 1 ? "s" : ""}`;
}

function riskBadge(level: string): string {
  if (level === "safe") return "Safe";
  return level.toUpperCase();
}

function printFlightTable(flights: FlightResult[], limit: number): void {
  const rows = flights.slice(0, limit);
  console.log("");
  console.log(
    `  ${pad("Route", 18)} ${pad("Date", 12)} ${pad("Price", 10)} ${pad("Duration", 10)} ${pad("Stops", 10)} Safety`
  );
  console.log("  " + "-".repeat(76));
  for (const f of rows) {
    const date = f.legs[0]?.departure?.slice(0, 10) || "";
    console.log(
      `  ${pad(f.route, 18)} ${pad(date, 12)} ${pad(f.currency + " " + f.price, 10)} ${pad(formatDuration(f.duration_minutes), 10)} ${pad(stopsLabel(f.stops), 10)} ${riskBadge(f.risk_level)}`
    );
  }
  if (flights.length > limit) {
    console.log(`  ... and ${flights.length - limit} more`);
  }
  console.log("");
}

function printRoundTripTable(
  trips: RoundTripResult[],
  limit: number
): void {
  const rows = trips.slice(0, limit);
  console.log("");
  console.log(
    `  ${pad("Outbound", 16)} ${pad("Return", 16)} ${pad("Total", 10)} ${pad("Duration", 12)} Safety`
  );
  console.log("  " + "-".repeat(70));
  for (const rt of rows) {
    const dur = formatDuration(
      rt.outbound.duration_minutes + rt.inbound.duration_minutes
    );
    console.log(
      `  ${pad(rt.outbound.route, 16)} ${pad(rt.inbound.route, 16)} ${pad(rt.currency + " " + rt.total_price, 10)} ${pad(dur, 12)} ${riskBadge(rt.risk_level)}`
    );
  }
  if (trips.length > limit) {
    console.log(`  ... and ${trips.length - limit} more`);
  }
  console.log("");
}

function clearLine(): void {
  if (process.stdout.isTTY) {
    process.stdout.write("\r\x1b[K");
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("flyfast")
  .description("Search flights from your terminal")
  .version("0.1.0");

program
  .command("search", { isDefault: true })
  .description("Search flights using natural language")
  .argument("<query>", "Search query (e.g. 'Berlin to London next week')")
  .option("-c, --currency <code>", "Currency code (EUR, USD, GBP...)")
  .option("-n, --limit <number>", "Max results to show", "10")
  .action(async (query: string, opts: { currency?: string; limit: string }) => {
    const limit = parseInt(opts.limit, 10) || 10;

    try {
      const result = await client.search(query, {
        currency: opts.currency,
        onParsed(parsed) {
          clearLine();
          process.stdout.write(
            `  Searching ${parsed.origins.join("/")} -> ${parsed.destinations.join("/")} (${parsed.total_routes} routes)...`
          );
        },
        onProgress(p: SearchProgress) {
          clearLine();
          const route = p.route ? ` (${p.route})` : "";
          process.stdout.write(
            `  Searching... ${p.done}/${p.total} routes${route}`
          );
        },
      });

      clearLine();

      if (result.no_results_reason) {
        console.log(`  No results: ${result.no_results_reason}`);
        process.exit(0);
      }

      if (result.round_trip_results?.length) {
        console.log(
          `  Found ${result.round_trip_results.length} round trips`
        );
        printRoundTripTable(result.round_trip_results, limit);
      } else if (result.flights.length) {
        console.log(`  Found ${result.flights.length} flights`);
        printFlightTable(result.flights, limit);
      }

      if (result.zones_warning) {
        console.log(`  Safety: ${result.zones_warning}`);
      }

      if (result.summary?.best_destinations?.length) {
        console.log("  Best destinations:");
        for (const d of result.summary.best_destinations) {
          console.log(
            `    ${d.city}: from ${result.summary.currency} ${d.min_price} (${d.flight_count} flights)`
          );
        }
        console.log("");
      }
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

program
  .command("zones")
  .description("List tracked conflict zones")
  .action(async () => {
    try {
      const result = await client.listZones();
      console.log("");
      console.log(
        `  ${pad("Zone", 30)} ${pad("Risk", 12)} Countries`
      );
      console.log("  " + "-".repeat(70));
      for (const zone of result.zones) {
        console.log(
          `  ${pad(zone.name, 30)} ${pad(zone.risk_level, 12)} ${zone.countries.join(", ")}`
        );
      }
      if (result.warning) {
        console.log(`\n  ${result.warning}`);
      }
      console.log("");
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exit(1);
    }
  });

program.parse();
