"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function SiteHeader() {
  const [gitHubStars, setGitHubStars] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/github-stars")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stars != null) setGitHubStars(d.stars);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="border-b border-[var(--color-border)]">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--color-accent)]" fill="currentColor">
            <path d="M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 2.59 4.49L21 11.49c.81-.23 1.28-1.05 1.07-1.85z" />
          </svg>
          <span className="text-lg font-semibold">
            <span className="text-[var(--color-accent)]">fly</span>fast
          </span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-4 text-sm">
          <Link
            href="/methodology"
            className="hidden sm:inline text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            How it works
          </Link>
          <Link
            href="/contact"
            className="hidden sm:inline text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Contact
          </Link>
          <a
            href="https://github.com/buildingopen/opensky"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors inline-flex items-center gap-1.5"
          >
            GitHub
            {gitHubStars !== null && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-[var(--color-surface-2)] border border-[var(--color-border)] px-1.5 py-0.5 rounded-full tabular-nums text-[var(--color-text-muted)]">
                <svg viewBox="0 0 16 16" className="w-3 h-3 fill-[var(--color-caution)]">
                  <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
                </svg>
                {gitHubStars}
              </span>
            )}
          </a>
        </nav>
      </div>
    </header>
  );
}
