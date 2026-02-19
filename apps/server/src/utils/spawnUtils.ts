import type { TileMap } from "@abraxas/shared";
import type { SpatialLookup } from "./SpatialLookup";

/**
 * Generic outward spiral search from (originX, originY).
 * Visits tiles in a clockwise spiral: right → down → left → up, expanding one
 * ring at a time. Calls `isValid` on each candidate and returns the first
 * passing tile, or null if none is found within maxRadius.
 */
export function spiralSearch(
	originX: number,
	originY: number,
	maxRadius: number,
	isValid: (x: number, y: number) => boolean,
): { x: number; y: number } | null {
	if (isValid(originX, originY)) return { x: originX, y: originY };

	// Clockwise direction deltas: right, down, left, up
	const ddx = [1, 0, -1, 0];
	const ddy = [0, 1, 0, -1];

	let x = originX;
	let y = originY;
	let dir = 0;
	let steps = 1; // tiles to walk before the next turn
	let stepsTaken = 0;
	let turns = 0; // number of direction changes made

	while (steps <= maxRadius) {
		x += ddx[dir];
		y += ddy[dir];
		stepsTaken++;

		if (isValid(x, y)) return { x, y };

		if (stepsTaken === steps) {
			stepsTaken = 0;
			dir = (dir + 1) % 4;
			turns++;
			// Increase segment length every two turns (one full axis pair)
			if (turns % 2 === 0) steps++;
		}
	}

	return null;
}

/**
 * Returns true if the tile is within map bounds, walkable (no collision tile),
 * and not occupied by any living entity (player or NPC).
 * Items / drops on the tile are explicitly allowed.
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
 * Finds the nearest valid spawn tile starting from (originX, originY) using a
 * spiral outward search. Returns the origin immediately if it is already valid.
 * Returns null if no free tile is found within maxRadius.
 */
export function findSafeSpawn(
	originX: number,
	originY: number,
	map: TileMap,
	spatial: SpatialLookup,
	maxRadius = 20,
): { x: number; y: number } | null {
	return spiralSearch(originX, originY, maxRadius, (x, y) =>
		isValidSpawnTile(x, y, map, spatial),
	);
}
