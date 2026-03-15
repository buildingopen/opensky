import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderHook, act } from "@testing-library/react";
import { useSavedSearches, SavedSearchesList } from "../SavedSearches";

beforeEach(() => {
  localStorage.clear();
});

describe("useSavedSearches", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useSavedSearches());
    expect(result.current.searches).toEqual([]);
  });

  it("saves a search", () => {
    const { result } = renderHook(() => useSavedSearches());
    act(() => result.current.save("JFK to London"));
    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0].query).toBe("JFK to London");
  });

  it("deduplicates searches, moving repeated query to top", () => {
    const { result } = renderHook(() => useSavedSearches());
    act(() => result.current.save("JFK to London"));
    act(() => result.current.save("LAX to Tokyo"));
    act(() => result.current.save("JFK to London"));
    expect(result.current.searches).toHaveLength(2);
    expect(result.current.searches[0].query).toBe("JFK to London");
  });

  it("caps at 10 items", () => {
    const { result } = renderHook(() => useSavedSearches());
    for (let i = 0; i < 15; i++) {
      act(() => result.current.save(`search ${i}`));
    }
    expect(result.current.searches).toHaveLength(10);
    expect(result.current.searches[0].query).toBe("search 14");
  });

  it("ignores empty/whitespace queries", () => {
    const { result } = renderHook(() => useSavedSearches());
    act(() => result.current.save(""));
    act(() => result.current.save("   "));
    expect(result.current.searches).toHaveLength(0);
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useSavedSearches());
    act(() => result.current.save("JFK to London"));
    const stored = JSON.parse(localStorage.getItem("flyfast_history")!);
    expect(stored).toHaveLength(1);
    expect(stored[0].query).toBe("JFK to London");
  });

  it("clears all searches", () => {
    const { result } = renderHook(() => useSavedSearches());
    act(() => result.current.save("JFK to London"));
    act(() => result.current.clear());
    expect(result.current.searches).toEqual([]);
    expect(localStorage.getItem("flyfast_history")).toBeNull();
  });

  it("loads from localStorage on mount", () => {
    const data = [{ query: "SFO to Paris", timestamp: 1000 }];
    localStorage.setItem("flyfast_history", JSON.stringify(data));
    const { result } = renderHook(() => useSavedSearches());
    // useEffect runs after render, so we need to wait
    expect(result.current.searches).toEqual(data);
  });
});

describe("SavedSearchesList", () => {
  it("renders nothing when no searches", () => {
    const { container } = render(
      <SavedSearchesList searches={[]} onSelect={() => {}} onClear={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders search pills", () => {
    const searches = [
      { query: "JFK to London", timestamp: 1 },
      { query: "LAX to Tokyo", timestamp: 2 },
    ];
    render(<SavedSearchesList searches={searches} onSelect={() => {}} onClear={() => {}} />);
    expect(screen.getByText("JFK to London")).toBeInTheDocument();
    expect(screen.getByText("LAX to Tokyo")).toBeInTheDocument();
    expect(screen.getByText("Recent searches")).toBeInTheDocument();
  });

  it("calls onSelect when pill clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SavedSearchesList
        searches={[{ query: "JFK to London", timestamp: 1 }]}
        onSelect={onSelect}
        onClear={() => {}}
      />,
    );
    await user.click(screen.getByText("JFK to London"));
    expect(onSelect).toHaveBeenCalledWith("JFK to London");
  });

  it("calls onClear when Clear clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <SavedSearchesList
        searches={[{ query: "test", timestamp: 1 }]}
        onSelect={() => {}}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByLabelText("Clear search history"));
    expect(onClear).toHaveBeenCalled();
  });

  it("has aria-labels on search pills", () => {
    render(
      <SavedSearchesList
        searches={[{ query: "JFK to London", timestamp: 1 }]}
        onSelect={() => {}}
        onClear={() => {}}
      />,
    );
    expect(screen.getByLabelText("Search: JFK to London")).toBeInTheDocument();
  });
});
