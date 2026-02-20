import type { TileMap } from "@abraxas/shared";

declare global {
  var __ABRAXAS_MAPS__: Map<string, TileMap> | undefined;
}

function getMaps(): Map<string, TileMap> {
  if (!globalThis.__ABRAXAS_MAPS__) {
    globalThis.__ABRAXAS_MAPS__ = new Map<string, TileMap>();
  }
  return globalThis.__ABRAXAS_MAPS__;
}

export function addToRegistry(name: string, data: TileMap) {
  getMaps().set(name, data);
}

export function getFromRegistry(name: string): TileMap | undefined {
  return getMaps().get(name);
}
