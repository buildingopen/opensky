export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">Terms of Use</h1>
      <div className="mt-8 space-y-4 text-sm text-[var(--color-text-muted)]">
        <p>
          FlyFast is provided as-is for informational purposes. Flight prices, routes, and safety information can change
          rapidly and should be verified before booking.
        </p>
        <p>
          You agree not to abuse the service, bypass rate limits, or use automated scraping that affects service
          availability for other users.
        </p>
        <p>
          FlyFast is not a substitute for official government travel advisories, airline notices, or regulatory guidance.
        </p>
      </div>
    </main>
  );
}
