import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import type { PathwayMap } from "@/lib/types";

const mapsDir = path.join(process.cwd(), "generated-data", "maps");

export const getBuiltInMaps = cache(async (): Promise<PathwayMap[]> => {
  try {
    const files = await readdir(mapsDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json")).sort();

    const maps = await Promise.all(
      jsonFiles.map(async (file) => {
        const content = await readFile(path.join(mapsDir, file), "utf8");
        const map = JSON.parse(content) as PathwayMap;
        return { ...map, builtIn: true };
      }),
    );

    return maps;
  } catch {
    return [];
  }
});

export const getBuiltInMap = cache(async (id: string): Promise<PathwayMap | null> => {
  const maps = await getBuiltInMaps();
  return maps.find((map) => map.id === id) ?? null;
});
