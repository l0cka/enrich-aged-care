import Isaacus from "isaacus";

import type { DerivedSegment, EmbeddingEntry } from "@/lib/types";

const BATCH_SIZE = 128;

type SegmentRef = {
  segmentId: string;
  instrumentSlug: string;
  text: string;
};

function collectSegmentTexts(
  instrumentSlug: string,
  segments: Record<string, DerivedSegment>,
): SegmentRef[] {
  const refs: SegmentRef[] = [];

  for (const segment of Object.values(segments)) {
    if (segment.kind !== "unit" || !segment.text.trim()) {
      continue;
    }

    refs.push({ segmentId: segment.id, instrumentSlug, text: segment.text });
  }

  return refs;
}

export async function embedSegments(
  allSegments: Map<string, { instrumentSlug: string; segments: Record<string, DerivedSegment> }>,
): Promise<EmbeddingEntry[]> {
  const apiKey = process.env.ISAACUS_API_KEY;

  if (!apiKey) {
    console.warn("ISAACUS_API_KEY not set — skipping embedding.");
    return [];
  }

  const client = new Isaacus({ apiKey });
  const refs: SegmentRef[] = [];

  for (const [, bundle] of allSegments) {
    refs.push(...collectSegmentTexts(bundle.instrumentSlug, bundle.segments));
  }

  console.log(`Embedding ${refs.length} segments in batches of ${BATCH_SIZE}…`);

  const entries: EmbeddingEntry[] = [];

  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = refs.slice(i, i + BATCH_SIZE);
    const texts = batch.map((ref) => ref.text);

    const response = await client.embeddings.create({
      model: "kanon-2-embedder",
      texts,
      task: "retrieval/document",
      overflow_strategy: "drop_end",
    });

    for (const embedding of response.embeddings) {
      const ref = batch[embedding.index];

      if (!ref) {
        continue;
      }

      entries.push({
        segmentId: ref.segmentId,
        instrumentSlug: ref.instrumentSlug,
        vector: embedding.embedding.map((v) => Math.round(v * 1e4) / 1e4),
      });
    }

    const done = Math.min(i + BATCH_SIZE, refs.length);
    console.log(`  embedded ${done}/${refs.length}`);
  }

  return entries;
}
