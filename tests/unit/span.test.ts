import { describe, expect, it } from "vitest";

import {
  buildCodePointIndex,
  codePointSpanToUtf16Range,
  sliceCodePointSpan,
  utf16RangeToCodePointSpan,
} from "@/lib/span";

describe("code point spans", () => {
  it("maps Unicode code points back to UTF-16 ranges", () => {
    const text = "A🙂B\u00a0C";
    const index = buildCodePointIndex(text);
    const span = { end: 4, start: 1 };

    expect(codePointSpanToUtf16Range(index, span)).toEqual({ end: 5, start: 1 });
    expect(sliceCodePointSpan(text, index, span)).toBe("🙂B\u00a0");
  });

  it("reconstructs code point spans from UTF-16 offsets", () => {
    const text = "Part\u00a01—Preliminary";
    const index = buildCodePointIndex(text);

    expect(utf16RangeToCodePointSpan(index, 5, 12)).toEqual({ end: 12, start: 5 });
  });
});
