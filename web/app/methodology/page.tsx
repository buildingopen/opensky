import type { Metadata } from "next";
import { TableOfContents } from "@/components/TableOfContents";

export const metadata: Metadata = {
  title: "How FlyFast Ranks Flights - Methodology",
  description: "How FlyFast searches every flight on Google Flights, filters conflict zones, and ranks by price, duration, and route safety. Open methodology.",
};

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to search for safe flights using FlyFast",
  description: "Use natural language to search every flight on Google Flights, filter conflict zones, and book directly.",
  step: [
    { "@type": "HowToStep", name: "Describe your trip", text: "Go to flyfast.app and type your trip in plain English. For example: 'London to Tokyo next month under $600' or 'cheapest flight from New York to Bangkok avoiding conflict zones'." },
    { "@type": "HowToStep", name: "Review results", text: "FlyFast searches every flight on Google Flights, filters conflict zones, and ranks by price, duration, stops, and route safety. Each flight shows a safety badge: Safe, Caution, High Risk, or Do Not Fly." },
    { "@type": "HowToStep", name: "Book your flight", text: "Click any result to go directly to the airline or Google Flights to compare and book. FlyFast does not sell tickets; you book with the provider." },
  ],
  tool: { "@type": "HowToTool", name: "FlyFast (flyfast.app)" },
};

const tocItems = [
  { id: "describe", label: "1. Describe your trip" },
  { id: "parse", label: "2. AI parsing" },
  { id: "search", label: "3. Search flights" },
  { id: "safety", label: "4. Conflict zone check" },
  { id: "rank", label: "5. Rank & recommend" },
  { id: "book", label: "6. Book directly" },
  { id: "data-sources", label: "Data sources" },
  { id: "comparison", label: "FlyFast vs. traditional" },
  { id: "limitations", label: "Limitations" },
];

export default function MethodologyPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <h1 className="text-3xl font-bold text-[var(--color-text)]">How FlyFast Works</h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        FlyFast combines natural language understanding, real-time flight data from Google Flights, and conflict zone intelligence
        to find the best route for your trip. This page explains exactly how.
      </p>

      <div className="lg:grid lg:grid-cols-[1fr_180px] lg:gap-12 mt-10">
        <section className="space-y-8 text-sm text-[var(--color-text-muted)]">

          {/* Step 1 */}
          <div id="describe">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">1. You describe your trip</h2>
            <p>
              Type what you need in plain English. FlyFast understands origins, destinations, dates, budgets, cabin class, stop preferences, and more.
            </p>
            <div className="mt-3 bg-[var(--color-surface-2)] rounded-lg p-4 space-y-2 font-mono text-xs">
              <p className="text-[var(--color-text)]">&quot;Mumbai to Hamburg next week, under $300&quot;</p>
              <p className="text-[var(--color-text)]">&quot;Cheapest flight from JFK to anywhere in Southeast Asia in July&quot;</p>
              <p className="text-[var(--color-text)]">&quot;Berlin to Tokyo, round trip, business class, flexible dates&quot;</p>
              <p className="text-[var(--color-text)]">&quot;London to New York nonstop this weekend&quot;</p>
            </div>
            <p className="mt-3">
              FlyFast also expands nearby airports automatically. Searching &quot;Hamburg&quot; checks HAM, BRE, HAJ, LBC, and BER.
              Flexible dates like &quot;cheapest in July&quot; sample every few days across the month.
            </p>
          </div>

          {/* Step 2 */}
          <div id="parse">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">2. We parse your query with AI</h2>
            <p>
              Your natural language input is parsed into structured search parameters: origin airports, destination airports,
              date ranges, price limits, cabin class, and stop preferences. This parsing is powered by Google Gemini.
            </p>
            <p className="mt-2">
              If your query is too broad (for example, &quot;cheapest flight anywhere&quot;), FlyFast suggests three narrower
              alternatives instead of running thousands of searches.
            </p>
          </div>

          {/* Step 3 */}
          <div id="search">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">3. We search every matching flight</h2>
            <p>
              FlyFast searches every origin-destination-date combination in parallel across Google Flights.
              For a query like &quot;Hamburg or Berlin to Tokyo, any day next week&quot;, that could be 5 origins x 2 destinations x 7 dates = 70 searches, all running simultaneously.
            </p>
            <p className="mt-2">
              Results stream in as they arrive, so you see flights appearing in real time rather than waiting for all searches to finish.
            </p>
          </div>

          {/* Step 4 */}
          <div id="safety">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">4. We check every route against conflict zones</h2>
            <p>
              Every flight result is checked against our conflict zone dataset. We look at all airports in the itinerary
              and the airspace the route passes through. Routes are classified into four safety levels:
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[var(--color-safe)] shrink-0" />
                <span><span className="text-[var(--color-text)] font-medium">Safe</span>: no conflict zones in the route</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[var(--color-caution)] shrink-0" />
                <span><span className="text-[var(--color-text)] font-medium">Caution</span>: touches a lower-risk advisory area. Shown with a warning so you can decide.</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[var(--color-high-risk)] shrink-0" />
                <span><span className="text-[var(--color-text)] font-medium">High risk</span>: passes through active conflict airspace. Removed from results.</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[var(--color-danger)] shrink-0" />
                <span><span className="text-[var(--color-text)] font-medium">Do not fly</span>: closed or restricted airspace. Removed from results.</span>
              </div>
            </div>
            <p className="mt-3">
              High-risk and do-not-fly routes are filtered out before you see them. You only see safe and caution-level flights.
            </p>
          </div>

          {/* Step 5 */}
          <div id="rank">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">5. We rank and recommend</h2>
            <p>
              After filtering, every remaining flight is scored across four dimensions:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><span className="text-[var(--color-text)] font-medium">Price</span>: lower is better</li>
              <li><span className="text-[var(--color-text)] font-medium">Duration</span>: shorter is better</li>
              <li><span className="text-[var(--color-text)] font-medium">Stops</span>: fewer is better</li>
              <li><span className="text-[var(--color-text)] font-medium">Safety</span>: safe routes score higher than caution routes</li>
            </ul>
            <p className="mt-3">
              FlyFast then labels the top results:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><span className="text-[var(--color-text)] font-medium">Recommended</span>: best overall balance of price, speed, comfort, and safety</li>
              <li><span className="text-[var(--color-text)] font-medium">Cheapest</span>: lowest price among safe routes</li>
              <li><span className="text-[var(--color-text)] font-medium">Fastest</span>: shortest total travel time</li>
              <li><span className="text-[var(--color-text)] font-medium">Lowest stress</span>: fewest stops and simplest itinerary</li>
            </ul>
          </div>

          {/* Step 6 */}
          <div id="book">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">6. You book directly</h2>
            <p>
              FlyFast does not sell tickets and does not take payment. When you click a flight, you go directly to the airline
              or to Google Flights where you can compare and book. Prices can change between our search and your booking.
            </p>
          </div>

          {/* Data sources */}
          <div id="data-sources" className="border-t border-[var(--color-border)] pt-8">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Data sources</h2>
            <ul className="space-y-2">
              <li>
                <span className="text-[var(--color-text)] font-medium">Flight data:</span> Google Flights, covering major carriers, low-cost airlines, and multi-airline itineraries worldwide.
              </li>
              <li>
                <span className="text-[var(--color-text)] font-medium">Conflict zone data:</span> Maintained by Building Open. Includes active conflict zones, military activity areas,
                restricted airspace, and aviation advisories. Updated regularly. The &quot;Conflict zones updated&quot; date in the footer shows when the data was last refreshed.
              </li>
              <li>
                <span className="text-[var(--color-text)] font-medium">Query parsing:</span> Google Gemini (AI) for natural language understanding.
              </li>
            </ul>
          </div>

          {/* Comparison */}
          <div id="comparison" className="border-t border-[var(--color-border)] pt-8">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">FlyFast vs. traditional flight search</h2>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="py-2 pr-4 text-[var(--color-text)] font-medium" />
                    <th className="py-2 px-4 text-[var(--color-text)] font-medium">FlyFast</th>
                    <th className="py-2 px-4 text-[var(--color-text)] font-medium">Traditional search</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  <tr className="border-b border-[var(--color-border)]/30">
                    <td className="py-2.5 pr-4 text-[var(--color-text)]">Input</td>
                    <td className="py-2.5 px-4">Plain English sentence</td>
                    <td className="py-2.5 px-4">Fill origin, destination, date, passengers forms</td>
                  </tr>
                  <tr className="border-b border-[var(--color-border)]/30">
                    <td className="py-2.5 pr-4 text-[var(--color-text)]">Conflict zone safety</td>
                    <td className="py-2.5 px-4">Filtered by default</td>
                    <td className="py-2.5 px-4">Not available</td>
                  </tr>
                  <tr className="border-b border-[var(--color-border)]/30">
                    <td className="py-2.5 pr-4 text-[var(--color-text)]">Multi-city search</td>
                    <td className="py-2.5 px-4">&quot;Hamburg or Berlin to Tokyo&quot;</td>
                    <td className="py-2.5 px-4">Search each combination manually</td>
                  </tr>
                  <tr className="border-b border-[var(--color-border)]/30">
                    <td className="py-2.5 pr-4 text-[var(--color-text)]">Flexible dates</td>
                    <td className="py-2.5 px-4">&quot;Cheapest day in July&quot;</td>
                    <td className="py-2.5 px-4">Check each day or use calendar view</td>
                  </tr>
                  <tr className="border-b border-[var(--color-border)]/30">
                    <td className="py-2.5 pr-4 text-[var(--color-text)]">Login required</td>
                    <td className="py-2.5 px-4">No</td>
                    <td className="py-2.5 px-4">Often</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-[var(--color-text)]">Price</td>
                    <td className="py-2.5 px-4">Free</td>
                    <td className="py-2.5 px-4">Free (with ads)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Limitations */}
          <div id="limitations" className="border-t border-[var(--color-border)] pt-8">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Limitations</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>FlyFast is decision support, not official travel advice. Always check government advisories and your airline before booking.</li>
              <li>Prices change in real time. The price you see may differ from the price at booking.</li>
              <li>Conflict zone data is updated regularly but may not reflect changes that happened in the last few days.</li>
              <li>FlyFast searches are rate-limited to 10 per hour per user to prevent abuse.</li>
            </ul>
          </div>
        </section>

        <TableOfContents items={tocItems} />
      </div>
    </main>
  );
}
