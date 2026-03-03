# skyroute

Flight search with conflict zone filtering. Searches Google Flights, Duffel, and Amadeus, then filters out routes through active conflict zones, airspace closures, and high-risk regions.

## The problem

When booking flights, especially between Asia and Europe, many routes transit through the Middle East. During airspace closures (e.g., Iran strikes Feb 2026), these routes become dangerous or impossible. No existing flight search tool filters by airspace safety.

skyroute solves this: search thousands of origin/destination/date combinations, automatically flag routes through conflict zones, and find the safest cheapest option.

## Install

Requires Python 3.11+.

```bash
pip install skyroute
```

Or from source:

```bash
git clone https://github.com/federicodeponte/skyroute.git
cd skyroute
python -m venv .venv && source .venv/bin/activate
pip install -e .
```

Copy `.env.example` to `.env` and fill in any API keys you have (optional, Google Flights works without any keys).

## Providers

skyroute supports three flight data providers. Google Flights is always available. Duffel and Amadeus activate automatically when their env vars are set.

| Provider | Env vars | Notes |
|----------|----------|-------|
| Google Flights | none (default) | Scrapes Google Flights. Needs residential IP. |
| [Duffel](https://duffel.com) | `SKYROUTE_DUFFEL_TOKEN` | Free unlimited searches. |
| [Amadeus](https://developers.amadeus.com) | `SKYROUTE_AMADEUS_KEY` + `SKYROUTE_AMADEUS_SECRET` | Free tier: 2,000 calls/month. |

When multiple providers are configured, results are aggregated and deduplicated (same flight from two sources keeps the cheapest price).

Use `--provider` / `-p` to limit to a single provider:

```bash
skyroute search BLR HAM 2026-03-10 --provider duffel
```

## Quick demo

See what skyroute does without any API keys or network calls:

```bash
skyroute demo
skyroute demo --show-risky
```

![skyroute demo](demo.gif)

## Usage

### Single route search

```bash
skyroute search BLR HAM 2026-03-10
skyroute search BLR HAM 2026-03-10 --currency EUR --show-risky
skyroute search BLR HAM 2026-03-10 --json
skyroute search BLR HAM 2026-03-10 --provider duffel
```

### Multi-route scan

Generate a config file:

```bash
skyroute config init
```

Edit `scan.toml` with your origins, destinations, and dates, then:

```bash
skyroute scan --config scan.toml
skyroute scan --config scan.toml --workers 5 --json -o results.json
```

Scans are cached. If interrupted, re-run the same command to resume from where it left off.

### Conflict zones

```bash
skyroute zones              # list active conflict zones
skyroute zones --update     # fetch latest data from GitHub
```

### Cache management

```bash
skyroute cache stats
skyroute cache clear
```

## Scan config

```toml
[search]
origins = ["BLR", "DEL", "BOM", "KUL", "BKK", "SIN"]
destinations = ["HAM", "FRA", "MUC", "BER", "AMS", "CPH"]
cabin = "economy"
currency = "EUR"

[search.date_range]
start = "2026-03-10"
end = "2026-03-20"

[safety]
# Filter threshold. Routes at or above this level are hidden.
# Options: do_not_fly | high_risk | caution
risk_threshold = "high_risk"

[scoring]
price_weight = 1.0
duration_weight = 0.5

# Optional: add ground transit time for scoring
[connections]
final_destination = "Hamburg"

[connections.transit_hours]
HAM = 0
HAJ = 1.5
BER = 2
FRA = 4
```

## Safety data

skyroute ships with a bundled conflict zone database based on:
- [EASA Conflict Zone Information Bulletins (CZIB)](https://www.easa.europa.eu/en/domains/air-operations/czibs)
- [Safe Airspace](https://safeairspace.net)
- FAA NOTAMs

The database maps countries and specific airports to risk levels: `SAFE`, `CAUTION`, `HIGH_RISK`, `DO_NOT_FLY`.

Run `skyroute zones --update` to fetch the latest version.

**This is informational only. Always check official NOTAMs and airline advisories before booking.**

## Limitations

- **Residential IP required**: Google Flights blocks datacenter IPs with a consent wall. Use `--proxy` if running on a server. Duffel and Amadeus work from any IP.
- **Rate limits**: All providers are rate-limited to 10 req/sec. Google will throttle aggressive scanning. Default scan settings (3 workers, 1s delay) are conservative.
- **Price accuracy**: Prices may differ from airline websites. Always verify before booking.
- **Safety data**: The conflict zone database is a best-effort compilation. It may be incomplete or outdated. This tool is not a substitute for official aviation safety advisories.

## Credits

Flight data API based on [fli](https://github.com/punitarani/fli) by Punit Arani (MIT license).

Airport metadata from [airportsdata](https://github.com/mborsetti/airportsdata).

## License

MIT
