import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { useAirlineFilter, AirlineFilterChips, airlineName, AIRLINE_NAMES } from "../AirlineFilter";

const flights = [
  { legs: [{ airline: "BA" }], price: 400 },
  { legs: [{ airline: "LH" }], price: 350 },
  { legs: [{ airline: "BA" }, { airline: "AA" }], price: 500 },
  { legs: [{ airline: "FR" }], price: 100 },
];

describe("airlineName", () => {
  it("returns full name for known codes", () => {
    expect(airlineName("BA")).toBe("British Airways");
    expect(airlineName("LH")).toBe("Lufthansa");
  });

  it("returns code as-is for unknown codes", () => {
    expect(airlineName("XX")).toBe("XX");
  });
});

describe("AIRLINE_NAMES", () => {
  it("has entries for major airlines", () => {
    expect(Object.keys(AIRLINE_NAMES).length).toBeGreaterThan(30);
    expect(AIRLINE_NAMES["AA"]).toBe("American");
    expect(AIRLINE_NAMES["DL"]).toBe("Delta");
  });
});

describe("useAirlineFilter", () => {
  it("extracts sorted unique airlines, excluding ZZ", () => {
    const flightsWithZZ = [...flights, { legs: [{ airline: "ZZ" }], price: 0 }];
    const { result } = renderHook(() => useAirlineFilter(flightsWithZZ));
    expect(result.current.airlines).toEqual(["AA", "BA", "FR", "LH"]);
  });

  it("returns all flights when nothing selected", () => {
    const { result } = renderHook(() => useAirlineFilter(flights));
    expect(result.current.filtered).toHaveLength(4);
    expect(result.current.selected.size).toBe(0);
  });

  it("filters flights after toggling an airline", () => {
    const { result } = renderHook(() => useAirlineFilter(flights));
    act(() => result.current.toggle("BA"));
    // BA appears in flight 0 (single leg) and flight 2 (multi-leg)
    expect(result.current.filtered).toHaveLength(2);
    expect(result.current.selected.has("BA")).toBe(true);
  });

  it("toggle off deselects airline", () => {
    const { result } = renderHook(() => useAirlineFilter(flights));
    act(() => result.current.toggle("BA"));
    expect(result.current.filtered).toHaveLength(2);
    act(() => result.current.toggle("BA"));
    expect(result.current.filtered).toHaveLength(4);
  });

  it("clearFilter resets selection", () => {
    const { result } = renderHook(() => useAirlineFilter(flights));
    act(() => result.current.toggle("BA"));
    act(() => result.current.toggle("FR"));
    expect(result.current.selected.size).toBe(2);
    act(() => result.current.clearFilter());
    expect(result.current.selected.size).toBe(0);
    expect(result.current.filtered).toHaveLength(4);
  });
});

describe("AirlineFilterChips", () => {
  it("renders nothing when only 1 airline", () => {
    const { container } = render(
      <AirlineFilterChips
        airlines={["BA"]}
        selected={new Set()}
        toggle={() => {}}
        clearFilter={() => {}}
        totalCount={1}
        filteredCount={1}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders chips for multiple airlines", () => {
    render(
      <AirlineFilterChips
        airlines={["BA", "LH", "FR"]}
        selected={new Set()}
        toggle={() => {}}
        clearFilter={() => {}}
        totalCount={3}
        filteredCount={3}
      />,
    );
    expect(screen.getByText("British Airways")).toBeInTheDocument();
    expect(screen.getByText("Lufthansa")).toBeInTheDocument();
    expect(screen.getByText("Ryanair")).toBeInTheDocument();
  });

  it("shows count and Clear button when filter active", () => {
    render(
      <AirlineFilterChips
        airlines={["BA", "LH"]}
        selected={new Set(["BA"])}
        toggle={() => {}}
        clearFilter={() => {}}
        totalCount={5}
        filteredCount={2}
      />,
    );
    expect(screen.getByText("Showing 2 of 5 flights")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("calls toggle when chip clicked", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    render(
      <AirlineFilterChips
        airlines={["BA", "LH"]}
        selected={new Set()}
        toggle={toggle}
        clearFilter={() => {}}
        totalCount={2}
        filteredCount={2}
      />,
    );
    await user.click(screen.getByText("British Airways"));
    expect(toggle).toHaveBeenCalledWith("BA");
  });

  it("sets aria-pressed on selected chips", () => {
    render(
      <AirlineFilterChips
        airlines={["BA", "LH"]}
        selected={new Set(["BA"])}
        toggle={() => {}}
        clearFilter={() => {}}
        totalCount={2}
        filteredCount={1}
      />,
    );
    expect(screen.getByText("British Airways").closest("button")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Lufthansa").closest("button")).toHaveAttribute("aria-pressed", "false");
  });
});
