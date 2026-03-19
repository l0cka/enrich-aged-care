import type { EnrichedInstrumentBundle } from "@/lib/types";

export type ReaderVisibility = {
  showEndnotes: boolean;
  showFrontMatter: boolean;
};

export function getVisibleSegmentIds(
  bundle: EnrichedInstrumentBundle,
  visibility: ReaderVisibility,
): string[] {
  // Build sets for quick lookup — children of sections are absorbed into
  // the section's full-text rendering, and TOC containers are hidden entirely.
  const sectionIds = new Set<string>();
  const tocIds = new Set<string>();

  for (const seg of Object.values(bundle.segments)) {
    if (seg.type === "section" && seg.kind === "container") {
      sectionIds.add(seg.id);
    }

    if (seg.type === "table_of_contents") {
      tocIds.add(seg.id);
    }
  }

  return bundle.orderedSegmentIds.filter((id) => {
    const segment = bundle.segments[id];

    if (!segment) {
      return false;
    }

    // Sections and their structural parents (parts, chapters) are always shown —
    // front/back matter filtering only hides non-legislative metadata segments.
    const isLegislativeProvision = segment.type === "section" || segment.type === "part"
      || segment.type === "chapter" || segment.type === "division" || segment.type === "subdivision"
      || segment.type === "subsection" || segment.type === "paragraph" || segment.type === "note";

    if (!isLegislativeProvision) {
      if (!visibility.showFrontMatter && bundle.frontMatterIds.includes(id)) {
        return false;
      }

      if (!visibility.showEndnotes && bundle.endnoteIds.includes(id)) {
        return false;
      }
    }

    // Skip "item" and "figure" kind segments — they are list items or tables
    // already included in their parent segment's rendered text
    if (segment.kind !== "container" && segment.kind !== "unit") {
      return false;
    }

    // Skip table of contents segments
    if (segment.type === "table_of_contents") {
      return false;
    }

    // Skip segments with no type and no title — TOC line items,
    // structural fragments, or other non-legislative content
    if (!segment.type && segment.label === "(untitled)") {
      return false;
    }

    // Skip any untitled segment with no body text
    if (segment.label === "(untitled)" && !segment.text?.trim()) {
      return false;
    }

    // Skip empty containers (no body text to render)
    if (segment.kind === "container" && !segment.text?.trim()) {
      return false;
    }

    // Skip standalone note segments — they clutter the reader as
    // separate "(untitled)" blocks. Notes within sections are
    // already part of the section's rendered text.
    if (segment.type === "note" && segment.kind === "unit") {
      return false;
    }

    // Skip note containers — their children are absorbed into parent sections
    if (segment.type === "note" && segment.kind === "container") {
      return false;
    }

    // Skip descendants of sections — sections render their full text,
    // so subsections, paragraphs, and notes within them are already visible.
    // Also skip descendants of TOC containers.
    let ancestor = segment.parent;

    while (ancestor) {
      if (sectionIds.has(ancestor) || tocIds.has(ancestor)) {
        return false;
      }

      ancestor = bundle.segments[ancestor]?.parent ?? null;
    }

    return true;
  });
}
