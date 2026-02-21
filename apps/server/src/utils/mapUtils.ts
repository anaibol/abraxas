import { MathUtils } from "@abraxas/shared";
import type { SpatialLookup } from "./SpatialLookup";

/**
 * Returns true if the tile is walkable (no wall collision) and has no living
 * entity occupying it. Ignores drops on the ground.
 */
export function isTileValidForMove(
  x: number,
  y: number,
  map: { width: number; height: number; collision: number[][] },
  spatial: SpatialLookup,
  excludeSessionId?: string
): boolean {
  if (!MathUtils.isTileWalkable(x, y, map)) return false;
  return !spatial.isTileOccupied(x, y, excludeSessionId);
}
