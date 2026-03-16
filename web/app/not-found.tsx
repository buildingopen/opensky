import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <svg viewBox="0 0 24 24" className="w-12 h-12 mb-6" fill="none">
        <path d="M3 12l9-8v5h8l-9 8v-5H3z" fill="var(--color-accent)" opacity={0.3} />
      </svg>
      <h1 className="text-5xl font-bold tracking-tight text-[var(--color-text)] mb-3">404</h1>
      <p className="text-lg text-[var(--color-text-muted)] mb-8">
        This route doesn&apos;t exist. Maybe it was rerouted.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-black font-medium px-5 py-2.5 rounded-lg transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
          <path d="M3 12l9-8v5h8l-9 8v-5H3z" fill="currentColor" />
        </svg>
        Search flights
      </Link>
    </main>
  );
}
