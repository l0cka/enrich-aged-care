const prefixByType: Record<string, string> = {
  section: "s",
  subsection: "s",
  rule: "r",
  subrule: "r",
  schedule: "sch",
  clause: "cl",
  part: "pt",
  division: "div",
  chapter: "ch",
  paragraph: "para",
  subparagraph: "subpara",
};

/**
 * Build a formal Australian legislative citation for a segment.
 *
 * Examples:
 *   formatCitation({ type: "section", code: "65(1)" }, "Aged Care Act 2024")
 *   → "s 65(1) of the Aged Care Act 2024"
 */
export function formatCitation(
  segment: { type: string | null; code: string | null; label: string },
  instrumentTitle: string,
): string {
  const prefix = segment.type ? prefixByType[segment.type] : null;

  if (prefix && segment.code) {
    return `${prefix} ${segment.code} of the ${instrumentTitle}`;
  }

  return `${segment.label} of the ${instrumentTitle}`;
}

/**
 * Build a formatted export block for a single collected provision.
 */
export function formatExportBlock(
  citation: string,
  text: string,
): string {
  const trimmed = text.trim().replace(/\n{3,}/g, "\n\n");
  return `${citation}\n"${trimmed}"`;
}

/**
 * Build the full "Copy all" export text for a collection.
 */
export function formatCollectionExport(
  items: { citation: string; text: string }[],
): string {
  return items.map((item) => formatExportBlock(item.citation, item.text)).join("\n\n");
}

/**
 * Build the "Copy citations only" export text.
 */
export function formatCitationsOnly(citations: string[]): string {
  return citations.join("\n");
}
