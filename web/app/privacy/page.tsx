import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - FlyFast",
  description: "FlyFast privacy policy. How we handle search data, analytics, and third-party flight providers. No personal data is sold.",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">Privacy Policy</h1>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">Last updated: March 2026</p>
      <p className="mt-4 text-[var(--color-text-muted)]">
        FlyFast is built by <a className="text-[var(--color-accent)] hover:underline" href="https://buildingopen.org" target="_blank" rel="noopener noreferrer">Building Open</a>.
        We collect only what is necessary to operate the service and prevent abuse. We do not sell personal data.
      </p>

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text-muted)]">

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">What we collect</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li><span className="text-[var(--color-text)] font-medium">Search queries</span> -- your natural language prompts are sent to our backend to parse and search flights. We do not store queries long-term.</li>
            <li><span className="text-[var(--color-text)] font-medium">Usage analytics</span> -- anonymized page views, search counts, and error rates via PostHog. No personally identifiable information is tracked.</li>
            <li><span className="text-[var(--color-text)] font-medium">Rate limiting data</span> -- your IP address is used server-side to enforce the 10 searches per hour limit. It is not stored or shared.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">What we do not collect</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>No account registration, no login, no passwords</li>
            <li>No cookies for advertising or cross-site tracking</li>
            <li>No payment or financial information (FlyFast does not sell tickets)</li>
            <li>No location data beyond what you type in your search</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Third-party services</h2>
          <p>FlyFast uses the following external services to operate:</p>
          <ul className="mt-2 space-y-2 list-disc list-inside">
            <li><span className="text-[var(--color-text)] font-medium">Google Flights</span> -- flight data provider. Your search parameters (origins, destinations, dates) are sent to retrieve flight results.</li>
            <li><span className="text-[var(--color-text)] font-medium">Google Gemini</span> -- AI service for parsing natural language queries into structured search parameters.</li>
            <li><span className="text-[var(--color-text)] font-medium">PostHog</span> -- privacy-focused analytics. EU-hosted. No personal data is sent.</li>
            <li><span className="text-[var(--color-text)] font-medium">Vercel</span> -- hosting provider for the web application.</li>
          </ul>
          <p className="mt-2">Each service processes data under its own privacy policy. We recommend reviewing their terms if you have concerns.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Data retention</h2>
          <p>
            Search queries are processed in real time and not stored after the response is sent.
            Anonymized analytics data is retained for up to 12 months. Rate limiting data expires automatically.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Your rights</h2>
          <p>
            You can request access to, correction of, or deletion of any data we hold about you.
            Contact <a className="text-[var(--color-accent)] hover:underline" href="mailto:hello@buildingopen.org">hello@buildingopen.org</a> with your request.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Open source</h2>
          <p>
            FlyFast is open source. You can inspect exactly what data the application collects by reviewing the code at{" "}
            <a className="text-[var(--color-accent)] hover:underline" href="https://github.com/buildingopen/opensky" target="_blank" rel="noopener noreferrer">github.com/buildingopen/opensky</a>.
          </p>
        </div>
      </section>

    </main>
  );
}
