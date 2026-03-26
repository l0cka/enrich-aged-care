import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PinButton } from "@/components/pin-button";
import { ReaderActiveRail } from "@/components/reader-active-rail";
import { ReaderTocRail } from "@/components/reader-toc-rail";
import { renderSegmentHtml, type InlineLink } from "@/lib/render-segment-html";
import { readParam } from "@/lib/search-params";
import { getGeneratedManifest, getInstrumentBundle } from "@/lib/server/data";
import { prepareReaderPageData } from "@/lib/server/reader";
import { getRelatedProvisionIndex } from "@/lib/server/related-provisions";
import { getSimilarityIndex } from "@/lib/server/semantic";

type ReaderPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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

  const [bundle, relatedProvisionIndex, similarityIndex] = await Promise.all([
    getInstrumentBundle(slug),
    getRelatedProvisionIndex(),
    getSimilarityIndex(),
  ]);
  const currentSearchParams = new URLSearchParams(
    Object.entries(rawSearchParams).flatMap(([key, value]) =>
      Array.isArray(value) ? value.map((item) => [key, item]) : value ? [[key, value]] : [],
    ),
  );
  const showFrontMatter = readParam(rawSearchParams.frontMatter) === "1";
  const showEndnotes = readParam(rawSearchParams.endnotes) === "1";
  const { railPanels, visibleSegments } = prepareReaderPageData({
    bundle,
    instrumentSlug: slug,
    relatedProvisionIndex,
    showEndnotes,
    showFrontMatter,
    similarityIndex,
  });

  return (
    <div className="reader-page">
      <header className="reader-hero">
        <div>
          <p className="eyebrow">{entry.instrumentType}</p>
          <h1>{entry.title}</h1>
          <p className="reader-hero__summary">{entry.compilationLabel}</p>
        </div>

        <div className="reader-hero__controls">
          <Link className="button button--primary" href={`/search?instrument=${slug}`}>
            Search this instrument
          </Link>
          <details className="reader-hero__options">
            <summary>Sections</summary>
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
            </div>
          </details>
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
                  {segment.code ? <span>{segment.code}</span> : null}
                  <PinButton instrumentSlug={slug} segmentId={segment.id} label={segment.label} />
                </div>

                <HeadingTag className={`reader-segment__heading reader-segment__heading--level-${Math.min(segment.level, 4)}`}>
                  {segment.label}
                </HeadingTag>

                {segment.text.trim() ? (
                  <div
                    className="reader-segment__body"
                    dangerouslySetInnerHTML={{ __html: renderSegmentHtml(segment.text, inlineLinks) }}
                  />
                ) : null}
              </section>
            );
          })}
        </article>

        <ReaderActiveRail
          instrumentTitles={Object.fromEntries(manifest.map((m) => [m.slug, m.title]))}
          panels={railPanels}
          instrumentSlug={slug}
        />
      </div>
    </div>
  );
}
