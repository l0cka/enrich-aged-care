import type { Span } from "@/lib/types";

export type CodePointIndex = number[];

export function buildCodePointIndex(text: string): CodePointIndex {
  const offsets = [0];

  for (const symbol of text) {
    offsets.push(offsets[offsets.length - 1]! + symbol.length);
  }

  return offsets;
}

export function codePointLength(text: string): number {
  return buildCodePointIndex(text).length - 1;
}

export function utf16OffsetToCodePoint(index: CodePointIndex, utf16Offset: number): number {
  let low = 0;
  let high = index.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const current = index[mid]!;

    if (current === utf16Offset) {
      return mid;
    }

    if (current < utf16Offset) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return Math.max(0, high);
}

export function codePointSpanToUtf16Range(index: CodePointIndex, span: Span): Span {
  return {
    start: index[span.start] ?? 0,
    end: index[span.end] ?? index[index.length - 1] ?? 0,
  };
}

export function sliceCodePointSpan(text: string, index: CodePointIndex, span: Span): string {
  const range = codePointSpanToUtf16Range(index, span);
  return text.slice(range.start, range.end);
}

export function utf16RangeToCodePointSpan(index: CodePointIndex, start: number, end: number): Span {
  return {
    start: utf16OffsetToCodePoint(index, start),
    end: utf16OffsetToCodePoint(index, end),
  };
}

export function findAllCodePointSpans(text: string, query: RegExp): Span[] {
  const flags = query.flags.includes("g") ? query.flags : `${query.flags}g`;
  const matcher = new RegExp(query.source, flags);
  const index = buildCodePointIndex(text);
  const spans: Span[] = [];

  for (const match of text.matchAll(matcher)) {
    if (match.index === undefined) {
      continue;
    }

    const matchedText = match[0];

    if (!matchedText) {
      continue;
    }

    spans.push(utf16RangeToCodePointSpan(index, match.index, match.index + matchedText.length));
  }

  return spans;
}
