import { cache } from "react";

import { getAllInstrumentBundles } from "@/lib/server/data";
import { getRelatedProvisionIndex } from "@/lib/server/related-provisions";

export type GraphNode = {
  id: string;
  label: string;
  code: string | null;
  type: string | null;
  instrumentSlug: string;
  instrumentTitle: string;
  anchor: string;
  level: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  relationship: string;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  instruments: { slug: string; title: string }[];
};

export const getGraphData = cache(async (): Promise<GraphData> => {
  const [bundles, relatedIndex] = await Promise.all([
    getAllInstrumentBundles(),
    getRelatedProvisionIndex(),
  ]);

  const instruments = bundles.map((b) => ({
    slug: b.manifest.slug,
    title: b.manifest.title,
  }));

  // Collect section-level nodes (not subsections — too many)
  const nodeMap = new Map<string, GraphNode>();

  for (const bundle of bundles) {
    for (const segment of Object.values(bundle.segments)) {
      if (segment.type !== "section") continue;

      const nodeId = `${bundle.manifest.slug}:${segment.id}`;

      nodeMap.set(nodeId, {
        id: nodeId,
        label: segment.label,
        code: segment.code,
        type: segment.type,
        instrumentSlug: bundle.manifest.slug,
        instrumentTitle: bundle.manifest.title,
        anchor: segment.anchor,
        level: segment.level,
      });
    }
  }

  // Build edges from related provisions (cross-instrument only)
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const [key, relations] of Object.entries(relatedIndex)) {
    const [sourceSlug] = key.split(":");
    const sourceSegId = key.slice(key.indexOf(":") + 1);

    // Find the section that contains this segment
    const sourceBundle = bundles.find((b) => b.manifest.slug === sourceSlug);

    if (!sourceBundle) continue;

    // Walk up to find the parent section
    let sourceSectionId: string | null = sourceSegId;

    while (sourceSectionId) {
      const found: typeof sourceBundle.segments[string] | undefined = sourceBundle.segments[sourceSectionId];
      if (!found) break;
      if (found.type === "section") break;
      sourceSectionId = found.parent;
    }

    if (!sourceSectionId) continue;

    const sourceNodeId = `${sourceSlug}:${sourceSectionId}`;

    if (!nodeMap.has(sourceNodeId)) continue;

    for (const relation of relations) {
      if (relation.otherInstrumentSlug === sourceSlug) continue; // skip internal

      // Find the target section
      const targetBundle = bundles.find((b) => b.manifest.slug === relation.otherInstrumentSlug);

      if (!targetBundle) continue;

      let targetSectionId: string | null = relation.otherSegmentId;

      while (targetSectionId) {
        const found: typeof targetBundle.segments[string] | undefined = targetBundle.segments[targetSectionId];
        if (!found) break;
        if (found.type === "section") break;
        targetSectionId = found.parent;
      }

      if (!targetSectionId) continue;

      const targetNodeId = `${relation.otherInstrumentSlug}:${targetSectionId}`;

      if (!nodeMap.has(targetNodeId)) continue;

      const edgeKey = [sourceNodeId, targetNodeId].sort().join("↔");

      if (edgeSet.has(edgeKey)) continue;

      edgeSet.add(edgeKey);
      edges.push({
        source: sourceNodeId,
        target: targetNodeId,
        relationship: relation.relationKind,
      });
    }
  }

  // Only include nodes that have at least one edge
  const connectedNodeIds = new Set<string>();

  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  const nodes = Array.from(nodeMap.values()).filter((n) => connectedNodeIds.has(n.id));

  return { nodes, edges, instruments };
});
