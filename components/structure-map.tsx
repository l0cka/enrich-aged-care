"use client";

import Link from "next/link";
import { useState } from "react";

import { getInstrumentColor } from "@/lib/instruments";
import type { StructureNode } from "@/lib/server/structure";

type StructureMapProps = {
  instruments: StructureNode[];
};

export function StructureMap({ instruments }: StructureMapProps) {
  const [selectedInstrument, setSelectedInstrument] = useState<string>(
    instruments[0]?.instrumentSlug ?? "",
  );
  const [focusNode, setFocusNode] = useState<StructureNode | null>(null);

  const instrument = instruments.find((i) => i.instrumentSlug === selectedInstrument);
  const displayNode = focusNode ?? instrument;

  if (!instrument || !displayNode) return null;

  const children = displayNode.children.length > 0
    ? displayNode.children
    : [displayNode];

  return (
    <div className="structure-map">
      <div className="structure-map__controls">
        <div className="structure-map__tabs">
          {instruments.map((inst) => (
            <button
              key={inst.instrumentSlug}
              className={`structure-map__tab ${inst.instrumentSlug === selectedInstrument ? "structure-map__tab--active" : ""}`}
              onClick={() => { setSelectedInstrument(inst.instrumentSlug); setFocusNode(null); }}
              type="button"
            >
              {inst.label.replace("Aged Care ", "").replace("(Consequential and Transitional Provisions) ", "Transitional ")}
            </button>
          ))}
        </div>

        {focusNode ? (
          <button
            className="structure-map__back"
            onClick={() => setFocusNode(null)}
            type="button"
          >
            ← Back to full view
          </button>
        ) : null}
      </div>

      {focusNode ? (
        <div className="structure-map__breadcrumb">
          <span className="eyebrow">{focusNode.type}</span>
          <h2>{focusNode.label}</h2>
          <p className="muted">{focusNode.sectionCount} section{focusNode.sectionCount === 1 ? "" : "s"}</p>
        </div>
      ) : null}

      <div className="structure-map__grid">
        {children.map((child) => (
          <TreemapNode
            key={child.id}
            node={child}
            color={getInstrumentColor(selectedInstrument)}
            depth={0}
            onFocus={setFocusNode}
          />
        ))}
      </div>
    </div>
  );
}

type TreemapNodeProps = {
  node: StructureNode;
  color: string;
  depth: number;
  onFocus: (node: StructureNode) => void;
};

function TreemapNode({ node, color, depth, onFocus }: TreemapNodeProps) {
  const hasChildren = node.children.length > 0;
  const opacity = Math.max(0.08, 0.25 - depth * 0.05);
  const sectionCountLabel = `${node.sectionCount} section${node.sectionCount === 1 ? "" : "s"}`;

  if (node.sectionCount === 0) return null;

  return (
    <div
      className={`treemap-node treemap-node--depth-${Math.min(depth, 3)}`}
      style={{
        borderLeft: depth === 0 ? `3px solid ${color}` : undefined,
        background: `color-mix(in oklab, ${color} ${Math.round(opacity * 100)}%, transparent)`,
        flex: `${Math.max(node.sectionCount, 1)} 0 0`,
      }}
    >
      <div className="treemap-node__header">
        {hasChildren ? (
          <button
            aria-label={`Focus ${node.label} (${sectionCountLabel})`}
            className="treemap-node__label"
            onClick={() => onFocus(node)}
            type="button"
          >
            {node.label}
          </button>
        ) : (
          <Link
            aria-label={`Open ${node.label} (${sectionCountLabel})`}
            className="treemap-node__label"
            href={`/${node.instrumentSlug}#${node.anchor}`}
          >
            {node.label}
          </Link>
        )}
        <span aria-label={sectionCountLabel} className="treemap-node__count">
          {node.sectionCount}
        </span>
      </div>

      {hasChildren && depth < 2 ? (
        <div className="treemap-node__children">
          {node.children.map((child) => (
            <TreemapNode
              key={child.id}
              node={child}
              color={color}
              depth={depth + 1}
              onFocus={onFocus}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
