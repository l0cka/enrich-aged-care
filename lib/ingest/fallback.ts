import type {
  CitationRecord,
  CrossreferenceRecord,
  DerivedSegment,
  EnrichedInstrumentBundle,
  InstrumentManifestEntry,
  SearchRecord,
  SegmentCategory,
  Span,
  TermRecord,
  TocItem,
} from "@/lib/types";
import { renderSegmentHtml } from "@/lib/render-segment-html";
import { buildCodePointIndex, findAllCodePointSpans, utf16RangeToCodePointSpan } from "@/lib/span";
import { escapeRegExp, normalizeSearchText, normalizeWhitespace, sentenceCase, slugify } from "@/lib/normalize";

type Paragraph = {
  compactText: string;
  endCodePoint: number;
  endUtf16: number;
  index: number;
  rawText: string;
  startCodePoint: number;
  startUtf16: number;
};

type Marker = {
  category: SegmentCategory;
  code: string | null;
  headingSpan: Span;
  id: string;
  kind: "container" | "unit";
  label: string;
  level: number;
  paragraphIndex: number;
  rank: number;
  title: string | null;
  type: string | null;
};

type MarkerContext = {
  byTypeAndCode: Map<string, string>;
  citationLookup: Record<string, CitationRecord>;
  crossreferenceLookup: Record<string, CrossreferenceRecord>;
  crossreferencesBySegment: Record<string, CrossreferenceRecord[]>;
  termLookup: Record<string, TermRecord>;
};

function splitParagraphs(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const codePointIndex = buildCodePointIndex(text);
  let cursor = 0;
  let paragraphIndex = 0;

  while (cursor < text.length) {
    while (cursor < text.length && text[cursor] === "\n") {
      cursor += 1;
    }

    if (cursor >= text.length) {
      break;
    }

    let next = cursor;

    while (next < text.length && !text.startsWith("\n\n", next)) {
      next += 1;
    }

    const rawText = text.slice(cursor, next);

    if (rawText.trim()) {
      paragraphs.push({
        compactText: normalizeWhitespace(rawText),
        endCodePoint: utf16RangeToCodePointSpan(codePointIndex, next, next).end,
        endUtf16: next,
        index: paragraphIndex,
        rawText,
        startCodePoint: utf16RangeToCodePointSpan(codePointIndex, cursor, cursor).start,
        startUtf16: cursor,
      });
      paragraphIndex += 1;
    }

    while (next < text.length && text[next] === "\n") {
      next += 1;
    }

    cursor = next;
  }

  return paragraphs;
}

function singularize(value: string): string {
  if (value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("s")) {
    return value.slice(0, -1);
  }

  return value;
}

function makeStableId(prefix: string, code: string | null, title: string | null, seen: Map<string, number>): string {
  const base = [prefix, code, title].filter(Boolean).join("-");
  const slug = slugify(base) || prefix;
  const count = (seen.get(slug) ?? 0) + 1;
  seen.set(slug, count);
  return count === 1 ? `seg:${slug}` : `seg:${slug}-${count}`;
}

function inferCategory(title: string | null, parentCategory: SegmentCategory): SegmentCategory {
  const normalizedTitle = normalizeSearchText(title ?? "");

  if (!normalizedTitle) {
    return parentCategory;
  }

  if (
    normalizedTitle.includes("definition") ||
    normalizedTitle.includes("meaning of") ||
    normalizedTitle.includes("interpretation") ||
    normalizedTitle.includes("simplified outline") ||
    normalizedTitle.includes("application")
  ) {
    return "scope";
  }

  return parentCategory;
}

function parseMarker(
  paragraph: Paragraph,
  manifest: InstrumentManifestEntry,
  stack: Marker[],
  seenIds: Map<string, number>,
): Marker | null {
  const text = paragraph.compactText;
  const rawText = paragraph.rawText.replace(/\u00a0/g, "\u00a0");
  const headingSpan = {
    end: paragraph.endCodePoint,
    start: paragraph.startCodePoint,
  };
  const containerPatterns = [
    { rank: 0, type: "chapter", matcher: /^Chapter[\s ]+(.+?)[\u2010-\u2015-](.+)$/u },
    { rank: 1, type: "part", matcher: /^Part[\s ]+(.+?)[\u2010-\u2015-](.+)$/u },
    { rank: 2, type: "division", matcher: /^Division[\s ]+(.+?)[\u2010-\u2015-](.+)$/u },
    { rank: 3, type: "subdivision", matcher: /^Subdivision[\s ]+(.+?)[\u2010-\u2015-](.+)$/u },
    { rank: 0, type: "schedule", matcher: /^Schedule[\s ]+(.+?)(?:[\u2010-\u2015-](.+))?$/u },
  ] as const;

  for (const pattern of containerPatterns) {
    const match = text.match(pattern.matcher);

    if (!match) {
      continue;
    }

    while (stack.length > pattern.rank) {
      stack.pop();
    }

    const code = normalizeWhitespace(match[1] ?? "");
    const title = normalizeWhitespace(match[2] ?? "");
    const category = inferCategory(title, "main");
    const label = `${sentenceCase(pattern.type)} ${code}${title ? ` — ${title}` : ""}`;
    const marker: Marker = {
      category,
      code,
      headingSpan,
      id: makeStableId(pattern.type, code, title, seenIds),
      kind: "container",
      label,
      level: stack.length,
      paragraphIndex: paragraph.index,
      rank: pattern.rank,
      title: title || null,
      type: pattern.type,
    };
    stack.push(marker);
    return marker;
  }

  const unitMatch = rawText.match(
    /^([0-9]+[A-Z]?(?:[\u2010-\u2015-][0-9]+[A-Z]?)*)(?:\t| {2,}|\u00a0{2,})(.+)$/u,
  );

  if (!unitMatch) {
    return null;
  }

  const code = normalizeWhitespace(unitMatch[1] ?? "");
  const title = normalizeWhitespace(unitMatch[2] ?? "");
  const parentCategory = stack.at(-1)?.category ?? "main";
  const type = manifest.instrumentType === "statute" ? "section" : "rule";

  return {
    category: inferCategory(title, parentCategory),
    code,
    headingSpan,
    id: makeStableId(type, code, title, seenIds),
    kind: "unit",
    label: `${code} ${title}`,
    level: stack.length,
    paragraphIndex: paragraph.index,
    rank: 99,
    title,
    type,
  };
}

function buildStructure(
  manifest: InstrumentManifestEntry,
  paragraphs: Paragraph[],
  text: string,
): { bodySegments: Record<string, DerivedSegment>; frontMatterIds: string[]; orderedIds: string[]; endnoteIds: string[]; toc: TocItem[] } {
  const contentsIndex = paragraphs.findIndex((paragraph) => paragraph.compactText === "Contents");
  let tocEnd = contentsIndex;

  while (tocEnd >= 0 && paragraphs[tocEnd + 1] && /\t\d+$/.test(paragraphs[tocEnd + 1]!.rawText)) {
    tocEnd += 1;
  }

  const bodyParagraphs = paragraphs.slice(Math.max(0, tocEnd + 1));
  const bodyMarkers: Marker[] = [];
  const stack: Marker[] = [];
  const seenIds = new Map<string, number>();

  for (const paragraph of bodyParagraphs) {
    if (paragraph.compactText === "Endnotes") {
      break;
    }

    const marker = parseMarker(paragraph, manifest, stack, seenIds);

    if (marker) {
      bodyMarkers.push(marker);
    }
  }

  const segments: Record<string, DerivedSegment> = {};
  const orderedIds: string[] = [];
  const frontMatterIds: string[] = [];
  const endnoteIds: string[] = [];
  const toc: TocItem[] = [];

  const firstBodyMarker = bodyMarkers[0];
  const endnotesParagraph = bodyParagraphs.find((paragraph) => paragraph.compactText === "Endnotes");
  const bodyEndUtf16 = endnotesParagraph?.startUtf16 ?? text.length;

  if (firstBodyMarker) {
    const frontMatterEnd = paragraphs[firstBodyMarker.paragraphIndex]!.startUtf16;
    const frontMatterText = text.slice(0, frontMatterEnd).trim();

    if (frontMatterText) {
      const frontMatterId = "seg:front-matter";
      segments[frontMatterId] = {
        anchor: "front-matter",
        category: "front_matter",
        children: [],
        citationIds: [],
        code: null,
        crossreferenceIds: [],
        headingSpan: null,
        html: renderSegmentHtml(frontMatterText),
        id: frontMatterId,
        kind: "unit",
        label: "Compilation and front matter",
        level: 0,
        parent: null,
        span: {
          end: utf16RangeToCodePointSpan(buildCodePointIndex(text), frontMatterEnd, frontMatterEnd).end,
          start: 0,
        },
        termIds: [],
        text: frontMatterText,
        title: "Compilation and front matter",
        type: "front_matter",
      };
      orderedIds.push(frontMatterId);
      frontMatterIds.push(frontMatterId);
    }
  }

  const parentStack: Marker[] = [];

  for (let index = 0; index < bodyMarkers.length; index += 1) {
    const marker = bodyMarkers[index]!;
    const paragraph = paragraphs[marker.paragraphIndex]!;
    let segmentEndUtf16 = bodyEndUtf16;

    if (marker.kind === "container") {
      const boundary = bodyMarkers.slice(index + 1).find((candidate) => candidate.kind === "container" && candidate.rank <= marker.rank);
      segmentEndUtf16 = boundary ? paragraphs[boundary.paragraphIndex]!.startUtf16 : bodyEndUtf16;
    } else {
      const boundary = bodyMarkers[index + 1];
      segmentEndUtf16 = boundary ? paragraphs[boundary.paragraphIndex]!.startUtf16 : bodyEndUtf16;
    }

    while (parentStack.length > marker.level) {
      parentStack.pop();
    }

    const firstChildMarker = bodyMarkers.slice(index + 1).find((candidate) => candidate.level === marker.level + 1);
    const contentEndUtf16 =
      marker.kind === "container" && firstChildMarker ? paragraphs[firstChildMarker.paragraphIndex]!.startUtf16 : segmentEndUtf16;
    const bodyText = text.slice(paragraph.endUtf16, contentEndUtf16).trim();
    const parentId = parentStack.at(-1)?.id ?? null;
    const anchor = slugify(marker.label);

    segments[marker.id] = {
      anchor,
      category: marker.category,
      children: [],
      citationIds: [],
      code: marker.code,
      crossreferenceIds: [],
      headingSpan: marker.headingSpan,
      html: renderSegmentHtml(bodyText),
      id: marker.id,
      kind: marker.kind,
      label: marker.label,
      level: marker.level,
      parent: parentId,
      span: {
        end: utf16RangeToCodePointSpan(buildCodePointIndex(text), contentEndUtf16, contentEndUtf16).end,
        start: paragraph.startCodePoint,
      },
      termIds: [],
      text: bodyText,
      title: marker.title,
      type: marker.type,
    };
    orderedIds.push(marker.id);

    if (parentId) {
      segments[parentId]!.children.push(marker.id);
    }

    if (marker.kind === "container") {
      parentStack.push(marker);
    }

    toc.push({
      anchor,
      category: marker.category,
      id: marker.id,
      label: marker.label,
      level: marker.level,
      type: marker.type,
    });
  }

  if (endnotesParagraph) {
    const endnotesId = "seg:endnotes";
    const endnotesBodyParagraphs = paragraphs.slice(endnotesParagraph.index + 1);
    const endnoteMarkers = endnotesBodyParagraphs
      .map((paragraph) => {
        const match = paragraph.compactText.match(/^Endnote[\s ]+([0-9]+)[\u2010-\u2015-](.+)$/u);

        if (!match) {
          return null;
        }

        return {
          code: normalizeWhitespace(match[1] ?? ""),
          paragraph,
          title: normalizeWhitespace(match[2] ?? ""),
        };
      })
      .filter(Boolean) as { code: string; paragraph: Paragraph; title: string }[];

    const rootBodyEndUtf16 = endnoteMarkers[0]?.paragraph.startUtf16 ?? text.length;
    const rootText = text.slice(endnotesParagraph.endUtf16, rootBodyEndUtf16).trim();

    segments[endnotesId] = {
      anchor: "endnotes",
      category: "back_matter",
      children: [],
      citationIds: [],
      code: null,
      crossreferenceIds: [],
      headingSpan: {
        end: endnotesParagraph.endCodePoint,
        start: endnotesParagraph.startCodePoint,
      },
      html: renderSegmentHtml(rootText),
      id: endnotesId,
      kind: "container",
      label: "Endnotes",
      level: 0,
      parent: null,
      span: {
        end: utf16RangeToCodePointSpan(buildCodePointIndex(text), rootBodyEndUtf16, rootBodyEndUtf16).end,
        start: endnotesParagraph.startCodePoint,
      },
      termIds: [],
      text: rootText,
      title: "Endnotes",
      type: "endnotes",
    };
    orderedIds.push(endnotesId);
    endnoteIds.push(endnotesId);

    endnoteMarkers.forEach((marker, index) => {
      const next = endnoteMarkers[index + 1];
      const endUtf16 = next?.paragraph.startUtf16 ?? text.length;
      const bodyText = text.slice(marker.paragraph.endUtf16, endUtf16).trim();
      const id = `seg:endnote-${marker.code}`;

      segments[id] = {
        anchor: slugify(`endnote ${marker.code}`),
        category: "annotation",
        children: [],
        citationIds: [],
        code: marker.code,
        crossreferenceIds: [],
        headingSpan: {
          end: marker.paragraph.endCodePoint,
          start: marker.paragraph.startCodePoint,
        },
        html: renderSegmentHtml(bodyText),
        id,
        kind: "unit",
        label: `Endnote ${marker.code} — ${marker.title}`,
        level: 1,
        parent: endnotesId,
        span: {
          end: utf16RangeToCodePointSpan(buildCodePointIndex(text), endUtf16, endUtf16).end,
          start: marker.paragraph.startCodePoint,
        },
        termIds: [],
        text: bodyText,
        title: marker.title,
        type: "endnote",
      };
      segments[endnotesId]!.children.push(id);
      orderedIds.push(id);
      endnoteIds.push(id);
    });
  }

  return { bodySegments: segments, endnoteIds, frontMatterIds, orderedIds, toc };
}

function createInitialContext(): MarkerContext {
  return {
    byTypeAndCode: new Map<string, string>(),
    citationLookup: {},
    crossreferenceLookup: {},
    crossreferencesBySegment: {},
    termLookup: {},
  };
}

function registerSegmentCodes(segments: Record<string, DerivedSegment>, context: MarkerContext) {
  Object.values(segments).forEach((segment) => {
    if (!segment.code || !segment.type) {
      return;
    }

    context.byTypeAndCode.set(`${segment.type}:${normalizeSearchText(segment.code)}`, segment.id);
  });
}

function trimDefinition(value: string): string {
  const trimmed = normalizeWhitespace(value);
  const firstSentence = trimmed.match(/^(.+?[.;])( |$)/);
  return normalizeWhitespace(firstSentence?.[1] ?? trimmed).slice(0, 280);
}

function resolveCitationSlug(label: string, manifest: InstrumentManifestEntry[]): string | null {
  const normalized = normalizeSearchText(label);

  for (const entry of manifest) {
    if (entry.citationAliases.some((alias) => normalizeSearchText(alias) === normalized)) {
      return entry.slug;
    }
  }

  return null;
}

function extractTerms(
  fullText: string,
  segments: Record<string, DerivedSegment>,
  context: MarkerContext,
): void {
  for (const segment of Object.values(segments)) {
    const termCandidates: { definition: string; label: string }[] = [];

    if (segment.title) {
      const meaningMatch = segment.title.match(/^Meaning of (.+)$/i);

      if (meaningMatch && segment.text) {
        termCandidates.push({
          definition: trimDefinition(segment.text),
          label: normalizeWhitespace(meaningMatch[1] ?? ""),
        });
      }
    }

    if (segment.category === "scope" && segment.text) {
      const lines = segment.text
        .split(/\n+/)
        .map((line) => normalizeWhitespace(line))
        .filter(Boolean);

      for (const line of lines) {
        if (/^Note:/i.test(line)) {
          continue;
        }

        const match = line.match(/^([A-Za-z][A-Za-z0-9()/'’.,\- ]{1,120}?)\s+means\s+(.+)$/u);

        if (!match) {
          continue;
        }

        const rawLabel = normalizeWhitespace(match[1] ?? "");
        const label = rawLabel.replace(/, for .+$/i, "").trim();

        if (label.length < 3 || label.length > 100) {
          continue;
        }

        termCandidates.push({
          definition: trimDefinition(match[2] ?? ""),
          label,
        });
      }
    }

    for (const candidate of termCandidates) {
      const id = `term:${slugify(candidate.label)}`;

      if (!context.termLookup[id]) {
        context.termLookup[id] = {
          definition: candidate.definition,
          definitionSegmentId: segment.id,
          id,
          label: candidate.label,
          mentions: [],
          normalizedLabel: normalizeSearchText(candidate.label),
        };
      }
    }
  }

  for (const term of Object.values(context.termLookup)) {
    const spans = findAllCodePointSpans(
      fullText,
      new RegExp(`\\b${escapeRegExp(term.label).replace(/ /g, "\\s+")}\\b`, "giu"),
    );

    term.mentions = spans;

    for (const segment of Object.values(segments)) {
      if (spans.some((span) => span.start >= segment.span.start && span.end <= segment.span.end)) {
        segment.termIds.push(term.id);
      }
    }
  }
}

function extractCitations(
  fullText: string,
  manifest: InstrumentManifestEntry[],
  segments: Record<string, DerivedSegment>,
  context: MarkerContext,
): void {
  const genericCitationPattern =
    /\b([A-Z][A-Za-z()'’\-]+(?: [A-Z][A-Za-z()'’\-]+| of | and | on | the | to | with | under |, )*(?:Act|Rules|Rule|Regulations|Regulation) [0-9]{4})\b/gu;
  const fullIndex = buildCodePointIndex(fullText);
  const aliasMatchers = manifest.flatMap((entry) =>
    entry.citationAliases.map((alias) => ({
      alias,
      matcher: new RegExp(`\\b${escapeRegExp(alias).replace(/ /g, "\\s+")}\\b`, "giu"),
    })),
  );

  for (const segment of Object.values(segments)) {
    const segmentStartUtf16 = fullIndex[segment.span.start] ?? 0;
    const segmentEndUtf16 = fullIndex[segment.span.end] ?? fullText.length;
    const windowText = fullText.slice(segmentStartUtf16, segmentEndUtf16);
    const segmentMatches = [
      ...Array.from(windowText.matchAll(genericCitationPattern)),
      ...aliasMatchers.flatMap(({ alias, matcher }) =>
        Array.from(windowText.matchAll(matcher)).map((match) => {
          const result = Object.assign([...match], {
            index: match.index,
            input: match.input,
          }) as RegExpMatchArray;
          result[1] = alias;
          return result as RegExpMatchArray;
        }),
      ),
    ];
    const seenMentions = new Set<string>();

    for (const match of segmentMatches) {
      if (match.index === undefined) {
        continue;
      }

      const label = normalizeWhitespace(match[1] ?? "");

      if (label.length < 8 || label.length > 160) {
        continue;
      }

      const globalStartUtf16 = segmentStartUtf16 + match.index;
      const globalEndUtf16 = globalStartUtf16 + match[0].length;
      const mentionKey = `${globalStartUtf16}:${globalEndUtf16}:${label}`;

      if (seenMentions.has(mentionKey)) {
        continue;
      }

      seenMentions.add(mentionKey);
      const span = utf16RangeToCodePointSpan(fullIndex, globalStartUtf16, globalEndUtf16);
      const id = `citation:${slugify(label)}`;

      if (!context.citationLookup[id]) {
        context.citationLookup[id] = {
          id,
          label,
          mentions: [],
          normalizedLabel: normalizeSearchText(label),
          resolvedInstrumentSlug: resolveCitationSlug(label, manifest),
        };
      }

      context.citationLookup[id]!.mentions.push(span);

      if (!segment.citationIds.includes(id)) {
        segment.citationIds.push(id);
      }
    }
  }
}

function extractCrossreferences(
  fullText: string,
  manifest: InstrumentManifestEntry,
  segments: Record<string, DerivedSegment>,
  context: MarkerContext,
): void {
  const crossreferencePattern =
    /\b(section|sections|subsection|subsections|chapter|chapters|part|parts|division|divisions|subdivision|subdivisions|schedule|schedules)\s+([0-9]+[A-Z]?(?:[\u2010-\u2015-][0-9]+[A-Z]?)?(?:\([0-9A-Za-z]+\))?)/giu;
  const fullIndex = buildCodePointIndex(fullText);

  for (const segment of Object.values(segments)) {
    const segmentStartUtf16 = fullIndex[segment.span.start] ?? 0;
    const segmentEndUtf16 = fullIndex[segment.span.end] ?? fullText.length;
    const windowText = fullText.slice(segmentStartUtf16, segmentEndUtf16);
    const matches = Array.from(windowText.matchAll(crossreferencePattern));

    context.crossreferencesBySegment[segment.id] = [];

    for (const match of matches) {
      if (match.index === undefined) {
        continue;
      }

      const label = normalizeWhitespace(match[0] ?? "");
      const targetType = singularize((match[1] ?? "").toLowerCase());
      const rawCode = normalizeWhitespace(match[2] ?? "");
      const targetCode = normalizeSearchText(rawCode.replace(/\(.+\)$/, ""));
      const targetSegmentId = context.byTypeAndCode.get(`${targetType}:${targetCode}`) ?? null;
      const globalStartUtf16 = segmentStartUtf16 + match.index;
      const globalEndUtf16 = globalStartUtf16 + match[0].length;
      const span = utf16RangeToCodePointSpan(fullIndex, globalStartUtf16, globalEndUtf16);

      const record: CrossreferenceRecord = {
        id: `${segment.id}:${slugify(label)}:${context.crossreferencesBySegment[segment.id]!.length + 1}`,
        label,
        resolution: targetSegmentId ? "internal" : "unresolved",
        sourceSegmentId: segment.id,
        sourceSpan: span,
        targetInstrumentSlug: targetSegmentId ? manifest.slug : null,
        targetLabel: targetSegmentId ? segments[targetSegmentId]?.label ?? null : null,
        targetSegmentId,
        targetType,
      };

      context.crossreferencesBySegment[segment.id]!.push(record);
      context.crossreferenceLookup[record.id] = record;
      segment.crossreferenceIds.push(record.id);
    }
  }
}

function buildSearchRecords(
  manifest: InstrumentManifestEntry,
  segments: Record<string, DerivedSegment>,
  terms: Record<string, TermRecord>,
  citations: Record<string, CitationRecord>,
): SearchRecord[] {
  return Object.values(segments).map((segment) => {
    const excerpt = normalizeWhitespace(segment.text).slice(0, 320) || segment.label;
    const termLabels = segment.termIds.map((id) => terms[id]?.label).filter(Boolean) as string[];
    const citationLabels = segment.citationIds.map((id) => citations[id]?.label).filter(Boolean) as string[];

    return {
      anchor: segment.anchor,
      category: segment.category,
      citationLabels,
      code: segment.code,
      excerpt,
      instrumentSlug: manifest.slug,
      label: segment.label,
      searchText: normalizeSearchText([segment.label, excerpt, ...termLabels, ...citationLabels].join(" ")),
      segmentId: segment.id,
      termLabels,
      title: segment.title,
      type: segment.type,
    };
  });
}

export function buildFallbackBundle(
  manifest: InstrumentManifestEntry,
  text: string,
  manifestEntries: InstrumentManifestEntry[],
): EnrichedInstrumentBundle {
  const paragraphs = splitParagraphs(text);
  const { bodySegments, endnoteIds, frontMatterIds, orderedIds, toc } = buildStructure(manifest, paragraphs, text);
  const context = createInitialContext();

  registerSegmentCodes(bodySegments, context);
  extractTerms(text, bodySegments, context);
  extractCitations(text, manifestEntries, bodySegments, context);
  extractCrossreferences(text, manifest, bodySegments, context);

  return {
    citationLookup: context.citationLookup,
    crossreferenceLookup: context.crossreferenceLookup,
    endnoteIds,
    frontMatterIds,
    generatedAt: new Date().toISOString(),
    ilgsDocument: null,
    manifest,
    orderedSegmentIds: orderedIds,
    searchRecords: buildSearchRecords(manifest, bodySegments, context.termLookup, context.citationLookup),
    segments: bodySegments,
    sourceMode: "fallback",
    termLookup: context.termLookup,
    text,
    toc,
  };
}
