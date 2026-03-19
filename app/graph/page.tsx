import type { Metadata } from "next";

import { ProvisionGraph } from "@/components/provision-graph";
import { getGraphData } from "@/lib/server/graph";

export const metadata: Metadata = {
  title: "Provision Graph",
  description: "Interactive graph showing cross-instrument connections between provisions.",
};

export default async function GraphPage() {
  const graphData = await getGraphData();

  return (
    <div className="graph-page">
      <ProvisionGraph data={graphData} />
    </div>
  );
}
