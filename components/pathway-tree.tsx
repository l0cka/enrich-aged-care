import Link from "next/link";

import { PinButton } from "@/components/pin-button";
import type { Pathway, PathwayRelationship } from "@/lib/types";

const relationshipLabels: Record<PathwayRelationship, string> = {
  delegates_to: "delegates to",
  specified_by: "specified by",
  references: "references",
  referenced_by: "referenced by",
  internal: "internal reference",
};

type PathwayTreeProps = {
  pathway: Pathway;
  instrumentTitles: Record<string, string>;
};

export function PathwayTree({ pathway, instrumentTitles }: PathwayTreeProps) {
  if (pathway.nodes.length <= 1) {
    return (
      <div className="pathway-empty">
        <p className="muted">No cross-instrument connections found for this provision.</p>
      </div>
    );
  }

  const nonSeedNodes = pathway.nodes.filter((node) => node.segmentId !== pathway.seed.segmentId);
  const edgesByTarget = new Map(pathway.edges.map((edge) => [edge.to, edge]));

  const groups = new Map<string, typeof nonSeedNodes>();

  for (const node of nonSeedNodes) {
    const existing = groups.get(node.instrumentSlug) ?? [];
    existing.push(node);
    groups.set(node.instrumentSlug, existing);
  }

  return (
    <div className="pathway-tree">
      {Array.from(groups.entries()).map(([slug, nodes]) => (
        <section key={slug} className="pathway-group">
          <h3 className="pathway-group__title">
            <span className="instrument-badge">
              {instrumentTitles[slug] ?? slug}
            </span>
          </h3>
          <ul className="pathway-group__list">
            {nodes.map((node) => {
              const edge = edgesByTarget.get(node.segmentId);

              return (
                <li key={node.segmentId} className="pathway-node">
                  <div className="pathway-node__header">
                    {edge ? (
                      <span className="pathway-node__relationship">
                        {relationshipLabels[edge.relationship]}
                      </span>
                    ) : null}
                    <Link
                      className="pathway-node__label"
                      href={`/${node.instrumentSlug}#${node.anchor}`}
                    >
                      {node.label}
                    </Link>
                    <PinButton
                      instrumentSlug={node.instrumentSlug}
                      segmentId={node.segmentId}
                      label={node.label}
                    />
                  </div>
                  <p className="pathway-node__preview">{node.text}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {pathway.truncated ? (
        <p className="pathway-truncation muted">
          Showing {pathway.nodes.length} of {pathway.totalCount} connected provisions
        </p>
      ) : null}
    </div>
  );
}
