import Link from "next/link";

import { CorpusSearchForm } from "@/components/corpus-search-form";
import { PinButton } from "@/components/pin-button";
import { getAllInstrumentBundles, getSearchFacets } from "@/lib/server/data";
import { searchCorpus } from "@/lib/server/search";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const [params, facets, bundles] = await Promise.all([searchParams, getSearchFacets(), getAllInstrumentBundles()]);
  const query = readParam(params.q);
  const instrument = readParam(params.instrument);
  const type = readParam(params.type);
  const category = readParam(params.category);
  const term = readParam(params.term);
  const citation = readParam(params.citation);
  const hasSearchIntent = Boolean(query || instrument || type || category || term || citation);
  const results = hasSearchIntent
    ? await searchCorpus({ category, citation, instrument, query, term, type })
    : [];
  const titleBySlug = Object.fromEntries(bundles.map((bundle) => [bundle.manifest.slug, bundle.manifest.title]));

  return (
    <div className="search-page">
      <div className="search-page__header">
        <p className="eyebrow">Corpus search</p>
        <h1>Search by phrase, structure, definition, or cited instrument.</h1>
      </div>

      <div className="search-layout">
        <aside className="search-sidebar">
          <CorpusSearchForm
            action="/search"
            category={category}
            citation={citation}
            facets={facets}
            instrument={instrument}
            query={query}
            showFilters
            term={term}
            type={type}
          />
        </aside>

        <section className="search-results" aria-live="polite">
          {hasSearchIntent ? (
            <p className="search-results__meta">
              {results.length} result{results.length === 1 ? "" : "s"}
            </p>
          ) : (
            <div className="search-empty-guide">
              <h2>Search across all three instruments</h2>
              <p>
                Try a section number, defined term, or topic. Use the filters to narrow results by instrument,
                segment type, or cited document.
              </p>
              <p className="eyebrow">Example searches</p>
              <div className="search-empty-examples">
                <Link className="chip" href="/search?q=registered+nurse">registered nurse</Link>
                <Link className="chip" href="/search?q=quality+standards">quality standards</Link>
                <Link className="chip" href="/search?q=restraint">restraint</Link>
                <Link className="chip" href="/search?q=responsible+person">responsible person</Link>
                <Link className="chip" href="/search?q=complaints">complaints</Link>
              </div>
            </div>
          )}

          {results.length ? (
            <ol className="result-list">
              {results.map((result) => (
                <li key={`${result.instrumentSlug}:${result.segmentId}`} className="result-card">
                  <PinButton
                    instrumentSlug={result.instrumentSlug}
                    segmentId={result.segmentId}
                    label={result.label}
                  />
                  <p className="result-card__meta">
                    <span>{titleBySlug[result.instrumentSlug] ?? result.instrumentSlug}</span>
                    <span>{result.type ?? "segment"}</span>
                    <span>{result.category.replace(/_/g, " ")}</span>
                  </p>
                  <h2>
                    <Link href={`/${result.instrumentSlug}#${result.anchor}`}>{result.label}</Link>
                  </h2>
                  <p>{result.excerpt}</p>

                  <div className="chip-row">
                    {result.matchedTerms.map((item) => (
                      <span key={`term:${item}`} className="chip">
                        term: {item}
                      </span>
                    ))}
                    {result.matchedCitations.map((item) => (
                      <span key={`citation:${item}`} className="chip">
                        citation: {item}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          ) : hasSearchIntent ? (
            <div className="empty-state empty-state--inline">
              <h2>No results matched this search.</h2>
              <p>Try a broader query, remove a filter, or search for a different term.</p>
              <div className="button-row">
                <Link className="button button--secondary" href="/search">Clear all filters</Link>
                <Link className="button button--secondary" href="/">Browse instruments</Link>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
