import type { CollectionItem, CollectionStore } from "@/lib/types";

const storageKey = "enrich:collection";
const changeEvent = "enrich-aged-care-collectionchange";
const currentVersion = 1;
const maxItems = 50;
const emptyItems: CollectionItem[] = [];
const emptyCollectionStore: CollectionStore = { version: currentVersion, items: emptyItems };

// ── Snapshot cache ───────────────────────────────────────────
// useSyncExternalStore requires getSnapshot to return a referentially
// stable value when the underlying data hasn't changed. We cache the
// last-read raw JSON string and the derived snapshots so repeated
// calls return the same objects.

let cachedRaw: string | null | undefined;
let cachedStore: CollectionStore = emptyCollectionStore;
let cachedItems: CollectionItem[] = emptyItems;
let cachedCount: number = 0;

function readStore(): CollectionStore {
  if (typeof window === "undefined") {
    return emptyCollectionStore;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    // Same raw string → return cached store (same reference)
    if (raw === cachedRaw) {
      return cachedStore;
    }

    cachedRaw = raw;

    if (!raw) {
      cachedStore = emptyCollectionStore;
      cachedItems = emptyItems;
      cachedCount = 0;
      return cachedStore;
    }

    const parsed = JSON.parse(raw) as CollectionStore;

    if (parsed.version !== currentVersion) {
      cachedStore = emptyCollectionStore;
      cachedItems = emptyItems;
      cachedCount = 0;
      return cachedStore;
    }

    cachedStore = parsed;
    cachedItems = parsed.items;
    cachedCount = parsed.items.length;
    return cachedStore;
  } catch {
    cachedRaw = null;
    cachedStore = emptyCollectionStore;
    cachedItems = emptyItems;
    cachedCount = 0;
    return cachedStore;
  }
}

function writeStore(store: CollectionStore): void {
  const raw = JSON.stringify(store);

  cachedRaw = raw;
  cachedStore = store;
  cachedItems = store.items;
  cachedCount = store.items.length;

  try {
    window.localStorage.setItem(storageKey, raw);
  } catch {
    /* storage unavailable */
  }

  window.dispatchEvent(new Event(changeEvent));
}

export function getCollectionItems(): CollectionItem[] {
  readStore();
  return cachedItems;
}

export function getEmptyCollectionItems(): CollectionItem[] {
  return emptyItems;
}

export function getCollectionCount(): number {
  readStore();
  return cachedCount;
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

  writeStore({
    version: currentVersion,
    items: [
      ...store.items,
      {
        segmentId,
        instrumentSlug,
        note: "",
        addedAt: Date.now(),
      },
    ],
  });
}

export function removeFromCollection(instrumentSlug: string, segmentId: string): void {
  const store = readStore();
  writeStore({
    version: currentVersion,
    items: store.items.filter(
      (item) => !(item.instrumentSlug === instrumentSlug && item.segmentId === segmentId),
    ),
  });
}

export function updateNote(instrumentSlug: string, segmentId: string, note: string): void {
  const store = readStore();
  let changed = false;
  const nextItems = store.items.map((item) => {
    if (item.instrumentSlug !== instrumentSlug || item.segmentId !== segmentId) {
      return item;
    }

    if (item.note === note) {
      return item;
    }

    changed = true;
    return { ...item, note };
  });

  if (changed) {
    writeStore({ version: currentVersion, items: nextItems });
  }
}

export function moveItem(fromIndex: number, toIndex: number): void {
  const store = readStore();

  if (fromIndex < 0 || fromIndex >= store.items.length || toIndex < 0 || toIndex >= store.items.length) {
    return;
  }

  const nextItems = [...store.items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  writeStore({ version: currentVersion, items: nextItems });
}

export function clearCollection(): void {
  writeStore({ version: currentVersion, items: [] });
}

export function addBulk(items: { instrumentSlug: string; segmentId: string }[]): number {
  const store = readStore();
  const nextItems = [...store.items];
  let added = 0;

  for (const { instrumentSlug, segmentId } of items) {
    if (nextItems.length >= maxItems) {
      break;
    }

    if (nextItems.some((existing) => existing.instrumentSlug === instrumentSlug && existing.segmentId === segmentId)) {
      continue;
    }

    nextItems.push({ segmentId, instrumentSlug, note: "", addedAt: Date.now() });
    added++;
  }

  if (added > 0) {
    writeStore({ version: currentVersion, items: nextItems });
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
