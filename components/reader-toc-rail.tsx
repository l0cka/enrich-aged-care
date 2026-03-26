"use client";

import { useEffect, useMemo } from "react";

import type { TocItem } from "@/lib/types";
import { useActiveReaderItem } from "@/components/use-active-reader-item";

type ReaderTocRailProps = {
  instrumentTitle: string;
  items: TocItem[];
};

export function ReaderTocRail({ instrumentTitle, items }: ReaderTocRailProps) {
  const trackedItems = useMemo(
    () => items.map((item) => ({ anchor: item.anchor, id: item.anchor })),
    [items],
  );
  const activeAnchor = useActiveReaderItem({
    items: trackedItems,
    selector: "[data-panel-id]",
    activationLineRatio: 0.24,
    minActivationLine: 170,
    maxActivationLine: 280,
  });

  useEffect(() => {
    if (!activeAnchor) {
      return;
    }

    const activeLink = document.querySelector<HTMLElement>(`[data-toc-anchor="${activeAnchor}"]`);
    activeLink?.scrollIntoView({ block: "nearest" });
  }, [activeAnchor]);

  const activeItem = items.find((item) => item.anchor === activeAnchor) ?? items[0] ?? null;

  return (
    <aside className="toc-rail" aria-labelledby="toc-title" tabIndex={0}>
      <div className="toc-rail__header">
        <p className="eyebrow">Table of contents</p>
        {activeItem ? (
          <a className="toc-rail__current" href={`#${activeItem.anchor}`}>{activeItem.label}</a>
        ) : null}
      </div>

      <nav aria-label={`${instrumentTitle} table of contents`}>
        {items.length ? (
          <ol className="toc-list">
            {items.map((item) => {
              const active = item.anchor === activeAnchor;

              return (
                <li key={item.id} className={`toc-list__item toc-list__item--level-${Math.min(item.level, 4)}`}>
                  <a
                    aria-current={active ? "location" : undefined}
                    className={active ? "toc-list__link--active" : undefined}
                    data-toc-anchor={item.anchor}
                    href={`#${item.anchor}`}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="muted">No table of contents available.</p>
        )}
      </nav>
    </aside>
  );
}
