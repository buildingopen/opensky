import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AirportAutocomplete } from "../AirportAutocomplete";

function renderAutocomplete(overrides = {}) {
  const props = {
    id: "from",
    label: "FROM",
    placeholder: "JFK, London...",
    value: "",
    onChange: vi.fn(),
    ...overrides,
  };
  const result = render(<AirportAutocomplete {...props} />);
  return { ...result, onChange: props.onChange };
}

describe("AirportAutocomplete", () => {
  it("renders label and input", () => {
    renderAutocomplete();
    expect(screen.getByLabelText("FROM")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("JFK, London...")).toBeInTheDocument();
  });

  it("has combobox role and ARIA attributes", () => {
    renderAutocomplete();
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveAttribute("aria-controls", "from-listbox");
  });

  it("shows dropdown when typing a matching query", async () => {
    const user = userEvent.setup();
    renderAutocomplete();
    const input = screen.getByRole("combobox");
    await user.type(input, "JFK");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("JFK")).toBeInTheDocument();
  });

  it("filters by city name", async () => {
    const user = userEvent.setup();
    renderAutocomplete();
    await user.type(screen.getByRole("combobox"), "london");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    // Should show London airports (LHR, LGW, STN, LTN)
    expect(screen.getByText("LHR")).toBeInTheDocument();
  });

  it("selects airport on click", async () => {
    const user = userEvent.setup();
    const { onChange } = renderAutocomplete();
    await user.type(screen.getByRole("combobox"), "JFK");
    // Find the option and click it
    const options = screen.getAllByRole("option");
    await user.click(options[0]);
    expect(onChange).toHaveBeenCalledWith("JFK");
  });

  it("navigates with arrow keys and selects with Enter", async () => {
    const user = userEvent.setup();
    const { onChange } = renderAutocomplete();
    const input = screen.getByRole("combobox");
    await user.type(input, "JFK");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("JFK");
  });

  it("closes dropdown on Escape", async () => {
    const user = userEvent.setup();
    renderAutocomplete();
    const input = screen.getByRole("combobox");
    await user.type(input, "JFK");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("limits results to 8 matches", async () => {
    const user = userEvent.setup();
    renderAutocomplete();
    // "a" matches many airports
    await user.type(screen.getByRole("combobox"), "a");
    const options = screen.getAllByRole("option");
    expect(options.length).toBeLessThanOrEqual(8);
  });

  it("shows no dropdown for empty input", async () => {
    const user = userEvent.setup();
    renderAutocomplete();
    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("respects disabled prop", () => {
    renderAutocomplete({ disabled: true });
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
