import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";

import { THEME_QUERIES, classifySegments } from "@/lib/ingest/classify";
import { extractDocxText } from "@/lib/ingest/docx";
import { embedSegments } from "@/lib/ingest/embed";
import { buildFallbackBundle } from "@/lib/ingest/fallback";
import { enrichWithIsaacus } from "@/lib/ingest/isaacus";
import { buildKanonBundle } from "@/lib/ingest/kanon";
import { computeSimilarity } from "@/lib/ingest/similarity";
import { instrumentManifest } from "@/lib/instruments";
import type {
  ClassificationIndex,
  DerivedSegment,
  EmbeddingIndex,
  EnrichedInstrumentBundle,
  SimilarityIndex,
} from "@/lib/types";

const outputDir = path.join(process.cwd(), "generated-data");
const { loadEnvConfig } = nextEnv;

async function main() {
  loadEnvConfig(process.cwd());
  await mkdir(outputDir, { recursive: true });
  const bundles: EnrichedInstrumentBundle[] = [];

  for (const entry of instrumentManifest) {
    const sourcePath = path.join(process.cwd(), entry.sourceFile);
    const text = await extractDocxText(sourcePath);
    const fallbackBundle = buildFallbackBundle(entry, text, instrumentManifest);
    const ilgsDocument = await enrichWithIsaacus(text);

    const bundle: EnrichedInstrumentBundle = ilgsDocument
      ? buildKanonBundle(entry, text, ilgsDocument, instrumentManifest)
      : fallbackBundle;

    bundles.push(bundle);
    await writeFile(path.join(outputDir, `${entry.slug}.json`), JSON.stringify(bundle, null, 2));
  }

  await writeFile(path.join(outputDir, "manifest.json"), JSON.stringify(instrumentManifest, null, 2));
  console.log(`Wrote ${bundles.length} instrument bundle(s) to ${outputDir}`);

  // ── Phase 2: Embeddings, Classification & Similarity ──────────
  const allSegments = new Map<string, { instrumentSlug: string; segments: Record<string, DerivedSegment> }>();

  for (const bundle of bundles) {
    allSegments.set(bundle.manifest.slug, {
      instrumentSlug: bundle.manifest.slug,
      segments: bundle.segments,
    });
  }

  const generatedAt = new Date().toISOString();
  const embeddingsPath = path.join(outputDir, "embeddings.json");
  const similarityPath = path.join(outputDir, "similarity.json");

  // Embed all segments (skip if embeddings.json already exists)
  const embeddingsExist = await access(embeddingsPath).then(() => true, () => false);

  if (embeddingsExist) {
    console.log("embeddings.json already exists — skipping embedding & similarity.");
  } else {
    const embeddingEntries = await embedSegments(allSegments);

    if (embeddingEntries.length > 0) {
      const dimensions = embeddingEntries[0]?.vector.length ?? 0;
      const embeddingIndex: EmbeddingIndex = { generatedAt, dimensions, entries: embeddingEntries };
      await writeFile(embeddingsPath, JSON.stringify(embeddingIndex));
      console.log(`Wrote ${embeddingEntries.length} embeddings (${dimensions}d) to embeddings.json`);

      // Compute similarity from embeddings
      const similarityEntries = computeSimilarity(embeddingEntries, allSegments);
      const similarityIndex: SimilarityIndex = { generatedAt, entries: similarityEntries };
      await writeFile(similarityPath, JSON.stringify(similarityIndex));
      console.log(`Wrote ${similarityEntries.length} similarity records to similarity.json`);
    }
  }

  // Classify all segments
  const classificationEntries = await classifySegments(allSegments);

  if (classificationEntries.length > 0) {
    const classificationIndex: ClassificationIndex = {
      generatedAt,
      themeLabels: THEME_QUERIES.map((q) => q.theme),
      entries: classificationEntries,
    };
    await writeFile(path.join(outputDir, "classifications.json"), JSON.stringify(classificationIndex));
    console.log(`Wrote ${classificationEntries.length} classification records to classifications.json`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
