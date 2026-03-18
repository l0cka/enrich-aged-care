import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { EnrichedInstrumentBundle } from "@/lib/types";

function readBundle(slug: string): EnrichedInstrumentBundle {
  const file = path.join(process.cwd(), "generated-data", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as EnrichedInstrumentBundle;
}

describe("citation alias resolution", () => {
  it("resolves the Aged Care Act citation from the rules bundle", () => {
    const bundle = readBundle("aged-care-rules-2025");
    const citation = bundle.citationLookup["citation:aged-care-act-2024"];

    expect(citation).toBeDefined();
    expect(citation?.resolvedInstrumentSlug).toBe("aged-care-act-2024");
  });
});
