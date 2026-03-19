import { cache } from "react";

import { getAllInstrumentBundles, getInstrumentBundle } from "@/lib/server/data";
import { getRelatedProvisionIndex } from "@/lib/server/related-provisions";
import type { DerivedSegment, RelatedProvision } from "@/lib/types";

export type CompareSection = {
  id: string;
  anchor: string;
  code: string | null;
  label: string;
  text: string;
  html: string;
  relatedProvisions: CompareRelated[];
};

export type CompareRelated = {
  segmentId: string;
  anchor: string;
  code: string | null;
  label: string;
  text: string;
  html: string;
  instrumentSlug: string;
  instrumentTitle: string;
  relationKind: RelatedProvision["relationKind"];
  triggerText: string;
};

export type CompareData = {
  leftSlug: string;
  leftTitle: string;
  rightSlug: string;
  rightTitle: string;
  sections: CompareSection[];
  totalWithRelated: number;
};

/**
 * Build comparison data between two instruments.
 * Returns Act sections with their related Rules provisions.
 */
export const getCompareData = cache(
  async (leftSlug: string, rightSlug: string): Promise<CompareData> => {
    const [leftBundle, rightBundle, relatedIndex] = await Promise.all([
      getInstrumentBundle(leftSlug),
      getInstrumentBundle(rightSlug),
      getRelatedProvisionIndex(),
    ]);

    const sections: CompareSection[] = [];
    let totalWithRelated = 0;

    // Walk through left instrument's sections in order
    for (const segId of leftBundle.orderedSegmentIds) {
      const seg = leftBundle.segments[segId];

      if (!seg || seg.type !== "section" || seg.kind !== "container") continue;

      // Get related provisions from the right instrument
      const key = `${leftSlug}:${segId}` as `${string}:${string}`;
      const allRelated = relatedIndex[key] ?? [];
      const rightRelated = allRelated.filter(
        (rp) => rp.otherInstrumentSlug === rightSlug,
      );

      // Resolve the related segments' full data
      const relatedProvisions: CompareRelated[] = rightRelated.map((rp) => {
        const targetSeg = rightBundle.segments[rp.otherSegmentId];

        return {
          segmentId: rp.otherSegmentId,
          anchor: rp.otherAnchor,
          code: rp.otherCode,
          label: rp.otherLabel,
          text: targetSeg?.text ?? "",
          html: targetSeg?.html ?? "",
          instrumentSlug: rp.otherInstrumentSlug,
          instrumentTitle: rp.otherInstrumentTitle,
          relationKind: rp.relationKind,
          triggerText: rp.triggerText,
        };
      });

      if (relatedProvisions.length > 0) totalWithRelated++;

      sections.push({
        id: segId,
        anchor: seg.anchor,
        code: seg.code,
        label: seg.label,
        text: seg.text,
        html: seg.html,
        relatedProvisions,
      });
    }

    return {
      leftSlug,
      leftTitle: leftBundle.manifest.title,
      rightSlug,
      rightTitle: rightBundle.manifest.title,
      sections,
      totalWithRelated,
    };
  },
);
