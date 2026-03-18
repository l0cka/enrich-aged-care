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
  const found = store.items.find(
    (item) => item.instrumentSlug === instrumentSlug && item.segmentId === segmentId,
  );

  if (found) {
    found.note = note;
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
