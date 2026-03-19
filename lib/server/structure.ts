import { cache } from "react";

import { getAllInstrumentBundles } from "@/lib/server/data";

export type StructureNode = {
  id: string;
  label: string;
  type: string | null;
  anchor: string;
  instrumentSlug: string;
  sectionCount: number;
  children: StructureNode[];
};

export type StructureData = {
  instruments: StructureNode[];
};

/**
 * Build a hierarchical structure tree from TOC data for all instruments.
 * Only includes chapters, parts, divisions, and subdivisions as containers.
 * Sections are counted but not included as nodes (they determine container size).
 */
export const getStructureData = cache(async (): Promise<StructureData> => {
  const bundles = await getAllInstrumentBundles();

  const instruments: StructureNode[] = bundles.map((bundle) => {
    const toc = bundle.toc;
    const containerTypes = new Set(["chapter", "part", "division", "subdivision", "subpart"]);

    // Build tree from TOC using level-based nesting
    const root: StructureNode = {
      id: bundle.manifest.slug,
      label: bundle.manifest.title,
      type: "instrument",
      anchor: "",
      instrumentSlug: bundle.manifest.slug,
      sectionCount: 0,
      children: [],
    };

    const stack: StructureNode[] = [root];

    for (const item of toc) {
      if (item.type === "section") {
        // Count sections under the nearest container
        const parent = stack[stack.length - 1];
        if (parent) parent.sectionCount++;
        continue;
      }

      if (!containerTypes.has(item.type ?? "")) continue;

      const node: StructureNode = {
        id: item.id,
        label: item.label,
        type: item.type,
        anchor: item.anchor,
        instrumentSlug: bundle.manifest.slug,
        sectionCount: 0,
        children: [],
      };

      // Pop stack until we find a parent at a higher level
      while (stack.length > 1 && stack[stack.length - 1] !== root) {
        const top = stack[stack.length - 1];
        // Use TOC level to determine nesting: a deeper level nests under current
        const topTocItem = toc.find((t) => t.id === top.id);
        if (topTocItem && topTocItem.level < item.level) break;
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      parent.children.push(node);
      stack.push(node);
    }

    // Propagate section counts up
    function propagateCounts(node: StructureNode): number {
      let total = node.sectionCount;
      for (const child of node.children) {
        total += propagateCounts(child);
      }
      node.sectionCount = total;
      return total;
    }

    propagateCounts(root);

    return root;
  });

  return { instruments };
});
