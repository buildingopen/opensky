"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function SiteHeader() {
  const [gitHubStars, setGitHubStars] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/github-stars")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stars != null) setGitHubStars(d.stars);
      })
      .catch(() => {});
  }, []);

  // Lock body scroll when menu open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const navLinks = [
    { href: "/methodology", label: "How it works" },
    { href: "/safety", label: "Safety" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <header className="border-b border-[var(--color-border)]">
      <div className="max-w-[min(64rem,92vw)] mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
            <path d="M4 6L17 6L28 15L13 15Z" fill="var(--color-accent)" />
            <path d="M4 26L13 17L28 17L17 26Z" fill="var(--color-accent)" opacity="0.45" />
          </svg>
          <span className="text-lg font-semibold tracking-tight">
            <span className="text-[var(--color-accent)]">fly</span><span className="text-[var(--color-text)]">fast</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
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

        {/* Mobile hamburger button */}
        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile slide-in panel */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity"
            onClick={() => setMenuOpen(false)}
          />
          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-64 bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-xl flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
                  <path d="M4 6L17 6L28 15L13 15Z" fill="var(--color-accent)" />
                  <path d="M4 26L13 17L28 17L17 26Z" fill="var(--color-accent)" opacity="0.45" />
                </svg>
                <span className="text-lg font-semibold tracking-tight">
                  <span className="text-[var(--color-accent)]">fly</span><span className="text-[var(--color-text)]">fast</span>
                </span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                aria-label="Close menu"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col py-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="https://github.com/buildingopen/opensky"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors inline-flex items-center gap-1.5"
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
        </div>
      )}
    </header>
  );
}
