export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">Privacy Policy</h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        OpenSky stores only the data needed to operate the service, prevent abuse, and improve reliability.
      </p>
      <div className="mt-8 space-y-4 text-sm text-[var(--color-text-muted)]">
        <p>
          We may process your search prompts, route metadata, and anonymized usage analytics to understand feature usage and
          error rates.
        </p>
        <p>
          We do not sell personal data. Third-party flight providers and AI parsing services process requests according to
          their own terms and privacy policies.
        </p>
        <p>
          For data requests or deletion, contact <a className="text-[var(--color-accent)] hover:underline" href="mailto:hello@buildingopen.org">hello@buildingopen.org</a>.
        </p>
      </div>
    </main>
  );
}
