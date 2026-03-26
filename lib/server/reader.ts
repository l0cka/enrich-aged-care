import { getVisibleSegmentIds, type ReaderVisibility } from "@/lib/reader";
import type {
  DerivedSegment,
  EnrichedInstrumentBundle,
  ExternalDocumentRecord,
  PersonRecord,
  RelatedProvision,
  SimilarProvision,
  SimilarityIndex,
} from "@/lib/types";

type ReaderPanelPerson = Pick<PersonRecord, "id" | "name" | "role">;
type ReaderPanelExternalDocument = Pick<ExternalDocumentRecord, "id" | "name" | "jurisdiction">;

type ReaderPanelCrossreference = {
  href: string | null;
  id: string;
  label: string;
  resolution: "internal" | "cross_document" | "external" | "unresolved";
  targetLabel: string | null;
};

export type ReaderRailPanel = {
  anchor: string;
  citations: {
    id: string;
    label: string;
    resolvedInstrumentSlug: string | null;
  }[];
  crossreferences: ReaderPanelCrossreference[];
  externalDocuments?: ReaderPanelExternalDocument[];
  id: string;
  label: string;
  persons?: ReaderPanelPerson[];
  relatedProvisions: RelatedProvision[];
  similarProvisions?: SimilarProvision[];
  terms: {
    definition: string;
    id: string;
    label: string;
  }[];
};

type PrepareReaderPageDataArgs = ReaderVisibility & {
  bundle: EnrichedInstrumentBundle;
  instrumentSlug: string;
  relatedProvisionIndex: Record<string, RelatedProvision[]>;
  similarityIndex: SimilarityIndex | null;
};

type MentionRecord = {
  id: string;
  mentions: { start: number; end: number }[];
};

function findContainingSegmentId(
  visibleSegments: DerivedSegment[],
  mention: { start: number; end: number },
): string | null {
  for (const segment of visibleSegments) {
    if (mention.start >= segment.span.start && mention.end <= segment.span.end) {
      return segment.id;
    }
  }

  return null;
}

function buildMentionIndex<TRecord extends MentionRecord, TResult>(
  records: TRecord[] | undefined,
  visibleSegments: DerivedSegment[],
  getRecordKey: (record: TRecord) => string,
  mapRecord: (record: TRecord) => TResult,
): Map<string, TResult[]> {
  const index = new Map<string, TResult[]>();
  const seenKeysBySegment = new Map<string, Set<string>>();

  if (!records?.length) {
    return index;
  }

  for (const record of records) {
    for (const mention of record.mentions) {
      const segmentId = findContainingSegmentId(visibleSegments, mention);

      if (!segmentId) {
        continue;
      }

      const recordKey = getRecordKey(record);
      const seenKeys = seenKeysBySegment.get(segmentId) ?? new Set<string>();

      if (!seenKeys.has(recordKey)) {
        const existing = index.get(segmentId) ?? [];
        existing.push(mapRecord(record));
        index.set(segmentId, existing);
        seenKeys.add(recordKey);
        seenKeysBySegment.set(segmentId, seenKeys);
      }

      break;
    }
  }

  return index;
}

function buildSimilarityLookup(
  similarityIndex: SimilarityIndex | null,
  instrumentSlug: string,
): Map<string, SimilarProvision[]> {
  const lookup = new Map<string, SimilarProvision[]>();

  if (!similarityIndex) {
    return lookup;
  }

  for (const entry of similarityIndex.entries) {
    if (entry.instrumentSlug === instrumentSlug) {
      lookup.set(entry.segmentId, entry.similar);
    }
  }

  return lookup;
}

function buildRailPanel(
  segment: DerivedSegment,
  bundle: EnrichedInstrumentBundle,
  instrumentSlug: string,
  relatedProvisionIndex: Record<string, RelatedProvision[]>,
  personsBySegment: Map<string, ReaderPanelPerson[]>,
  externalDocumentsBySegment: Map<string, ReaderPanelExternalDocument[]>,
  similarBySegment: Map<string, SimilarProvision[]>,
): ReaderRailPanel {
  const seenCrossreferenceTargets = new Set<string>();
  const crossreferences = segment.crossreferenceIds
    .map((id) => bundle.crossreferenceLookup[id])
    .filter(Boolean)
    .filter((crossreference) => {
      const key = crossreference.targetSegmentId ?? crossreference.id;

      if (seenCrossreferenceTargets.has(key)) {
        return false;
      }

      seenCrossreferenceTargets.add(key);
      return true;
    })
    .slice(0, 12)
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

  return {
    anchor: segment.anchor,
    citations: segment.citationIds.map((id) => bundle.citationLookup[id]).filter(Boolean).slice(0, 8),
    crossreferences,
    id: segment.id,
    label: segment.label,
    relatedProvisions: relatedProvisionIndex[`${instrumentSlug}:${segment.id}`] ?? [],
    terms: segment.termIds.map((id) => bundle.termLookup[id]).filter(Boolean).slice(0, 12),
    persons: (personsBySegment.get(segment.id) ?? []).slice(0, 6),
    externalDocuments: (externalDocumentsBySegment.get(segment.id) ?? []).slice(0, 6),
    similarProvisions: (similarBySegment.get(segment.id) ?? []).slice(0, 10),
  };
}

export function prepareReaderPageData({
  bundle,
  instrumentSlug,
  relatedProvisionIndex,
  showEndnotes,
  showFrontMatter,
  similarityIndex,
}: PrepareReaderPageDataArgs): {
  railPanels: Record<string, ReaderRailPanel>;
  visibleSegments: DerivedSegment[];
} {
  const visibleSegmentIds = getVisibleSegmentIds(bundle, { showEndnotes, showFrontMatter });
  const visibleSegments = visibleSegmentIds.map((id) => bundle.segments[id]).filter(Boolean);
  const personsBySegment = buildMentionIndex(
    bundle.personLookup ? Object.values(bundle.personLookup) : undefined,
    visibleSegments,
    (person) => person.id,
    (person) => ({ id: person.id, name: person.name, role: person.role }),
  );
  const externalDocumentsBySegment = buildMentionIndex(
    bundle.externalDocumentLookup ? Object.values(bundle.externalDocumentLookup) : undefined,
    visibleSegments,
    (document) => document.id,
    (document) => ({ id: document.id, name: document.name, jurisdiction: document.jurisdiction }),
  );
  const similarBySegment = buildSimilarityLookup(similarityIndex, instrumentSlug);
  const railPanels = Object.fromEntries(
    visibleSegments.map((segment) => [
      segment.id,
      buildRailPanel(
        segment,
        bundle,
        instrumentSlug,
        relatedProvisionIndex,
        personsBySegment,
        externalDocumentsBySegment,
        similarBySegment,
      ),
    ]),
  );

  return { railPanels, visibleSegments };
}
