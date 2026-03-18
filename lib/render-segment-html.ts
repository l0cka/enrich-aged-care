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
    .map((block) => block.trim())
    .filter(Boolean);
}

function isColumnHeaderBlock(block: string): boolean {
  return /^Column\s*\d+/i.test(block);
}

function isTableLeadBlock(block: string): boolean {
  return /^Item$/i.test(block) || isColumnHeaderBlock(block);
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

function renderParagraph(block: string): string {
  const className =
    /^Note:/i.test(block) || /^Example:/i.test(block)
      ? "reader-block reader-block--note"
      : /^[([a-z0-9]+[)\].]/i.test(block)
        ? "reader-block reader-block--item"
        : "reader-block";

  return `<p class="${className}">${renderInlineHtml(block)}</p>`;
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

export function renderSegmentHtml(bodyText: string): string {
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

  return parts.join("");
}
