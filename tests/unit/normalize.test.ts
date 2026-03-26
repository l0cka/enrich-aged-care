import { describe, expect, it } from "vitest";

import {
  escapeRegExp,
  normalizeSearchText,
  normalizeWhitespace,
  sentenceCase,
  slugify,
  unique,
} from "@/lib/normalize";

describe("normalize utilities", () => {
  it("normalizes whitespace and preserves paragraph breaks", () => {
    expect(normalizeWhitespace("  Part\u00a01\t\tTitle\n\n\nBody  text  ")).toBe("Part 1 Title\n\nBody text");
  });

  it("normalizes search text for case-insensitive matching", () => {
    expect(normalizeSearchText("  Quality—of\u00a0care! (Provider)  ")).toBe("quality-of care (provider)");
  });

  it("slugifies labels and trims punctuation", () => {
    expect(slugify("Section 65(1) — Quality of care")).toBe("section-651-quality-of-care");
  });

  it("capitalizes the first character and deduplicates lists", () => {
    expect(sentenceCase("provider obligations")).toBe("Provider obligations");
    expect(unique(["a", "b", "a", "c", "b"])).toEqual(["a", "b", "c"]);
  });

  it("escapes regular expression metacharacters", () => {
    expect(escapeRegExp("s 10(1)+quality?")).toBe("s 10\\(1\\)\\+quality\\?");
  });
});
