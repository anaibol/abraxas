/**
 * Map generator for the Abraxas Arena.
 * Produces a 200×200 tile world with forests, rivers, stone ruins and
 * strategically placed NPCs. Run with: bun scripts/generate-arena.ts
 */
import { writeFileSync } from "fs";
import { resolve } from "path";

const W = 200;
const H = 200;

const TILE_GRASS = 0;
const TILE_WALL = 1;
const TILE_TREE = 2;
const TILE_WATER = 3;

// ── Seeded PRNG (LCG) ────────────────────────────────────────────────────────

let seed = 0xdeadbeef;
function rand(): number {
	seed = (seed * 1664525 + 1013904223) >>> 0;
	return (seed >>> 0) / 0xffffffff;
}
function randInt(min: number, max: number): number {
	return Math.floor(rand() * (max - min + 1)) + min;
}

// ── Grid ─────────────────────────────────────────────────────────────────────

const tileTypes: number[][] = Array.from({ length: H }, () =>
	new Array(W).fill(TILE_GRASS),
);

function setTile(x: number, y: number, type: number) {
	if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) return;
	tileTypes[y][x] = type;
}

function getTile(x: number, y: number): number {
	if (x < 0 || x >= W || y < 0 || y >= H) return TILE_WALL;
	return tileTypes[y][x];
}

// ── Border walls ─────────────────────────────────────────────────────────────

for (let x = 0; x < W; x++) {
	tileTypes[0][x] = TILE_WALL;
	tileTypes[H - 1][x] = TILE_WALL;
}
for (let y = 0; y < H; y++) {
	tileTypes[y][0] = TILE_WALL;
	tileTypes[y][W - 1] = TILE_WALL;
}

// ── Forest clusters ──────────────────────────────────────────────────────────
//   Each cluster: center + radius, trees placed with density falloff.
//   Keep a clear zone (radius 30) around the central arena.

const CENTER_X = 100;
const CENTER_Y = 100;
const CLEAR_RADIUS = 28;

const forestCenters = [
	{ cx: 28, cy: 28, r: 20 },
	{ cx: 172, cy: 28, r: 18 },
	{ cx: 28, cy: 172, r: 18 },
	{ cx: 172, cy: 172, r: 20 },
	{ cx: 100, cy: 42, r: 14 },
	{ cx: 42, cy: 100, r: 12 },
	{ cx: 158, cy: 100, r: 12 },
	{ cx: 100, cy: 158, r: 14 },
	{ cx: 65, cy: 65, r: 10 },
	{ cx: 135, cy: 65, r: 10 },
	{ cx: 65, cy: 135, r: 10 },
	{ cx: 135, cy: 135, r: 10 },
];

for (const { cx, cy, r } of forestCenters) {
	for (let dy = -r; dy <= r; dy++) {
		for (let dx = -r; dx <= r; dx++) {
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist > r) continue;
			const tx = cx + dx;
			const ty = cy + dy;
			const distFromCenter = Math.sqrt(
				(tx - CENTER_X) ** 2 + (ty - CENTER_Y) ** 2,
			);
			if (distFromCenter < CLEAR_RADIUS) continue;
			// Density falls off with distance from cluster center
			const density = 0.7 * (1 - dist / r);
			if (rand() < density + 0.25) {
				setTile(tx, ty, TILE_TREE);
			}
		}
	}
}

// ── Rivers ───────────────────────────────────────────────────────────────────
//   Two rivers: one snaking west→east, one north→south.
//   Rivers are 2-3 tiles wide.

function placeRiver(
	startX: number,
	startY: number,
	axis: "x" | "y",
	length: number,
	width: number,
) {
	let cx = startX;
	let cy = startY;
	for (let i = 0; i < length; i++) {
		for (let w = 0; w < width; w++) {
			if (axis === "x") setTile(cx, cy + w, TILE_WATER);
			else setTile(cx + w, cy, TILE_WATER);
		}
		if (i % 6 === 0) {
			const drift = randInt(-1, 1);
			if (axis === "x") cy = Math.max(10, Math.min(H - 12, cy + drift));
			else cx = Math.max(10, Math.min(W - 12, cx + drift));
		}
		if (axis === "x") cx++;
		else cy++;
	}
}

// West-to-east river at ~y=68
placeRiver(2, 68, "x", W - 4, 2);
// North-to-south river at ~x=138
placeRiver(138, 2, "y", H - 4, 2);

// ── Stone ruins ──────────────────────────────────────────────────────────────
//   Hollow rectangular structures with an entrance gap.

function addRuin(cx: number, cy: number, rw: number, rh: number) {
	// Outer walls
	for (let y = cy - rh; y <= cy + rh; y++) {
		for (let x = cx - rw; x <= cx + rw; x++) {
			if (y === cy - rh || y === cy + rh || x === cx - rw || x === cx + rw) {
				setTile(x, y, TILE_WALL);
			} else {
				setTile(x, y, TILE_GRASS); // clear interior
			}
		}
	}
	// Entrance on south wall (2 tiles wide)
	setTile(cx, cy + rh, TILE_GRASS);
	setTile(cx - 1, cy + rh, TILE_GRASS);
}

addRuin(165, 18, 8, 8); // Lich tower – NE corner
addRuin(30, 178, 7, 5); // Orc fortress – SW corner
addRuin(178, 178, 6, 5); // Orc fortress – SE corner
addRuin(45, 100, 5, 4); // Skeleton crypt – center-west
addRuin(155, 100, 5, 4); // Ghost shrine – center-east
addRuin(100, 178, 8, 4); // South ruins

// Small pillars / scattered walls for cover in the open arena area
const pillars = [
	{ x: 88, y: 92 },
	{ x: 112, y: 92 },
	{ x: 88, y: 108 },
	{ x: 112, y: 108 },
	{ x: 100, y: 88 },
	{ x: 100, y: 112 },
];
for (const { x, y } of pillars) {
	setTile(x, y, TILE_WALL);
	setTile(x + 1, y, TILE_WALL);
	setTile(x, y + 1, TILE_WALL);
	setTile(x + 1, y + 1, TILE_WALL);
}

// ── Ensure central arena is clear ────────────────────────────────────────────

for (let y = CENTER_Y - 20; y <= CENTER_Y + 20; y++) {
	for (let x = CENTER_X - 20; x <= CENTER_X + 20; x++) {
		const dist = Math.sqrt((x - CENTER_X) ** 2 + (y - CENTER_Y) ** 2);
		if (dist <= 18) {
			setTile(x, y, TILE_GRASS);
		}
	}
}
// Reset pillars that might have been cleared
for (const { x, y } of pillars) {
	setTile(x, y, TILE_WALL);
	setTile(x + 1, y, TILE_WALL);
	setTile(x, y + 1, TILE_WALL);
	setTile(x + 1, y + 1, TILE_WALL);
}

// ── Village clearing (west, near merchant) ────────────────────────────────────

for (let y = 90; y <= 110; y++) {
	for (let x = 60; x <= 80; x++) {
		setTile(x, y, TILE_GRASS);
	}
}

// ── Derive collision from tileTypes ──────────────────────────────────────────

const collision: number[][] = tileTypes.map((row) =>
	row.map((t) => (t === TILE_GRASS ? 0 : 1)),
);

// ── Player spawn points ──────────────────────────────────────────────────────
//   Spread around the central arena and the village.

const spawns = [
	{ x: 96, y: 96 },
	{ x: 104, y: 96 },
	{ x: 96, y: 104 },
	{ x: 104, y: 104 },
	{ x: 90, y: 100 },
	{ x: 110, y: 100 },
	{ x: 100, y: 90 },
	{ x: 100, y: 110 },
	{ x: 70, y: 96 }, // Village area
	{ x: 70, y: 104 },
	{ x: 78, y: 100 },
	{ x: 82, y: 94 },
];

// ── Fixed NPC placements ──────────────────────────────────────────────────────

const npcs = [
	// Village services
	{ type: "merchant", x: 66, y: 100 },
	{ type: "banker", x: 64, y: 103 },

	// NW forest — goblins
	{ type: "goblin", x: 20, y: 22 },
	{ type: "goblin", x: 26, y: 18 },
	{ type: "goblin", x: 32, y: 24 },
	{ type: "goblin", x: 22, y: 32 },

	// NE forest — wolves
	{ type: "wolf", x: 165, y: 22 },
	{ type: "wolf", x: 172, y: 30 },
	{ type: "wolf", x: 178, y: 18 },

	// SW forest — wolves + spiders
	{ type: "wolf", x: 22, y: 165 },
	{ type: "spider", x: 28, y: 172 },
	{ type: "spider", x: 18, y: 176 },

	// SE forest — spiders
	{ type: "spider", x: 172, y: 165 },
	{ type: "spider", x: 178, y: 172 },

	// Skeleton crypt (center-west ruin)
	{ type: "skeleton", x: 44, y: 97 },
	{ type: "skeleton", x: 42, y: 103 },
	{ type: "skeleton", x: 48, y: 100 },

	// Ghost shrine (center-east ruin)
	{ type: "ghost", x: 154, y: 97 },
	{ type: "ghost", x: 158, y: 103 },

	// SW orc fortress
	{ type: "orc", x: 26, y: 175 },
	{ type: "orc", x: 33, y: 176 },
	{ type: "orc", x: 29, y: 180 },

	// SE orc fortress
	{ type: "orc", x: 174, y: 175 },
	{ type: "orc", x: 181, y: 180 },

	// Lich tower (NE ruin) — guarded by skeletons outside
	{ type: "skeleton", x: 158, y: 20 },
	{ type: "skeleton", x: 160, y: 26 },
	{ type: "lich", x: 165, y: 16 },

	// Roaming enemies near the rivers / mid-map
	{ type: "goblin", x: 98, y: 52 },
	{ type: "wolf", x: 52, y: 58 },
	{ type: "skeleton", x: 108, y: 176 },
	{ type: "orc", x: 175, y: 108 },
	{ type: "spider", x: 55, y: 130 },
	{ type: "ghost", x: 148, y: 148 },
];

// ── Write output ──────────────────────────────────────────────────────────────

const mapData = {
	width: W,
	height: H,
	tileSize: 32,
	collision,
	tileTypes,
	spawns,
	npcs,
	npcCount: 0,
};

const outPath = resolve(
	import.meta.dir,
	"../packages/shared/src/maps/arena.json",
);
writeFileSync(outPath, JSON.stringify(mapData));
console.log(`✓ arena.json written → ${outPath} (${W}×${H} tiles)`);
