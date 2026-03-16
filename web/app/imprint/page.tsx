import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Imprint - FlyFast",
  description: "FlyFast legal notice (Impressum) as required by German TMG §5.",
};

export default function ImprintPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">Imprint</h1>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">Impressum gemass §5 TMG</p>

      <section className="mt-10 space-y-8 text-sm text-[var(--color-text-muted)]">

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Angaben gemass §5 TMG</h2>
          <p>
            Building Open<br />
            Federico De Ponte<br />
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Kontakt</h2>
          <p>
            E-Mail:{" "}
            <a className="text-[var(--color-accent)] hover:underline" href="mailto:hello@buildingopen.org">
              hello@buildingopen.org
            </a>
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">
            Verantwortlich fur den Inhalt nach §55 Abs. 2 RStV
          </h2>
          <p>Federico De Ponte</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Haftungsausschluss</h2>

          <h3 className="font-medium text-[var(--color-text)] mt-4 mb-1">Haftung fur Inhalte</h3>
          <p>
            Die Inhalte unserer Seiten wurden mit grosster Sorgfalt erstellt. Fur die Richtigkeit,
            Vollstandigkeit und Aktualitat der Inhalte konnen wir jedoch keine Gewahr ubernehmen.
            Als Diensteanbieter sind wir gemass §7 Abs. 1 TMG fur eigene Inhalte auf diesen Seiten
            nach den allgemeinen Gesetzen verantwortlich. Nach §§8 bis 10 TMG sind wir als
            Diensteanbieter jedoch nicht verpflichtet, ubermittelte oder gespeicherte fremde
            Informationen zu uberwachen.
          </p>

          <h3 className="font-medium text-[var(--color-text)] mt-4 mb-1">Haftung fur Links</h3>
          <p>
            Unser Angebot enthalt Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
            Einfluss haben. Deshalb konnen wir fur diese fremden Inhalte auch keine Gewahr ubernehmen.
            Fur die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
            Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf
            mogliche Rechtsverstesse uberpruft. Rechtswidrige Inhalte waren zum Zeitpunkt der
            Verlinkung nicht erkennbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige
            Links umgehend entfernen.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">EU-Streitschlichtung</h2>
          <p>
            Die Europaische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <a
              className="text-[var(--color-accent)] hover:underline"
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://ec.europa.eu/consumers/odr/
            </a>
            . Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </div>

      </section>
    </main>
  );
}
