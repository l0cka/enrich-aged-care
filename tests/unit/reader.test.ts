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
  it("hides front matter and endnotes by default", () => {
    const bundle = readBundle("aged-care-act-2024");
    const visibleIds = getVisibleSegmentIds(bundle, {
      showEndnotes: false,
      showFrontMatter: false,
    });

    expect(visibleIds).not.toContain("seg:front-matter");
    expect(visibleIds).not.toContain("seg:endnotes");
    expect(visibleIds).toContain("seg:section-1-short-title");
  });

  it("can explicitly include front matter and endnotes", () => {
    const bundle = readBundle("aged-care-act-2024");
    const visibleIds = getVisibleSegmentIds(bundle, {
      showEndnotes: true,
      showFrontMatter: true,
    });

    expect(visibleIds).toContain("seg:front-matter");
    expect(visibleIds).toContain("seg:endnotes");
    expect(visibleIds.some((id) => id.startsWith("seg:endnote-"))).toBe(true);
  });
});
