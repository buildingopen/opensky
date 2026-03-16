import Link from "next/link";

const ZONES_UPDATED_AT = process.env.NEXT_PUBLIC_ZONES_UPDATED_AT || "March 2026";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-auto">
      <div className="max-w-[min(64rem,92vw)] mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[var(--color-text-muted)]">
        <span>
          Built by{" "}
          <a href="https://buildingopen.org" className="text-[var(--color-text)] hover:text-[var(--color-accent)]">
            Building Open
          </a>
        </span>
        <div className="flex flex-col sm:items-end gap-2">
          <span>Conflict zones updated {ZONES_UPDATED_AT}. Decision support, not official travel advice.</span>
          <span className="flex flex-wrap justify-center gap-3">
            <Link href="/privacy" className="hover:text-[var(--color-text)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--color-text)]">Terms</Link>
            <Link href="/methodology" className="hover:text-[var(--color-text)]">Methodology</Link>
            <Link href="/contact" className="hover:text-[var(--color-text)]">Contact</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
