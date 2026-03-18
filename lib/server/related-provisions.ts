import { cache } from "react";

import { escapeRegExp, normalizeSearchText, normalizeWhitespace, slugify } from "@/lib/normalize";
import { getAllInstrumentBundles } from "@/lib/server/data";
import type { DerivedSegment, EnrichedInstrumentBundle, RelatedProvision } from "@/lib/types";

type SegmentKey = `${string}:${string}`;

type DirectRelation = {
  matchText: string;
  sourceBundle: EnrichedInstrumentBundle;
  sourceSegment: DerivedSegment;
  targetBundle: EnrichedInstrumentBundle;
  targetSegment: DerivedSegment;
};

const subordinateProvisionTypes = new Set([
  "subsection",
  "subsections",
  "paragraph",
  "paragraphs",
  "subparagraph",
  "subparagraphs",
  "subrule",
  "subrules",
]);

const whitespacePattern = "[\\s\\u00A0]+";
const referenceTypePattern =
  "(section|sections|subsection|subsections|paragraph|paragraphs|subparagraph|subparagraphs|rule|rules|subrule|subrules|chapter|chapters|part|parts|division|divisions|subdivision|subdivisions|schedule|schedules)";
const referenceCodePattern = "([0-9]+[A-Z]?(?:[\\u2010-\\u2015-][0-9]+[A-Z]?)*(?:\\([0-9A-Za-z]+\\))*)";

function singularize(value: string): string {
  if (value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("s")) {
    return value.slice(0, -1);
  }

  return value;
}

function baseProvisionCode(value: string): string {
  return value.replace(/(\([^)]+\))+$/g, "");
}

function buildSegmentKey(instrumentSlug: string, segmentId: string): SegmentKey {
  return `${instrumentSlug}:${segmentId}`;
}

function getReferencedProvisionType(rawType: string, targetBundle: EnrichedInstrumentBundle): string {
  if (subordinateProvisionTypes.has(rawType)) {
    return targetBundle.manifest.instrumentType === "statute" ? "section" : "rule";
  }

  return singularize(rawType);
}

function buildCodeIndex(bundle: EnrichedInstrumentBundle): Map<string, DerivedSegment> {
  const index = new Map<string, DerivedSegment>();

  Object.values(bundle.segments).forEach((segment) => {
    if (!segment.code || !segment.type) {
      return;
    }

    index.set(`${segment.type}:${normalizeSearchText(segment.code)}`, segment);
  });

  return index;
}

function buildAliasPattern(aliases: string[]): string | null {
  const values = aliases
    .map((alias) => normalizeWhitespace(alias))
    .filter(Boolean)
    .map((alias) => `(?:${escapeRegExp(alias).replace(/ /g, whitespacePattern)})`);

  return values.length ? values.join("|") : null;
}

function sortRelations(left: RelatedProvision, right: RelatedProvision): number {
  const priority = {
    cites_this_provision: 0,
    this_provision_cites: 1,
    via_internal_reference: 2,
  } as const;

  return (
    priority[left.relationKind] - priority[right.relationKind] ||
    left.otherInstrumentTitle.localeCompare(right.otherInstrumentTitle) ||
    (left.otherCode ?? left.otherLabel).localeCompare(right.otherCode ?? right.otherLabel, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function makeDisplayRecord(
  relation: DirectRelation,
  relationKind: RelatedProvision["relationKind"],
  currentIsSource: boolean,
  viaLabel: string | null,
): RelatedProvision {
  const otherBundle = currentIsSource ? relation.targetBundle : relation.sourceBundle;
  const otherSegment = currentIsSource ? relation.targetSegment : relation.sourceSegment;

  return {
    id: slugify(
      [
        relationKind,
        otherBundle.manifest.slug,
        otherSegment.id,
        relation.matchText,
        viaLabel ?? "",
      ].join("-"),
    ),
    otherAnchor: otherSegment.anchor,
    otherCode: otherSegment.code,
    otherInstrumentSlug: otherBundle.manifest.slug,
    otherInstrumentTitle: otherBundle.manifest.title,
    otherLabel: otherSegment.label,
    otherSegmentId: otherSegment.id,
    otherType: otherSegment.type,
    relationKind,
    triggerText: relation.matchText,
    viaLabel,
  };
}

export const getRelatedProvisionIndex = cache(async (): Promise<Record<SegmentKey, RelatedProvision[]>> => {
  const bundles = await getAllInstrumentBundles();
  const bundlesBySlug = Object.fromEntries(bundles.map((bundle) => [bundle.manifest.slug, bundle]));
  const codeIndexBySlug = Object.fromEntries(
    bundles.map((bundle) => [bundle.manifest.slug, buildCodeIndex(bundle)]),
  ) as Record<string, Map<string, DerivedSegment>>;
  const outboundBySource: Record<SegmentKey, DirectRelation[]> = {};
  const inboundByTarget: Record<SegmentKey, DirectRelation[]> = {};

  for (const sourceBundle of bundles) {
    for (const relationAlias of sourceBundle.manifest.referenceAliases ?? []) {
      const targetBundle = bundlesBySlug[relationAlias.targetSlug];

      if (!targetBundle) {
        continue;
      }

      const aliasPattern = buildAliasPattern(relationAlias.aliases);

      if (!aliasPattern) {
        continue;
      }

      const matcher = new RegExp(
        `\\b${referenceTypePattern}${whitespacePattern}${referenceCodePattern}${whitespacePattern}of${whitespacePattern}(${aliasPattern})\\b`,
        "giu",
      );

      for (const sourceSegment of Object.values(sourceBundle.segments)) {
        const seenMatches = new Set<string>();

        for (const match of sourceSegment.text.matchAll(matcher)) {
          const rawType = (match[1] ?? "").toLowerCase();
          const rawCode = match[2] ?? "";
          const normalizedCode = normalizeSearchText(baseProvisionCode(rawCode));
          const targetType = getReferencedProvisionType(rawType, targetBundle);
          const targetSegment =
            codeIndexBySlug[targetBundle.manifest.slug]?.get(`${targetType}:${normalizedCode}`) ?? null;

          if (!targetSegment) {
            continue;
          }

          const dedupeKey = `${sourceSegment.id}:${targetSegment.id}:${match[0]}`;

          if (seenMatches.has(dedupeKey)) {
            continue;
          }

          seenMatches.add(dedupeKey);

          const relation: DirectRelation = {
            matchText: match[0],
            sourceBundle,
            sourceSegment,
            targetBundle,
            targetSegment,
          };
          const sourceKey = buildSegmentKey(sourceBundle.manifest.slug, sourceSegment.id);
          const targetKey = buildSegmentKey(targetBundle.manifest.slug, targetSegment.id);
          outboundBySource[sourceKey] = [...(outboundBySource[sourceKey] ?? []), relation];
          inboundByTarget[targetKey] = [...(inboundByTarget[targetKey] ?? []), relation];
        }
      }
    }
  }

  const relatedBySegment: Record<SegmentKey, RelatedProvision[]> = {};

  for (const bundle of bundles) {
    for (const segment of Object.values(bundle.segments)) {
      const currentKey = buildSegmentKey(bundle.manifest.slug, segment.id);
      const relationMap = new Map<string, RelatedProvision>();

      for (const relation of inboundByTarget[currentKey] ?? []) {
        const display = makeDisplayRecord(relation, "cites_this_provision", false, null);
        relationMap.set(`${display.otherInstrumentSlug}:${display.otherSegmentId}`, display);
      }

      for (const relation of outboundBySource[currentKey] ?? []) {
        const display = makeDisplayRecord(relation, "this_provision_cites", true, null);

        if (!relationMap.has(`${display.otherInstrumentSlug}:${display.otherSegmentId}`)) {
          relationMap.set(`${display.otherInstrumentSlug}:${display.otherSegmentId}`, display);
        }
      }

      for (const crossreferenceId of segment.crossreferenceIds) {
        const crossreference = bundle.crossreferenceLookup[crossreferenceId];

        if (!crossreference?.targetSegmentId || crossreference.targetInstrumentSlug !== bundle.manifest.slug) {
          continue;
        }

        const viaTargetKey = buildSegmentKey(bundle.manifest.slug, crossreference.targetSegmentId);

        for (const relation of inboundByTarget[viaTargetKey] ?? []) {
          const display = makeDisplayRecord(
            relation,
            "via_internal_reference",
            false,
            crossreference.targetLabel ?? crossreference.label,
          );
          const dedupeKey = `${display.otherInstrumentSlug}:${display.otherSegmentId}`;

          if (relationMap.has(dedupeKey)) {
            continue;
          }

          relationMap.set(dedupeKey, display);
        }
      }

      relatedBySegment[currentKey] = Array.from(relationMap.values()).sort(sortRelations).slice(0, 12);
    }
  }

  return relatedBySegment;
});
