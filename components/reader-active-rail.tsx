"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";

import type { RelatedProvision, SimilarProvision } from "@/lib/types";

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

type RailPerson = {
  id: string;
  name: string;
  role: string;
};

type RailExternalDocument = {
  id: string;
  name: string;
  jurisdiction: string;
};

type RailPanel = {
  anchor: string;
  citations: RailCitation[];
  crossreferences: RailCrossreference[];
  id: string;
  label: string;
  relatedProvisions: RelatedProvision[];
  similarProvisions?: SimilarProvision[];
  terms: RailTerm[];
  persons?: RailPerson[];
  externalDocuments?: RailExternalDocument[];
};

type ReaderActiveRailProps = {
  instrumentTitles?: Record<string, string>;
  panels: Record<string, RailPanel>;
  instrumentSlug: string;
};

export function ReaderActiveRail({ instrumentTitles, panels, instrumentSlug }: ReaderActiveRailProps) {
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
    let timeoutIds: number[] = [];

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
      timeoutIds.forEach((id) => window.clearTimeout(id));
      timeoutIds = [];

      const hash = window.location.hash.slice(1);

      if (!hash) {
        scheduleSync();
        return;
      }

      const match = orderedPanelIds.find((id) => panels[id]?.anchor === hash);

      if (match) {
        let userHasScrolled = false;
        const onUserScroll = () => { userHasScrolled = true; };
        window.addEventListener("scroll", onUserScroll, { passive: true, once: true });

        const runHashSync = () => {
          if (userHasScrolled) {
            // User started scrolling — stop fighting them
            timeoutIds.forEach((id) => window.clearTimeout(id));
            timeoutIds = [];
            return;
          }

          document.getElementById(hash)?.scrollIntoView();
          setActivePanelId(match);
          scheduleSync();
        };

        // Try once immediately, then a few retries for slow renders
        [0, 200, 800].forEach((delay) => {
          timeoutIds.push(window.setTimeout(runHashSync, delay));
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

      timeoutIds.forEach((id) => window.clearTimeout(id));

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
    <aside className="margin-rail" aria-labelledby="margin-intelligence-title" tabIndex={0}>
      <div className="margin-rail__heading">
        <h2 id="margin-intelligence-title">
          <a className="margin-rail__tracking-link" href={`#${activePanel.anchor}`}>
            {activePanel.label}
          </a>
        </h2>
      </div>

      {activePanel.terms.length ? (
        <section className="margin-rail__section">
          <h3>Defined terms</h3>
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
        </section>
      ) : null}

      {activePanel.crossreferences.length ? (
        <section className="margin-rail__section">
          <h3>Crossreferences</h3>
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
        </section>
      ) : null}

      {activePanel.citations.length ? (
        <section className="margin-rail__section">
          <h3>Cited documents</h3>
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
        </section>
      ) : null}

      {activePanel.relatedProvisions.length ? (
        <section className="margin-rail__section">
          <h3>Other instruments</h3>
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
        </section>
      ) : null}

      {activePanel.persons?.length ? (
        <section className="margin-rail__section">
          <h3>Key entities</h3>
          <ul className="stack-list">
            {activePanel.persons.map((person) => (
              <li key={person.id}>
                <span>{person.name}</span>
                <p className="muted">{person.role.replace(/_/g, " ")}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activePanel.externalDocuments?.length ? (
        <section className="margin-rail__section">
          <h3>External legislation</h3>
          <ul className="stack-list">
            {activePanel.externalDocuments.map((doc) => (
              <li key={doc.id}>
                <span>{doc.name}</span>
                <p className="muted">{doc.jurisdiction}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activePanel.similarProvisions?.length ? (
        <section className="margin-rail__section">
          <h3>Similar provisions</h3>
          <ul className="stack-list">
            {activePanel.similarProvisions.slice(0, 5).map((provision) => (
              <li key={`${provision.instrumentSlug}:${provision.segmentId}`}>
                <a href={`/${provision.instrumentSlug}#${provision.anchor}`}>
                  {provision.label}
                </a>
                <p className="muted">
                  {instrumentTitles?.[provision.instrumentSlug] ?? provision.instrumentSlug.replace(/-/g, " ")}
                  {" · "}
                  {Math.round(provision.score * 100)}% similar
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="margin-rail__section">
        <a
          className="button button--secondary"
          href={`/pathway/${instrumentSlug}/${activePanel.anchor}`}
          style={{ fontSize: "0.8125rem" }}
        >
          Trace pathway →
        </a>
      </section>
    </aside>
  );
}
