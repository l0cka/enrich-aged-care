import { describe, expect, it } from "vitest";

import { renderSegmentHtml } from "@/lib/render-segment-html";

describe("renderSegmentHtml", () => {
  it("upgrades item/column text blocks into an HTML table", () => {
    const html = renderSegmentHtml(`
Classification type ongoing for service group home support

Item

Column 1Priority categories

Column 2Eligibility criteria

1

Urgent

The individual has 5 or more points determined in accordance with subsection (2)

2

High

The individual has 4 points determined in accordance with subsection (2)
    `);

    expect(html).toContain("<table");
    expect(html).toContain("<caption>Classification type ongoing for service group home support</caption>");
    expect(html).toContain("<th scope=\"col\">Column 1 Priority categories</th>");
    expect(html).toContain("<th scope=\"row\">1</th>");
    expect(html).toContain("<td>Urgent</td>");
  });
});
