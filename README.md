# opensky

`opensky` is an open-source flight search CLI that aggregates Google Flights, Duffel, and Amadeus results, then flags itineraries that transit through risky airports, land in risky countries, or appear to overfly whole-country conflict zones on regional segments.

## What The Engine Evaluates Today

- one-way itineraries returned by the configured providers
- airports and countries present in the itinerary
- regional great-circle overflight screening for whole-country conflict zones
- airport-based advisories for partial-region conflict zones
- risk levels from the bundled or refreshed conflict-zone dataset
- price and duration scoring across single-route searches and multi-route scans

It does not ingest filed routings, live FIR closures, or airline-specific detours. Partial-region and FIR-style advisories without bundled geometry remain airport-based.

## Install

Requires Python 3.11+.

Install from PyPI:

```bash
pip install opensky-cli
```

GitHub install still works:

```bash
pip install "git+https://github.com/buildingopen/opensky.git"
```

Or from source:

```bash
git clone https://github.com/buildingopen/opensky.git
cd opensky
python -m venv .venv && source .venv/bin/activate
pip install -e .
```

Copy `.env.example` to `.env` and fill in any API keys you have. Google Flights works without any keys.

`skyroute` remains available as a compatibility command for now, but `opensky` is the canonical CLI.

## Quick Demo

See the full output without any API keys or network calls:

```bash
opensky demo
opensky demo --show-risky
```

![opensky demo](demo.gif)

## Providers

`opensky` supports three providers. Google Flights is always available. Duffel and Amadeus activate automatically when their env vars are set.

| Provider | Env vars | Notes |
|----------|----------|-------|
| Google Flights | none (default) | Scrapes Google Flights. Needs a residential IP. |
| [Duffel](https://duffel.com) | `OPENSKY_DUFFEL_TOKEN` | Fallback: `SKYROUTE_DUFFEL_TOKEN`. |
| [Amadeus](https://developers.amadeus.com) | `OPENSKY_AMADEUS_KEY` + `OPENSKY_AMADEUS_SECRET` | Fallback: legacy `SKYROUTE_AMADEUS_KEY` + `SKYROUTE_AMADEUS_SECRET`. |

When multiple providers are configured, results are aggregated and deduplicated. If one provider fails, the CLI reports partial results. If every provider fails, the command exits non-zero.

Use `--provider` / `-p` to limit to a single provider:

```bash
opensky search BLR HAM 2026-04-10 --provider duffel
```

## Usage

### Single route search

```bash
opensky search BLR HAM 2026-04-10
opensky search BLR HAM 2026-04-10 --currency EUR --show-risky
opensky search BLR HAM 2026-04-10 --json
opensky search BLR HAM 2026-04-10 --provider duffel
```

### Multi-route scan

Generate a config file:

```bash
opensky config init
```

Edit `scan.toml` with your origins, destinations, and dates, then:

```bash
opensky scan --config scan.toml
opensky scan --config scan.toml --workers 5 --json -o results.json
```

Scans are cached. If interrupted, rerun the same command to reuse cached provider results.

### Conflict zones

```bash
opensky zones
opensky zones --update
```

### Cache management

```bash
opensky cache stats
opensky cache clear
```

## Scan Config

```toml
[search]
origins = ["BLR", "DEL", "BOM", "KUL", "BKK", "SIN"]
destinations = ["HAM", "FRA", "MUC", "BER", "AMS", "CPH"]
cabin = "economy"
currency = "EUR"
stops = "any"

[search.date_range]
start = "2026-04-10"
end = "2026-04-20"

[safety]
# Hide routes at or above this level.
# Options: do_not_fly | high_risk | caution
risk_threshold = "high_risk"

[scoring]
price_weight = 1.0
duration_weight = 0.5

[connections.transit_hours]
HAM = 0
HAJ = 1.5
BER = 2
FRA = 4
MUC = 5.5
AMS = 5
CPH = 5
```

## Safety Data

`opensky` ships with a bundled conflict-zone database based on:

- [EASA Conflict Zone Information Bulletins (CZIB)](https://www.easa.europa.eu/en/domains/air-operations/czibs)
- [Safe Airspace](https://safeairspace.net)
- FAA NOTAMs
- [Natural Earth 50m admin 0 country geometry](https://www.naturalearthdata.com/)

The dataset maps countries and specific airports to `SAFE`, `CAUTION`, `HIGH_RISK`, and `DO_NOT_FLY`. Whole-country zones also use bundled country geometry for regional overflight screening.

Run `opensky zones --update` to fetch the latest dataset from GitHub.

This is informational only. Always check official NOTAMs and airline advisories before booking.

## Limitations

- Google Flights often requires a residential IP. Use `--proxy` if you are running searches from a server.
- Prices can differ from airline and OTA checkout pages.
- The conflict-zone database is a best-effort dataset and can be incomplete or stale.
- Overflight screening uses a regional great-circle proxy, not filed flight plans or live ATC reroutes.
- FIR-level closures without bundled geometry still require airport-based or manual review.

## Release

CI runs on Python 3.11 through 3.14. Tagging `v*` triggers the release workflow, which builds distributions, creates a GitHub release, and can optionally publish to PyPI if trusted publishing is configured.

See [RELEASING.md](RELEASING.md) for the release steps.

## Credits

Flight data API based on [fli](https://github.com/punitarani/fli) by Punit Arani (MIT license).

Airport metadata from [airportsdata](https://github.com/mborsetti/airportsdata).

## License

MIT
