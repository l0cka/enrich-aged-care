import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";

import { instrumentManifest } from "@/lib/instruments";
import { extractDocxText } from "@/lib/ingest/docx";
import { buildFallbackBundle } from "@/lib/ingest/fallback";
import { enrichWithIsaacus } from "@/lib/ingest/isaacus";
import { buildKanonBundle } from "@/lib/ingest/kanon";
import type { EnrichedInstrumentBundle } from "@/lib/types";

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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
