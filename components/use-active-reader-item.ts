"use client";

import { useEffect, useEffectEvent, useState } from "react";

type ActiveReaderItem = {
  anchor: string;
  id: string;
};

type UseActiveReaderItemOptions = {
  items: ActiveReaderItem[];
  selector: string;
  activationLineRatio: number;
  minActivationLine: number;
  maxActivationLine: number;
  nodeIdAttribute?: string;
};

function getNodeId(node: HTMLElement, nodeIdAttribute?: string): string | null {
  if (nodeIdAttribute) {
    return node.getAttribute(nodeIdAttribute);
  }

  return node.id || null;
}

export function useActiveReaderItem({
  items,
  selector,
  activationLineRatio,
  minActivationLine,
  maxActivationLine,
  nodeIdAttribute,
}: UseActiveReaderItemOptions): string | null {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const resolvedActiveId = activeId && items.some((item) => item.id === activeId)
    ? activeId
    : items[0]?.id ?? null;

  const syncActiveId = useEffectEvent(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));

    if (!nodes.length) {
      return;
    }

    const activationLine = Math.min(Math.max(window.innerHeight * activationLineRatio, minActivationLine), maxActivationLine);
    let nextId = getNodeId(nodes[0]!, nodeIdAttribute);

    for (const node of nodes) {
      if (node.getBoundingClientRect().top <= activationLine) {
        nextId = getNodeId(node, nodeIdAttribute);
        continue;
      }

      break;
    }

    if (nextId) {
      setActiveId((current) => (current === nextId ? current : nextId));
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
        syncActiveId();
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

      const match = items.find((item) => item.anchor === hash);

      if (!match) {
        scheduleSync();
        return;
      }

      let userHasScrolled = false;
      const onUserScroll = () => {
        userHasScrolled = true;
      };

      window.addEventListener("scroll", onUserScroll, { passive: true, once: true });

      const runHashSync = () => {
        if (userHasScrolled) {
          timeoutIds.forEach((id) => window.clearTimeout(id));
          timeoutIds = [];
          return;
        }

        document.getElementById(hash)?.scrollIntoView();
        setActiveId(match.id);
        scheduleSync();
      };

      [0, 200, 800].forEach((delay) => {
        timeoutIds.push(window.setTimeout(runHashSync, delay));
      });
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
  }, [items, selector, activationLineRatio, minActivationLine, maxActivationLine, nodeIdAttribute]);

  return resolvedActiveId;
}
