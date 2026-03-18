"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";

import type { RelatedProvision } from "@/lib/types";

type RailCrossreference = {
  href: string | null;
  id: string;
  label: string;
  resolution: "internal" | "cross_document" | "external" | "unresolved";
  targetLabel: string | null;
};

type RailCitation = {
  id: string;
  label: string;
  resolvedInstrumentSlug: string | null;
};

type RailTerm = {
  definition: string;
  id: string;
  label: string;
};

type RailPanel = {
  anchor: string;
  citations: RailCitation[];
  crossreferences: RailCrossreference[];
  id: string;
  label: string;
  relatedProvisions: RelatedProvision[];
  terms: RailTerm[];
};

type ReaderActiveRailProps = {
  panels: Record<string, RailPanel>;
};

export function ReaderActiveRail({ panels }: ReaderActiveRailProps) {
  const orderedPanelIds = useMemo(() => Object.keys(panels), [panels]);
  const [activePanelId, setActivePanelId] = useState<string | null>(orderedPanelIds[0] ?? null);

  const syncActivePanel = useEffectEvent(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-panel-id]"));

    if (!nodes.length) {
      return;
    }

    const activationLine = Math.min(Math.max(window.innerHeight * 0.26, 190), 300);
    let nextPanelId = nodes[0]?.getAttribute("data-panel-id");

    for (const node of nodes) {
      if (node.getBoundingClientRect().top <= activationLine) {
        nextPanelId = node.getAttribute("data-panel-id");
        continue;
      }

      break;
    }

    if (nextPanelId) {
      setActivePanelId((current) => (current === nextPanelId ? current : nextPanelId));
    }
  });

  useEffect(() => {
    if (!orderedPanelIds.length) {
      return;
    }

    let frameId = 0;

    const scheduleSync = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        syncActivePanel();
      });
    };

    const updateFromHash = () => {
      const hash = window.location.hash.slice(1);

      if (!hash) {
        scheduleSync();
        return;
      }

      const match = orderedPanelIds.find((id) => panels[id]?.anchor === hash);

      if (match) {
        window.requestAnimationFrame(() => {
          setActivePanelId(match);
          scheduleSync();
        });
      }
    };

    scheduleSync();
    updateFromHash();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("hashchange", updateFromHash);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("hashchange", updateFromHash);
    };
  }, [orderedPanelIds, panels]);

  const activePanel = (activePanelId ? panels[activePanelId] : null) ?? panels[orderedPanelIds[0] ?? ""];

  if (!activePanel) {
    return null;
  }

  return (
    <aside className="margin-rail" aria-labelledby="margin-intelligence-title">
      <div className="margin-rail__heading">
        <p className="eyebrow">Margin intelligence</p>
        <p className="margin-rail__tracking-label">Currently showing for</p>
        <h2 id="margin-intelligence-title">
          <a className="margin-rail__tracking-link" href={`#${activePanel.anchor}`}>
            {activePanel.label}
          </a>
        </h2>
      </div>

      <section className="margin-rail__section">
        <h3>Defined terms</h3>
        {activePanel.terms.length ? (
          <ul className="stack-list">
            {activePanel.terms.map((term) => (
              <li key={term.id}>
                <details className="term-disclosure">
                  <summary>{term.label}</summary>
                  <p>{term.definition}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No tracked defined terms in this segment.</p>
        )}
      </section>

      <section className="margin-rail__section">
        <h3>Crossreferences</h3>
        {activePanel.crossreferences.length ? (
          <ul className="stack-list">
            {activePanel.crossreferences.map((crossreference) => (
              <li key={crossreference.id}>
                {crossreference.href ? (
                  <a href={crossreference.href}>{crossreference.label}</a>
                ) : (
                  <span>{crossreference.label}</span>
                )}
                <p className="muted">
                  {crossreference.targetLabel ?? crossreference.resolution.replace(/_/g, " ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No parsed crossreferences in this segment.</p>
        )}
      </section>

      <section className="margin-rail__section">
        <h3>Cited documents</h3>
        {activePanel.citations.length ? (
          <ul className="stack-list">
            {activePanel.citations.map((citation) => (
              <li key={citation.id}>
                {citation.resolvedInstrumentSlug ? (
                  <a href={`/${citation.resolvedInstrumentSlug}`}>{citation.label}</a>
                ) : (
                  <span>{citation.label}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No tracked cited documents in this segment.</p>
        )}
      </section>

      <section className="margin-rail__section">
        <h3>Other instruments</h3>
        {activePanel.relatedProvisions.length ? (
          <ul className="stack-list">
            {activePanel.relatedProvisions.map((provision) => (
              <li key={provision.id}>
                <a href={`/${provision.otherInstrumentSlug}#${provision.otherAnchor}`}>{provision.otherLabel}</a>
                <p className="muted">
                  {provision.otherInstrumentTitle}
                  {" · "}
                  {provision.relationKind === "cites_this_provision"
                    ? `cites ${provision.triggerText}`
                    : provision.relationKind === "this_provision_cites"
                      ? `this section cites ${provision.triggerText}`
                      : `${provision.triggerText} via ${provision.viaLabel}`}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No linked provisions in the other corpus instruments.</p>
        )}
      </section>
    </aside>
  );
}
