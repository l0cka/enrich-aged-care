import type { Metadata } from "next";

import { MapCard } from "@/components/map-card";
import { getBuiltInMaps } from "@/lib/server/maps";

export const metadata: Metadata = {
  title: "Decision Pathway Maps",
  description: "Pre-built and custom collections of provisions grouped by decision topic.",
};

export default async function MapsPage() {
  const builtInMaps = await getBuiltInMaps();

  return (
    <div className="maps-page">
      <div className="maps-page__header">
        <p className="eyebrow">Decision pathway maps</p>
        <h1>Navigate legislation by decision topic.</h1>
        <p>Each map collects the provisions relevant to a specific type of decision, in logical order across all instruments.</p>
      </div>

      {builtInMaps.length > 0 ? (
        <div className="maps-grid">
          {builtInMaps.map((map) => (
            <MapCard key={map.id} map={map} />
          ))}
        </div>
      ) : (
        <p className="muted">No maps available yet.</p>
      )}
    </div>
  );
}
