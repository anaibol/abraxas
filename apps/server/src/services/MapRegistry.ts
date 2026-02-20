import type { TileMap } from "@abraxas/shared";

const GLOBAL_MAPS_KEY = "__ABRAXAS_MAPS__";

function getMaps(): Map<string, TileMap> {
  if (!(globalThis as any)[GLOBAL_MAPS_KEY]) {
    (globalThis as any)[GLOBAL_MAPS_KEY] = new Map<string, TileMap>();
  }
  return (globalThis as any)[GLOBAL_MAPS_KEY];
}

export function addToRegistry(name: string, data: TileMap) {
  getMaps().set(name, data);
}

export function getFromRegistry(name: string): TileMap | undefined {
  return getMaps().get(name);
}
