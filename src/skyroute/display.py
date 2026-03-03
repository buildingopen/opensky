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
) -> None:
    if not flights:
        console.print("[dim]No flights found matching criteria.[/dim]")
        return

    # Check if all flights share the same date (single search vs scan)
    dates = {sf.date for sf in flights}
    show_date = len(dates) > 1

    table = Table(title=title, show_lines=False, pad_edge=False)
    table.add_column("Price", justify="right", style="bold")
    table.add_column("Duration", justify="right")
    table.add_column("Stops", justify="center")
    if show_date:
        table.add_column("Date")
    table.add_column("Route")
    table.add_column("Flights", style="dim")
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
        row += [sf.route, flights_col, safety_cell]
        table.add_row(*row)

    console.print(table)
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
        "origin", "destination", "route", "risk_level", "score",
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
            sf.risk.risk_level.value,
            f"{sf.score:.1f}",
        ])
    return buf.getvalue()


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
