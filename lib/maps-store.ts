import type { PathwayMap, UserMapsStore } from "@/lib/types";

const storageKey = "enrich:user-maps";
const changeEvent = "enrich-aged-care-mapschange";
const currentVersion = 1;

function emptyStore(): UserMapsStore {
  return { version: currentVersion, maps: [] };
}

function readStore(): UserMapsStore {
  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return emptyStore();
    }

    const parsed = JSON.parse(raw) as UserMapsStore;

    if (parsed.version !== currentVersion) {
      return emptyStore();
    }

    return parsed;
  } catch {
    return emptyStore();
  }
}

function writeStore(store: UserMapsStore): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(store));
  } catch {
    /* storage unavailable */
  }

  window.dispatchEvent(new Event(changeEvent));
}

export function getUserMaps(): PathwayMap[] {
  return readStore().maps;
}

export function getUserMap(id: string): PathwayMap | null {
  return readStore().maps.find((map) => map.id === id) ?? null;
}

export function saveUserMap(map: PathwayMap): void {
  const store = readStore();
  const index = store.maps.findIndex((m) => m.id === map.id);

  if (index >= 0) {
    store.maps[index] = { ...map, builtIn: false };
  } else {
    store.maps.push({ ...map, builtIn: false });
  }

  writeStore(store);
}

export function deleteUserMap(id: string): void {
  const store = readStore();
  store.maps = store.maps.filter((map) => map.id !== id);
  writeStore(store);
}

export function duplicateMap(source: PathwayMap): PathwayMap {
  const id = `${source.id}-copy-${Date.now()}`;

  return {
    ...source,
    id,
    title: `${source.title} (copy)`,
    builtIn: false,
    sections: source.sections.map((section) => ({
      ...section,
      provisions: [...section.provisions],
    })),
  };
}

export function subscribeToUserMaps(callback: () => void): () => void {
  window.addEventListener(changeEvent, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(changeEvent, callback);
    window.removeEventListener("storage", callback);
  };
}
