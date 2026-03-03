# skyroute

Flight search with conflict zone filtering. Searches Google Flights and filters out routes through active conflict zones, airspace closures, and high-risk regions.

## The problem

When booking flights, especially between Asia and Europe, many routes transit through the Middle East. During airspace closures (e.g., Iran strikes Feb 2026), these routes become dangerous or impossible. No existing flight search tool filters by airspace safety.

skyroute solves this: search thousands of origin/destination/date combinations, automatically flag routes through conflict zones, and find the safest cheapest option.

## Install

```bash
pip install skyroute
```

Or from source:

```bash
git clone https://github.com/federicodeponte/skyroute.git
cd skyroute
pip install -e .
```

## Usage

### Single route search

```bash
skyroute search BLR HAM 2026-03-10
skyroute search BLR HAM 2026-03-10 --currency EUR --show-risky
skyroute search BLR HAM 2026-03-10 --json
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

- **Residential IP required**: Google Flights blocks datacenter IPs with a consent wall. Use `--proxy` if running on a server.
- **Rate limits**: Google will throttle aggressive scanning. Default settings (3 workers, 1s delay) are conservative. Increase at your own risk.
- **Price accuracy**: Prices come from Google Flights and may differ from airline websites. Always verify before booking.
- **Safety data**: The conflict zone database is a best-effort compilation. It may be incomplete or outdated. This tool is not a substitute for official aviation safety advisories.

## Credits

Flight data API based on [fli](https://github.com/punitarani/fli) by Punit Arani (MIT license).

Airport metadata from [airportsdata](https://github.com/mborsetti/airportsdata).

## License

MIT
