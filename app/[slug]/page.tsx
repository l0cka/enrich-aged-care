import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReaderActiveRail } from "@/components/reader-active-rail";
import { getVisibleSegmentIds } from "@/lib/reader";
import { renderSegmentHtml } from "@/lib/render-segment-html";
import { getGeneratedManifest, getInstrumentBundle } from "@/lib/server/data";
import { getRelatedProvisionIndex } from "@/lib/server/related-provisions";

type ReaderPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildReaderHref(slug: string, current: URLSearchParams, next: { endnotes?: boolean; frontMatter?: boolean }) {
  const params = new URLSearchParams(current);

  if (next.frontMatter === undefined) {
    params.delete("frontMatter");
  } else {
    params.set("frontMatter", next.frontMatter ? "1" : "0");
  }

  if (next.endnotes === undefined) {
    params.delete("endnotes");
  } else {
    params.set("endnotes", next.endnotes ? "1" : "0");
  }

  const query = params.toString();
  return query ? `/${slug}?${query}` : `/${slug}`;
}

export async function generateStaticParams() {
  const manifest = await getGeneratedManifest();
  return manifest.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: ReaderPageProps): Promise<Metadata> {
  const { slug } = await params;
  const manifest = await getGeneratedManifest();
  const entry = manifest.find((item) => item.slug === slug);

  if (!entry) {
    return {};
  }

  return {
    description: `${entry.title} rendered as a structured, linked reader.`,
    title: entry.title,
  };
}

export default async function ReaderPage({ params, searchParams }: ReaderPageProps) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const manifest = await getGeneratedManifest();
  const entry = manifest.find((item) => item.slug === slug);

  if (!entry) {
    notFound();
  }

  const [bundle, relatedProvisionIndex] = await Promise.all([getInstrumentBundle(slug), getRelatedProvisionIndex()]);
  const currentSearchParams = new URLSearchParams(
    Object.entries(rawSearchParams).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((item) => [key, item]) : value ? [[key, value]] : [],
    ),
  );
  const showFrontMatter = readParam(rawSearchParams.frontMatter) === "1";
  const showEndnotes = readParam(rawSearchParams.endnotes) === "1";
  const visibleSegmentIds = getVisibleSegmentIds(bundle, { showEndnotes, showFrontMatter });
  const visibleSegments = visibleSegmentIds.map((id) => bundle.segments[id]).filter(Boolean);
  const railPanels = Object.fromEntries(
    visibleSegments.map((segment) => [
      segment.id,
      {
        anchor: segment.anchor,
        citations: segment.citationIds.map((id) => bundle.citationLookup[id]).filter(Boolean),
        crossreferences: segment.crossreferenceIds
          .map((id) => bundle.crossreferenceLookup[id])
          .filter(Boolean)
          .map((crossreference) => ({
            href: crossreference.targetSegmentId
              ? `#${bundle.segments[crossreference.targetSegmentId]?.anchor ?? ""}`
              : crossreference.targetInstrumentSlug
                ? `/${crossreference.targetInstrumentSlug}`
                : null,
            id: crossreference.id,
            label: crossreference.label,
            resolution: crossreference.resolution,
            targetLabel: crossreference.targetLabel,
          })),
        id: segment.id,
        label: segment.label,
        relatedProvisions: relatedProvisionIndex[`${slug}:${segment.id}`] ?? [],
        terms: segment.termIds.map((id) => bundle.termLookup[id]).filter(Boolean),
      },
    ]),
  );

  return (
    <div className="reader-page">
      <header className="reader-hero">
        <div>
          <p className="eyebrow">{entry.instrumentType}</p>
          <h1>{entry.title}</h1>
          <p className="reader-hero__summary">{entry.compilationLabel}</p>
        </div>

        <div className="reader-hero__controls">
          <span className="status-pill">
            {bundle.sourceMode === "isaacus" ? "Isaacus corpus" : "Fallback corpus until API key is supplied"}
          </span>
          <div className="button-row">
            <a
              className="button button--secondary"
              href={buildReaderHref(slug, currentSearchParams, {
                endnotes: showEndnotes,
                frontMatter: !showFrontMatter,
              })}
            >
              {showFrontMatter ? "Hide front matter" : "Show front matter"}
            </a>
            <a
              className="button button--secondary"
              href={buildReaderHref(slug, currentSearchParams, {
                endnotes: !showEndnotes,
                frontMatter: showFrontMatter,
              })}
            >
              {showEndnotes ? "Hide endnotes" : "Show endnotes"}
            </a>
            <Link className="button button--primary" href={`/search?instrument=${slug}`}>
              Search this instrument
            </Link>
          </div>
        </div>
      </header>

      <div className="reader-layout">
        <aside className="toc-rail">
          <p className="eyebrow">Table of contents</p>
          <nav aria-label={`${entry.title} table of contents`}>
            <ol className="toc-list">
              {bundle.toc.map((item) => (
                <li key={item.id} className={`toc-list__item toc-list__item--level-${Math.min(item.level, 4)}`}>
                  <a href={`#${item.anchor}`}>{item.label}</a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="reader-surface">
          {visibleSegments.map((segment) => {
            const HeadingTag = (segment.level <= 0
              ? "h2"
              : segment.level === 1
                ? "h3"
                : segment.level === 2
                  ? "h4"
                  : segment.level === 3
                    ? "h5"
                    : "h6") as "h2" | "h3" | "h4" | "h5" | "h6";

            const internalCrossreferences = segment.crossreferenceIds
              .map((id) => bundle.crossreferenceLookup[id])
              .filter((crossreference) => crossreference?.targetSegmentId)
              .slice(0, 8);
            const inlineTerms = segment.termIds.map((id) => bundle.termLookup[id]).filter(Boolean).slice(0, 8);

            return (
              <section
                key={segment.id}
                className={`reader-segment reader-segment--${segment.category}`}
                data-panel-id={segment.id}
                id={segment.anchor}
              >
                <div className="reader-segment__meta">
                  <span>{segment.type ?? "segment"}</span>
                  {segment.code ? <span>{segment.code}</span> : null}
                </div>

                <HeadingTag className={`reader-segment__heading reader-segment__heading--level-${Math.min(segment.level, 4)}`}>
                  {segment.label}
                </HeadingTag>

                {internalCrossreferences.length ? (
                  <div className="segment-link-row" aria-label={`${segment.label} crossreferences`}>
                    {internalCrossreferences.map((crossreference) => (
                      <a
                        key={crossreference.id}
                        className="chip"
                        href={`#${bundle.segments[crossreference.targetSegmentId!]?.anchor ?? ""}`}
                      >
                        {crossreference.label}
                      </a>
                    ))}
                  </div>
                ) : null}

                {inlineTerms.length ? (
                  <div className="segment-term-list">
                    {inlineTerms.map((term) => (
                      <details key={term.id} className="term-disclosure">
                        <summary>{term.label}</summary>
                        <p>{term.definition}</p>
                      </details>
                    ))}
                  </div>
                ) : null}

                {segment.text.trim() ? (
                  <div
                    className="reader-segment__body"
                    dangerouslySetInnerHTML={{ __html: renderSegmentHtml(segment.text) }}
                  />
                ) : (
                  <p className="muted">No body text for this structural segment.</p>
                )}
              </section>
            );
          })}
        </article>

        <ReaderActiveRail panels={railPanels} />
      </div>
    </div>
  );
}
