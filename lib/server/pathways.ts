import { cache } from "react";

import { getAllInstrumentBundles } from "@/lib/server/data";
import { getRelatedProvisionIndex } from "@/lib/server/related-provisions";
import type {
  DerivedSegment,
  EnrichedInstrumentBundle,
  Pathway,
  PathwayNode,
  PathwayRelationship,
  RelatedProvision,
} from "@/lib/types";

const maxNodes = 50;

function classifyRelationship(
  relationKind: RelatedProvision["relationKind"],
  sourceInstrumentType: string,
  targetInstrumentType: string,
): PathwayRelationship {
  if (relationKind === "via_internal_reference") {
    return "internal";
  }

  const isStatuteToRegulation =
    sourceInstrumentType === "statute" && targetInstrumentType === "regulation";

  if (relationKind === "this_provision_cites") {
    return isStatuteToRegulation ? "delegates_to" : "references";
  }

  // cites_this_provision
  return isStatuteToRegulation ? "specified_by" : "referenced_by";
}

function makeNode(segment: DerivedSegment, instrumentSlug: string): PathwayNode {
  return {
    segmentId: segment.id,
    instrumentSlug,
    anchor: segment.anchor,
    label: segment.label,
    code: segment.code,
    text: segment.text.slice(0, 200),
  };
}

export const computePathway = cache(
  async (instrumentSlug: string, segmentId: string, maxHops: number = 2): Promise<Pathway | null> => {
    const [bundles, relatedIndex] = await Promise.all([
      getAllInstrumentBundles(),
      getRelatedProvisionIndex(),
    ]);

    const bundleBySlug = Object.fromEntries(
      bundles.map((bundle) => [bundle.manifest.slug, bundle]),
    ) as Record<string, EnrichedInstrumentBundle>;

    const seedBundle = bundleBySlug[instrumentSlug];

    if (!seedBundle) {
      return null;
    }

    const seedSegment = seedBundle.segments[segmentId];

    if (!seedSegment) {
      return null;
    }

    const seedNode = makeNode(seedSegment, instrumentSlug);
    const visited = new Set<string>([`${instrumentSlug}:${segmentId}`]);
    const nodes: PathwayNode[] = [seedNode];
    const edges: Array<{ from: string; to: string; relationship: PathwayRelationship }> = [];
    let frontier: Array<{ slug: string; segmentId: string }> = [
      { slug: instrumentSlug, segmentId },
    ];
    let totalCount = 1;
    let truncated = false;

    for (let hop = 0; hop < maxHops; hop++) {
      const nextFrontier: Array<{ slug: string; segmentId: string }> = [];

      for (const current of frontier) {
        const key = `${current.slug}:${current.segmentId}`;
        const relations = (relatedIndex as Record<string, RelatedProvision[]>)[key] ?? [];

        for (const relation of relations) {
          const targetKey = `${relation.otherInstrumentSlug}:${relation.otherSegmentId}`;

          if (visited.has(targetKey)) {
            continue;
          }

          totalCount++;

          if (nodes.length >= maxNodes) {
            truncated = true;
            continue;
          }

          visited.add(targetKey);

          const targetBundle = bundleBySlug[relation.otherInstrumentSlug];

          if (!targetBundle) {
            continue;
          }

          const targetSegment = targetBundle.segments[relation.otherSegmentId];

          if (!targetSegment) {
            continue;
          }

          const sourceInstrumentType = bundleBySlug[current.slug]?.manifest.instrumentType ?? "statute";
          const targetInstrumentType = targetBundle.manifest.instrumentType;

          nodes.push(makeNode(targetSegment, relation.otherInstrumentSlug));
          edges.push({
            from: current.segmentId,
            to: relation.otherSegmentId,
            relationship: classifyRelationship(
              relation.relationKind,
              sourceInstrumentType,
              targetInstrumentType,
            ),
          });

          nextFrontier.push({
            slug: relation.otherInstrumentSlug,
            segmentId: relation.otherSegmentId,
          });
        }
      }

      if (truncated) {
        break;
      }

      frontier = nextFrontier;
    }

    return {
      seed: seedNode,
      nodes,
      edges,
      truncated,
      totalCount,
    };
  },
);
