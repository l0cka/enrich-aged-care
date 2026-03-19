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

      <section className="feature-cards">
        <div className="feature-card">
          <div className="feature-card__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 4h14M3 8h10M3 12h12M3 16h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h3>Read enriched legislation</h3>
          <p>Structured segments with inline defined terms and cross-references you can expand in place.</p>
        </div>
        <div className="feature-card">
          <div className="feature-card__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="6" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="14" cy="10" r="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M9 10h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h3>Explore connections</h3>
          <p>See how provisions relate across the Act, Rules, and Transitional instruments in the margin panel.</p>
        </div>
        <div className="feature-card">
          <div className="feature-card__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M13 13l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h3>Search with precision</h3>
          <p>Filter by instrument, segment type, defined term, or cited document to find exactly what you need.</p>
        </div>
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
