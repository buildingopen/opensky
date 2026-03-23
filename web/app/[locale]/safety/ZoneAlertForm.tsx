"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const API_URL = "";

interface Props {
  zones: Array<{ id: string; name: string; risk_level: string }>;
}

export function ZoneAlertForm({ zones }: Props) {
  const t = useTranslations("safety.alerts");
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
        setMessage(data.detail || t("error"));
        return;
      }
      setStatus("success");
      setMessage(data.message);
    } catch {
      setStatus("error");
      setMessage(t("networkError"));
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
            {t("title")}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[var(--color-interactive)] hover:underline shrink-0 ml-4"
        >
          {expanded ? t("collapse") : t("subscribe")}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 animate-fade-in">
          {/* Zone selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">
                {t("zones", { selected: selected.size, total: zones.length })}
              </span>
              <button
                onClick={selectAll}
                className="text-xs text-[var(--color-interactive)] hover:underline"
              >
                {selected.size === zones.length ? t("deselectAll") : t("selectAll")}
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
                        ? "border-[var(--color-interactive)] bg-[var(--color-interactive)]/10 text-[var(--color-interactive)]"
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
              placeholder={t("emailPlaceholder")}
              className="flex-1 min-w-0 text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-interactive)]"
            />
            <button
              onClick={submit}
              disabled={!email || selected.size === 0 || status === "loading"}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-[var(--color-interactive)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            >
              {status === "loading" ? t("loading") : t("subscribe")}
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
