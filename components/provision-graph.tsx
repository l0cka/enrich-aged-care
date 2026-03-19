"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GraphData } from "@/lib/server/graph";

type SimNode = {
  id: string;
  label: string;
  code: string | null;
  instrumentSlug: string;
  instrumentTitle: string;
  anchor: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  edges: number;
  neighborIndices: number[];
};

type SimEdge = {
  source: number;
  target: number;
};

const INSTRUMENT_COLORS: Record<string, { node: string; light: string }> = {
  "aged-care-act-2024": { node: "#6373c7", light: "#8b99d9" },
  "aged-care-rules-2025": { node: "#4da872", light: "#7bc49a" },
  "aged-care-consequential-and-transitional-provisions-rules-2025": { node: "#c4933a", light: "#d4ad66" },
};

function getColor(slug: string): string {
  return INSTRUMENT_COLORS[slug]?.node ?? "#888";
}

function getLightColor(slug: string): string {
  return INSTRUMENT_COLORS[slug]?.light ?? "#aaa";
}

type ProvisionGraphProps = {
  data: GraphData;
};

export function ProvisionGraph({ data }: ProvisionGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SimNode[]>([]);
  const [isDark, setIsDark] = useState(false);

  const simRef = useRef<{
    nodes: SimNode[];
    edges: SimEdge[];
    camera: { x: number; y: number; zoom: number };
    dragging: boolean;
    dragStart: { x: number; y: number } | null;
  }>({
    nodes: [],
    edges: [],
    camera: { x: 0, y: 0, zoom: 0.8 },
    dragging: false,
    dragStart: null,
  });

  // Detect theme
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.dataset.theme === "dark");
    check();
    window.addEventListener("enrich-aged-care-themechange", check);
    return () => window.removeEventListener("enrich-aged-care-themechange", check);
  }, []);

  // Initialize simulation
  useEffect(() => {
    const nodeIndex = new Map(data.nodes.map((n, i) => [n.id, i]));
    const edgeCountByNode = new Map<string, number>();
    const neighborsByNode = new Map<string, Set<number>>();

    for (const edge of data.edges) {
      edgeCountByNode.set(edge.source, (edgeCountByNode.get(edge.source) ?? 0) + 1);
      edgeCountByNode.set(edge.target, (edgeCountByNode.get(edge.target) ?? 0) + 1);

      const si = nodeIndex.get(edge.source) ?? -1;
      const ti = nodeIndex.get(edge.target) ?? -1;

      if (si >= 0 && ti >= 0) {
        const sn = neighborsByNode.get(edge.source) ?? new Set();
        sn.add(ti);
        neighborsByNode.set(edge.source, sn);

        const tn = neighborsByNode.get(edge.target) ?? new Set();
        tn.add(si);
        neighborsByNode.set(edge.target, tn);
      }
    }

    const nodes: SimNode[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      code: n.code,
      instrumentSlug: n.instrumentSlug,
      instrumentTitle: n.instrumentTitle,
      anchor: n.anchor,
      x: (Math.random() - 0.5) * 1200,
      y: (Math.random() - 0.5) * 900,
      vx: 0,
      vy: 0,
      edges: edgeCountByNode.get(n.id) ?? 0,
      neighborIndices: [...(neighborsByNode.get(n.id) ?? [])],
    }));

    const edges: SimEdge[] = data.edges
      .map((e) => ({
        source: nodeIndex.get(e.source) ?? -1,
        target: nodeIndex.get(e.target) ?? -1,
      }))
      .filter((e) => e.source >= 0 && e.target >= 0);

    simRef.current.nodes = nodes;
    simRef.current.edges = edges;
  }, [data]);

  // Force simulation + rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    let animationId = 0;
    let tickCount = 0;
    const maxTicks = 200;

    function resize() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    function tick() {
      const { nodes, edges, camera } = simRef.current;

      if (!nodes.length) {
        animationId = requestAnimationFrame(tick);
        return;
      }

      // Force simulation
      if (tickCount < maxTicks) {
        const alpha = Math.max(0.001, 1 - tickCount / maxTicks);

        // Repulsion (Barnes-Hut approximation: skip distant pairs)
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const distSq = dx * dx + dy * dy;

            if (distSq > 400000) continue;

            const dist = Math.sqrt(distSq) || 1;
            const force = (alpha * 600) / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }

        // Attraction along edges
        for (const edge of edges) {
          const s = nodes[edge.source];
          const t = nodes[edge.target];
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = alpha * (dist - 60) * 0.02;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          s.vx += fx;
          s.vy += fy;
          t.vx -= fx;
          t.vy -= fy;
        }

        // Instrument clustering
        const centers = new Map<string, { x: number; y: number; count: number }>();

        for (const node of nodes) {
          const c = centers.get(node.instrumentSlug) ?? { x: 0, y: 0, count: 0 };
          c.x += node.x;
          c.y += node.y;
          c.count++;
          centers.set(node.instrumentSlug, c);
        }

        for (const node of nodes) {
          const c = centers.get(node.instrumentSlug);

          if (c && c.count > 1) {
            node.vx += (c.x / c.count - node.x) * alpha * 0.008;
            node.vy += (c.y / c.count - node.y) * alpha * 0.008;
          }
        }

        // Apply velocity
        for (const node of nodes) {
          node.vx *= 0.4;
          node.vy *= 0.4;
          node.x += node.vx;
          node.y += node.vy;
        }

        tickCount++;
      }

      // Once physics settled, still render (for interaction updates) but skip physics

      // ── Render ────────────────────────────────────────────────
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      const bg = isDark ? "#1a1a2e" : "#fafafa";
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, w, h);
      ctx!.save();
      ctx!.translate(w / 2 + camera.x, h / 2 + camera.y);
      ctx!.scale(camera.zoom, camera.zoom);

      // Determine highlighted set
      const highlightSet = new Set<number>();
      let focusNodeIdx = -1;

      if (selectedNode) {
        focusNodeIdx = nodes.findIndex((n) => n.id === selectedNode.id);

        if (focusNodeIdx >= 0) {
          highlightSet.add(focusNodeIdx);
          nodes[focusNodeIdx].neighborIndices.forEach((ni) => highlightSet.add(ni));
        }
      }

      const hasHighlight = highlightSet.size > 0;

      // Draw edges
      for (const edge of edges) {
        const s = nodes[edge.source];
        const t = nodes[edge.target];

        if (selectedInstrument && s.instrumentSlug !== selectedInstrument && t.instrumentSlug !== selectedInstrument) {
          continue;
        }

        const isHighlighted = hasHighlight && (highlightSet.has(edge.source) && highlightSet.has(edge.target));

        if (hasHighlight && !isHighlighted) {
          ctx!.strokeStyle = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
          ctx!.lineWidth = 0.3;
        } else if (isHighlighted) {
          ctx!.strokeStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)";
          ctx!.lineWidth = 1.5;
        } else {
          ctx!.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
          ctx!.lineWidth = 0.4;
        }

        ctx!.beginPath();
        ctx!.moveTo(s.x, s.y);
        ctx!.lineTo(t.x, t.y);
        ctx!.stroke();
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (selectedInstrument && node.instrumentSlug !== selectedInstrument) {
          ctx!.globalAlpha = 0.06;
        } else if (hasHighlight && !highlightSet.has(i)) {
          ctx!.globalAlpha = 0.08;
        } else {
          ctx!.globalAlpha = 1;
        }

        const radius = Math.min(2.5 + node.edges * 0.6, 12);
        ctx!.fillStyle = getColor(node.instrumentSlug);
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx!.fill();

        // Draw label for high-connectivity nodes when zoomed in
        if (camera.zoom > 1.2 && node.edges >= 8 && ctx!.globalAlpha > 0.5) {
          const fontSize = 9 / camera.zoom;
          ctx!.font = `500 ${fontSize}px system-ui, sans-serif`;
          ctx!.fillStyle = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
          ctx!.textAlign = "left";
          ctx!.fillText(node.code ?? "", node.x + radius + 3, node.y + 3);
        }
      }

      ctx!.globalAlpha = 1;

      // Draw hovered/selected node label with background
      const labelNode = hoveredNode ?? selectedNode;

      if (labelNode) {
        const fontSize = Math.max(12, 14 / camera.zoom);
        ctx!.font = `600 ${fontSize}px system-ui, sans-serif`;
        const text = labelNode.label;
        const metrics = ctx!.measureText(text);
        const px = labelNode.x + 14;
        const py = labelNode.y;
        const pad = 4 / camera.zoom;

        // Background pill
        ctx!.fillStyle = isDark ? "rgba(30,30,50,0.92)" : "rgba(255,255,255,0.95)";
        ctx!.beginPath();
        ctx!.roundRect(
          px - pad,
          py - fontSize / 2 - pad,
          metrics.width + pad * 2,
          fontSize + pad * 2,
          pad * 2,
        );
        ctx!.fill();

        // Border
        ctx!.strokeStyle = getColor(labelNode.instrumentSlug);
        ctx!.lineWidth = 1 / camera.zoom;
        ctx!.stroke();

        // Text
        ctx!.fillStyle = isDark ? "#e8e8f0" : "#1a1a2e";
        ctx!.textAlign = "left";
        ctx!.textBaseline = "middle";
        ctx!.fillText(text, px, py);
        ctx!.textBaseline = "alphabetic";
      }

      ctx!.restore();

      // Zoom indicator
      ctx!.fillStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)";
      ctx!.font = "11px system-ui, sans-serif";
      ctx!.textAlign = "right";
      ctx!.fillText(`${Math.round(camera.zoom * 100)}%`, w - 12, h - 10);

      animationId = requestAnimationFrame(tick);
    }

    animationId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [data, hoveredNode, selectedNode, selectedInstrument, isDark]);

  // Mouse handlers
  const getNodeAtPosition = useCallback((clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current;

    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const { camera, nodes } = simRef.current;
    const mx = (clientX - rect.left - rect.width / 2 - camera.x) / camera.zoom;
    const my = (clientY - rect.top - rect.height / 2 - camera.y) / camera.zoom;
    let closest: SimNode | null = null;
    let closestDist = Infinity;

    for (const node of nodes) {
      const dx = node.x - mx;
      const dy = node.y - my;
      const dist = dx * dx + dy * dy;
      const hitRadius = Math.min(2.5 + node.edges * 0.6, 12) + 6;

      if (dist < hitRadius * hitRadius && dist < closestDist) {
        closest = node;
        closestDist = dist;
      }
    }

    return closest;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (simRef.current.dragging) {
      simRef.current.camera.x += e.movementX;
      simRef.current.camera.y += e.movementY;
      return;
    }

    setHoveredNode(getNodeAtPosition(e.clientX, e.clientY));
  }, [getNodeAtPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    simRef.current.dragging = true;
    simRef.current.dragStart = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const dragStart = simRef.current.dragStart;
    simRef.current.dragging = false;
    simRef.current.dragStart = null;

    if (dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        const node = getNodeAtPosition(e.clientX, e.clientY);
        setSelectedNode(node);
      }
    }
  }, [getNodeAtPosition]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    simRef.current.camera.zoom = Math.max(0.15, Math.min(6, simRef.current.camera.zoom * factor));
  }, []);

  // Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const q = searchQuery.toLowerCase();
    const results = simRef.current.nodes
      .filter((n) => n.label.toLowerCase().includes(q) || (n.code ?? "").toLowerCase().includes(q))
      .slice(0, 10);
    setSearchResults(results);
  }, [searchQuery]);

  const zoomToNode = useCallback((node: SimNode) => {
    simRef.current.camera.x = -node.x * simRef.current.camera.zoom;
    simRef.current.camera.y = -node.y * simRef.current.camera.zoom;
    simRef.current.camera.zoom = Math.max(simRef.current.camera.zoom, 1.5);
    setSelectedNode(node);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  return (
    <div className="graph-container">
      <div className="graph-toolbar">
        <div className="graph-search">
          <input
            className="graph-search__input"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sections…"
            type="search"
            value={searchQuery}
          />
          {searchResults.length > 0 ? (
            <ul className="graph-search__results">
              {searchResults.map((node) => (
                <li key={node.id}>
                  <button
                    className="graph-search__result"
                    onClick={() => zoomToNode(node)}
                    type="button"
                  >
                    <span className="graph-search__dot" style={{ background: getColor(node.instrumentSlug) }} />
                    <span>{node.label}</span>
                    <span className="graph-search__instrument">{node.instrumentTitle.replace(/Aged Care /, "")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="graph-legend">
          {data.instruments.map((inst) => (
            <button
              key={inst.slug}
              className={`graph-legend__item ${selectedInstrument === inst.slug ? "graph-legend__item--active" : ""}`}
              onClick={() => setSelectedInstrument(selectedInstrument === inst.slug ? null : inst.slug)}
              type="button"
            >
              <span className="graph-legend__dot" style={{ background: getColor(inst.slug) }} />
              {inst.title.replace("Aged Care ", "").replace("(Consequential and Transitional Provisions) ", "")}
            </button>
          ))}
        </div>
      </div>

      <div className="graph-body">
        <div className="graph-canvas-wrap" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="graph-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { simRef.current.dragging = false; setHoveredNode(null); }}
            onWheel={handleWheel}
            style={{ cursor: hoveredNode ? "pointer" : simRef.current.dragging ? "grabbing" : "grab" }}
          />
        </div>

        {selectedNode ? (
          <aside className="graph-detail">
            <div className="graph-detail__header">
              <span className="graph-detail__dot" style={{ background: getColor(selectedNode.instrumentSlug) }} />
              <h3>{selectedNode.label}</h3>
              <button
                className="graph-detail__close"
                onClick={() => setSelectedNode(null)}
                type="button"
                aria-label="Close detail"
              >
                ✕
              </button>
            </div>
            <p className="graph-detail__meta">{selectedNode.instrumentTitle}</p>
            <p className="graph-detail__meta">{selectedNode.edges} cross-instrument connection{selectedNode.edges === 1 ? "" : "s"}</p>

            {selectedNode.neighborIndices.length > 0 ? (
              <div className="graph-detail__neighbors">
                <p className="eyebrow">Connected to</p>
                <ul>
                  {selectedNode.neighborIndices.slice(0, 20).map((ni) => {
                    const neighbor = simRef.current.nodes[ni];

                    if (!neighbor) return null;

                    return (
                      <li key={neighbor.id}>
                        <button
                          className="graph-detail__neighbor"
                          onClick={() => zoomToNode(neighbor)}
                          type="button"
                        >
                          <span className="graph-detail__ndot" style={{ background: getColor(neighbor.instrumentSlug) }} />
                          {neighbor.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <a className="button button--primary graph-detail__link" href={`/${selectedNode.instrumentSlug}#${selectedNode.anchor}`}>
              Open in reader →
            </a>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
