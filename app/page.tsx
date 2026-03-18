import Link from "next/link";

import { CorpusSearchForm } from "@/components/corpus-search-form";
import { getAllInstrumentBundles, getSearchFacets } from "@/lib/server/data";

export default async function HomePage() {
  const [bundles, facets] = await Promise.all([getAllInstrumentBundles(), getSearchFacets()]);
  const totalSections = bundles.reduce((sum, bundle) => sum + bundle.orderedSegmentIds.length, 0);
  const totalTerms = bundles.reduce((sum, bundle) => sum + Object.keys(bundle.termLookup).length, 0);

  return (
    <div className="landing-page">
      <section className="hero-panel">
        <div className="hero-panel__copy">
          <p className="eyebrow">Readable, structured, public legislation</p>
          <h1>Browse the aged care corpus as a living, linked reading surface.</h1>
          <p className="hero-panel__lede">
            This explorer layers structure, defined terms, crossreferences, and cited instruments over the
            current legislation set committed in the repository.
          </p>
        </div>

        <div className="hero-panel__meta">
          <div>
            <span>Instruments</span>
            <strong>{bundles.length}</strong>
          </div>
          <div>
            <span>Structured segments</span>
            <strong>{totalSections}</strong>
          </div>
          <div>
            <span>Defined terms</span>
            <strong>{totalTerms}</strong>
          </div>
        </div>

        <CorpusSearchForm action="/search" className="hero-panel__search" facets={facets} submitLabel="Open search" />
      </section>

      <section className="instrument-grid">
        {bundles.map((bundle) => (
          <article key={bundle.manifest.slug} className="instrument-card">
            <p className="instrument-card__type">{bundle.manifest.instrumentType}</p>
            <h2>
              <Link href={`/${bundle.manifest.slug}`}>{bundle.manifest.title}</Link>
            </h2>
            <p className="instrument-card__label">{bundle.manifest.compilationLabel}</p>
            <p className="instrument-card__summary">
              {bundle.toc.length} navigable segments, {Object.keys(bundle.termLookup).length} extracted definitions,
              and {Object.keys(bundle.citationLookup).length} linked cited instruments.
            </p>

            <div className="instrument-card__actions">
              <Link className="button button--primary" href={`/${bundle.manifest.slug}`}>
                Open reader
              </Link>
              <Link className="button button--secondary" href={`/search?instrument=${bundle.manifest.slug}`}>
                Search within
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
