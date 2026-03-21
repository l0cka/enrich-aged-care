import { readFile } from "node:fs/promises";
import path from "node:path";

import Isaacus from "isaacus";

import type {
  ClassificationIndex,
  EmbeddingEntry,
  EmbeddingIndex,
  SimilarProvision,
  SimilarityIndex,
} from "@/lib/types";

const generatedDataDir = path.join(process.cwd(), "generated-data");

// ── Module-level singleton cache (survives across requests) ─────

let _embeddingIndex: EmbeddingIndex | null | undefined;
let _classificationIndex: ClassificationIndex | null | undefined;
let _similarityIndex: SimilarityIndex | null | undefined;

async function readJsonFile<T>(filename: string): Promise<T | null> {
  try {
    const content = await readFile(path.join(generatedDataDir, filename), "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function getEmbeddingIndex(): Promise<EmbeddingIndex | null> {
  if (_embeddingIndex === undefined) {
    _embeddingIndex = await readJsonFile<EmbeddingIndex>("embeddings.json");
  }

  return _embeddingIndex;
}

export async function getClassificationIndex(): Promise<ClassificationIndex | null> {
  if (_classificationIndex === undefined) {
    _classificationIndex = await readJsonFile<ClassificationIndex>("classifications.json");
  }

  return _classificationIndex;
}

export async function getSimilarityIndex(): Promise<SimilarityIndex | null> {
  if (_similarityIndex === undefined) {
    _similarityIndex = await readJsonFile<SimilarityIndex>("similarity.json");
  }

  return _similarityIndex;
}

// ── Query embedding (runtime API call) ──────────────────────────

export async function embedQuery(query: string): Promise<number[] | null> {
  const apiKey = process.env.ISAACUS_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const client = new Isaacus({ apiKey });
    const response = await client.embeddings.create({
      model: "kanon-2-embedder",
      texts: query,
      task: "retrieval/query",
    });

    return response.embeddings[0]?.embedding ?? null;
  } catch (error) {
    console.warn("embedQuery failed:", error);
    return null;
  }
}

// ── Vector search ───────────────────────────────────────────────

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

export type SemanticHit = {
  segmentId: string;
  instrumentSlug: string;
  score: number;
};

export function semanticSearch(
  queryVector: number[],
  entries: EmbeddingEntry[],
  topK: number,
): SemanticHit[] {
  const queryMag = magnitude(queryVector);

  if (queryMag === 0) {
    return [];
  }

  const scores: SemanticHit[] = [];

  for (const entry of entries) {
    const entryMag = magnitude(entry.vector);

    if (entryMag === 0) {
      continue;
    }

    const score = dotProduct(queryVector, entry.vector) / (queryMag * entryMag);
    scores.push({ segmentId: entry.segmentId, instrumentSlug: entry.instrumentSlug, score });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

// ── Classification helpers ──────────────────────────────────────

export function getSegmentThemes(
  classificationIndex: ClassificationIndex,
  instrumentSlug: string,
  segmentId: string,
  minScore = 0.5,
): string[] {
  const entry = classificationIndex.entries.find(
    (e) => e.instrumentSlug === instrumentSlug && e.segmentId === segmentId,
  );

  if (!entry) {
    return [];
  }

  return entry.themes.filter((t) => t.score >= minScore).map((t) => t.theme);
}

export function getThemeLabels(classificationIndex: ClassificationIndex): string[] {
  return classificationIndex.themeLabels;
}

// ── Similarity helpers ──────────────────────────────────────────

export async function getSimilarProvisions(
  instrumentSlug: string,
  segmentId: string,
): Promise<SimilarProvision[]> {
  const index = await getSimilarityIndex();

  if (!index) {
    return [];
  }

  const entry = index.entries.find(
    (e) => e.instrumentSlug === instrumentSlug && e.segmentId === segmentId,
  );

  return entry?.similar ?? [];
}
