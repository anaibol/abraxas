import type { TileMap } from "@abraxas/shared";

const GLOBAL_MAPS_KEY = "__ABRAXAS_MAPS__";

if (!(globalThis as any)[GLOBAL_MAPS_KEY]) {
  (globalThis as any)[GLOBAL_MAPS_KEY] = new Map<string, TileMap>();
}

export function addToRegistry(name: string, data: TileMap) {
  const maps = (globalThis as any)[GLOBAL_MAPS_KEY] as Map<string, TileMap>;
  maps.set(name, data);
}

export function getFromRegistry(name: string): TileMap | undefined {
  const maps = (globalThis as any)[GLOBAL_MAPS_KEY] as Map<string, TileMap>;
  return maps.get(name);
}
