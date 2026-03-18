import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddChainButton } from "@/components/add-chain-button";
import { PathwayTree } from "@/components/pathway-tree";
import { PinButton } from "@/components/pin-button";
import { renderSegmentHtml } from "@/lib/render-segment-html";
import { getAllInstrumentBundles, getInstrumentBundle } from "@/lib/server/data";
import { computePathway } from "@/lib/server/pathways";

type PathwayPageProps = {
  params: Promise<{ instrumentSlug: string; segmentAnchor: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function generateMetadata({ params }: PathwayPageProps): Promise<Metadata> {
  const { instrumentSlug, segmentAnchor } = await params;
  const bundle = await getInstrumentBundle(instrumentSlug).catch(() => null);

  if (!bundle) {
    return {};
  }

  const segment = Object.values(bundle.segments).find((s) => s.anchor === segmentAnchor);

  return {
    title: segment ? `Pathway: ${segment.label}` : "Provision Pathway",
    description: `Obligation chain for ${segment?.label ?? segmentAnchor}`,
  };
}

export default async function PathwayPage({ params, searchParams }: PathwayPageProps) {
  const [{ instrumentSlug, segmentAnchor }, rawSearchParams] = await Promise.all([params, searchParams]);
  const bundle = await getInstrumentBundle(instrumentSlug).catch(() => null);

  if (!bundle) {
    notFound();
  }

  const segment = Object.values(bundle.segments).find((s) => s.anchor === segmentAnchor);

  if (!segment) {
    notFound();
  }

  const hopsParam = readParam(rawSearchParams.hops);
  const maxHops = hopsParam === "1" ? 1 : hopsParam === "3" ? 3 : 2;
  const pathway = await computePathway(instrumentSlug, segment.id, maxHops);

  if (!pathway) {
    notFound();
  }

  const bundles = await getAllInstrumentBundles();
  const instrumentTitles = Object.fromEntries(
    bundles.map((b) => [b.manifest.slug, b.manifest.title]),
  );

  const baseHref = `/pathway/${instrumentSlug}/${segmentAnchor}`;

  return (
    <div className="pathway-page">
      <header className="pathway-hero">
        <p className="eyebrow">Provision pathway</p>
        <div className="pathway-hero__seed">
          <h1>{segment.label}</h1>
          <PinButton instrumentSlug={instrumentSlug} segmentId={segment.id} label={segment.label} />
        </div>
        <p className="muted">{bundle.manifest.title}</p>
        {segment.text.trim() ? (
          <div
            className="pathway-hero__text reader-segment__body"
            // Content is pre-generated trusted HTML from renderSegmentHtml (same pattern as app/[slug]/page.tsx)
            dangerouslySetInnerHTML={{ __html: renderSegmentHtml(segment.text) }}
          />
        ) : null}

        <div className="pathway-controls">
          <span className="eyebrow">Depth</span>
          <div className="button-row">
            {([1, 2, 3] as const).map((hops) => (
              <a
                key={hops}
                className={`button button--secondary ${maxHops === hops ? "button--active" : ""}`}
                href={hops === 2 ? baseHref : `${baseHref}?hops=${hops}`}
              >
                {hops} hop{hops > 1 ? "s" : ""}
              </a>
            ))}
          </div>
          <AddChainButton
            items={pathway.nodes.map((node) => ({
              instrumentSlug: node.instrumentSlug,
              segmentId: node.segmentId,
            }))}
          />
          <Link className="button button--secondary" href={`/${instrumentSlug}#${segmentAnchor}`}>
            ← Back to reader
          </Link>
        </div>
      </header>

      <PathwayTree pathway={pathway} instrumentTitles={instrumentTitles} />
    </div>
  );
}
