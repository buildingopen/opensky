import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use - FlyFast",
  description: "FlyFast terms of use. Service provided as-is for informational purposes. Not a substitute for official travel advisories.",
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">Terms of Use</h1>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">Last updated: March 2026</p>
      <p className="mt-4 text-[var(--color-text-muted)]">
        By using FlyFast you agree to these terms. FlyFast is operated by{" "}
        <a className="text-[var(--color-accent)] hover:underline" href="https://buildingopen.org" target="_blank" rel="noopener noreferrer">Building Open</a>.
      </p>

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text-muted)]">

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Service description</h2>
          <p>
            FlyFast is a free flight search tool that uses natural language input to search flights across Google Flights
            and filter routes through conflict zones. FlyFast does not sell tickets, process payments, or act as a travel agent.
            When you click a flight result, you are redirected to the airline or Google Flights to complete your booking.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">No guarantee of accuracy</h2>
          <p>
            Flight prices, availability, routes, and safety information can change rapidly.
            The information displayed on FlyFast is for informational purposes only and may differ from what you see at the point of booking.
            Always verify prices, schedules, and travel advisories directly with the airline and relevant government authorities.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Conflict zone data</h2>
          <p>
            FlyFast provides conflict zone filtering as decision support, not as official safety guidance.
            The conflict zone dataset is updated regularly but may not reflect very recent developments.
            FlyFast is not a substitute for official NOTAMs, government travel advisories, or airline safety communications.
            You are responsible for verifying the safety of your route before booking.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Price alerts</h2>
          <p>
            Price alerts are provided on a best-effort basis. Prices in alert emails are indicative and may have changed by the time you check.
            We are not liable for missed deals or incorrect pricing in alert notifications. Alerts are active for 90 days from creation.
            You can unsubscribe from any alert at any time via the link included in each email.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Acceptable use</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>Do not bypass or attempt to circumvent rate limits (10 searches per hour per user).</li>
            <li>Do not use automated scraping, bots, or other tools that degrade service availability.</li>
            <li>Do not use FlyFast to facilitate illegal activity.</li>
          </ul>
          <p className="mt-2">We reserve the right to block access for users who violate these terms.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Intellectual property</h2>
          <p>
            FlyFast is open source under the MIT license. The source code is available at{" "}
            <a className="text-[var(--color-accent)] hover:underline" href="https://github.com/buildingopen/opensky" target="_blank" rel="noopener noreferrer">github.com/buildingopen/opensky</a>.
            Flight data is provided by Google Flights and is subject to their terms. Conflict zone data is maintained by Building Open.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Limitation of liability</h2>
          <p>
            FlyFast is provided &quot;as is&quot; without warranty of any kind.
            Building Open is not liable for any losses, damages, or costs arising from your use of FlyFast,
            including but not limited to: inaccurate pricing, route safety misclassification, missed flights, or booking errors.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Changes to these terms</h2>
          <p>
            We may update these terms at any time. Changes take effect when published on this page.
            Continued use of FlyFast after changes constitutes acceptance of the updated terms.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Contact</h2>
          <p>
            Questions about these terms? Email{" "}
            <a className="text-[var(--color-accent)] hover:underline" href="mailto:hello@buildingopen.org">hello@buildingopen.org</a>.
          </p>
        </div>
      </section>

    </main>
  );
}
