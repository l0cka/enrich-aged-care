import type { Metadata } from "next";

import { StructureMap } from "@/components/structure-map";
import { getStructureData } from "@/lib/server/structure";

export const metadata: Metadata = {
  title: "Structure Map",
  description: "Visual hierarchy of Australia's aged care legislation.",
};

export default async function StructurePage() {
  const structureData = await getStructureData();

  return (
    <div className="structure-page">
      <header className="structure-page__header">
        <h1>Structure map</h1>
        <p className="muted">Visual hierarchy of the legislation. Click a container to zoom in, or click a leaf to open the reader.</p>
      </header>
      <StructureMap instruments={structureData.instruments} />
    </div>
  );
}
