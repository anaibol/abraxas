import type { TileMap } from "@abraxas/shared";
import type { SpatialLookup } from "./SpatialLookup";

/**
 * Returns true if the tile is within bounds, walkable (no collision),
 * and not occupied by any living entity (player or NPC).
 * Items/drops on the tile are allowed — only solid blockers count.
 */
function isValidSpawnTile(
	x: number,
	y: number,
	map: TileMap,
	spatial: SpatialLookup,
): boolean {
	return (
		x >= 0 &&
		x < map.width &&
		y >= 0 &&
		y < map.height &&
		map.collision[y]?.[x] !== 1 &&
		!spatial.isTileOccupied(x, y)
	);
}

/**
 * Finds the nearest valid spawn tile starting from (originX, originY)
 * using a clockwise outward spiral search.
 *
 * Returns the origin immediately if it is already valid.
 * Returns null if no free tile is found within maxRadius tiles.
 *
 * Spiral order: right → down → left → up, expanding one ring at a time.
 */
export function findSafeSpawn(
	originX: number,
	originY: number,
	map: TileMap,
	spatial: SpatialLookup,
	maxRadius = 20,
): { x: number; y: number } | null {
	if (isValidSpawnTile(originX, originY, map, spatial)) {
		return { x: originX, y: originY };
	}

	// Spiral: right(+x), down(+y), left(-x), up(-y)
	const ddx = [1, 0, -1, 0];
	const ddy = [0, 1, 0, -1];

	let x = originX;
	let y = originY;
	let dir = 0;
	let steps = 1; // tiles to walk in the current segment length
	let stepsTaken = 0;
	let turns = 0; // number of direction changes

	while (steps <= maxRadius) {
		x += ddx[dir];
		y += ddy[dir];
		stepsTaken++;

		if (isValidSpawnTile(x, y, map, spatial)) {
			return { x, y };
		}

		if (stepsTaken === steps) {
			stepsTaken = 0;
			dir = (dir + 1) % 4;
			turns++;
			// Increase segment length every two turns (after each full axis pair)
			if (turns % 2 === 0) steps++;
		}
	}

	return null;
}
