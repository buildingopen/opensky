import { fireEvent, render, screen } from "@testing-library/react";
import Home from "../app/page";

describe("home page", () => {
  it("renders key product messaging", () => {
    render(<Home />);
    expect(screen.getByText(/Find the safest practical/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Search/ })).toBeInTheDocument();
  });

  it("enables search in natural language mode after typing", () => {
    render(<Home />);
    fireEvent.click(screen.getByText("Describe your trip instead"));
    const input = screen.getByLabelText("Describe your trip in plain English");
    fireEvent.change(input, { target: { value: "JFK to LHR next week" } });
    expect(screen.getByRole("button", { name: /Search/ })).toBeEnabled();
  });
});
