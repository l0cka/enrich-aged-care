export type InlineLink = {
  start: number;
  end: number;
  href: string;
};

// ── HTML helpers ─────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInlineHtml(value: string): string {
  return escapeHtml(value).replace(/\t/g, "    ").replace(/\n/g, "<br />");
}

function normalizeTableHeader(value: string): string {
  return value.replace(/(Column\s*\d+)(?=[A-Z])/g, "$1 ");
}

function splitBlocks(bodyText: string): string[] {
  return bodyText
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+$/, "")) // trim trailing only, keep leading tabs
    .filter(Boolean);
}

function isColumnHeaderBlock(block: string): boolean {
  return /^\s*Column\s*\d+/i.test(block);
}

function isTableLeadBlock(block: string): boolean {
  return /^\s*Item\s*$/i.test(block) || isColumnHeaderBlock(block);
}

function looksLikeItemCell(value: string): boolean {
  return /^(?:\d+[A-Z]?|[A-Z]|[ivxlcdm]+)$/i.test(value.trim());
}

function looksLikeTableRow(cells: string[], headers: string[]): boolean {
  if (cells.some((cell) => !cell.trim())) {
    return false;
  }

  if (/^Item$/i.test(headers[0] ?? "")) {
    return looksLikeItemCell(cells[0] ?? "");
  }

  return true;
}

function countLeadingTabs(text: string): number {
  let count = 0;

  for (const char of text) {
    if (char === "\t") {
      count++;
    } else {
      break;
    }
  }

  return count;
}

function renderParagraph(block: string): string {
  // Count leading tabs for indentation level
  const tabs = countLeadingTabs(block);
  const trimmed = block.replace(/^\t+/, "");

  // Detect legislative paragraph labels: (1), (a), (i), (iv), etc.
  const labelMatch = trimmed.match(/^(\([a-z0-9]+\)|\([ivxlcdm]+\))\t+/i);

  if (labelMatch) {
    const label = escapeHtml(labelMatch[1]);
    const body = trimmed.slice(labelMatch[0].length);

    // Infer indent from the label pattern (more reliable than tab count)
    let indent: number;
    const rawLabel = labelMatch[1];

    if (/^\(\d+\)$/.test(rawLabel)) {
      indent = 1; // subsection: (1), (2)
    } else if (/^\([ivxlc]{2,}\)$/i.test(rawLabel)) {
      indent = 3; // multi-char roman numeral: (ii), (iv), (xi)
    } else if (/^\([a-hj-uw-z]\)$/i.test(rawLabel)) {
      indent = 2; // letter paragraph: (a)-(h), (j)-(u), (w)-(z) — excludes i,v,x
    } else if (/^\([ivx]\)$/i.test(rawLabel)) {
      indent = 3; // single roman numeral: (i), (v), (x)
    } else if (/^\([a-z]\)$/i.test(rawLabel)) {
      indent = 2; // fallback letter
    } else {
      indent = Math.max(1, Math.min(tabs, 4));
    }

    return `<div class="reader-block reader-block--provision reader-block--indent-${indent}"><span class="reader-block__label">${label}</span><span class="reader-block__text">${renderInlineHtml(body)}</span></div>`;
  }

  // Note blocks
  if (/^Note\s*\d*:/i.test(trimmed) || /^Example:/i.test(trimmed)) {
    return `<p class="reader-block reader-block--note">${renderInlineHtml(trimmed)}</p>`;
  }

  // Regular paragraph with indentation
  const indent = Math.min(tabs, 4);
  const indentClass = indent > 0 ? ` reader-block--indent-${indent}` : "";

  return `<p class="reader-block${indentClass}">${renderInlineHtml(trimmed)}</p>`;
}

function consumeTable(blocks: string[], startIndex: number): { html: string; nextIndex: number } | null {
  let cursor = startIndex;
  let caption: string | null = null;

  if (!isTableLeadBlock(blocks[cursor] ?? "") && isTableLeadBlock(blocks[cursor + 1] ?? "")) {
    caption = blocks[cursor] ?? null;
    cursor += 1;
  }

  if (!isTableLeadBlock(blocks[cursor] ?? "")) {
    return null;
  }

  const headers: string[] = [];

  if (/^Item$/i.test(blocks[cursor] ?? "")) {
    headers.push("Item");
    cursor += 1;
  }

  while (isColumnHeaderBlock(blocks[cursor] ?? "")) {
    headers.push(normalizeTableHeader(blocks[cursor] ?? ""));
    cursor += 1;
  }

  if (headers.length < 2) {
    return null;
  }

  const rows: string[][] = [];

  while (cursor + headers.length - 1 < blocks.length) {
    const candidate = blocks.slice(cursor, cursor + headers.length);

    if (!looksLikeTableRow(candidate, headers)) {
      break;
    }

    rows.push(candidate);
    cursor += headers.length;
  }

  if (!rows.length) {
    return null;
  }

  const captionHtml = caption ? `<caption>${renderInlineHtml(caption)}</caption>` : "";
  const headHtml = headers.map((header) => `<th scope="col">${renderInlineHtml(header)}</th>`).join("");
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) => {
            const tag = index === 0 && /^Item$/i.test(headers[0] ?? "") ? "th scope=\"row\"" : "td";
            return `<${tag}>${renderInlineHtml(cell)}</${tag.startsWith("th") ? "th" : "td"}>`;
          })
          .join("")}</tr>`,
    )
    .join("");

  return {
    html: `<div class="reader-table-wrap"><table class="reader-table">${captionHtml}<thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
    nextIndex: cursor,
  };
}

// ── Main export ──────────────────────────────────────────────────

export function renderSegmentHtml(bodyText: string, links?: InlineLink[]): string {
  const blocks = splitBlocks(bodyText);
  const parts: string[] = [];

  for (let index = 0; index < blocks.length; ) {
    const table = consumeTable(blocks, index);

    if (table) {
      parts.push(table.html);
      index = table.nextIndex;
      continue;
    }

    parts.push(renderParagraph(blocks[index]!));
    index += 1;
  }

  let html = parts.join("");

  // Post-render pass: inject inline cross-reference links by finding
  // the escaped reference text in the rendered HTML and wrapping it.
  if (links?.length) {
    // Sort by text length descending to avoid partial replacements
    const sorted = [...links].sort((a, b) => (b.end - b.start) - (a.end - a.start));

    for (const link of sorted) {
      const rawText = bodyText.slice(link.start, link.end);

      if (!rawText) continue;

      // Escape the text the same way renderInlineHtml does
      const escapedText = escapeHtml(rawText).replace(/\t/g, "    ").replace(/\n/g, "<br />");

      // Only replace the first occurrence that isn't already inside a tag
      const escapedForRegex = escapedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?<![">])${escapedForRegex}(?![^<]*>)`, "");
      const replacement = `<a href="${escapeHtml(link.href)}" class="inline-xref">${escapedText}</a>`;

      html = html.replace(pattern, replacement);
    }
  }

  return html;
}
