import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact FlyFast",
  description: "Get in touch with the FlyFast team. Report bugs, ask questions, or suggest features for the natural language flight search engine.",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "Is FlyFast free?", acceptedAnswer: { "@type": "Answer", text: "Yes. No login, no ads, no premium tier. You get 10 searches per hour." } },
    { "@type": "Question", name: "Does FlyFast sell tickets?", acceptedAnswer: { "@type": "Answer", text: "No. FlyFast finds and ranks flights. When you click a result, you book directly with the airline or via Google Flights." } },
    { "@type": "Question", name: "How accurate is the conflict zone data?", acceptedAnswer: { "@type": "Answer", text: "The dataset is updated regularly and covers active conflict zones, restricted airspace, and aviation advisories. It may not reflect changes from the last few days. Always check official government advisories before booking." } },
    { "@type": "Question", name: "Can I use FlyFast data in my app?", acceptedAnswer: { "@type": "Answer", text: "The code is open source under the MIT license. For questions or collaboration, email hello@buildingopen.org." } },
  ],
};

export default function ContactPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <h1 className="text-3xl font-bold text-[var(--color-text)]">Contact</h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        FlyFast is built by <a className="text-[var(--color-accent)] hover:underline" href="https://buildingopen.org" target="_blank" rel="noopener noreferrer">Building Open</a>, a small team focused on open source travel tools.
        We read every message and typically respond within 48 hours.
      </p>

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text-muted)]">

        {/* Get in touch */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">Get in touch</h2>
          <div className="space-y-4">
            <div className="bg-[var(--color-surface-2)] rounded-lg p-4">
              <p className="text-[var(--color-text)] font-medium">General questions and feedback</p>
              <p className="mt-1">
                Email us at{" "}
                <a className="text-[var(--color-accent)] hover:underline" href="mailto:hello@buildingopen.org">hello@buildingopen.org</a>.
                Whether you have a feature idea, a question about how FlyFast works, or just want to say hello.
              </p>
            </div>
            <div className="bg-[var(--color-surface-2)] rounded-lg p-4">
              <p className="text-[var(--color-text)] font-medium">Bug reports and technical issues</p>
              <p className="mt-1">
                Open an issue on{" "}
                <a className="text-[var(--color-accent)] hover:underline" href="https://github.com/buildingopen/opensky/issues" target="_blank" rel="noopener noreferrer">GitHub</a>.
                Include what you searched, what you expected, and what happened instead. Screenshots help.
              </p>
            </div>
            <div className="bg-[var(--color-surface-2)] rounded-lg p-4">
              <p className="text-[var(--color-text)] font-medium">Partnerships</p>
              <p className="mt-1">
                Travel platforms, corporate travel managers, and safety organizations: email{" "}
                <a className="text-[var(--color-accent)] hover:underline" href="mailto:hello@buildingopen.org">hello@buildingopen.org</a>{" "}
                with your use case.
              </p>
            </div>
          </div>
        </div>

        {/* Open source */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">Open source</h2>
          <p>
            FlyFast is fully open source. The code is at{" "}
            <a className="text-[var(--color-accent)] hover:underline" href="https://github.com/buildingopen/opensky" target="_blank" rel="noopener noreferrer">github.com/buildingopen/opensky</a>.
            Contributions, pull requests, and forks are welcome. Check the README for setup instructions.
          </p>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">Common questions</h2>
          <div className="space-y-4">
            <div>
              <p className="text-[var(--color-text)] font-medium">Is FlyFast free?</p>
              <p className="mt-1">Yes. No login, no ads, no premium tier. You get 10 searches per hour.</p>
            </div>
            <div>
              <p className="text-[var(--color-text)] font-medium">Does FlyFast sell tickets?</p>
              <p className="mt-1">No. FlyFast finds and ranks flights. When you click a result, you book directly with the airline or via Google Flights.</p>
            </div>
            <div>
              <p className="text-[var(--color-text)] font-medium">How accurate is the conflict zone data?</p>
              <p className="mt-1">
                The dataset is updated regularly and covers active conflict zones, restricted airspace, and aviation advisories.
                It may not reflect changes from the last few days. Always check official government advisories before booking.
              </p>
            </div>
            <div>
              <p className="text-[var(--color-text)] font-medium">Can I use FlyFast data in my app?</p>
              <p className="mt-1">
                The code is open source (MIT license). For questions or collaboration, reach out at{" "}
                <a className="text-[var(--color-accent)] hover:underline" href="mailto:hello@buildingopen.org">hello@buildingopen.org</a>.
              </p>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
