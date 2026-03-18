"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { formatCitation, formatCitationsOnly, formatCollectionExport } from "@/lib/citation";
import {
  clearCollection,
  getCollectionItems,
  moveItem,
  removeFromCollection,
  subscribeToCollection,
  updateNote,
} from "@/lib/collection-store";
import { showToast } from "@/components/toast";

type CollectionDrawerProps = {
  onClose: () => void;
};

type ResolvedItem = {
  segmentId: string;
  instrumentSlug: string;
  instrumentTitle: string;
  citation: string;
  excerpt: string;
  fullText: string;
  note: string;
  anchor: string;
};

export function CollectionDrawer({ onClose }: CollectionDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const items = useSyncExternalStore(subscribeToCollection, getCollectionItems, () => []);
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);

  // Resolve citations and excerpts from server data via API
  useEffect(() => {
    if (!items.length) {
      setResolvedItems([]);
      return;
    }

    const params = new URLSearchParams();

    for (const item of items) {
      params.append("id", `${item.instrumentSlug}:${item.segmentId}`);
    }

    fetch(`/api/resolve-segments?${params.toString()}`)
      .then((res) => res.json())
      .then((data: Record<string, { instrumentTitle: string; type: string | null; code: string | null; label: string; text: string; anchor: string }>) => {
        setResolvedItems(
          items.map((item) => {
            const key = `${item.instrumentSlug}:${item.segmentId}`;
            const segment = data[key];

            if (!segment) {
              return {
                ...item,
                instrumentTitle: item.instrumentSlug,
                citation: item.segmentId,
                excerpt: "",
                fullText: "",
                anchor: "",
              };
            }

            const citation = formatCitation(segment, segment.instrumentTitle);
            return {
              ...item,
              instrumentTitle: segment.instrumentTitle,
              citation,
              excerpt: segment.text.slice(0, 120).trim() + (segment.text.length > 120 ? "\u2026" : ""),
              fullText: segment.text,
              anchor: segment.anchor,
            };
          }),
        );
      })
      .catch(() => {
        /* resolve failed - show raw IDs */
      });
  }, [items]);

  // Focus trap and escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    drawerRef.current?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleCopyAll = async () => {
    const exportItems = resolvedItems.map((item) => ({
      citation: item.citation,
      text: item.fullText,
    }));
    const text = formatCollectionExport(exportItems);

    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard");
    } catch {
      setFallbackText(text);
    }
  };

  const handleCopyCitations = async () => {
    const text = formatCitationsOnly(resolvedItems.map((item) => item.citation));

    try {
      await navigator.clipboard.writeText(text);
      showToast("Citations copied to clipboard");
    } catch {
      setFallbackText(text);
    }
  };

  const handleClear = () => {
    if (confirmingClear) {
      clearCollection();
      setConfirmingClear(false);
      showToast("Collection cleared");
    } else {
      setConfirmingClear(true);
    }
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="drawer"
        ref={drawerRef}
        role="dialog"
        aria-label="Citation collection"
        tabIndex={-1}
      >
        <div className="drawer__header">
          <h2>Collection</h2>
          <button aria-label="Close collection" className="drawer__close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="drawer__body">
          {resolvedItems.length === 0 ? (
            <p className="muted">Pin provisions from the reader or search results to build your collection.</p>
          ) : (
            <ol className="drawer__list">
              {resolvedItems.map((item, index) => (
                <li key={`${item.instrumentSlug}:${item.segmentId}`} className="drawer__item">
                  <div className="drawer__item-header">
                    <a
                      className="drawer__item-citation"
                      href={`/${item.instrumentSlug}#${item.anchor}`}
                      onClick={onClose}
                    >
                      {item.citation}
                    </a>
                    <div className="drawer__item-actions">
                      <button
                        aria-label="Move up"
                        className="drawer__move-button"
                        disabled={index === 0}
                        onClick={() => moveItem(index, index - 1)}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        aria-label="Move down"
                        className="drawer__move-button"
                        disabled={index === resolvedItems.length - 1}
                        onClick={() => moveItem(index, index + 1)}
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        aria-label={`Remove ${item.citation}`}
                        className="drawer__remove-button"
                        onClick={() => removeFromCollection(item.instrumentSlug, item.segmentId)}
                        type="button"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="drawer__item-excerpt">{item.excerpt}</p>
                  <input
                    aria-label={`Note for ${item.citation}`}
                    className="drawer__item-note"
                    onChange={(event) => updateNote(item.instrumentSlug, item.segmentId, event.target.value)}
                    placeholder="Add a note…"
                    type="text"
                    value={item.note}
                  />
                </li>
              ))}
            </ol>
          )}

          {fallbackText ? (
            <div className="drawer__fallback">
              <p className="muted">Could not copy to clipboard. Select all and copy manually:</p>
              <textarea className="drawer__fallback-text" readOnly rows={8} value={fallbackText} />
              <button className="button button--secondary" onClick={() => setFallbackText(null)} type="button">
                Dismiss
              </button>
            </div>
          ) : null}
        </div>

        {resolvedItems.length > 0 ? (
          <div className="drawer__footer">
            <button className="button button--primary" onClick={handleCopyAll} type="button">
              Copy all
            </button>
            <button className="button button--secondary" onClick={handleCopyCitations} type="button">
              Copy citations only
            </button>
            <button
              className={`button button--secondary ${confirmingClear ? "button--danger" : ""}`}
              onClick={handleClear}
              type="button"
            >
              {confirmingClear ? "Confirm clear" : "Clear all"}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
