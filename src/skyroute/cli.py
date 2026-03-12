from __future__ import annotations

from pathlib import Path
from typing import Annotated, Optional

import typer
from rich.console import Console

from skyroute import __version__
from skyroute.config import VALID_CABINS, VALID_STOPS
from skyroute.search import ProviderFailure

app = typer.Typer(
    name="skyroute",
    help="Flight search with itinerary conflict-zone flagging.",
    no_args_is_help=True,
)
console = Console()


VALID_PROVIDERS = ("google", "duffel", "amadeus")


def _validate_provider(provider: str | None) -> None:
    if provider is not None and provider not in VALID_PROVIDERS:
        console.print(f"[red]Unknown provider: {provider}. Choose from: {', '.join(VALID_PROVIDERS)}.[/red]")
        console.print("[dim]Env vars: SKYROUTE_DUFFEL_TOKEN, SKYROUTE_AMADEUS_KEY + SKYROUTE_AMADEUS_SECRET[/dim]")
        raise typer.Exit(1)


def _validate_cabin(cabin: str) -> None:
    if cabin not in VALID_CABINS:
        console.print(
            f"[red]Unknown cabin: {cabin}. Choose from: {', '.join(VALID_CABINS)}.[/red]"
        )
        raise typer.Exit(1)


def _validate_stops(stops: str) -> None:
    if stops not in VALID_STOPS:
        console.print(
            f"[red]Unknown stops filter: {stops}. Choose from: {', '.join(VALID_STOPS)}.[/red]"
        )
        raise typer.Exit(1)


def _format_provider_failures(failures: list[ProviderFailure]) -> str:
    return ", ".join(
        f"{failure.provider} ({failure.error})"
        for failure in failures
    )


def _format_scan_failures(
    failed_providers: dict[str, int],
    failed_provider_errors: dict[str, str],
) -> str:
    return ", ".join(
        f"{provider} x{count} ({failed_provider_errors.get(provider, 'error')})"
        for provider, count in sorted(failed_providers.items())
    )


def version_callback(value: bool) -> None:
    if value:
        console.print(f"skyroute {__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: Annotated[
        Optional[bool],
        typer.Option("--version", "-v", callback=version_callback, is_eager=True),
    ] = None,
) -> None:
    pass


@app.command()
def search(
    origin: Annotated[str, typer.Argument(help="Origin airport IATA code")],
    destination: Annotated[str, typer.Argument(help="Destination airport IATA code")],
    date: Annotated[str, typer.Argument(help="Travel date (YYYY-MM-DD)")],
    currency: Annotated[str, typer.Option("--currency", "-c")] = "EUR",
    cabin: Annotated[str, typer.Option("--cabin", help="Cabin class: economy, premium_economy, business, first")] = "economy",
    stops: Annotated[str, typer.Option("--stops", help="Stop filter: any, non_stop, one_stop_or_fewer, two_or_fewer_stops")] = "any",
    max_price: Annotated[float, typer.Option("--max-price", help="Max price filter (0 = no limit)")] = 0,
    show_risky: Annotated[bool, typer.Option("--show-risky")] = False,
    json_output: Annotated[bool, typer.Option("--json")] = False,
    csv_output: Annotated[bool, typer.Option("--csv")] = False,
    no_cache: Annotated[bool, typer.Option("--no-cache")] = False,
    proxy: Annotated[Optional[str], typer.Option("--proxy")] = None,
    provider: Annotated[Optional[str], typer.Option("--provider", "-p", help="Provider: google (default), duffel (SKYROUTE_DUFFEL_TOKEN), amadeus (SKYROUTE_AMADEUS_KEY + _SECRET)")] = None,
    output: Annotated[Optional[str], typer.Option("--output", "-o", help="Save results to file")] = None,
) -> None:
    """Search flights for a single route."""
    from datetime import date as date_cls

    from skyroute import display
    from skyroute.models import RiskLevel
    from skyroute.safety import zones_age_warning
    from skyroute.search import SearchEngine

    origin = origin.upper()
    destination = destination.upper()

    # Validate date early with a clear message
    try:
        d = date_cls.fromisoformat(date)
        if d < date_cls.today():
            console.print(f"[red]Date {date} is in the past.[/red]")
            raise typer.Exit(1)
    except ValueError:
        console.print(f"[red]Invalid date format: {date}. Use YYYY-MM-DD.[/red]")
        raise typer.Exit(1)

    _validate_provider(provider)
    _validate_cabin(cabin)
    _validate_stops(stops)

    warning = zones_age_warning()
    if warning:
        console.print(f"[yellow]{warning}[/yellow]")

    try:
        engine = SearchEngine(
            currency=currency,
            proxy=proxy,
            use_cache=not no_cache,
            seat=cabin,
            stops=stops,
            provider=provider,
        )
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    names = ", ".join(p.name for p in engine._providers)
    console.print(f"[dim]Searching {names}...[/dim]")

    # Always search unfiltered, then split safe/risky in CLI for messaging
    try:
        report = engine.search_scored_report(
            origin, destination, date,
            risk_threshold=None,
            max_price=max_price,
        )
    except Exception as e:
        console.print(f"[red]Search failed: {e}[/red]")
        raise typer.Exit(1)
    finally:
        engine.close()

    if report.failed_providers and not report.successful_providers:
        console.print(
            f"[red]Search failed: {_format_provider_failures(report.failed_providers)}[/red]"
        )
        raise typer.Exit(1)

    if report.failed_providers:
        console.print(
            f"[yellow]Partial results: {_format_provider_failures(report.failed_providers)}[/yellow]"
        )

    all_results = report.results
    if not all_results:
        if max_price > 0:
            console.print(f"[dim]No flights found under {display.format_price(max_price, currency)}.[/dim]")
        else:
            console.print("[dim]No flights found.[/dim]")
        raise typer.Exit()

    safe = [sf for sf in all_results if sf.risk.risk_level < RiskLevel.HIGH_RISK]
    risky = [sf for sf in all_results if sf.risk.risk_level >= RiskLevel.HIGH_RISK]
    results = all_results if show_risky else safe

    if not results:
        console.print("[dim]No safe flights found. Use --show-risky to see all options.[/dim]")
        raise typer.Exit()

    results.sort(key=lambda x: x.score)

    if json_output:
        text = display.flights_json(results)
        if output:
            Path(output).write_text(text)
            console.print(f"Saved to {output}")
        else:
            print(text)
    elif csv_output:
        text = display.flights_csv(results)
        if output:
            Path(output).write_text(text)
            console.print(f"Saved to {output}")
        else:
            print(text)
    else:
        display.flights_table(results, title="Flight Results")
        if not show_risky and risky:
            console.print(
                f"[dim]{len(safe)} safe flights shown "
                f"({len(risky)} risky hidden, use --show-risky)[/dim]"
            )
        if output:
            text = display.flights_json(results)
            Path(output).write_text(text)
            console.print(f"Saved to {output}")


@app.command()
def scan(
    config_path: Annotated[str, typer.Option("--config", "-f", help="TOML config file")],
    workers: Annotated[int, typer.Option("--workers", "-w")] = 3,
    delay: Annotated[float, typer.Option("--delay")] = 1.0,
    max_price: Annotated[float, typer.Option("--max-price", help="Max price filter, overrides config (0 = no limit)")] = 0,
    detail: Annotated[bool, typer.Option("--detail", help="Show flat table instead of summary")] = False,
    show_risky: Annotated[bool, typer.Option("--show-risky")] = False,
    json_output: Annotated[bool, typer.Option("--json")] = False,
    csv_output: Annotated[bool, typer.Option("--csv")] = False,
    no_cache: Annotated[bool, typer.Option("--no-cache")] = False,
    proxy: Annotated[Optional[str], typer.Option("--proxy")] = None,
    provider: Annotated[Optional[str], typer.Option("--provider", "-p", help="Provider: google (default), duffel (SKYROUTE_DUFFEL_TOKEN), amadeus (SKYROUTE_AMADEUS_KEY + _SECRET)")] = None,
    output: Annotated[Optional[str], typer.Option("--output", "-o", help="Save results to file")] = None,
) -> None:
    """Run exhaustive multi-route scan from a TOML config."""
    from skyroute import display
    from skyroute.config import load_config
    from skyroute.models import RiskLevel
    from pydantic import ValidationError
    from skyroute.safety import zones_age_warning
    from skyroute.search import SearchEngine

    _validate_provider(provider)

    warning = zones_age_warning()
    if warning:
        console.print(f"[yellow]{warning}[/yellow]")

    try:
        cfg = load_config(config_path)
    except (OSError, ValidationError, ValueError) as e:
        console.print(f"[red]Invalid config: {e}[/red]")
        raise typer.Exit(1)

    # CLI --max-price overrides config value
    if max_price > 0:
        cfg.search.max_price = max_price

    dates = cfg.search.date_range.dates()
    total = len(cfg.search.origins) * len(cfg.search.destinations) * len(dates)

    try:
        engine = SearchEngine(
            currency=cfg.search.currency,
            proxy=proxy,
            use_cache=not no_cache,
            seat=cfg.search.cabin,
            stops=cfg.search.stops,
            provider=provider,
        )
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    names = ", ".join(p.name for p in engine._providers)
    provider_info = f" via {names}"

    console.print(
        f"Scanning {len(cfg.search.origins)} origins x "
        f"{len(cfg.search.destinations)} destinations x "
        f"{len(dates)} dates = {total} combos{provider_info}"
    )

    progress = display.scan_progress()
    with progress:
        task = progress.add_task("Scanning", total=total, errors=0)

        def on_progress(completed: int, total: int, errors: int) -> None:
            progress.update(task, completed=completed, errors=errors)

        scan_kwargs = {}
        if show_risky:
            scan_kwargs["risk_threshold_override"] = None

        try:
            report = engine.scan_report(
                cfg,
                workers=workers,
                delay=delay,
                on_progress=on_progress,
                **scan_kwargs,
            )
        except KeyboardInterrupt:
            console.print("\n[yellow]Scan interrupted. Cached results preserved for resume.[/yellow]")
            raise typer.Exit(1)
        finally:
            engine.close()

    if report.failed_providers and not report.successful_providers:
        console.print(
            f"[red]Scan failed: {_format_scan_failures(report.failed_providers, report.failed_provider_errors)}[/red]"
        )
        raise typer.Exit(1)

    if report.failed_providers:
        console.print(
            f"[yellow]Partial results: {_format_scan_failures(report.failed_providers, report.failed_provider_errors)}[/yellow]"
        )

    results = report.results
    if json_output:
        text = display.flights_json(results)
        if output:
            Path(output).write_text(text)
            console.print(f"Saved to {output}")
        else:
            print(text)
    elif csv_output:
        text = display.flights_csv(results)
        if output:
            Path(output).write_text(text)
            console.print(f"Saved to {output}")
        else:
            print(text)
    elif detail:
        display.flights_table(
            results,
            title=f"Scan Results ({len(results)} flights)",
        )
        if output:
            text = display.flights_json(results)
            Path(output).write_text(text)
            console.print(f"Saved to {output}")
    else:
        display.scan_summary(results, cfg.search.currency)
        if output:
            text = display.flights_json(results)
            Path(output).write_text(text)
            console.print(f"Saved to {output}")


@app.command()
def zones(
    update: Annotated[bool, typer.Option("--update", help="Fetch latest conflict zone data")] = False,
) -> None:
    """Display active conflict zones."""
    from skyroute import display
    from skyroute.safety import load_zones, save_cached_zones

    if update:
        import urllib.request

        url = "https://raw.githubusercontent.com/buildingopen/opensky/master/src/skyroute/data/conflict_zones.json"
        console.print(f"Fetching from {url}...")
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = resp.read().decode()
            save_cached_zones(data)
            console.print("[green]Conflict zone data updated.[/green]")
        except Exception as e:
            console.print(f"[red]Update failed: {e}[/red]")
            console.print("Using bundled data instead.")

    zone_list = load_zones(force_bundled=not update)
    display.zones_table(zone_list)


@app.command()
def demo(
    show_risky: Annotated[bool, typer.Option("--show-risky")] = False,
    json_output: Annotated[bool, typer.Option("--json")] = False,
    csv_output: Annotated[bool, typer.Option("--csv")] = False,
) -> None:
    """Show example output using bundled fixture data (no API calls needed)."""
    import json
    from importlib import resources

    from skyroute import display
    from skyroute._vendor.google_flights import SearchFlights
    from skyroute.models import RiskLevel
    from skyroute.providers.google import _convert_result
    from skyroute.search import SearchEngine

    # Load bundled fixture
    fixture_path = resources.files("skyroute") / "data" / "demo_flights.json"
    flights_data = json.loads(fixture_path.read_text())
    parsed = SearchFlights._deduplicate(
        [SearchFlights._parse_flight(f) for f in flights_data]
    )
    domain_results = [_convert_result(f, "EUR") for f in parsed]

    # Score through the real engine (safety filtering, scoring)
    engine = SearchEngine(currency="EUR", use_cache=False)
    from unittest.mock import MagicMock
    mock_provider = MagicMock()
    mock_provider.name = "google"
    mock_provider.search.return_value = domain_results
    engine._providers = [mock_provider]

    all_results = engine.search_scored(
        "BLR", "HAM", "2026-03-10", risk_threshold=None,
    )
    engine.close()

    safe = [sf for sf in all_results if sf.risk.risk_level < RiskLevel.HIGH_RISK]
    risky = [sf for sf in all_results if sf.risk.risk_level >= RiskLevel.HIGH_RISK]
    results = all_results if show_risky else safe

    if not results:
        console.print("[dim]No flights to show.[/dim]")
        raise typer.Exit()

    results.sort(key=lambda x: x.score)

    if json_output:
        print(display.flights_json(results))
    elif csv_output:
        print(display.flights_csv(results))
    else:
        console.print("[dim]Demo: BLR -> HAM, 2026-03-10 (bundled fixture data, no API calls)[/dim]\n")
        display.flights_table(results, title="Flight Results (Demo)")
        if not show_risky and risky:
            console.print(
                f"[dim]{len(safe)} safe flights shown "
                f"({len(risky)} risky hidden, use --show-risky)[/dim]"
            )


@app.command(name="cache")
def cache_cmd(
    action: Annotated[str, typer.Argument(help="Action: clear | stats")] = "stats",
) -> None:
    """Manage the search cache."""
    from skyroute import cache as cache_mod

    if action == "clear":
        cache_mod.clear()
        console.print("Cache cleared.")
    elif action == "stats":
        s = cache_mod.stats()
        console.print(f"Entries: {s['size']}")
        console.print(f"Directory: {s['directory']}")
        console.print(f"Size: {s['volume'] / 1024:.1f} KB")
    else:
        console.print(f"[red]Unknown action: {action}. Use 'clear' or 'stats'.[/red]")


@app.command(name="config")
def config_cmd(
    action: Annotated[str, typer.Argument(help="Action: init")] = "init",
    output: Annotated[str, typer.Option("--output", "-o")] = "scan.toml",
) -> None:
    """Generate example config files."""
    from skyroute.config import EXAMPLE_CONFIG

    if action == "init":
        p = Path(output)
        if p.exists():
            console.print(f"[yellow]{output} already exists. Overwrite? (use -o to specify different path)[/yellow]")
            raise typer.Exit(1)
        p.write_text(EXAMPLE_CONFIG)
        console.print(f"Created {output}")
    else:
        console.print(f"[red]Unknown action: {action}. Use 'init'.[/red]")
