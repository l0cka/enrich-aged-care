# Lawyer-Indispensable Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three features — Citation Clipboard, Provision Pathways, and Decision Pathway Maps — that transform the legislation explorer from a reference reader into a decision-drafting workflow tool for lawyers.

**Architecture:** All features build on existing pre-generated JSON bundles and the `relatedProvisions` cross-reference index. New client-side state uses localStorage with versioned schemas. No new dependencies — vanilla CSS, React 19 hooks, and Next.js 16 server components following existing patterns.

**Tech Stack:** Next.js 16, React 19, vanilla CSS with oklch custom properties, localStorage, Clipboard API

**Spec:** `docs/superpowers/specs/2026-03-19-lawyer-features-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `lib/citation.ts` | Deterministic citation format generation from segment type/code + instrument title |
| `lib/collection-store.ts` | Client-side localStorage wrapper for citation collection (versioned schema, add/remove/reorder/export) |
| `lib/server/pathways.ts` | Server-side pathway computation: BFS walk of relatedProvisions index, edge classification, truncation |
| `lib/server/maps.ts` | Server-side loader for built-in map JSON files from `generated-data/maps/` |
| `lib/maps-store.ts` | Client-side localStorage wrapper for user maps (versioned schema, CRUD) |
| `components/pin-button.tsx` | Reusable pin/unpin toggle button (client component) |
| `components/toast.tsx` | Minimal auto-dismiss toast (3s, bottom-center, client component) |
| `components/collection-drawer.tsx` | Slide-out collection panel with export actions (client component) |
| `components/collection-indicator.tsx` | Header badge showing collection count (client component) |
| `components/add-chain-button.tsx` | Bulk-add pathway nodes to collection (client component) |
| `components/pathway-tree.tsx` | Pathway node list grouped by instrument (server-friendly, receives data as props) |
| `components/map-card.tsx` | Map card for the maps index grid (server component) |
| `components/map-provision-list.tsx` | Provision list within map detail view |
| `components/map-editor.tsx` | Edit mode controls for user maps (client component) |
| `app/api/resolve-segments/route.ts` | API route to resolve segment IDs to text/type/code for collection drawer |
| `app/pathway/[instrumentSlug]/[segmentAnchor]/page.tsx` | Pathway view page (server component) |
| `app/maps/page.tsx` | Maps index page (server component) |
| `app/maps/[id]/page.tsx` | Map detail page (server + client hybrid) |
| `generated-data/maps/provider-registration.json` | Built-in map: Provider Registration |

### Modified files

| File | Changes |
|------|---------|
| `lib/types.ts` | Add CollectionItem, CollectionStore, PathwayNode, PathwayEdge, PathwayRelationship, Pathway, PathwayMap, MapSection, MapProvision, UserMapsStore types |
| `app/layout.tsx` | Add Toast, CollectionIndicator, and "Maps" nav link to header |
| `app/[slug]/page.tsx` | Add pin buttons to each segment |
| `app/search/page.tsx` | Add pin buttons to each search result card |
| `components/reader-active-rail.tsx` | Add `instrumentSlug` prop and "Trace pathway" link |
| `app/globals.css` | Add styles for pin button, toast, drawer, pathway tree, map grid, map detail, map editor |

---

## Chunk 1: Feature 3 — Citation Clipboard & Export

### Task 1: Add types to lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add collection and citation types**

Append to the end of `lib/types.ts`:

```typescript
// ── Citation Clipboard ──────────────────────────────────────────

export type CollectionItem = {
  segmentId: string;
  instrumentSlug: string;
  note: string;
  addedAt: number;
};

export type CollectionStore = {
  version: 1;
  items: CollectionItem[];
};
```

- [ ] **Step 2: Verify the project builds**

Run: `npm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add CollectionItem and CollectionStore types"
```

---

### Task 2: Create lib/citation.ts — citation format generation

**Files:**
- Create: `lib/citation.ts`

- [ ] **Step 1: Create the citation format module**

```typescript
const prefixByType: Record<string, string> = {
  section: "s",
  subsection: "s",
  rule: "r",
  subrule: "r",
  schedule: "sch",
  clause: "cl",
  part: "pt",
  division: "div",
  chapter: "ch",
  paragraph: "para",
  subparagraph: "subpara",
};

/**
 * Build a formal Australian legislative citation for a segment.
 *
 * Examples:
 *   formatCitation({ type: "section", code: "65(1)" }, "Aged Care Act 2024")
 *   -> "s 65(1) of the Aged Care Act 2024"
 */
export function formatCitation(
  segment: { type: string | null; code: string | null; label: string },
  instrumentTitle: string,
): string {
  const prefix = segment.type ? prefixByType[segment.type] : null;

  if (prefix && segment.code) {
    return `${prefix} ${segment.code} of the ${instrumentTitle}`;
  }

  // Fallback: use the label directly
  return `${segment.label} of the ${instrumentTitle}`;
}

/**
 * Build a formatted export block for a single collected provision.
 */
export function formatExportBlock(
  citation: string,
  text: string,
): string {
  const trimmed = text.trim().replace(/\n{3,}/g, "\n\n");
  return `${citation}\n"${trimmed}"`;
}

/**
 * Build the full "Copy all" export text for a collection.
 */
export function formatCollectionExport(
  items: { citation: string; text: string }[],
): string {
  return items.map((item) => formatExportBlock(item.citation, item.text)).join("\n\n");
}

/**
 * Build the "Copy citations only" export text.
 */
export function formatCitationsOnly(citations: string[]): string {
  return citations.join("\n");
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add lib/citation.ts
git commit -m "feat: add deterministic citation format generation"
```

---

### Task 3: Create lib/collection-store.ts — localStorage wrapper

**Files:**
- Create: `lib/collection-store.ts`

This is a client-side module. It follows the same `useSyncExternalStore` + custom event pattern used in `components/onboarding-hint.tsx` and `components/theme-toggle.tsx`.

- [ ] **Step 1: Create the collection store module**

```typescript
import type { CollectionItem, CollectionStore } from "@/lib/types";

const storageKey = "enrich:collection";
const changeEvent = "enrich-aged-care-collectionchange";
const currentVersion = 1;
const maxItems = 50;

function emptyStore(): CollectionStore {
  return { version: currentVersion, items: [] };
}

function readStore(): CollectionStore {
  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return emptyStore();
    }

    const parsed = JSON.parse(raw) as CollectionStore;

    if (parsed.version !== currentVersion) {
      return emptyStore();
    }

    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: CollectionStore): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(store));
  } catch {
    /* storage unavailable */
  }

  window.dispatchEvent(new Event(changeEvent));
}

export function getCollectionItems(): CollectionItem[] {
  return readStore().items;
}

export function getCollectionCount(): number {
  return readStore().items.length;
}

export function isInCollection(instrumentSlug: string, segmentId: string): boolean {
  return readStore().items.some(
    (item) => item.instrumentSlug === instrumentSlug && item.segmentId === segmentId,
  );
}

export function addToCollection(instrumentSlug: string, segmentId: string): void {
  const store = readStore();

  if (store.items.some((item) => item.instrumentSlug === instrumentSlug && item.segmentId === segmentId)) {
    return;
  }

  if (store.items.length >= maxItems) {
    return;
  }

  store.items.push({
    segmentId,
    instrumentSlug,
    note: "",
    addedAt: Date.now(),
  });

  writeStore(store);
}

export function removeFromCollection(instrumentSlug: string, segmentId: string): void {
  const store = readStore();
  store.items = store.items.filter(
    (item) => !(item.instrumentSlug === instrumentSlug && item.segmentId === segmentId),
  );
  writeStore(store);
}

export function updateNote(instrumentSlug: string, segmentId: string, note: string): void {
  const store = readStore();
  const item = store.items.find(
    (item) => item.instrumentSlug === instrumentSlug && item.segmentId === segmentId,
  );

  if (item) {
    item.note = note;
    writeStore(store);
  }
}

export function moveItem(fromIndex: number, toIndex: number): void {
  const store = readStore();

  if (fromIndex < 0 || fromIndex >= store.items.length || toIndex < 0 || toIndex >= store.items.length) {
    return;
  }

  const [item] = store.items.splice(fromIndex, 1);
  store.items.splice(toIndex, 0, item);
  writeStore(store);
}

export function clearCollection(): void {
  writeStore(emptyStore());
}

export function addBulk(items: { instrumentSlug: string; segmentId: string }[]): number {
  const store = readStore();
  let added = 0;

  for (const { instrumentSlug, segmentId } of items) {
    if (store.items.length >= maxItems) {
      break;
    }

    if (store.items.some((existing) => existing.instrumentSlug === instrumentSlug && existing.segmentId === segmentId)) {
      continue;
    }

    store.items.push({ segmentId, instrumentSlug, note: "", addedAt: Date.now() });
    added++;
  }

  if (added > 0) {
    writeStore(store);
  }

  return added;
}

export function subscribeToCollection(callback: () => void): () => void {
  window.addEventListener(changeEvent, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(changeEvent, callback);
    window.removeEventListener("storage", callback);
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add lib/collection-store.ts
git commit -m "feat: add collection localStorage store with versioned schema"
```

---

### Task 4: Create components/toast.tsx

**Files:**
- Create: `components/toast.tsx`

- [ ] **Step 1: Create the toast component**

```typescript
"use client";

import { useEffect, useState } from "react";

type ToastMessage = {
  id: number;
  text: string;
  variant: "success" | "error";
};

let toastId = 0;
let listeners: Array<(message: ToastMessage) => void> = [];

export function showToast(text: string, variant: "success" | "error" = "success"): void {
  const message: ToastMessage = { id: ++toastId, text, variant };
  listeners.forEach((listener) => listener(message));
}

export function Toast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (message: ToastMessage) => {
      setMessages((prev) => [...prev, message]);

      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== message.id));
      }, 3000);
    };

    listeners.push(listener);

    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (!messages.length) {
    return null;
  }

  return (
    <div className="toast-container" aria-live="polite">
      {messages.map((message) => (
        <div key={message.id} className={`toast toast--${message.variant}`} role="status">
          {message.text}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/toast.tsx
git commit -m "feat: add minimal auto-dismiss toast component"
```

---

### Task 5: Create components/pin-button.tsx

**Files:**
- Create: `components/pin-button.tsx`

- [ ] **Step 1: Create the pin button component**

```typescript
"use client";

import { useSyncExternalStore } from "react";

import {
  addToCollection,
  isInCollection,
  removeFromCollection,
  subscribeToCollection,
} from "@/lib/collection-store";

type PinButtonProps = {
  instrumentSlug: string;
  segmentId: string;
  label: string;
};

export function PinButton({ instrumentSlug, segmentId, label }: PinButtonProps) {
  const pinned = useSyncExternalStore(
    subscribeToCollection,
    () => isInCollection(instrumentSlug, segmentId),
    () => false,
  );

  const handleClick = () => {
    if (pinned) {
      removeFromCollection(instrumentSlug, segmentId);
    } else {
      addToCollection(instrumentSlug, segmentId);
    }
  };

  return (
    <button
      aria-label={pinned ? `Unpin ${label} from collection` : `Pin ${label} to collection`}
      className={`pin-button ${pinned ? "pin-button--pinned" : ""}`}
      onClick={handleClick}
      title={pinned ? "Remove from collection" : "Add to collection"}
      type="button"
    >
      {pinned ? "\u2713" : "+"}
    </button>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add components/pin-button.tsx
git commit -m "feat: add reusable pin/unpin button for collection"
```

---

### Task 6: Create components/collection-indicator.tsx and components/collection-drawer.tsx

**Files:**
- Create: `components/collection-indicator.tsx`
- Create: `components/collection-drawer.tsx`

- [ ] **Step 1: Create the collection header indicator**

```typescript
"use client";

import { useState, useSyncExternalStore } from "react";

import { getCollectionCount, subscribeToCollection } from "@/lib/collection-store";

import { CollectionDrawer } from "./collection-drawer";

export function CollectionIndicator() {
  const count = useSyncExternalStore(
    subscribeToCollection,
    () => getCollectionCount(),
    () => 0,
  );

  const [open, setOpen] = useState(false);

  if (count === 0 && !open) {
    return null;
  }

  return (
    <>
      <button
        aria-label={`Collection: ${count} item${count === 1 ? "" : "s"}`}
        className="collection-trigger"
        onClick={() => setOpen(true)}
        type="button"
      >
        Collection ({count})
      </button>
      {open ? <CollectionDrawer onClose={() => setOpen(false)} /> : null}
    </>
  );
}
```

- [ ] **Step 2: Create the collection drawer**

```typescript
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
            \u2715
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
                        \u2191
                      </button>
                      <button
                        aria-label="Move down"
                        className="drawer__move-button"
                        disabled={index === resolvedItems.length - 1}
                        onClick={() => moveItem(index, index + 1)}
                        type="button"
                      >
                        \u2193
                      </button>
                      <button
                        aria-label={`Remove ${item.citation}`}
                        className="drawer__remove-button"
                        onClick={() => removeFromCollection(item.instrumentSlug, item.segmentId)}
                        type="button"
                      >
                        \u2715
                      </button>
                    </div>
                  </div>
                  <p className="drawer__item-excerpt">{item.excerpt}</p>
                  <input
                    aria-label={`Note for ${item.citation}`}
                    className="drawer__item-note"
                    onChange={(event) => updateNote(item.instrumentSlug, item.segmentId, event.target.value)}
                    placeholder="Add a note\u2026"
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
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build will fail because `/api/resolve-segments` doesn't exist yet. That's expected — we create it in Task 7.

- [ ] **Step 4: Commit**

```bash
git add components/collection-indicator.tsx components/collection-drawer.tsx
git commit -m "feat: add collection drawer and header indicator"
```

---

### Task 7: Create API route for segment resolution

The collection drawer needs to resolve segment IDs to their text/type/code at render time. This thin API endpoint accepts a list of `instrumentSlug:segmentId` pairs and returns the data needed for citation formatting.

**Files:**
- Create: `app/api/resolve-segments/route.ts`

- [ ] **Step 1: Create the resolve-segments API**

```typescript
import { NextRequest, NextResponse } from "next/server";

import { getInstrumentBundle } from "@/lib/server/data";

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.getAll("id");

  if (!ids.length) {
    return NextResponse.json({});
  }

  const slugs = [...new Set(ids.map((id) => id.split(":")[0]))];
  const bundles = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return { slug, bundle: await getInstrumentBundle(slug) };
      } catch {
        return null;
      }
    }),
  );

  const bundleBySlug = Object.fromEntries(
    bundles.filter(Boolean).map((entry) => [entry!.slug, entry!.bundle]),
  );

  const result: Record<string, {
    instrumentTitle: string;
    type: string | null;
    code: string | null;
    label: string;
    text: string;
    anchor: string;
  }> = {};

  for (const id of ids) {
    const separatorIndex = id.indexOf(":");
    const slug = id.slice(0, separatorIndex);
    const segmentId = id.slice(separatorIndex + 1);
    const bundle = bundleBySlug[slug];

    if (!bundle) {
      continue;
    }

    const segment = bundle.segments[segmentId];

    if (!segment) {
      continue;
    }

    result[id] = {
      instrumentTitle: bundle.manifest.title,
      type: segment.type,
      code: segment.code,
      label: segment.label,
      text: segment.text,
      anchor: segment.anchor,
    };
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/api/resolve-segments/route.ts
git commit -m "feat: add resolve-segments API for collection drawer"
```

---

### Task 8: Add CSS styles for collection UI

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add collection, pin, toast, and drawer styles**

Append the following to the end of `app/globals.css`. Note: check that `.reader-segment__meta` does not already have a `display: flex` rule — if it does, only add the `gap` property.

```css
/* ── Pin button ──────────────────────────────────────────────── */

.pin-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-panel);
  color: var(--color-muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.pin-button:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.pin-button--pinned {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-panel);
}

.pin-button--pinned:hover {
  opacity: 0.85;
  color: var(--color-panel);
}

/* ── Toast ────────────────────────────────────────────────────── */

.toast-container {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

.toast {
  padding: 0.625rem 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-family: var(--font-body);
  animation: toast-in 0.2s ease;
  pointer-events: auto;
}

.toast--success {
  background: var(--color-accent);
  color: var(--color-panel);
}

.toast--error {
  background: oklch(0.55 0.2 25);
  color: white;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(0.5rem); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Collection trigger (header) ─────────────────────────────── */

.collection-trigger {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-body);
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.collection-trigger:hover {
  border-color: var(--color-accent);
}

/* ── Drawer ───────────────────────────────────────────────────── */

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: oklch(0 0 0 / 0.3);
  z-index: 50;
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(28rem, 90vw);
  background: var(--color-bg);
  border-left: 1px solid var(--color-border);
  z-index: 51;
  display: flex;
  flex-direction: column;
  animation: drawer-in 0.2s ease;
  outline: none;
}

@keyframes drawer-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.drawer__header h2 {
  font-size: 1rem;
  font-family: var(--font-body);
  font-weight: 600;
  margin: 0;
}

.drawer__close {
  background: none;
  border: none;
  font-size: 1.125rem;
  cursor: pointer;
  color: var(--color-muted);
  padding: 0.25rem;
}

.drawer__close:hover {
  color: var(--color-text);
}

.drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
}

.drawer__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.drawer__item {
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.drawer__item-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.drawer__item-citation {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-accent);
  text-decoration: none;
}

.drawer__item-citation:hover {
  text-decoration: underline;
}

.drawer__item-actions {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.drawer__move-button,
.drawer__remove-button {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.75rem;
  cursor: pointer;
  color: var(--color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.drawer__move-button:hover,
.drawer__remove-button:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.drawer__move-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.drawer__item-excerpt {
  font-size: 0.8125rem;
  color: var(--color-muted);
  margin: 0.375rem 0;
  line-height: 1.4;
}

.drawer__item-note {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: var(--font-body);
}

.drawer__item-note::placeholder {
  color: var(--color-muted);
}

.drawer__fallback {
  margin-top: 1rem;
}

.drawer__fallback-text {
  width: 100%;
  font-size: 0.75rem;
  font-family: monospace;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: var(--color-panel);
  color: var(--color-text);
  resize: vertical;
  margin: 0.5rem 0;
}

.drawer__footer {
  display: flex;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.button--danger {
  border-color: oklch(0.55 0.2 25);
  color: oklch(0.55 0.2 25);
}

.button--danger:hover {
  background: oklch(0.55 0.2 25);
  color: white;
}

/* ── Pin button positioning ──────────────────────────────────── */

.result-card {
  position: relative;
}

.result-card > .pin-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add CSS for pin button, toast, collection drawer"
```

---

### Task 9: Wire collection into layout, reader, and search

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/[slug]/page.tsx`
- Modify: `app/search/page.tsx`

- [ ] **Step 1: Add Toast and CollectionIndicator to layout**

In `app/layout.tsx`, add imports:

```typescript
import { CollectionIndicator } from "@/components/collection-indicator";
import { Toast } from "@/components/toast";
```

Add `<CollectionIndicator />` inside `.site-header__actions`, before `<nav>`:

```tsx
<div className="site-header__actions">
  <CollectionIndicator />
  <nav className="site-nav" aria-label="Primary">
    <Link href="/">Corpus</Link>
    <Link href="/search">Search</Link>
  </nav>
  <ThemeToggle />
</div>
```

Add `<Toast />` just before closing `</body>`:

```tsx
        <Toast />
      </body>
```

- [ ] **Step 2: Add pin buttons to reader segments**

In `app/[slug]/page.tsx`, add import:

```typescript
import { PinButton } from "@/components/pin-button";
```

Replace the `.reader-segment__meta` div contents:

```tsx
<div className="reader-segment__meta">
  <span>{segment.type ?? "segment"}</span>
  {segment.code ? <span>{segment.code}</span> : null}
  <PinButton instrumentSlug={slug} segmentId={segment.id} label={segment.label} />
</div>
```

- [ ] **Step 3: Add pin buttons to search results**

In `app/search/page.tsx`, add import:

```typescript
import { PinButton } from "@/components/pin-button";
```

Add `PinButton` inside each result card, after the `.chip-row` div and before the closing `</li>`:

```tsx
<PinButton
  instrumentSlug={result.instrumentSlug}
  segmentId={result.segmentId}
  label={result.label}
/>
```

- [ ] **Step 4: Verify build and test**

Run: `npm run build && npm run dev`
Expected: Build succeeds. Pin buttons visible on reader segments and search results. Collection drawer opens from header. Export works.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/[slug]/page.tsx app/search/page.tsx
git commit -m "feat: wire collection UI into layout, reader, and search"
```

---

## Chunk 2: Feature 1 — Provision Pathways

### Task 10: Add pathway types to lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add pathway types**

Append to `lib/types.ts`:

```typescript
// ── Provision Pathways ──────────────────────────────────────────

export type PathwayRelationship =
  | "delegates_to"
  | "specified_by"
  | "references"
  | "referenced_by"
  | "internal";

export type PathwayNode = {
  segmentId: string;
  instrumentSlug: string;
  label: string;
  code: string | null;
  text: string;
};

export type PathwayEdge = {
  from: string;
  to: string;
  relationship: PathwayRelationship;
};

export type Pathway = {
  seed: PathwayNode;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  truncated: boolean;
  totalCount: number;
};
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build && git add lib/types.ts && git commit -m "feat: add Pathway, PathwayNode, PathwayEdge types"
```

---

### Task 11: Create lib/server/pathways.ts — pathway computation

**Files:**
- Create: `lib/server/pathways.ts`

- [ ] **Step 1: Create the pathway computation module**

```typescript
import { cache } from "react";

import { getAllInstrumentBundles } from "@/lib/server/data";
import { getRelatedProvisionIndex } from "@/lib/server/related-provisions";
import type {
  DerivedSegment,
  EnrichedInstrumentBundle,
  Pathway,
  PathwayNode,
  PathwayRelationship,
  RelatedProvision,
} from "@/lib/types";

const maxNodes = 50;

function classifyRelationship(
  relationKind: RelatedProvision["relationKind"],
  sourceInstrumentType: string,
  targetInstrumentType: string,
): PathwayRelationship {
  if (relationKind === "via_internal_reference") {
    return "internal";
  }

  const isStatuteToRegulation =
    sourceInstrumentType === "statute" && targetInstrumentType === "regulation";

  if (relationKind === "this_provision_cites") {
    return isStatuteToRegulation ? "delegates_to" : "references";
  }

  // cites_this_provision
  return isStatuteToRegulation ? "specified_by" : "referenced_by";
}

function makeNode(segment: DerivedSegment, instrumentSlug: string): PathwayNode {
  return {
    segmentId: segment.id,
    instrumentSlug,
    label: segment.label,
    code: segment.code,
    text: segment.text.slice(0, 200),
  };
}

export const computePathway = cache(
  async (instrumentSlug: string, segmentId: string, maxHops: number = 2): Promise<Pathway | null> => {
    const [bundles, relatedIndex] = await Promise.all([
      getAllInstrumentBundles(),
      getRelatedProvisionIndex(),
    ]);

    const bundleBySlug = Object.fromEntries(
      bundles.map((bundle) => [bundle.manifest.slug, bundle]),
    ) as Record<string, EnrichedInstrumentBundle>;

    const seedBundle = bundleBySlug[instrumentSlug];

    if (!seedBundle) {
      return null;
    }

    const seedSegment = seedBundle.segments[segmentId];

    if (!seedSegment) {
      return null;
    }

    const seedNode = makeNode(seedSegment, instrumentSlug);
    const visited = new Set<string>([`${instrumentSlug}:${segmentId}`]);
    const nodes: PathwayNode[] = [seedNode];
    const edges: Array<{ from: string; to: string; relationship: PathwayRelationship }> = [];
    let frontier: Array<{ slug: string; segmentId: string }> = [
      { slug: instrumentSlug, segmentId },
    ];
    let totalCount = 1;
    let truncated = false;

    for (let hop = 0; hop < maxHops; hop++) {
      const nextFrontier: Array<{ slug: string; segmentId: string }> = [];

      for (const current of frontier) {
        const key = `${current.slug}:${current.segmentId}`;
        const relations = relatedIndex[key] ?? [];

        for (const relation of relations) {
          const targetKey = `${relation.otherInstrumentSlug}:${relation.otherSegmentId}`;

          if (visited.has(targetKey)) {
            continue;
          }

          totalCount++;

          if (nodes.length >= maxNodes) {
            truncated = true;
            continue;
          }

          visited.add(targetKey);

          const targetBundle = bundleBySlug[relation.otherInstrumentSlug];

          if (!targetBundle) {
            continue;
          }

          const targetSegment = targetBundle.segments[relation.otherSegmentId];

          if (!targetSegment) {
            continue;
          }

          const sourceInstrumentType = bundleBySlug[current.slug]?.manifest.instrumentType ?? "statute";
          const targetInstrumentType = targetBundle.manifest.instrumentType;

          nodes.push(makeNode(targetSegment, relation.otherInstrumentSlug));
          edges.push({
            from: current.segmentId,
            to: relation.otherSegmentId,
            relationship: classifyRelationship(
              relation.relationKind,
              sourceInstrumentType,
              targetInstrumentType,
            ),
          });

          nextFrontier.push({
            slug: relation.otherInstrumentSlug,
            segmentId: relation.otherSegmentId,
          });
        }
      }

      if (truncated) {
        break;
      }

      frontier = nextFrontier;
    }

    return {
      seed: seedNode,
      nodes,
      edges,
      truncated,
      totalCount,
    };
  },
);
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build && git add lib/server/pathways.ts && git commit -m "feat: add pathway computation with BFS walk and edge classification"
```

---

### Task 12: Create components/pathway-tree.tsx and components/add-chain-button.tsx

**Files:**
- Create: `components/pathway-tree.tsx`
- Create: `components/add-chain-button.tsx`

- [ ] **Step 1: Create the pathway tree component**

See spec for full layout. This is a server-friendly component (no `"use client"`) that receives pathway data as props and renders nodes grouped by instrument with relationship badges, pin buttons, and links to reader.

Key structure:
- Group `pathway.nodes` (excluding seed) by `instrumentSlug`
- For each group, render instrument title and node list
- Each node shows: relationship badge, label link, preview text, pin button
- Show truncation indicator when `pathway.truncated` is true
- Show empty state when only seed node exists

- [ ] **Step 2: Create the add-chain-button component**

```typescript
"use client";

import { showToast } from "@/components/toast";
import { addBulk } from "@/lib/collection-store";

type AddChainButtonProps = {
  items: { instrumentSlug: string; segmentId: string }[];
};

export function AddChainButton({ items }: AddChainButtonProps) {
  const handleClick = () => {
    const added = addBulk(items);

    if (added > 0) {
      showToast(`Added ${added} provision${added === 1 ? "" : "s"} to collection`);
    } else {
      showToast("All provisions already in collection", "error");
    }
  };

  return (
    <button className="button button--secondary" onClick={handleClick} type="button">
      Add chain to collection
    </button>
  );
}
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build && git add components/pathway-tree.tsx components/add-chain-button.tsx && git commit -m "feat: add pathway tree and add-chain-button components"
```

---

### Task 13: Create the pathway page route

**Files:**
- Create: `app/pathway/[instrumentSlug]/[segmentAnchor]/page.tsx`

- [ ] **Step 1: Create the pathway view page**

Server component that:
1. Resolves `segmentAnchor` param to a segment ID via `Object.values(bundle.segments).find(s => s.anchor === segmentAnchor)`
2. Calls `computePathway(instrumentSlug, segmentId, maxHops)` where `maxHops` comes from `?hops=` search param (default 2)
3. Renders: seed provision with full text at top, depth toggle controls (1/2/3 hops as links), "Add chain to collection" button, PathwayTree component, and "Back to reader" link
4. Uses `generateMetadata` for page title

- [ ] **Step 2: Verify build and commit**

```bash
npm run build && git add app/pathway && git commit -m "feat: add pathway page route with depth controls"
```

---

### Task 14: Add pathway styles and wire "Trace pathway" into reader

**Files:**
- Modify: `app/globals.css`
- Modify: `components/reader-active-rail.tsx`
- Modify: `app/[slug]/page.tsx`

- [ ] **Step 1: Add pathway CSS to globals.css**

Add styles for: `.pathway-page`, `.pathway-hero`, `.pathway-hero__seed`, `.pathway-controls`, `.button--active`, `.pathway-tree`, `.pathway-group`, `.instrument-badge`, `.pathway-node`, `.pathway-node__relationship`, `.pathway-node__label`, `.pathway-node__preview`, `.pathway-truncation`, `.pathway-empty`.

- [ ] **Step 2: Add `instrumentSlug` prop to ReaderActiveRail**

In `components/reader-active-rail.tsx`:
- Add `instrumentSlug: string` to `ReaderActiveRailProps`
- Add a "Trace pathway" link at the end of the "Other instruments" section:

```tsx
<a
  className="button button--secondary"
  href={`/pathway/${instrumentSlug}/${activePanel.anchor}`}
  style={{ marginTop: "0.75rem", display: "inline-block", fontSize: "0.8125rem" }}
>
  Trace pathway \u2192
</a>
```

In `app/[slug]/page.tsx`, pass the prop: `<ReaderActiveRail panels={railPanels} instrumentSlug={slug} />`

- [ ] **Step 3: Verify build and test**

Run: `npm run build && npm run dev`
Expected: "Trace pathway" link visible in reader margin rail. Clicking it opens pathway page with connected provisions.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css components/reader-active-rail.tsx app/[slug]/page.tsx
git commit -m "feat: add pathway styles and wire Trace Pathway into reader"
```

---

## Chunk 3: Feature 2 — Decision Pathway Maps

### Task 15: Add map types to lib/types.ts

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add map types**

Append PathwayMap, MapSection, MapProvision, and UserMapsStore types as defined in the spec.

- [ ] **Step 2: Verify build and commit**

```bash
npm run build && git add lib/types.ts && git commit -m "feat: add PathwayMap, MapSection, MapProvision types"
```

---

### Task 16: Create lib/server/maps.ts and lib/maps-store.ts

**Files:**
- Create: `lib/server/maps.ts` — server-side loader using `readdir`/`readFile` from `generated-data/maps/`, wrapped in React `cache()`
- Create: `lib/maps-store.ts` — client-side localStorage wrapper with versioned schema, CRUD operations, `subscribeToUserMaps`, and `duplicateMap` helper

- [ ] **Step 1: Create both store modules**

Follow the same patterns as `lib/server/data.ts` (server) and `lib/collection-store.ts` (client).

- [ ] **Step 2: Verify build and commit**

```bash
npm run build && git add lib/server/maps.ts lib/maps-store.ts && git commit -m "feat: add map server loader and client store"
```

---

### Task 17: Create built-in map skeleton and map components

**Files:**
- Create: `generated-data/maps/provider-registration.json` — skeleton with empty provisions arrays (to be populated by examining the instruments)
- Create: `components/map-card.tsx` — card for maps grid (title, description, provision count, badges)
- Create: `components/map-provision-list.tsx` — provision list grouped by section headings with pin buttons
- Create: `components/map-editor.tsx` — edit mode with up/down reorder, remove, and save

- [ ] **Step 1: Create map directory and starter JSON**

```bash
mkdir -p generated-data/maps
```

- [ ] **Step 2: Create all three components**

- [ ] **Step 3: Verify build and commit**

```bash
npm run build && git add generated-data/maps components/map-card.tsx components/map-provision-list.tsx components/map-editor.tsx && git commit -m "feat: add map components and starter built-in map"
```

---

### Task 18: Create maps index and detail pages

**Files:**
- Create: `app/maps/page.tsx` — server component, loads built-in maps, renders grid of MapCards
- Create: `app/maps/[id]/page.tsx` — server component, resolves all map provisions against instrument bundles, renders MapProvisionList

- [ ] **Step 1: Create both pages**

- [ ] **Step 2: Verify build and commit**

```bash
npm run build && git add app/maps && git commit -m "feat: add maps index and detail pages"
```

---

### Task 19: Add map styles and wire Maps into navigation

**Files:**
- Modify: `app/globals.css` — add `.maps-page`, `.maps-grid`, `.map-card`, `.map-detail-page`, `.map-provisions`, `.map-editor` styles
- Modify: `app/layout.tsx` — add `<Link href="/maps">Maps</Link>` to site nav

- [ ] **Step 1: Add CSS and nav link**

- [ ] **Step 2: Verify build and test**

Run: `npm run build && npm run dev`
Expected: "Maps" link in header. Maps index page loads. Map detail page loads.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css app/layout.tsx && git commit -m "feat: add map styles and wire Maps into site navigation"
```

---

### Task 20: Final verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Manual smoke test**

Run `npm run dev` and verify:

1. **Reader:** Pin buttons on segments. Toggle pin state.
2. **Collection drawer:** Opens from header. Citations resolved. Copy all / Copy citations. Reorder. Clear with confirmation.
3. **Search:** Pin buttons on search results.
4. **Pathway:** "Trace pathway" in margin rail. Pathway page loads. Nodes grouped by instrument. Depth controls. Pin buttons. "Add chain to collection".
5. **Maps:** "Maps" in header. Index shows cards. Detail shows grouped provisions.
6. **Dark mode:** All new UI respects dark theme.
7. **Mobile (< 760px):** Drawer usable. Pathway page readable.
8. **Keyboard:** Tab through pin buttons, drawer controls, pathway nodes.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: address smoke test issues"
```
