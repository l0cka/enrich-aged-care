import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PinButton } from "@/components/pin-button";
import { ReaderActiveRail } from "@/components/reader-active-rail";
import { ReaderTocRail } from "@/components/reader-toc-rail";
import { getVisibleSegmentIds } from "@/lib/reader";
import { renderSegmentHtml, type InlineLink } from "@/lib/render-segment-html";
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

  // Pre-compute entity lists per segment by checking mention span overlaps
  const personsBySegment = new Map<string, { id: string; name: string; role: string }[]>();
  const extDocsBySegment = new Map<string, { id: string; name: string; jurisdiction: string }[]>();

  if (bundle.personLookup) {
    for (const person of Object.values(bundle.personLookup)) {
      for (const mention of person.mentions) {
        for (const seg of visibleSegments) {
          if (mention.start >= seg.span.start && mention.end <= seg.span.end) {
            const list = personsBySegment.get(seg.id) ?? [];
            if (!list.some((p) => p.id === person.id)) {
              list.push({ id: person.id, name: person.name, role: person.role });
              personsBySegment.set(seg.id, list);
            }
            break;
          }
        }
      }
    }
  }

  if (bundle.externalDocumentLookup) {
    for (const doc of Object.values(bundle.externalDocumentLookup)) {
      for (const mention of doc.mentions) {
        for (const seg of visibleSegments) {
          if (mention.start >= seg.span.start && mention.end <= seg.span.end) {
            const list = extDocsBySegment.get(seg.id) ?? [];
            if (!list.some((d) => d.id === doc.id)) {
              list.push({ id: doc.id, name: doc.name, jurisdiction: doc.jurisdiction });
              extDocsBySegment.set(seg.id, list);
            }
            break;
          }
        }
      }
    }
  }

  const railPanels = Object.fromEntries(
    visibleSegments.map((segment) => [
      segment.id,
      {
        anchor: segment.anchor,
        citations: segment.citationIds.map((id) => bundle.citationLookup[id]).filter(Boolean),
        crossreferences: (() => {
          const seen = new Set<string>();
          return segment.crossreferenceIds
            .map((id) => bundle.crossreferenceLookup[id])
            .filter(Boolean)
            .filter((xref) => {
              const key = xref.targetSegmentId ?? xref.id;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
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
            }));
        })(),
        id: segment.id,
        label: segment.label,
        relatedProvisions: relatedProvisionIndex[`${slug}:${segment.id}`] ?? [],
        terms: segment.termIds.map((id) => bundle.termLookup[id]).filter(Boolean),
        persons: personsBySegment.get(segment.id) ?? [],
        externalDocuments: extDocsBySegment.get(segment.id) ?? [],
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

      <div className="reader-layout" suppressHydrationWarning>
        <ReaderTocRail instrumentTitle={entry.title} items={bundle.toc} />

        <article className="reader-surface" suppressHydrationWarning>
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

            const seenTargets = new Set<string>();
            const internalCrossreferences = segment.crossreferenceIds
              .map((id) => bundle.crossreferenceLookup[id])
              .filter((crossreference) => {
                if (!crossreference?.targetSegmentId) return false;
                if (seenTargets.has(crossreference.targetSegmentId)) return false;
                seenTargets.add(crossreference.targetSegmentId);
                return true;
              })
              .slice(0, 8);
            const inlineTerms = segment.termIds.map((id) => bundle.termLookup[id]).filter(Boolean).slice(0, 8);

            // sourceSpan offsets are relative to the full instrument text.
            // segment.text is the body only (heading stripped), so find where
            // the body starts in the full text to compute the correct offset.
            const bodyOffset = segment.text.length > 0
              ? bundle.text.indexOf(segment.text.slice(0, 40), segment.span.start)
              : -1;
            const inlineLinks: InlineLink[] = [];

            if (bodyOffset >= 0) {
              for (const id of segment.crossreferenceIds) {
                const xref = bundle.crossreferenceLookup[id];

                if (!xref?.targetSegmentId || xref.resolution === "external" || xref.resolution === "unresolved") {
                  continue;
                }

                const targetAnchor = bundle.segments[xref.targetSegmentId]?.anchor;

                if (!targetAnchor) {
                  continue;
                }

                const href =
                  xref.targetInstrumentSlug === slug || !xref.targetInstrumentSlug
                    ? `#${targetAnchor}`
                    : `/${xref.targetInstrumentSlug}#${targetAnchor}`;

                const localStart = xref.sourceSpan.start - bodyOffset;
                const localEnd = xref.sourceSpan.end - bodyOffset;

                if (localStart >= 0 && localEnd <= segment.text.length) {
                  inlineLinks.push({ start: localStart, end: localEnd, href });
                }
              }
            }

            return (
              <section
                key={segment.id}
                className={`reader-segment reader-segment--${segment.category}`}
                data-panel-id={segment.id}
                id={segment.anchor}
              >
                <div className="reader-segment__meta">
                  <span>{segment.type ?? (segment.kind === "container" ? "heading" : "provision")}</span>
                  {segment.code ? <span>{segment.code}</span> : null}
                  <PinButton instrumentSlug={slug} segmentId={segment.id} label={segment.label} />
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
                    dangerouslySetInnerHTML={{ __html: renderSegmentHtml(segment.text, inlineLinks) }}
                  />
                ) : (
                  <p className="muted">No body text for this structural segment.</p>
                )}
              </section>
            );
          })}
        </article>

        <ReaderActiveRail panels={railPanels} instrumentSlug={slug} />
      </div>
    </div>
  );
}
