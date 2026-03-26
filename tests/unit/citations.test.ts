import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { formatCitation, formatCitationsOnly, formatCollectionExport, formatExportBlock } from "@/lib/citation";
import type { EnrichedInstrumentBundle } from "@/lib/types";

function readBundle(slug: string): EnrichedInstrumentBundle {
  const file = path.join(process.cwd(), "generated-data", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as EnrichedInstrumentBundle;
}

describe("citation alias resolution", () => {
  it("resolves canonical instrument citations present in generated bundles", () => {
    const bundle = readBundle("aged-care-rules-2025");
    const citation = Object.values(bundle.citationLookup).find(
      (entry) => entry.label === "Aged Care Rules 2025",
    );

    expect(citation).toBeDefined();
    expect(citation?.resolvedInstrumentSlug).toBe("aged-care-rules-2025");
  });
});

describe("citation formatting utilities", () => {
  it("formats formal citations for coded provisions", () => {
    expect(
      formatCitation(
        { type: "section", code: "65(1)", label: "65 Registration conditions" },
        "Aged Care Act 2024",
      ),
    ).toBe("s 65(1) of the Aged Care Act 2024");
  });

  it("falls back to the label when no citation prefix can be derived", () => {
    expect(
      formatCitation(
        { type: null, code: null, label: "Dictionary" },
        "Aged Care Rules 2025",
      ),
    ).toBe("Dictionary of the Aged Care Rules 2025");
  });

  it("formats export text for full collections and citation-only copies", () => {
    expect(
      formatExportBlock(
        "s 10 of the Aged Care Act 2024",
        "First line\n\n\nSecond line",
      ),
    ).toBe('s 10 of the Aged Care Act 2024\n"First line\n\nSecond line"');

    expect(
      formatCollectionExport([
        { citation: "s 10 of the Aged Care Act 2024", text: "First line" },
        { citation: "r 5 of the Aged Care Rules 2025", text: "Second line" },
      ]),
    ).toBe(
      's 10 of the Aged Care Act 2024\n"First line"\n\nr 5 of the Aged Care Rules 2025\n"Second line"',
    );

    expect(
      formatCitationsOnly([
        "s 10 of the Aged Care Act 2024",
        "r 5 of the Aged Care Rules 2025",
      ]),
    ).toBe("s 10 of the Aged Care Act 2024\nr 5 of the Aged Care Rules 2025");
  });
});
