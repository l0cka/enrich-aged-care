export type InstrumentKind = "statute" | "regulation";

export type SegmentKind = "container" | "unit";

export type SegmentCategory =
  | "front_matter"
  | "scope"
  | "main"
  | "annotation"
  | "back_matter"
  | "other";

export type Span = {
  start: number;
  end: number;
};

export type InstrumentManifestEntry = {
  slug: string;
  title: string;
  sourceFile: string;
  instrumentType: InstrumentKind;
  compilationLabel: string;
  citationAliases: string[];
  referenceAliases?: {
    targetSlug: string;
    aliases: string[];
  }[];
};

export type TocItem = {
  id: string;
  anchor: string;
  label: string;
  level: number;
  type: string | null;
  category: SegmentCategory;
};

export type CrossreferenceRecord = {
  id: string;
  label: string;
  sourceSpan: Span;
  sourceSegmentId: string;
  targetSegmentId: string | null;
  targetInstrumentSlug: string | null;
  targetLabel: string | null;
  targetType: string | null;
  resolution: "internal" | "cross_document" | "external" | "unresolved";
};

export type CitationRecord = {
  id: string;
  label: string;
  normalizedLabel: string;
  mentions: Span[];
  resolvedInstrumentSlug: string | null;
};

export type TermRecord = {
  id: string;
  label: string;
  normalizedLabel: string;
  definition: string;
  definitionSegmentId: string;
  mentions: Span[];
};

export type DerivedSegment = {
  id: string;
  anchor: string;
  kind: SegmentKind;
  type: string | null;
  category: SegmentCategory;
  level: number;
  code: string | null;
  title: string | null;
  label: string;
  parent: string | null;
  children: string[];
  span: Span;
  headingSpan: Span | null;
  text: string;
  html: string;
  termIds: string[];
  citationIds: string[];
  crossreferenceIds: string[];
};

export type SearchRecord = {
  instrumentSlug: string;
  segmentId: string;
  anchor: string;
  label: string;
  code: string | null;
  title: string | null;
  type: string | null;
  category: SegmentCategory;
  excerpt: string;
  searchText: string;
  termLabels: string[];
  citationLabels: string[];
};

export type SearchResult = {
  instrumentSlug: string;
  segmentId: string;
  anchor: string;
  label: string;
  excerpt: string;
  type: string | null;
  category: SegmentCategory;
  matchedTerms: string[];
  matchedCitations: string[];
  score: number;
  semanticScore?: number;
  themes?: string[];
};

// ── Embedding & Classification Indexes ────────────────────────

export type EmbeddingEntry = {
  segmentId: string;
  instrumentSlug: string;
  vector: number[];
};

export type EmbeddingIndex = {
  generatedAt: string;
  dimensions: number;
  entries: EmbeddingEntry[];
};

export type ThemeScore = {
  theme: string;
  score: number;
};

export type ClassificationEntry = {
  segmentId: string;
  instrumentSlug: string;
  themes: ThemeScore[];
};

export type ClassificationIndex = {
  generatedAt: string;
  themeLabels: string[];
  entries: ClassificationEntry[];
};

export type SimilarProvision = {
  segmentId: string;
  instrumentSlug: string;
  anchor: string;
  label: string;
  code: string | null;
  score: number;
};

export type SimilarityEntry = {
  segmentId: string;
  instrumentSlug: string;
  similar: SimilarProvision[];
};

export type SimilarityIndex = {
  generatedAt: string;
  entries: SimilarityEntry[];
};

export type RelatedProvision = {
  id: string;
  otherAnchor: string;
  otherCode: string | null;
  otherInstrumentSlug: string;
  otherInstrumentTitle: string;
  otherLabel: string;
  otherSegmentId: string;
  otherType: string | null;
  relationKind: "cites_this_provision" | "this_provision_cites" | "via_internal_reference";
  triggerText: string;
  viaLabel: string | null;
};

export type PersonRecord = {
  id: string;
  name: string;
  type: "natural" | "politic";
  role: string;
  mentions: Span[];
};

export type ExternalDocumentRecord = {
  id: string;
  name: string;
  type: string;
  jurisdiction: string;
  mentions: Span[];
};

export type EnrichedInstrumentBundle = {
  manifest: InstrumentManifestEntry;
  generatedAt: string;
  sourceMode: "isaacus" | "fallback";
  text: string;
  ilgsDocument: unknown | null;
  crossreferenceLookup: Record<string, CrossreferenceRecord>;
  toc: TocItem[];
  orderedSegmentIds: string[];
  segments: Record<string, DerivedSegment>;
  termLookup: Record<string, TermRecord>;
  citationLookup: Record<string, CitationRecord>;
  searchRecords: SearchRecord[];
  frontMatterIds: string[];
  endnoteIds: string[];
  personLookup?: Record<string, PersonRecord>;
  externalDocumentLookup?: Record<string, ExternalDocumentRecord>;
};

// ── Citation Clipboard ──────────────────────────────────────────

export type CollectionItem = {
  segmentId: string;
  instrumentSlug: string;
  note: string;
  addedAt: number;
};

export type CollectionStore = {
  version: 1;
  items: CollectionItem[];
};

// ── Provision Pathways ──────────────────────────────────────────

export type PathwayRelationship =
  | "delegates_to"
  | "specified_by"
  | "references"
  | "referenced_by"
  | "internal";

export type PathwayNode = {
  segmentId: string;
  instrumentSlug: string;
  label: string;
  code: string | null;
  text: string;
};

export type PathwayEdge = {
  from: string;
  to: string;
  relationship: PathwayRelationship;
};

export type Pathway = {
  seed: PathwayNode;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  truncated: boolean;
  totalCount: number;
};

// ── Decision Pathway Maps ───────────────────────────────────────

export type MapProvision = {
  instrumentSlug: string;
  segmentId: string;
  annotation?: string;
};

export type MapSection = {
  heading: string;
  provisions: MapProvision[];
};

export type PathwayMap = {
  id: string;
  title: string;
  description: string;
  builtIn: boolean;
  sections: MapSection[];
};

export type UserMapsStore = {
  version: 1;
  maps: PathwayMap[];
};
