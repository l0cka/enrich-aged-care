"use client";

import Link from "next/link";
import { useState } from "react";

import { PinButton } from "@/components/pin-button";
import type { CompareData, CompareSection } from "@/lib/server/compare";

// Note: HTML content comes from pre-generated trusted instrument data (renderSegmentHtml),
// not from user input. This is the same pattern used throughout the reader (app/[slug]/page.tsx).

type CompareViewProps = {
  data: CompareData;
};

export function CompareView({ data }: CompareViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterLinked, setFilterLinked] = useState(false);

  const visibleSections = filterLinked
    ? data.sections.filter((s) => s.relatedProvisions.length > 0)
    : data.sections;

  const selected = selectedId
    ? data.sections.find((s) => s.id === selectedId)
    : null;

  return (
    <div className="compare-layout">
      <div className="compare-pane compare-pane--left">
        <div className="compare-pane__header">
          <h2>{data.leftTitle}</h2>
          <label className="compare-filter">
            <input
              checked={filterLinked}
              onChange={(e) => setFilterLinked(e.target.checked)}
              type="checkbox"
            />
            Only show linked sections
          </label>
        </div>

        <ul className="compare-section-list">
          {visibleSections.map((section) => (
            <li key={section.id}>
              <button
                aria-controls={`compare-section-panel-${section.id}`}
                aria-expanded={selectedId === section.id}
                className={`compare-section-btn ${selectedId === section.id ? "compare-section-btn--active" : ""} ${section.relatedProvisions.length > 0 ? "compare-section-btn--linked" : ""}`}
                onClick={() => setSelectedId(selectedId === section.id ? null : section.id)}
                type="button"
              >
                <span className="compare-section-btn__label">{section.label}</span>
                {section.relatedProvisions.length > 0 ? (
                  <span className="compare-section-btn__badge">
                    {section.relatedProvisions.length}
                  </span>
                ) : null}
              </button>

              {selectedId === section.id ? (
                <div
                  className="compare-section-expanded"
                  id={`compare-section-panel-${section.id}`}
                >
                  {/* Pre-generated trusted HTML from renderSegmentHtml — same pattern as reader */}
                  <div
                    className="reader-segment__body"
                    dangerouslySetInnerHTML={{ __html: section.html }}
                  />
                  <div className="compare-section-actions">
                    <PinButton
                      instrumentSlug={data.leftSlug}
                      segmentId={section.id}
                      label={section.label}
                    />
                    <Link
                      className="compare-link"
                      href={`/${data.leftSlug}#${section.anchor}`}
                    >
                      Open in reader
                    </Link>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="compare-pane compare-pane--right">
        <div className="compare-pane__header">
          <h2>{data.rightTitle}</h2>
        </div>

        {selected ? (
          <CompareRightPane section={selected} data={data} />
        ) : (
          <div className="compare-empty">
            <p className="muted">
              Select a section on the left to see related provisions from the {data.rightTitle}.
            </p>
            <p className="muted">
              {data.totalWithRelated} of {data.sections.length} sections have related provisions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareRightPane({ section, data }: { section: CompareSection; data: CompareData }) {
  if (section.relatedProvisions.length === 0) {
    return (
      <div className="compare-empty">
        <p className="muted">
          No provisions in the {data.rightTitle} reference this section.
        </p>
      </div>
    );
  }

  return (
    <ul className="compare-related-list">
      {section.relatedProvisions.map((rp) => (
        <li key={rp.segmentId} className="compare-related-item">
          <div className="compare-related-item__header">
            <span className="compare-related-item__label">{rp.label}</span>
            <div className="compare-related-item__actions">
              <PinButton
                instrumentSlug={rp.instrumentSlug}
                segmentId={rp.segmentId}
                label={rp.label}
              />
              <Link
                className="compare-link"
                href={`/${rp.instrumentSlug}#${rp.anchor}`}
              >
                Open
              </Link>
            </div>
          </div>
          <p className="compare-related-item__trigger">{rp.triggerText}</p>
          {rp.html ? (
            /* Pre-generated trusted HTML from renderSegmentHtml */
            <div
              className="reader-segment__body"
              dangerouslySetInnerHTML={{ __html: rp.html }}
            />
          ) : rp.text ? (
            <p className="compare-related-item__text">{rp.text.slice(0, 300)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
