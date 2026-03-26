import { describe, expect, it } from "vitest";

import { getRelatedProvisionIndex } from "@/lib/server/related-provisions";

describe("related provisions", () => {
  it("surfaces rules provisions directly and indirectly related to Act section 86", async () => {
    const index = await getRelatedProvisionIndex();
    const related = index["aged-care-act-2024:seg:2257"] ?? [];

    expect(
      related.some(
        (item) =>
          item.otherInstrumentSlug === "aged-care-rules-2025" &&
          item.otherLabel === "86‑5 All service groups—period in which priority category decisions must be made" &&
          item.relationKind === "cites_this_provision",
      ),
    ).toBe(true);

    expect(
      related.some(
        (item) =>
          item.otherInstrumentSlug === "aged-care-rules-2025" &&
          item.otherLabel === "87‑5 Priority categories and eligibility criteria for classification type ongoing" &&
          item.relationKind === "via_internal_reference" &&
          item.viaLabel?.includes("87 Priority categories"),
      ),
    ).toBe(true);
  });

  it("surfaces the Act provision cited by Rules 87-5", async () => {
    const index = await getRelatedProvisionIndex();
    const related = index["aged-care-rules-2025:seg:2999"] ?? [];

    expect(
      related.some(
        (item) =>
          item.otherInstrumentSlug === "aged-care-act-2024" &&
          item.otherLabel === "87 Priority categories and urgency ratings" &&
          item.relationKind === "this_provision_cites",
      ),
    ).toBe(true);
  });
});
