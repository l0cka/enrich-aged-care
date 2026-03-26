import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MapProvisionList } from "@/components/map-provision-list";
import { getAllInstrumentBundles } from "@/lib/server/data";
import { getBuiltInMap, getBuiltInMaps } from "@/lib/server/maps";

type MapDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const maps = await getBuiltInMaps();
  return maps.map((map) => ({ id: map.id }));
}

export async function generateMetadata({ params }: MapDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const map = await getBuiltInMap(id);

  return {
    title: map ? map.title : "Pathway Map",
    description: map?.description,
  };
}

export default async function MapDetailPage({ params }: MapDetailPageProps) {
  const { id } = await params;
  const map = await getBuiltInMap(id);

  if (!map) {
    notFound();
  }

  const bundles = await getAllInstrumentBundles();
  const bundleBySlug = Object.fromEntries(
    bundles.map((bundle) => [bundle.manifest.slug, bundle]),
  );

  const resolvedProvisions: Record<string, {
    instrumentSlug: string;
    segmentId: string;
    label: string;
    excerpt: string;
    annotation?: string;
    anchor: string;
  }> = {};

  for (const section of map.sections) {
    for (const provision of section.provisions) {
      const bundle = bundleBySlug[provision.instrumentSlug];
      const segment = bundle?.segments[provision.segmentId];

      if (segment) {
        const key = `${provision.instrumentSlug}:${provision.segmentId}`;
        resolvedProvisions[key] = {
          instrumentSlug: provision.instrumentSlug,
          segmentId: provision.segmentId,
          label: segment.label,
          excerpt: segment.text.slice(0, 120).trim() + (segment.text.length > 120 ? "\u2026" : ""),
          annotation: provision.annotation,
          anchor: segment.anchor,
        };
      }
    }
  }

  const provisionCount = map.sections.reduce((sum, s) => sum + s.provisions.length, 0);

  return (
    <div className="map-detail-page">
      <header className="map-detail-header">
        <p className="eyebrow">Decision pathway map</p>
        <h1>{map.title}</h1>
        <p className="muted">{map.description}</p>
        <div className="map-detail-meta">
          <span>{provisionCount} provision{provisionCount === 1 ? "" : "s"}</span>
          <Link className="button button--secondary" href="/maps">← All maps</Link>
        </div>
      </header>

      <MapProvisionList
        sections={map.sections}
        resolvedProvisions={resolvedProvisions}
      />
    </div>
  );
}
