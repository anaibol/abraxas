import { resolve } from "node:path";
import type { TileMap } from "@abraxas/shared";
import { logger } from "../logger";

const maps = new Map<string, TileMap>();
const mapsDir = resolve(import.meta.dir, "../../../packages/shared/src/maps");

export function setMap(mapName: string, mapData: TileMap): void {
  maps.set(mapName, mapData);
}

export async function getMap(mapName: string): Promise<TileMap | undefined> {
  if (maps.has(mapName)) return maps.get(mapName);

  try {
    const mapPath = resolve(mapsDir, `${mapName}.json`);
    const file = Bun.file(mapPath);
    if (!(await file.exists())) {
      logger.warn({ message: "Map file not found", mapName, path: mapPath });
      return undefined;
    }
    const mapData: TileMap = await file.json();
    maps.set(mapName, mapData);
    return mapData;
  } catch (e) {
    logger.error({ message: "Error loading map", mapName, error: String(e) });
    return undefined;
  }
}
