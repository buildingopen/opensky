export default function ContactPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">Contact</h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        Questions, bug reports, or partnership ideas are welcome. We typically respond within 48 hours.
      </p>
      <div className="mt-8 space-y-3 text-sm text-[var(--color-text-muted)]">
        <p>
          Email: <a className="text-[var(--color-accent)] hover:underline" href="mailto:hello@buildingopen.org">hello@buildingopen.org</a>
        </p>
        <p>
          GitHub issues: <a className="text-[var(--color-accent)] hover:underline" href="https://github.com/buildingopen/opensky-app/issues" target="_blank" rel="noopener noreferrer">buildingopen/opensky-app</a>
        </p>
      </div>
    </main>
  );
}
