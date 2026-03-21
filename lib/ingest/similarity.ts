import type { DerivedSegment, EmbeddingEntry, SimilarityEntry } from "@/lib/types";

const TOP_K = 10;

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;

  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }

  return sum;
}

function magnitude(v: number[]): number {
  return Math.sqrt(dotProduct(v, v));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dotProduct(a, b) / (magA * magB);
}

export function computeSimilarity(
  embeddings: EmbeddingEntry[],
  allSegments: Map<string, { instrumentSlug: string; segments: Record<string, DerivedSegment> }>,
): SimilarityEntry[] {
  console.log(`Computing pairwise similarity for ${embeddings.length} segments…`);

  // Build a lookup for segment metadata
  const segmentMeta = new Map<string, { anchor: string; label: string; code: string | null }>();

  for (const [, bundle] of allSegments) {
    for (const segment of Object.values(bundle.segments)) {
      segmentMeta.set(`${bundle.instrumentSlug}:${segment.id}`, {
        anchor: segment.anchor,
        label: segment.label,
        code: segment.code,
      });
    }
  }

  // Pre-compute magnitudes
  const magnitudes = embeddings.map((entry) => magnitude(entry.vector));

  const entries: SimilarityEntry[] = [];

  for (let i = 0; i < embeddings.length; i++) {
    const source = embeddings[i]!;
    const sourceMag = magnitudes[i]!;

    if (sourceMag === 0) {
      continue;
    }

    const scores: { index: number; score: number }[] = [];

    for (let j = 0; j < embeddings.length; j++) {
      if (i === j) {
        continue;
      }

      const targetMag = magnitudes[j]!;

      if (targetMag === 0) {
        continue;
      }

      const score = dotProduct(source.vector, embeddings[j]!.vector) / (sourceMag * targetMag);
      scores.push({ index: j, score });
    }

    scores.sort((a, b) => b.score - a.score);
    const topK = scores.slice(0, TOP_K);

    entries.push({
      segmentId: source.segmentId,
      instrumentSlug: source.instrumentSlug,
      similar: topK.map(({ index, score }) => {
        const target = embeddings[index]!;
        const meta = segmentMeta.get(`${target.instrumentSlug}:${target.segmentId}`);

        return {
          segmentId: target.segmentId,
          instrumentSlug: target.instrumentSlug,
          anchor: meta?.anchor ?? target.segmentId,
          label: meta?.label ?? target.segmentId,
          code: meta?.code ?? null,
          score: Math.round(score * 1e3) / 1e3,
        };
      }),
    });

    if ((i + 1) % 500 === 0) {
      console.log(`  similarity: ${i + 1}/${embeddings.length}`);
    }
  }

  console.log(`  similarity: ${embeddings.length}/${embeddings.length} — done.`);
  return entries;
}
