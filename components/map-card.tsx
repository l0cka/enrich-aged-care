import Link from "next/link";

import type { PathwayMap } from "@/lib/types";

type MapCardProps = {
  map: PathwayMap;
};

export function MapCard({ map }: MapCardProps) {
  const provisionCount = map.sections.reduce((sum, section) => sum + section.provisions.length, 0);

  return (
    <Link href={`/maps/${map.id}`} className="map-card">
      <h2 className="map-card__title">{map.title}</h2>
      <p className="map-card__description">{map.description}</p>
      <div className="map-card__meta">
        <span>{provisionCount} provision{provisionCount === 1 ? "" : "s"}</span>
        {map.builtIn ? <span className="chip">Built-in</span> : <span className="chip">Custom</span>}
      </div>
    </Link>
  );
}
