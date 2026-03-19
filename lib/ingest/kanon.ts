/**
 * Transforms a Kanon 2 Enricher ilgsDocument into an EnrichedInstrumentBundle.
 *
 * This replaces the regex-based fallback pipeline with ML-extracted data,
 * producing ~10x more segments (subsection/paragraph level) plus rich entity data.
 */

import type {
  CitationRecord,
  CrossreferenceRecord,
  DerivedSegment,
  EnrichedInstrumentBundle,
  ExternalDocumentRecord,
  InstrumentManifestEntry,
  PersonRecord,
  SearchRecord,
  SegmentCategory,
  Span,
  TermRecord,
  TocItem,
} from "@/lib/types";
import { renderSegmentHtml, type InlineLink } from "@/lib/render-segment-html";
import { normalizeSearchText, normalizeWhitespace, slugify } from "@/lib/normalize";

// ── Kanon document types (from ilgsDocument) ─────────────────────

type KanonSpan = { start: number; end: number };
type KanonTextRef = { start: number; end: number };

type KanonSegment = {
  id: string;
  kind: "container" | "unit" | "item" | "figure";
  type: string | null;
  category: string;
  type_name: string | null;
  code: string | KanonTextRef | null;
  title: KanonTextRef | null;
  parent: string | null;
  children: string[];
  level: number;
  span: KanonSpan;
};

type KanonCrossreference = {
  start: string; // segment ID
  end: string; // segment ID
  span: KanonSpan;
};

type KanonTerm = {
  id: string;
  name: KanonTextRef;
  meaning: KanonTextRef | null;
  mentions: KanonSpan[];
};

type KanonPerson = {
  id: string;
  name: KanonTextRef;
  type: "natural" | "politic";
  role: string;
  parent: string | null;
  children: string[];
  residence: unknown;
  mentions: KanonSpan[];
};

type KanonExternalDocument = {
  id: string;
  name: KanonTextRef;
  type: string;
  jurisdiction: string;
  reception: unknown;
  mentions: KanonSpan[];
  pinpoints: Array<{ span?: KanonSpan; start?: number; end?: number }>;
};

type KanonDocument = {
  version: string;
  text: string;
  title: KanonTextRef | null;
  subtitle: unknown;
  type: string;
  jurisdiction: string;
  segments: KanonSegment[];
  crossreferences: KanonCrossreference[];
  terms: KanonTerm[];
  persons: KanonPerson[];
  external_documents: KanonExternalDocument[];
  headings: KanonSpan[];
  locations: unknown[];
  dates: unknown[];
  quotes: unknown[];
  emails: unknown[];
  websites: unknown[];
  phone_numbers: unknown[];
  id_numbers: unknown[];
  junk: unknown[];
};

// ── Helpers ──────────────────────────────────────────────────────

function resolveText(text: string, ref: KanonTextRef | null): string | null {
  if (!ref) return null;
  return normalizeWhitespace(text.slice(ref.start, ref.end));
}

function resolveCode(code: string | KanonTextRef | null, text: string): string | null {
  if (!code) return null;

  if (typeof code === "object" && "start" in code) {
    return normalizeWhitespace(text.slice(code.start, code.end));
  }

  return normalizeWhitespace(String(code));
}

function makeAnchor(seg: KanonSegment, text: string): string {
  const code = resolveCode(seg.code, text) ?? "";
  const title = seg.title ? normalizeWhitespace(text.slice(seg.title.start, seg.title.end)) : "";
  const raw = [code, title].filter(Boolean).join("-");
  const slug = slugify(raw);
  return slug || slugify(seg.id);
}

function makeLabel(code: string | null, title: string | null): string {
  if (code && title) return `${code} ${title}`;
  return code ?? title ?? "(untitled)";
}

/**
 * For containers without an explicit title (chapters, parts, etc.),
 * extract the heading from the first line of the span text.
 * E.g. "Chapter 3—Registered providers..." → { code: "3", title: "Registered providers..." }
 */
function extractContainerHeading(
  seg: KanonSegment,
  text: string,
): { code: string | null; title: string | null; label: string } {
  const spanText = text.slice(seg.span.start, seg.span.end);
  const firstLine = spanText.split(/\n/)[0]?.trim() ?? "";

  // Pattern: "Chapter 3—Title" or "Part 1—Title" or "Division 2—Title"
  const match = firstLine.match(
    /^(Chapter|Part|Division|Subdivision|Schedule|Subpart)\s+(\d+[A-Z]?(?:\.\d+)?)\s*[—–\-]\s*(.+)/i,
  );

  if (match) {
    const numericCode = match[2];
    const titleText = normalizeWhitespace(match[3]);
    return {
      code: numericCode,
      title: titleText,
      label: `${match[1]} ${numericCode} — ${titleText}`,
    };
  }

  // Try just "Chapter N" without a dash
  const simpleMatch = firstLine.match(
    /^(Chapter|Part|Division|Subdivision|Schedule|Subpart)\s+(\d+[A-Z]?(?:\.\d+)?)\s*$/i,
  );

  if (simpleMatch) {
    return {
      code: simpleMatch[2],
      title: null,
      label: `${simpleMatch[1]} ${simpleMatch[2]}`,
    };
  }

  // Fall back to first line as label
  if (firstLine.length > 0 && firstLine.length < 120) {
    return { code: null, title: firstLine, label: firstLine };
  }

  return { code: null, title: null, label: "(untitled)" };
}

function spanOverlaps(outer: KanonSpan, inner: KanonSpan): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

function normalizeCategory(category: string): SegmentCategory {
  const valid: SegmentCategory[] = ["front_matter", "scope", "main", "annotation", "back_matter", "other"];
  return valid.includes(category as SegmentCategory) ? (category as SegmentCategory) : "other";
}

// ── Main builder ─────────────────────────────────────────────────

export function buildKanonBundle(
  manifest: InstrumentManifestEntry,
  rawText: string,
  ilgsDocument: unknown,
  _allManifests: InstrumentManifestEntry[],
): EnrichedInstrumentBundle {
  const doc = ilgsDocument as KanonDocument;
  const text = doc.text || rawText;

  // ── Build segment index ──────────────────────────────────────
  const kanonById = new Map(doc.segments.map((s) => [s.id, s]));

  // Deduplicate anchors
  const anchorCounts = new Map<string, number>();

  function uniqueAnchor(base: string): string {
    const count = anchorCounts.get(base) ?? 0;
    anchorCounts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  }

  // ── Build segments ───────────────────────────────────────────
  const segments: Record<string, DerivedSegment> = {};
  const orderedSegmentIds: string[] = [];

  // Sort by span start for ordered rendering
  const sortedKanon = [...doc.segments].sort((a, b) => a.span.start - b.span.start);

  for (const kseg of sortedKanon) {
    let title = resolveText(text, kseg.title);
    let code = resolveCode(kseg.code, text);
    const kind = kseg.kind === "container" ? "container" : "unit";

    // Fix A: For structural containers (chapter, part, division), only take text
    // up to the first child to avoid duplicating. Sections get full text since
    // they are the primary reading unit — their children are filtered from rendering.
    let segText: string;
    const isStructuralContainer = kseg.kind === "container" && kseg.type !== "section";

    if (isStructuralContainer && kseg.children.length > 0) {
      const firstChild = kanonById.get(kseg.children[0]);
      segText = firstChild
        ? text.slice(kseg.span.start, firstChild.span.start)
        : text.slice(kseg.span.start, kseg.span.end);
    } else {
      segText = text.slice(kseg.span.start, kseg.span.end);
    }

    // For containers without explicit title/code, extract from heading text
    let label: string;

    if (kind === "container" && !title && !code) {
      const extracted = extractContainerHeading(kseg, text);
      code = extracted.code;
      title = extracted.title;
      label = extracted.label;
    } else {
      label = makeLabel(code, title);
    }

    // Fix D: Infer type for segments with null type
    let type = kseg.type;

    if (!type && code) {
      if (/^\(\d+\)$/.test(code)) {
        type = "subsection";
      } else if (/^\([a-z]+\)$/i.test(code)) {
        type = "paragraph";
      } else if (/^\([ivxlcdm]+\)$/i.test(code)) {
        type = "subparagraph";
      }
    }

    // Infer type for containers from their label/text
    if (!type && kind === "container" && label !== "(untitled)") {
      const lowerLabel = label.toLowerCase();

      if (lowerLabel.startsWith("subdivision")) {
        type = "subdivision";
      } else if (lowerLabel.startsWith("division")) {
        type = "division";
      } else if (lowerLabel.startsWith("part")) {
        type = "part";
      } else if (lowerLabel.startsWith("chapter")) {
        type = "chapter";
      }
    }

    // Give notes a label from their text content
    if (type === "note" && label === "(untitled)" && segText.trim()) {
      const noteText = segText.trim().slice(0, 60);
      label = noteText.length < segText.trim().length ? noteText + "…" : noteText;
    }

    const anchor = uniqueAnchor(makeAnchor(kseg, text));

    // Heading span: use title span if available
    const headingSpan: Span | null = kseg.title
      ? { start: kseg.title.start, end: kseg.title.end }
      : null;

    segments[kseg.id] = {
      id: kseg.id,
      anchor,
      kind,
      type,
      category: normalizeCategory(kseg.category),
      level: kseg.level,
      code,
      title,
      label,
      parent: kseg.parent,
      children: kseg.children,
      span: kseg.span,
      headingSpan,
      text: segText,
      html: "", // filled below after crossrefs are built
      termIds: [],
      citationIds: [],
      crossreferenceIds: [],
    };

    orderedSegmentIds.push(kseg.id);
  }

  // ── Build terms ──────────────────────────────────────────────
  const termLookup: Record<string, TermRecord> = {};

  for (const kt of doc.terms) {
    const name = resolveText(text, kt.name) ?? "";
    const meaning = kt.meaning ? text.slice(kt.meaning.start, kt.meaning.end) : "";

    // Find which segment contains the definition
    let definitionSegmentId = "";

    if (kt.meaning) {
      for (const seg of sortedKanon) {
        if (spanOverlaps(seg.span, kt.meaning)) {
          definitionSegmentId = seg.id;
          // Don't break — keep going for tighter match (deeper nesting)
        }
      }
    }

    termLookup[kt.id] = {
      id: kt.id,
      label: name,
      normalizedLabel: normalizeSearchText(name),
      definition: normalizeWhitespace(meaning),
      definitionSegmentId,
      mentions: kt.mentions.map((m) => ({ start: m.start, end: m.end })),
    };
  }

  // ── Build citations from external documents ──────────────────
  const citationLookup: Record<string, CitationRecord> = {};

  for (const exd of doc.external_documents) {
    const name = resolveText(text, exd.name) ?? exd.id;

    citationLookup[exd.id] = {
      id: exd.id,
      label: name,
      normalizedLabel: normalizeSearchText(name),
      mentions: exd.mentions.map((m) => ({ start: m.start, end: m.end })),
      resolvedInstrumentSlug: null, // Could map to our instruments but not critical for v1
    };
  }

  // ── Build cross-references ───────────────────────────────────
  const crossreferenceLookup: Record<string, CrossreferenceRecord> = {};

  for (let i = 0; i < doc.crossreferences.length; i++) {
    const kxref = doc.crossreferences[i];
    const id = `xref:${i}`;
    const label = normalizeWhitespace(text.slice(kxref.span.start, kxref.span.end));
    const targetSeg = kanonById.get(kxref.end);
    const targetLabel = targetSeg ? makeLabel(
      resolveCode(targetSeg.code, text),
      resolveText(text, targetSeg.title),
    ) : null;

    crossreferenceLookup[id] = {
      id,
      label,
      sourceSpan: { start: kxref.span.start, end: kxref.span.end },
      sourceSegmentId: kxref.start,
      targetSegmentId: kxref.end,
      targetInstrumentSlug: manifest.slug, // internal refs
      targetLabel,
      targetType: targetSeg?.type ?? null,
      resolution: "internal",
    };
  }

  // ── Build provision code index for regex cross-reference detection ──
  // Kanon's crossreferences are mostly self-referencing (58-94%). We detect
  // "section 85", "subsection 65(2)" etc. in the text and link them to the
  // corresponding segments. This index maps "type:code" → segment metadata.
  const provisionByKey = new Map<string, { id: string; anchor: string; label: string; type: string | null }>();

  for (const seg of Object.values(segments)) {
    if (!seg.code) continue;

    if (seg.type === "section" || seg.type === "subsection" || seg.type === "rule"
      || seg.type === "subrule" || seg.type === "paragraph" || seg.type === "subparagraph") {
      const key = `${seg.type}:${normalizeSearchText(seg.code)}`;
      provisionByKey.set(key, { id: seg.id, anchor: seg.anchor, label: seg.label, type: seg.type });
    }
  }

  // Also build a section-only index for fallback (when "section 65" references just the base number)
  const sectionByCode = new Map<string, { id: string; anchor: string; label: string; type: string | null }>();

  for (const seg of Object.values(segments)) {
    if (seg.code && seg.type === "section") {
      sectionByCode.set(normalizeSearchText(seg.code), { id: seg.id, anchor: seg.anchor, label: seg.label, type: seg.type });
    }
  }

  const refPattern = /\b(sections?|subsections?|rules?|subrules?|paragraphs?|subparagraphs?)\s+(\d+[A-Z]?(?:[‑\u2010-\u2015\-]\d+[A-Z]?)?(?:\(\d+\))?(?:\([a-z]+\))?(?:\([ivxlc]+\))?)/gi;

  function singularizeType(raw: string): string {
    const lower = raw.toLowerCase();
    if (lower.endsWith("s")) return lower.slice(0, -1);
    return lower;
  }

  function resolveRefTarget(
    rawType: string,
    fullCode: string,
    sourceSegId: string,
  ): { id: string; anchor: string; label: string; type: string | null } | null {
    const type = singularizeType(rawType);
    const normalizedFull = normalizeSearchText(fullCode);
    const baseCode = fullCode.replace(/\(.*$/, "");
    const normalizedBase = normalizeSearchText(baseCode);

    // Try exact type:code match first
    const exact = provisionByKey.get(`${type}:${normalizedFull}`);
    if (exact && exact.id !== sourceSegId) return exact;

    // Try section fallback (e.g., "subsection 65(2)" → section 65)
    const section = sectionByCode.get(normalizedBase);
    if (section && section.id !== sourceSegId) return section;

    return null;
  }

  // Note: regex xrefs are NOT created here. They are created in the HTML
  // generation loop below, AFTER heading stripping, so span offsets are
  // computed relative to the final body text.

  // ── Assign terms, citations, and crossrefs to segments ───────

  // Build a sorted segment list for binary-search-style overlap checks
  const segSpans = sortedKanon.map((s) => ({ id: s.id, start: s.span.start, end: s.span.end }));

  function findDeepestSegment(offset: number): string | null {
    let best: string | null = null;

    for (const seg of segSpans) {
      if (seg.start > offset) break;
      if (offset >= seg.start && offset < seg.end) {
        best = seg.id; // later = deeper nesting (sorted by start, deeper segments come after)
      }
    }

    return best;
  }

  // Assign term mentions to segments
  for (const [termId, term] of Object.entries(termLookup)) {
    for (const mention of term.mentions) {
      const segId = findDeepestSegment(mention.start);

      if (segId && segments[segId] && !segments[segId].termIds.includes(termId)) {
        segments[segId].termIds.push(termId);
      }
    }
  }

  // Fix C: Propagate termIds up to parent segments so sections show
  // all terms from their children (e.g., section 7 Definitions)
  for (const seg of Object.values(segments)) {
    if (!seg.termIds.length) continue;

    let parentId = seg.parent;

    while (parentId) {
      const parent = segments[parentId];
      if (!parent) break;

      for (const termId of seg.termIds) {
        if (!parent.termIds.includes(termId)) {
          parent.termIds.push(termId);
        }
      }

      parentId = parent.parent;
    }
  }

  // Assign citation mentions to segments
  for (const [citId, cit] of Object.entries(citationLookup)) {
    for (const mention of cit.mentions) {
      const segId = findDeepestSegment(mention.start);

      if (segId && segments[segId] && !segments[segId].citationIds.includes(citId)) {
        segments[segId].citationIds.push(citId);
      }
    }
  }

  // Assign Kanon crossrefs to segments (regex xrefs added in HTML loop below)
  for (const [xrefId, xref] of Object.entries(crossreferenceLookup)) {
    const seg = segments[xref.sourceSegmentId];

    if (seg && !seg.crossreferenceIds.includes(xrefId)) {
      seg.crossreferenceIds.push(xrefId);
    }
  }

  // ── Fix 4: Resolve citations to instrument slugs ──────────────
  for (const cit of Object.values(citationLookup)) {
    for (const m of _allManifests) {
      if (m.citationAliases.some((alias) =>
        normalizeSearchText(alias) === normalizeSearchText(cit.label),
      )) {
        cit.resolvedInstrumentSlug = m.slug;
        break;
      }
    }
  }

  // ── Fix 5: Text-based term scanning ───────────────────────────
  // After mention-based assignment + parent propagation, scan segment text
  // for defined term labels to improve coverage from ~3% to broader.
  const termsByNormLabel = new Map<string, string>();

  for (const [id, term] of Object.entries(termLookup)) {
    const norm = normalizeSearchText(term.label);
    if (norm.length >= 3) { // skip very short terms to avoid false matches
      termsByNormLabel.set(norm, id);
    }
  }

  for (const seg of Object.values(segments)) {
    if (!seg.text || seg.termIds.length >= 20) continue;

    const normalizedText = normalizeSearchText(seg.text);

    for (const [termText, termId] of termsByNormLabel) {
      if (seg.termIds.length >= 20) break;
      if (normalizedText.includes(termText) && !seg.termIds.includes(termId)) {
        seg.termIds.push(termId);
      }
    }
  }

  // ── Generate HTML with inline regex cross-references ──────────
  // Regex xrefs are detected HERE (after heading stripping) so that
  // match.index offsets are relative to the final body text. This fixes
  // the 95% span misalignment issue for Rules.
  let xrefCounter = Object.keys(crossreferenceLookup).length;

  for (const seg of Object.values(segments)) {
    let bodyText = seg.text;

    if (!bodyText.trim()) {
      seg.html = "";
      continue;
    }

    // Strip the heading from the body text to avoid duplication
    let headingStrip = 0;

    if (seg.code && seg.title) {
      const headingLine = `${seg.code}  ${seg.title}`;
      const blocks = bodyText.split(/\n{2,}/);

      if (blocks[0]?.replace(/\s+/g, " ").trim() === headingLine.replace(/\s+/g, " ").trim()) {
        headingStrip = blocks[0].length;
        const rest = bodyText.slice(headingStrip);
        const newlineMatch = rest.match(/^\n+/);
        headingStrip += newlineMatch ? newlineMatch[0].length : 0;
        bodyText = bodyText.slice(headingStrip);
      }
    }

    seg.text = bodyText;

    // Build inline links from Kanon crossrefs (global offsets)
    const inlineLinks: InlineLink[] = [];

    for (const xrefId of seg.crossreferenceIds) {
      const xref = crossreferenceLookup[xrefId];

      if (!xref?.targetSegmentId) continue;

      const targetSeg = segments[xref.targetSegmentId];

      if (!targetSeg) continue;

      const localStart = xref.sourceSpan.start - seg.span.start - headingStrip;
      const localEnd = xref.sourceSpan.end - seg.span.start - headingStrip;

      if (localStart >= 0 && localEnd <= bodyText.length) {
        inlineLinks.push({ start: localStart, end: localEnd, href: `#${targetSeg.anchor}` });
      }
    }

    // Regex-based internal reference detection on the STRIPPED body text
    // so match.index is relative to bodyText directly
    for (const match of bodyText.matchAll(refPattern)) {
      const target = resolveRefTarget(match[1], match[2], seg.id);

      if (!target) continue;

      const localStart = match.index ?? 0;
      const localEnd = localStart + match[0].length;

      // Skip if overlapping with an existing Kanon inline link
      const overlaps = inlineLinks.some(
        (link) => localStart < link.end && localEnd > link.start,
      );

      if (overlaps) continue;

      // Also create a crossref record for the margin rail
      const id = `xref:${xrefCounter++}`;
      const globalStart = seg.span.start + headingStrip + localStart;

      crossreferenceLookup[id] = {
        id,
        label: match[0],
        sourceSpan: { start: globalStart, end: globalStart + match[0].length },
        sourceSegmentId: seg.id,
        targetSegmentId: target.id,
        targetInstrumentSlug: manifest.slug,
        targetLabel: target.label,
        targetType: target.type,
        resolution: "internal",
      };

      seg.crossreferenceIds.push(id);
      inlineLinks.push({ start: localStart, end: localEnd, href: `#${target.anchor}` });
    }

    seg.html = renderSegmentHtml(bodyText, inlineLinks.length > 0 ? inlineLinks : undefined);
  }

  // ── Build TOC ────────────────────────────────────────────────
  const toc: TocItem[] = [];

  for (const seg of sortedKanon) {
    // Include containers and sections in TOC
    if (seg.kind !== "container" && seg.type !== "section") continue;

    const derived = segments[seg.id];
    if (!derived) continue;

    // Skip untitled entries, empty containers, TOC segments, and notes from the TOC
    if (derived.label === "(untitled)") continue;
    if (seg.type === "table_of_contents") continue;
    if (seg.type === "note") continue;
    if (!derived.text?.trim() && !derived.title) continue;

    // Skip front-matter items — these are the document's own TOC entries
    // with page numbers (e.g. "Part 7 — Reportable incidents 87")
    const segCategory = normalizeCategory(seg.category);
    if (segCategory === "front_matter") continue;

    // Strip trailing page numbers from labels (e.g. "Part 1 — Introduction\t95" → "Part 1 — Introduction")
    let tocLabel = derived.label.replace(/[\t\s]+\d+\s*$/, "").trim();
    if (!tocLabel) tocLabel = derived.label;

    toc.push({
      id: seg.id,
      anchor: derived.anchor,
      label: tocLabel,
      level: seg.level,
      type: seg.type,
      category: segCategory,
    });
  }

  // ── Build front matter and endnote ID lists ──────────────────
  const frontMatterIds = orderedSegmentIds.filter(
    (id) => segments[id]?.category === "front_matter",
  );
  const endnoteIds = orderedSegmentIds.filter(
    (id) => segments[id]?.category === "back_matter",
  );

  // ── Build search records ─────────────────────────────────────
  const searchRecords: SearchRecord[] = [];

  for (const seg of Object.values(segments)) {
    // Index unit segments and section containers with content
    if (!seg.text.trim()) continue;
    if (seg.kind !== "unit" && seg.type !== "section") continue;

    const excerpt = seg.text.slice(0, 200).trim();
    const termLabels = seg.termIds
      .map((id) => termLookup[id]?.label)
      .filter(Boolean);
    const citationLabels = seg.citationIds
      .map((id) => citationLookup[id]?.label)
      .filter(Boolean);

    searchRecords.push({
      instrumentSlug: manifest.slug,
      segmentId: seg.id,
      anchor: seg.anchor,
      label: seg.label,
      code: seg.code,
      title: seg.title,
      type: seg.type,
      category: seg.category,
      excerpt,
      searchText: normalizeSearchText([seg.label, seg.text, ...termLabels, ...citationLabels].join(" ")),
      termLabels,
      citationLabels,
    });
  }

  // ── Build person lookup ──────────────────────────────────────
  const personLookup: Record<string, PersonRecord> = {};

  for (const kp of doc.persons) {
    const name = resolveText(text, kp.name) ?? kp.id;

    personLookup[kp.id] = {
      id: kp.id,
      name,
      type: kp.type,
      role: kp.role,
      mentions: kp.mentions.map((m) => ({ start: m.start, end: m.end })),
    };
  }

  // ── Build external document lookup ───────────────────────────
  const externalDocumentLookup: Record<string, ExternalDocumentRecord> = {};

  for (const exd of doc.external_documents) {
    const name = resolveText(text, exd.name) ?? exd.id;

    externalDocumentLookup[exd.id] = {
      id: exd.id,
      name,
      type: exd.type,
      jurisdiction: exd.jurisdiction,
      mentions: exd.mentions.map((m) => ({ start: m.start, end: m.end })),
    };
  }

  // ── Assemble bundle ──────────────────────────────────────────
  return {
    manifest,
    generatedAt: new Date().toISOString(),
    sourceMode: "isaacus",
    text,
    ilgsDocument,
    crossreferenceLookup,
    toc,
    orderedSegmentIds,
    segments,
    termLookup,
    citationLookup,
    searchRecords,
    frontMatterIds,
    endnoteIds,
    personLookup,
    externalDocumentLookup,
  };
}
