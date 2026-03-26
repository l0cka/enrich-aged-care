import type { Metadata } from "next";

import { CompareView } from "@/components/compare-view";
import { getCompareData } from "@/lib/server/compare";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare Act & Rules",
  description: "Side-by-side view of Act provisions and the Rules that implement them.",
};

export default async function ComparePage() {
  const data = await getCompareData("aged-care-act-2024", "aged-care-rules-2025");

  return (
    <div className="compare-page">
      <header className="compare-page__header">
        <h1>Compare Act & Rules</h1>
        <p className="muted">
          Select an Act section to see the Rules provisions that reference it.
        </p>
      </header>
      <CompareView data={data} />
    </div>
  );
}
