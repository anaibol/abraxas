import type { TileMap } from "@abraxas/shared";

const maps = new Map<string, TileMap>();

export function addToRegistry(name: string, data: TileMap) {
  maps.set(name, data);
}

export function getFromRegistry(name: string): TileMap | undefined {
  return maps.get(name);
}
