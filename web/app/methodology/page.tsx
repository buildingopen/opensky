import Link from "next/link";

export default function MethodologyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">How We Rank Flights</h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        FlyFast helps you choose the safest practical flight by combining real route data with conflict-zone intelligence.
      </p>

      <section className="mt-8 space-y-6 text-sm text-[var(--color-text-muted)]">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">What we filter</h2>
          <p>
            We exclude routes that pass through airspace flagged as high-risk or no-fly. Our safety dataset includes conflict zones,
            military activity areas, and regions with known aviation advisories. Routes that touch these areas are either filtered out
            or clearly flagged so you can make an informed decision.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">How we rank</h2>
          <p>
            After filtering, we score each remaining option on safety, price, duration, and number of stops. Our &quot;Recommended&quot;
            option is the best balance of these factors. &quot;Cheapest&quot; is the lowest price among safe routes. &quot;Fastest&quot; is
            the shortest travel time. &quot;Lowest stress&quot; favors fewer stops and simpler itineraries.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Data sources</h2>
          <p>
            Flight options and prices come from Duffel and Google. Safety and conflict-zone data are maintained by Building Open and
            updated regularly. The &quot;Safety zones updated&quot; date in the footer shows when our risk data was last refreshed.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">What &quot;Safe&quot; means</h2>
          <p>
            A route is marked &quot;Safe&quot; when it does not pass through any flagged conflict zone. &quot;Caution&quot; means it
            touches a lower-risk area. &quot;High risk&quot; and &quot;Do not fly&quot; indicate routes we recommend avoiding. These
            labels are based on our dataset, not official government travel advisories.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Limitations</h2>
          <p>
            FlyFast is decision support, not legal or aviation safety advice. Always check official government travel advisories and
            your airline before booking. Prices and availability can change; you always book directly with the provider (e.g. Skyscanner,
            Google Flights), not through us.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <Link href="/" className="text-[var(--color-accent)] hover:underline text-sm">
          Back to search
        </Link>
      </div>
    </main>
  );
}
