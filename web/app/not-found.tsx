import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <svg viewBox="0 0 32 32" className="w-12 h-12 mb-6" fill="none">
        <path d="M9 27V11L15 4" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" opacity={0.3} />
        <path d="M19 27V11L25 4" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" opacity={0.3} />
        <line x1="4" y1="15" x2="26" y2="15" stroke="var(--color-accent)" strokeWidth="2.8" strokeLinecap="square" opacity={0.3} />
      </svg>
      <h1 className="text-5xl font-bold tracking-tight text-[var(--color-text)] mb-3">404</h1>
      <p className="text-lg text-[var(--color-text-muted)] mb-8">
        This route doesn&apos;t exist. Maybe it was rerouted.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black font-medium px-5 py-2.5 rounded-lg transition-colors"
      >
        <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none">
          <path d="M9 27V11L15 4" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M19 27V11L25 4" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square" strokeLinejoin="miter" />
          <line x1="4" y1="15" x2="26" y2="15" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square" />
        </svg>
        Search flights
      </Link>
    </main>
  );
}
