import Isaacus from "isaacus";

import type { ClassificationEntry, DerivedSegment } from "@/lib/types";

export const THEME_QUERIES: { theme: string; query: string }[] = [
  { theme: "Provider Obligations", query: "This provision imposes an obligation on a provider." },
  { theme: "Individual Rights", query: "This provision grants a right to an individual." },
  { theme: "Penalties & Sanctions", query: "This provision establishes a penalty or sanction." },
  { theme: "Commissioner Powers", query: "This provision confers a power on the Commissioner." },
  { theme: "Definitions", query: "This provision defines a term or concept." },
  { theme: "Conditions", query: "This provision sets a condition or prerequisite." },
  { theme: "Exemptions", query: "This provision provides an exemption or exception." },
  { theme: "Funding", query: "This provision relates to funding or financial matters." },
  { theme: "Complaints", query: "This provision relates to complaints or feedback." },
  { theme: "Restrictive Practices", query: "This provision relates to the use of restrictive practices." },
  { theme: "Governance", query: "This provision relates to governance or corporate structure." },
  { theme: "Quality & Safety", query: "This provision relates to quality and safety standards." },
  { theme: "Registration", query: "This provision relates to registration or approval." },
  { theme: "Reporting", query: "This provision relates to reporting or notification requirements." },
  { theme: "Worker Screening", query: "This provision relates to aged care worker screening." },
  { theme: "Transitional", query: "This provision relates to transitional arrangements." },
];

const SCORE_THRESHOLD = 0.3;

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

export async function classifySegments(
  allSegments: Map<string, { instrumentSlug: string; segments: Record<string, DerivedSegment> }>,
): Promise<ClassificationEntry[]> {
  const apiKey = process.env.ISAACUS_API_KEY;

  if (!apiKey) {
    console.warn("ISAACUS_API_KEY not set — skipping classification.");
    return [];
  }

  const client = new Isaacus({ apiKey });
  const refs: SegmentRef[] = [];

  for (const [, bundle] of allSegments) {
    refs.push(...collectSegmentTexts(bundle.instrumentSlug, bundle.segments));
  }

  console.log(`Classifying ${refs.length} segments against ${THEME_QUERIES.length} themes…`);

  const entriesMap = new Map<string, ClassificationEntry>();

  for (const ref of refs) {
    entriesMap.set(`${ref.instrumentSlug}:${ref.segmentId}`, {
      segmentId: ref.segmentId,
      instrumentSlug: ref.instrumentSlug,
      themes: [],
    });
  }

  for (const { theme, query } of THEME_QUERIES) {
    // Classify all segments against this theme
    const texts = refs.map((ref) => ref.text);

    // Process in batches to avoid overwhelming the API
    const BATCH_SIZE = 64;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batchTexts = texts.slice(i, i + BATCH_SIZE);
      const batchRefs = refs.slice(i, i + BATCH_SIZE);

      const response = await client.classifications.universal.create({
        model: "kanon-universal-classifier",
        query,
        texts: batchTexts,
        chunking_options: null,
      });

      for (const classification of response.classifications) {
        if (classification.score < SCORE_THRESHOLD) {
          continue;
        }

        const ref = batchRefs[classification.index];

        if (!ref) {
          continue;
        }

        const key = `${ref.instrumentSlug}:${ref.segmentId}`;
        const entry = entriesMap.get(key);

        if (entry) {
          entry.themes.push({
            theme,
            score: Math.round(classification.score * 1e3) / 1e3,
          });
        }
      }
    }

    console.log(`  classified theme: ${theme}`);
  }

  return Array.from(entriesMap.values()).filter((entry) => entry.themes.length > 0);
}
