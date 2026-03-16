"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  zones: Array<{ id: string; name: string; risk_level: string }>;
}

export function ZoneAlertForm({ zones }: Props) {
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === zones.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(zones.map((z) => z.id)));
    }
  };

  const submit = async () => {
    if (!email || selected.size === 0) return;
    setStatus("loading");
    try {
      const res = await fetch(`${API_URL}/api/zone-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, zones: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.detail || "Something went wrong.");
        return;
      }
      setStatus("success");
      setMessage(data.message);
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <svg className="w-5 h-5 text-[var(--color-safe)] shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          {message}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            Get notified when risk levels change
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Select zones to monitor. We&apos;ll email you when their status changes.
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[var(--color-accent)] hover:underline shrink-0 ml-4"
        >
          {expanded ? "Collapse" : "Subscribe"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 animate-fade-in">
          {/* Zone selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                Zones ({selected.size}/{zones.length})
              </span>
              <button
                onClick={selectAll}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                {selected.size === zones.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {zones.map((zone) => {
                const isSelected = selected.has(zone.id);
                return (
                  <button
                    key={zone.id}
                    onClick={() => toggle(zone.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      isSelected
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]"
                    }`}
                  >
                    {zone.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email + submit */}
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
            />
            <button
              onClick={submit}
              disabled={!email || selected.size === 0 || status === "loading"}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            >
              {status === "loading" ? "..." : "Subscribe"}
            </button>
          </div>

          {status === "error" && (
            <p className="text-xs text-[var(--color-danger)]">{message}</p>
          )}
        </div>
      )}
    </div>
  );
}
