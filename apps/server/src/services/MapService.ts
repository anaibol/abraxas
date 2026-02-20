import { resolve } from "node:path";
import type { TileMap } from "@abraxas/shared";
import { logger } from "../logger";

let _maps: Map<string, TileMap> | undefined;
function getMaps(): Map<string, TileMap> {
  if (!_maps) _maps = new Map<string, TileMap>();
  return _maps;
}
const mapsDir = resolve(import.meta.dir, "../../../packages/shared/src/maps");

export function setMap(mapName: string, mapData: TileMap): void {
  getMaps().set(mapName, mapData);
}

export async function getMap(mapName: string): Promise<TileMap | undefined> {
  const maps = getMaps();
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
