import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import { instrumentManifestBySlug } from "@/lib/instruments";
import { getClassificationIndex } from "@/lib/server/semantic";
import type { EnrichedInstrumentBundle, InstrumentManifestEntry } from "@/lib/types";

const generatedDataDir = path.join(process.cwd(), "generated-data");

function mergeManifestEntry(entry: InstrumentManifestEntry): InstrumentManifestEntry {
  const canonical = instrumentManifestBySlug[entry.slug];

  if (!canonical) {
    return entry;
  }

  return {
    ...entry,
    ...canonical,
    citationAliases: canonical.citationAliases?.length ? canonical.citationAliases : entry.citationAliases,
    referenceAliases: canonical.referenceAliases ?? entry.referenceAliases,
  };
}

export const getGeneratedManifest = cache(async (): Promise<InstrumentManifestEntry[]> => {
  const file = path.join(generatedDataDir, "manifest.json");
  const content = await readFile(file, "utf8");
  return (JSON.parse(content) as InstrumentManifestEntry[]).map(mergeManifestEntry);
});

export const getInstrumentBundle = cache(async (slug: string): Promise<EnrichedInstrumentBundle> => {
  const file = path.join(generatedDataDir, `${slug}.json`);
  const content = await readFile(file, "utf8");
  const bundle = JSON.parse(content) as EnrichedInstrumentBundle;

  return {
    ...bundle,
    manifest: mergeManifestEntry(bundle.manifest),
    // Strip the raw Kanon document — it's 2-3 MB per instrument and only
    // needed during ingestion, not at runtime.
    ilgsDocument: null,
  };
});

export const getAllInstrumentBundles = cache(async (): Promise<EnrichedInstrumentBundle[]> => {
  const manifest = await getGeneratedManifest();
  return Promise.all(manifest.map((entry) => getInstrumentBundle(entry.slug)));
});

export async function getSearchFacets() {
  const [bundles, classificationIndex] = await Promise.all([
    getAllInstrumentBundles(),
    getClassificationIndex(),
  ]);

  const terms = new Set<string>();
  const citations = new Set<string>();
  const types = new Set<string>();

  for (const bundle of bundles) {
    Object.values(bundle.termLookup).forEach((term) => terms.add(term.label));
    Object.values(bundle.citationLookup).forEach((citation) => citations.add(citation.label));

    bundle.searchRecords.forEach((record) => {
      if (record.type) {
        types.add(record.type);
      }
    });
  }

  return {
    categories: ["main", "scope", "annotation", "back_matter", "front_matter", "other"],
    citations: Array.from(citations).sort((left, right) => left.localeCompare(right)),
    instruments: bundles.map((bundle) => bundle.manifest),
    terms: Array.from(terms).sort((left, right) => left.localeCompare(right)),
    themes: classificationIndex?.themeLabels ?? [],
    types: Array.from(types).sort((left, right) => left.localeCompare(right)),
  };
}
