import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/data", () => ({
  getAllInstrumentBundles: vi.fn(),
}));

vi.mock("@/lib/server/semantic", () => ({
  embedQuery: vi.fn(),
  getClassificationIndex: vi.fn(),
  getEmbeddingIndex: vi.fn(),
  getSegmentThemes: vi.fn(),
  semanticSearch: vi.fn(),
}));

import { getAllInstrumentBundles } from "@/lib/server/data";
import { searchCorpus } from "@/lib/server/search";
import {
  embedQuery,
  getClassificationIndex,
  getEmbeddingIndex,
  getSegmentThemes,
  semanticSearch,
} from "@/lib/server/semantic";
import type { ClassificationIndex, EmbeddingIndex, EnrichedInstrumentBundle, SearchRecord } from "@/lib/types";

function createRecord(overrides: Partial<SearchRecord>): SearchRecord {
  return {
    instrumentSlug: "aged-care-act-2024",
    segmentId: "seg:default",
    anchor: "default-anchor",
    label: "Default label",
    code: null,
    title: null,
    type: "section",
    category: "main",
    excerpt: "Default excerpt",
    searchText: "default search text",
    termLabels: [],
    citationLabels: [],
    ...overrides,
  };
}

function createBundle(slug: string, searchRecords: SearchRecord[]): EnrichedInstrumentBundle {
  return {
    manifest: {
      slug,
      title: slug,
      sourceFile: `${slug}.docx`,
      instrumentType: "statute",
      compilationLabel: "Test compilation",
      citationAliases: [],
    },
    generatedAt: "2026-03-26T00:00:00Z",
    sourceMode: "fallback",
    text: "",
    ilgsDocument: null,
    crossreferenceLookup: {},
    toc: [],
    orderedSegmentIds: [],
    segments: {},
    termLookup: {},
    citationLookup: {},
    searchRecords,
    frontMatterIds: [],
    endnoteIds: [],
  };
}

describe("searchCorpus", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAllInstrumentBundles).mockResolvedValue([]);
    vi.mocked(getClassificationIndex).mockResolvedValue(null);
    vi.mocked(getEmbeddingIndex).mockResolvedValue(null);
    vi.mocked(embedQuery).mockResolvedValue(null);
    vi.mocked(getSegmentThemes).mockReturnValue([]);
    vi.mocked(semanticSearch).mockReturnValue([]);
  });

  it("filters results by theme and exposes matched theme labels", async () => {
    const bundle = createBundle("aged-care-act-2024", [
      createRecord({
        segmentId: "seg:provider-registration",
        anchor: "1-provider-registration",
        code: "1",
        label: "1 Provider registration",
        searchText: "provider registration obligations",
      }),
      createRecord({
        segmentId: "seg:complaints",
        anchor: "2-complaints",
        code: "2",
        label: "2 Complaints handling",
        searchText: "complaints and regulatory action",
      }),
    ]);
    const classificationIndex: ClassificationIndex = {
      generatedAt: "2026-03-26T00:00:00Z",
      themeLabels: ["governance", "complaints"],
      entries: [
        {
          instrumentSlug: "aged-care-act-2024",
          segmentId: "seg:provider-registration",
          themes: [{ theme: "governance", score: 0.95 }],
        },
        {
          instrumentSlug: "aged-care-act-2024",
          segmentId: "seg:complaints",
          themes: [{ theme: "complaints", score: 0.9 }],
        },
      ],
    };

    vi.mocked(getAllInstrumentBundles).mockResolvedValue([bundle]);
    vi.mocked(getClassificationIndex).mockResolvedValue(classificationIndex);
    vi.mocked(getSegmentThemes).mockImplementation((_index, _slug, segmentId) =>
      segmentId === "seg:provider-registration" ? ["governance"] : ["complaints"],
    );

    const results = await searchCorpus({ themes: ["governance"] });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      segmentId: "seg:provider-registration",
      themes: ["governance"],
    });
    expect(embedQuery).not.toHaveBeenCalled();
  });

  it("blends semantic scores into matching search results", async () => {
    const bundle = createBundle("aged-care-act-2024", [
      createRecord({
        segmentId: "seg:quality",
        anchor: "3-quality",
        label: "3 Quality standards",
        searchText: "quality standards and provider duties",
      }),
      createRecord({
        segmentId: "seg:registration",
        anchor: "4-registration",
        label: "4 Provider registration",
        searchText: "provider registration requirements",
      }),
    ]);
    const embeddingIndex: EmbeddingIndex = {
      generatedAt: "2026-03-26T00:00:00Z",
      dimensions: 2,
      entries: [
        { instrumentSlug: "aged-care-act-2024", segmentId: "seg:quality", vector: [1, 0] },
        { instrumentSlug: "aged-care-act-2024", segmentId: "seg:registration", vector: [0, 1] },
      ],
    };

    vi.mocked(getAllInstrumentBundles).mockResolvedValue([bundle]);
    vi.mocked(getEmbeddingIndex).mockResolvedValue(embeddingIndex);
    vi.mocked(embedQuery).mockResolvedValue([0, 1]);
    vi.mocked(semanticSearch).mockReturnValue([
      { instrumentSlug: "aged-care-act-2024", segmentId: "seg:registration", score: 0.9 },
    ]);

    const results = await searchCorpus({ query: "resilience" });
    const registrationResult = results.find((result) => result.segmentId === "seg:registration");

    expect(registrationResult).toMatchObject({
      anchor: "4-registration",
      semanticScore: 0.9,
      segmentId: "seg:registration",
    });
    expect(registrationResult?.score).toBeCloseTo(0.54);
    expect(semanticSearch).toHaveBeenCalledWith([0, 1], embeddingIndex.entries, 100);
  });
});
