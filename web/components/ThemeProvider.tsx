"use client";

import { createContext, useContext, useCallback, useEffect, useSyncExternalStore } from "react";

type Mode = "light" | "dark" | "system";
type Theme = "light" | "dark";

interface ThemeContextValue {
  mode: Mode;
  theme: Theme;
  setMode: (mode: Mode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  theme: "dark",
  setMode: () => {},
});

const STORAGE_KEY = "flyfast-theme";

function getStoredMode(): Mode {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function resolveTheme(mode: Mode): Theme {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#070b14" : "#f8faff");
}

// Simple external store for mode to avoid unnecessary re-renders
let currentMode: Mode = "system";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return currentMode;
}

function setModeInternal(mode: Mode) {
  currentMode = mode;
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(resolveTheme(mode));
  listeners.forEach((cb) => cb());
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => "system" as Mode);
  const theme = resolveTheme(mode);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = getStoredMode();
    if (stored !== currentMode) {
      currentMode = stored;
      applyTheme(resolveTheme(stored));
      listeners.forEach((cb) => cb());
    }
  }, []);

  // Listen for OS preference changes when in system mode
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (currentMode === "system") {
        applyTheme(resolveTheme("system"));
        listeners.forEach((cb) => cb());
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const setMode = useCallback((m: Mode) => setModeInternal(m), []);

  return (
    <ThemeContext.Provider value={{ mode, theme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
