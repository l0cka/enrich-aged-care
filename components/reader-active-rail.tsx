"use client";

import { useMemo } from "react";

import { useActiveReaderItem } from "@/components/use-active-reader-item";
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
  jurisdiction: string;
  name: string;
};

type RailPanel = {
  anchor: string;
  citations: RailCitation[];
  crossreferences: RailCrossreference[];
  externalDocuments?: RailExternalDocument[];
  id: string;
  label: string;
  persons?: RailPerson[];
  relatedProvisions: RelatedProvision[];
  similarProvisions?: SimilarProvision[];
  terms: RailTerm[];
};

type ReaderActiveRailProps = {
  instrumentSlug: string;
  instrumentTitles?: Record<string, string>;
  panels: Record<string, RailPanel>;
};

export function ReaderActiveRail({ instrumentSlug, instrumentTitles, panels }: ReaderActiveRailProps) {
  const orderedPanelIds = useMemo(() => Object.keys(panels), [panels]);
  const trackedItems = useMemo(
    () => orderedPanelIds.map((id) => ({ anchor: panels[id]!.anchor, id })),
    [orderedPanelIds, panels],
  );
  const activePanelId = useActiveReaderItem({
    items: trackedItems,
    selector: "[data-panel-id]",
    nodeIdAttribute: "data-panel-id",
    activationLineRatio: 0.26,
    maxActivationLine: 300,
    minActivationLine: 190,
  });

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
          <h3>External documents</h3>
          <ul className="stack-list">
            {activePanel.externalDocuments.map((document) => (
              <li key={document.id}>
                <span>{document.name}</span>
                <p className="muted">{document.jurisdiction}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activePanel.similarProvisions?.length ? (
        <section className="margin-rail__section">
          <h3>Semantically similar</h3>
          <ul className="stack-list">
            {activePanel.similarProvisions.map((provision) => (
              <li key={`${provision.instrumentSlug}:${provision.segmentId}`}>
                <a href={`/${provision.instrumentSlug}#${provision.anchor}`}>
                  {provision.label}
                </a>
                <p className="muted">
                  {(instrumentTitles?.[provision.instrumentSlug] ?? provision.instrumentSlug) === instrumentTitles?.[instrumentSlug]
                    ? provision.code ?? "Related provision"
                    : `${instrumentTitles?.[provision.instrumentSlug] ?? provision.instrumentSlug} · ${provision.code ?? "Related provision"}`}
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
