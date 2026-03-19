"use client";

import { useEffect, useEffectEvent, useState } from "react";

import type { TocItem } from "@/lib/types";

type ReaderTocRailProps = {
  instrumentTitle: string;
  items: TocItem[];
};

export function ReaderTocRail({ instrumentTitle, items }: ReaderTocRailProps) {
  const [activeAnchor, setActiveAnchor] = useState<string | null>(items[0]?.anchor ?? null);

  const syncActiveAnchor = useEffectEvent(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-panel-id]"));

    if (!nodes.length) {
      return;
    }

    const activationLine = Math.min(Math.max(window.innerHeight * 0.24, 170), 280);
    let nextAnchor = nodes[0]?.id ?? null;

    for (const node of nodes) {
      if (node.getBoundingClientRect().top <= activationLine) {
        nextAnchor = node.id;
        continue;
      }

      break;
    }

    if (nextAnchor) {
      setActiveAnchor((current) => (current === nextAnchor ? current : nextAnchor));
    }
  });

  useEffect(() => {
    if (!items.length) {
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
        syncActiveAnchor();
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

      if (items.some((item) => item.anchor === hash)) {
        let userHasScrolled = false;
        const onUserScroll = () => { userHasScrolled = true; };
        window.addEventListener("scroll", onUserScroll, { passive: true, once: true });

        const runHashSync = () => {
          if (userHasScrolled) {
            timeoutIds.forEach((id) => window.clearTimeout(id));
            timeoutIds = [];
            return;
          }

          document.getElementById(hash)?.scrollIntoView();
          setActiveAnchor(hash);
          scheduleSync();
        };

        [0, 200, 800].forEach((delay) => {
          timeoutIds.push(window.setTimeout(runHashSync, delay));
        });
        return;
      }

      scheduleSync();
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
  }, [items]);

  useEffect(() => {
    if (!activeAnchor) {
      return;
    }

    const activeLink = document.querySelector<HTMLElement>(`[data-toc-anchor="${activeAnchor}"]`);
    activeLink?.scrollIntoView({ block: "nearest" });
  }, [activeAnchor]);

  const activeItem = items.find((item) => item.anchor === activeAnchor) ?? items[0] ?? null;

  return (
    <aside className="toc-rail" aria-labelledby="toc-title">
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
