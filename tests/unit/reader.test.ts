import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { getVisibleSegmentIds } from "@/lib/reader";
import type { EnrichedInstrumentBundle } from "@/lib/types";

function readBundle(slug: string): EnrichedInstrumentBundle {
  const file = path.join(process.cwd(), "generated-data", `${slug}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as EnrichedInstrumentBundle;
}

describe("reader visibility", () => {
  it("hides front matter by default while keeping substantive provisions visible", () => {
    const bundle = readBundle("aged-care-act-2024");
    const visibleIds = getVisibleSegmentIds(bundle, {
      showEndnotes: false,
      showFrontMatter: false,
    });

    expect(visibleIds).not.toContain("seg:4");
    expect(visibleIds).toContain("seg:2257");
    expect(visibleIds).toContain("seg:797");
  });

  it("can explicitly include front matter and endnote content", () => {
    const bundle = readBundle("aged-care-act-2024");
    const visibleIds = getVisibleSegmentIds(bundle, {
      showEndnotes: true,
      showFrontMatter: true,
    });

    expect(visibleIds).toContain("seg:4");
    expect(visibleIds).toContain("seg:797");
    expect(visibleIds.some((id) => bundle.endnoteIds.includes(id))).toBe(true);
  });
});
