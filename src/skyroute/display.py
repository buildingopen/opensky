from __future__ import annotations

import csv
import io
import json

from rich.console import Console
from rich.progress import BarColumn, MofNCompleteColumn, Progress, TextColumn, TimeRemainingColumn
from rich.table import Table

from skyroute.models import ConflictZone, RiskLevel, ScoredFlight

console = Console()

RISK_COLORS = {
    RiskLevel.SAFE: "green",
    RiskLevel.CAUTION: "yellow",
    RiskLevel.HIGH_RISK: "red",
    RiskLevel.DO_NOT_FLY: "bold red",
}

RISK_ICONS = {
    RiskLevel.SAFE: "OK",
    RiskLevel.CAUTION: "!",
    RiskLevel.HIGH_RISK: "!!",
    RiskLevel.DO_NOT_FLY: "XXX",
}


def format_duration(minutes: int) -> str:
    h, m = divmod(minutes, 60)
    return f"{h}h {m}m" if m else f"{h}h"


def format_price(price: float, currency: str) -> str:
    if price <= 0:
        return "N/A"
    symbols = {"EUR": "\u20ac", "USD": "$", "GBP": "\u00a3", "INR": "\u20b9"}
    sym = symbols.get(currency, currency + " ")
    return f"{sym}{price:,.0f}"


def _format_flight_numbers(legs: list) -> str:
    return ", ".join(f"{leg.airline}{leg.flight_number}" for leg in legs)


def flights_table(
    flights: list[ScoredFlight],
    title: str = "Flight Results",
    show_count: bool = True,
) -> None:
    if not flights:
        console.print("[dim]No flights found matching criteria.[/dim]")
        return

    # Check if all flights share the same date (single search vs scan)
    dates = {sf.date for sf in flights}
    show_date = len(dates) > 1

    # Show source column when results come from multiple providers
    providers = {sf.flight.provider for sf in flights if sf.flight.provider}
    show_source = len(providers) > 1

    table = Table(title=title, show_lines=False, pad_edge=False)
    table.add_column("Price", justify="right", style="bold")
    table.add_column("Duration", justify="right")
    table.add_column("Stops", justify="center")
    if show_date:
        table.add_column("Date")
    table.add_column("Route")
    table.add_column("Flights", style="dim")
    if show_source:
        table.add_column("Source", style="dim")
    table.add_column("Safety", justify="center")

    for sf in flights:
        risk_color = RISK_COLORS[sf.risk.risk_level]
        risk_text = RISK_ICONS[sf.risk.risk_level]
        safety_cell = f"[{risk_color}]{risk_text}[/{risk_color}]"

        if sf.risk.flagged_airports:
            flagged = ", ".join(a.code for a in sf.risk.flagged_airports)
            safety_cell += f" [dim]({flagged})[/dim]"

        transit_note = ""
        if sf.transit_hours > 0:
            transit_note = f" [dim]+{sf.transit_hours:.1f}h[/dim]"

        flights_col = _format_flight_numbers(sf.flight.legs)

        row = [
            format_price(sf.flight.price, sf.flight.currency),
            format_duration(sf.flight.duration_minutes) + transit_note,
            str(sf.flight.stops),
        ]
        if show_date:
            row.append(sf.date)
        row += [sf.route, flights_col]
        if show_source:
            row.append(sf.flight.provider or "-")
        row.append(safety_cell)
        table.add_row(*row)

    console.print(table)
    if show_count:
        console.print(f"\n[dim]{len(flights)} flights shown[/dim]")


def flights_json(flights: list[ScoredFlight]) -> str:
    return json.dumps(
        [sf.model_dump() for sf in flights],
        indent=2,
        default=str,
    )


def flights_csv(flights: list[ScoredFlight]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "price", "currency", "duration_min", "stops", "date",
        "origin", "destination", "route", "flights",
        "provider", "risk_level", "score",
    ])
    for sf in flights:
        writer.writerow([
            sf.flight.price,
            sf.flight.currency,
            sf.flight.duration_minutes,
            sf.flight.stops,
            sf.date,
            sf.origin,
            sf.destination,
            sf.route,
            _format_flight_numbers(sf.flight.legs),
            sf.flight.provider,
            sf.risk.risk_level.value,
            f"{sf.score:.1f}",
        ])
    return buf.getvalue()


def _scan_stats(flights: list[ScoredFlight], currency: str) -> None:
    if not flights:
        console.print("[dim]No flights found.[/dim]")
        return

    destinations = {sf.destination for sf in flights}
    origins = {sf.origin for sf in flights}
    dates = {sf.date for sf in flights}
    priced = [sf.flight.price for sf in flights if sf.flight.price > 0]

    parts = [
        f"[bold]{len(flights)}[/bold] flights across",
        f"[bold]{len(destinations)}[/bold] destinations,",
        f"[bold]{len(origins)}[/bold] origins,",
        f"[bold]{len(dates)}[/bold] dates.",
    ]
    if priced:
        lo_val, hi_val = min(priced), max(priced)
        lo = format_price(lo_val, currency)
        if lo_val == hi_val:
            parts.append(f"Price: {lo}")
        else:
            hi = format_price(hi_val, currency)
            parts.append(f"Price range: {lo}-{hi}")

    console.print(" ".join(parts))


def _best_per_destination(flights: list[ScoredFlight]) -> None:
    if not flights:
        return

    best: dict[str, ScoredFlight] = {}
    for sf in flights:
        if sf.destination not in best or sf.score < best[sf.destination].score:
            best[sf.destination] = sf

    table = Table(title="Best per Destination", show_lines=False, pad_edge=False)
    table.add_column("Dest", style="bold")
    table.add_column("Price", justify="right")
    table.add_column("Date")
    table.add_column("Duration", justify="right")
    table.add_column("Route")
    table.add_column("Safety", justify="center")

    for dest in sorted(best):
        sf = best[dest]
        risk_color = RISK_COLORS[sf.risk.risk_level]
        risk_text = RISK_ICONS[sf.risk.risk_level]
        safety_cell = f"[{risk_color}]{risk_text}[/{risk_color}]"

        transit_note = ""
        if sf.transit_hours > 0:
            transit_note = f" [dim]+{sf.transit_hours:.1f}h[/dim]"

        table.add_row(
            dest,
            format_price(sf.flight.price, sf.flight.currency),
            sf.date,
            format_duration(sf.flight.duration_minutes) + transit_note,
            sf.route,
            safety_cell,
        )

    console.print(table)


def _date_matrix(flights: list[ScoredFlight], currency: str, max_dates: int = 14) -> None:
    priced = [sf for sf in flights if sf.flight.price > 0]
    if not priced:
        return

    destinations = sorted({sf.destination for sf in priced})
    dates = sorted({sf.date for sf in priced})

    if not destinations or not dates:
        return

    truncated = len(dates) > max_dates
    if truncated:
        dates = dates[:max_dates]

    # Build cheapest price lookup: (dest, date) -> price
    cheapest: dict[tuple[str, str], float] = {}
    for sf in priced:
        key = (sf.destination, sf.date)
        if key not in cheapest or sf.flight.price < cheapest[key]:
            cheapest[key] = sf.flight.price

    # Find cheapest date per destination for highlighting
    best_per_dest: dict[str, float] = {}
    for (dest, _dt), price in cheapest.items():
        if dest not in best_per_dest or price < best_per_dest[dest]:
            best_per_dest[dest] = price

    # Shorten date headers to MM-DD
    short_dates = [d[5:] for d in dates]

    table = Table(title="Price by Destination / Date", show_lines=False, pad_edge=False)
    table.add_column("Dest", style="bold")
    for sd in short_dates:
        table.add_column(sd, justify="right")

    sym = {"EUR": "\u20ac", "USD": "$", "GBP": "\u00a3", "INR": "\u20b9"}.get(currency, currency + " ")

    for dest in destinations:
        row = [dest]
        for dt in dates:
            price = cheapest.get((dest, dt))
            if price is None:
                row.append("[dim]-[/dim]")
            elif price == best_per_dest.get(dest):
                row.append(f"[green bold]{sym}{price:,.0f}[/green bold]")
            else:
                row.append(f"{sym}{price:,.0f}")
        table.add_row(*row)

    console.print(table)
    note = f"[dim]Prices in {currency}. Green = cheapest date per destination."
    if truncated:
        note += f" Showing first {max_dates} dates."
    note += "[/dim]"
    console.print(note)


def _top_flights(flights: list[ScoredFlight], n: int = 10) -> None:
    flights_table(flights[:n], title=f"Top {min(n, len(flights))} Flights", show_count=False)


def scan_summary(flights: list[ScoredFlight], currency: str) -> None:
    if not flights:
        console.print("[dim]No flights found matching criteria.[/dim]")
        return

    _scan_stats(flights, currency)
    console.print()
    _best_per_destination(flights)
    console.print()
    _date_matrix(flights, currency)
    console.print()
    _top_flights(flights)


def zones_table(zones: list[ConflictZone]) -> None:
    table = Table(title="Active Conflict Zones", show_lines=False, pad_edge=False)
    table.add_column("Zone", style="bold")
    table.add_column("Risk Level", justify="center")
    table.add_column("Countries")
    table.add_column("Airports")
    table.add_column("Source", style="dim")
    table.add_column("Updated", style="dim")

    for zone in sorted(zones, key=lambda z: (-z.risk_level.severity, z.name)):
        rl = zone.risk_level
        color = RISK_COLORS[rl]
        table.add_row(
            zone.name,
            f"[{color}]{rl.value.upper()}[/{color}]",
            ", ".join(zone.countries) if zone.countries else "-",
            ", ".join(zone.airports[:8]) + ("..." if len(zone.airports) > 8 else "") if zone.airports else "-",
            zone.source,
            zone.updated,
        )

    console.print(table)


def scan_progress() -> Progress:
    return Progress(
        TextColumn("[bold]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TextColumn("[dim]errors: {task.fields[errors]}"),
        TimeRemainingColumn(),
        console=console,
    )
