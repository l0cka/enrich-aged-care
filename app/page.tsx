import Link from "next/link";

import { getAllInstrumentBundles } from "@/lib/server/data";

export default async function HomePage() {
  const bundles = await getAllInstrumentBundles();

  return (
    <div className="landing-page">
      <header className="landing-header">
        <h1>Aged care legislation</h1>
        <p>Enriched with defined terms, cross-references, and linked provisions across instruments.</p>
      </header>

      <section className="instrument-grid">
        {bundles.map((bundle) => (
          <Link
            key={bundle.manifest.slug}
            href={`/${bundle.manifest.slug}`}
            className="instrument-card"
          >
            <p className="instrument-card__type">{bundle.manifest.instrumentType}</p>
            <h2>{bundle.manifest.title}</h2>
            <p className="instrument-card__label">{bundle.manifest.compilationLabel}</p>
          </Link>
        ))}
      </section>

      <nav className="landing-shortcuts">
        <Link href="/search">Search across all instruments</Link>
        <Link href="/graph">Explore structure map</Link>
      </nav>
    </div>
  );
}
