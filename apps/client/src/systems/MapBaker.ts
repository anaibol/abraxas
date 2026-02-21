import Phaser from "phaser";
import { WelcomeData, TILE_SIZE } from "@abraxas/shared";
import { RENDER_LAYERS } from "../utils/depth";

// ── Seeded deterministic hash (fast integer) ─────────────────────────────────
function tileHash(x: number, y: number, seed: number): number {
	let h = (x * 374761393 + y * 668265263 + seed) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	h = h ^ (h >>> 16);
	return (h >>> 0) / 4294967296; // 0..1
}

// ── Color helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex: number): [number, number, number] {
	return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function rgbToHex(r: number, g: number, b: number): number {
	return (
		((Math.max(0, Math.min(255, r | 0)) << 16) |
			(Math.max(0, Math.min(255, g | 0)) << 8) |
			Math.max(0, Math.min(255, b | 0))) >>>
		0
	);
}

function varyColor(base: number, x: number, y: number, seed: number, amount: number): number {
	const [r, g, b] = hexToRgb(base);
	const n = (tileHash(x, y, seed) - 0.5) * 2; // -1..1
	return rgbToHex(r + n * amount, g + n * amount, b + n * amount);
}

function lerpColor(a: number, b: number, t: number): number {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

// ── Tile type constants ──────────────────────────────────────────────────────
const TILE_GRASS = 0;
const TILE_WALL = 1;
const TILE_TREE = 2;
const TILE_WATER = 3;
const TILE_DARK_STONE = 4;
const TILE_DARK_WALL = 5;

const BASE_COLORS: Record<number, number> = {
	[TILE_GRASS]: 0x2d4c1e,
	[TILE_WALL]: 0x555555,
	[TILE_TREE]: 0x1b3a12,
	[TILE_WATER]: 0x1e4c6b,
	[TILE_DARK_STONE]: 0x111111,
	[TILE_DARK_WALL]: 0x222222,
};

// Noise amount per tile type (higher = more visible variation)
const NOISE_AMOUNT: Record<number, number> = {
	[TILE_GRASS]: 6,
	[TILE_WALL]: 5,
	[TILE_TREE]: 5,
	[TILE_WATER]: 4,
	[TILE_DARK_STONE]: 3,
	[TILE_DARK_WALL]: 3,
};

const TEX_MAP_BG = "__mapBaker_bg";

// Pool of known good tree Grh IDs from the indices (e.g. 157-171, 100-114)
export const TREE_GRH_POOL = [
	100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114,
	157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171
];

export class MapBaker {
	private waterTiles: { px: number; py: number }[] = [];
	private waterOverlay?: Phaser.GameObjects.Graphics;
	private treeSprites: Phaser.GameObjects.Sprite[] = [];

	constructor(private scene: Phaser.Scene, private welcome: WelcomeData) {
		this.bakeEntireMap();
	}

	// ── Main bake ──────────────────────────────────────────────────────────────
	private bakeEntireMap() {
		const width = this.welcome.mapWidth;
		const height = this.welcome.mapHeight;
		const collision = this.welcome.collision;
		const tileTypes = this.welcome.tileTypes;

		const pxW = width * TILE_SIZE;
		const pxH = height * TILE_SIZE;

		const g = this.scene.add.graphics();

		// ── Pass 1: Base fill with noise ──────────────────────────────────────
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const type = this.getTileType(x, y, tileTypes, collision);
				const base = BASE_COLORS[type] ?? BASE_COLORS[TILE_GRASS];
				const noise = NOISE_AMOUNT[type] ?? 10;
				const color = varyColor(base, x, y, 42, noise);

				const px = x * TILE_SIZE;
				const py = y * TILE_SIZE;

				g.fillStyle(color, 1);
				g.fillRect(px, py, TILE_SIZE, TILE_SIZE);

				// Track water for animation
				if (type === TILE_WATER) {
					this.waterTiles.push({ px, py });
				}
			}
		}

		// ── Pass 2: Edge blending between biomes ─────────────────────────────
		const BLEND_PX = 5;
		const dirs = [
			{ dx: 0, dy: -1, side: "top" },
			{ dx: 0, dy: 1, side: "bottom" },
			{ dx: -1, dy: 0, side: "left" },
			{ dx: 1, dy: 0, side: "right" },
		] as const;

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const type = this.getTileType(x, y, tileTypes, collision);
				const baseColor = BASE_COLORS[type] ?? BASE_COLORS[TILE_GRASS];

				for (const { dx, dy, side } of dirs) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
					const nType = this.getTileType(nx, ny, tileTypes, collision);
					if (nType === type) continue;

					const nColor = BASE_COLORS[nType] ?? BASE_COLORS[TILE_GRASS];
					const px = x * TILE_SIZE;
					const py = y * TILE_SIZE;

					// Draw feathered gradient strips along the shared edge
					for (let i = 0; i < BLEND_PX; i++) {
						const t = (i / BLEND_PX) * 0.4; // subtle blend, max 40%
						const blended = lerpColor(baseColor, nColor, t);

						g.fillStyle(blended, 1);
						switch (side) {
							case "top":
								g.fillRect(px, py + i, TILE_SIZE, 1);
								break;
							case "bottom":
								g.fillRect(px, py + TILE_SIZE - 1 - i, TILE_SIZE, 1);
								break;
							case "left":
								g.fillRect(px + i, py, 1, TILE_SIZE);
								break;
							case "right":
								g.fillRect(px + TILE_SIZE - 1 - i, py, 1, TILE_SIZE);
								break;
						}
					}
				}
			}
		}

		// ── Pass 3: Decorative details per tile type ─────────────────────────
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const type = this.getTileType(x, y, tileTypes, collision);
				const px = x * TILE_SIZE;
				const py = y * TILE_SIZE;

				switch (type) {
					case TILE_GRASS:
						this.drawGrassDetails(g, px, py, x, y);
						break;
					case TILE_WALL:
						this.drawWallDetails(g, px, py, x, y);
						break;
					case TILE_TREE:
						this.drawTreeDetails(g, px, py, x, y);
						break;
					case TILE_WATER:
						this.drawWaterDetails(g, px, py, x, y);
						break;
					case TILE_DARK_STONE:
						this.drawDarkStoneDetails(g, px, py, x, y);
						break;
					case TILE_DARK_WALL:
						this.drawDarkWallDetails(g, px, py, x, y);
						break;
				}
			}
		}

		// Bake graphics into a static texture and display as a single image
		if (this.scene.textures.exists(TEX_MAP_BG)) {
			this.scene.textures.remove(TEX_MAP_BG);
		}
		g.generateTexture(TEX_MAP_BG, pxW, pxH);
		g.destroy();

		const img = this.scene.add.image(0, 0, TEX_MAP_BG);
		img.setOrigin(0, 0);
		img.setDepth(RENDER_LAYERS.BACKGROUND);

		// ── Water ripple overlay (animated in update) ────────────────────────
		if (this.waterTiles.length > 0) {
			this.waterOverlay = this.scene.add.graphics();
			this.waterOverlay.setDepth(RENDER_LAYERS.WATER_OVERLAY);
		}
	}

	// ── Tile type resolver ───────────────────────────────────────────────────
	private getTileType(
		x: number,
		y: number,
		tileTypes: number[][] | undefined,
		collision: number[][] | undefined,
	): number {
		if (tileTypes?.[y]?.[x] !== undefined) {
			return tileTypes[y][x];
		}
		if (collision?.[y]?.[x] === 1) return TILE_WALL;
		return TILE_GRASS;
	}

	// ── Detail drawing methods ───────────────────────────────────────────────

	private drawGrassDetails(g: Phaser.GameObjects.Graphics, px: number, py: number, tx: number, ty: number) {
		// Tiny scattered dots simulating grass blades
		const count = 3 + Math.floor(tileHash(tx, ty, 100) * 4); // 3-6 blades
		for (let i = 0; i < count; i++) {
			const ox = tileHash(tx, ty, 200 + i) * (TILE_SIZE - 4) + 2;
			const oy = tileHash(tx, ty, 300 + i) * (TILE_SIZE - 4) + 2;
			const bright = tileHash(tx, ty, 400 + i) > 0.5;
			g.fillStyle(bright ? 0x3a6025 : 0x243d15, 0.6);
			g.fillRect(px + ox, py + oy, 1, 2);
		}

	}

	private drawWallDetails(g: Phaser.GameObjects.Graphics, px: number, py: number, tx: number, ty: number) {
		// Horizontal mortar lines
		const lineY1 = Math.floor(TILE_SIZE * 0.33);
		const lineY2 = Math.floor(TILE_SIZE * 0.66);
		g.lineStyle(1, 0x444444, 0.4);
		g.beginPath();
		g.moveTo(px, py + lineY1);
		g.lineTo(px + TILE_SIZE, py + lineY1);
		g.moveTo(px, py + lineY2);
		g.lineTo(px + TILE_SIZE, py + lineY2);
		g.strokePath();

		// Vertical crack
		if (tileHash(tx, ty, 500) > 0.7) {
			const cx = px + tileHash(tx, ty, 501) * (TILE_SIZE - 6) + 3;
			g.lineStyle(1, 0x3a3a3a, 0.5);
			g.beginPath();
			g.moveTo(cx, py + 2);
			g.lineTo(cx + 2, py + TILE_SIZE - 2);
			g.strokePath();
		}
	}

	private drawTreeDetails(g: Phaser.GameObjects.Graphics, px: number, py: number, tx: number, ty: number) {
		const aoResolver = this.scene.registry.get("aoResolver");
		if (!aoResolver) return;

		const cx = px + TILE_SIZE / 2;
		const cy = py + TILE_SIZE / 2; // Base of the tree is lower down

		// ── Render Tree using genuine AO Grh texture ──
		const archetypeHash = tileHash(tx, ty, 600);
		const treeIdx = Math.floor(tileHash(tx, ty, 601) * TREE_GRH_POOL.length);
		const grhId = TREE_GRH_POOL[treeIdx];

		const staticGrh = aoResolver.resolveStaticGrh(grhId);
		if (!staticGrh) return;

		const texKey = `ao-${staticGrh.grafico}`;
		const frameKey = `grh-${staticGrh.id}`;

		// We do not set scale variations for now since the AO textures are precisely pixel-art sized
		// and scaling pixel art randomly looks bad. But we can slightly tint.
		const tint = varyColor(0xffffff, tx, ty, 602, 10); 

		const sprite = this.scene.add.sprite(cx, cy + 16, texKey, frameKey);
		
		// In AO, trees generally anchor at their bottom-center so they sort nicely.
		sprite.setOrigin(0.5, 1.0); 
		sprite.setTint(tint);
		sprite.setAlpha(0.95);
		
		// Sort the tree based on its geometric base Y
		sprite.setDepth(RENDER_LAYERS.Y_SORT_BASE + (cy + 16) / TILE_SIZE);
		
		this.treeSprites.push(sprite);
	}

	private drawWaterDetails(g: Phaser.GameObjects.Graphics, px: number, py: number, tx: number, ty: number) {
		// Static ripple highlights
		const count = 2 + Math.floor(tileHash(tx, ty, 700) * 3);
		for (let i = 0; i < count; i++) {
			const ox = tileHash(tx, ty, 800 + i) * (TILE_SIZE - 8) + 4;
			const oy = tileHash(tx, ty, 900 + i) * (TILE_SIZE - 8) + 4;
			const len = 4 + tileHash(tx, ty, 1000 + i) * 6;
			g.lineStyle(1, 0x3399aa, 0.25);
			g.beginPath();
			g.moveTo(px + ox, py + oy);
			g.lineTo(px + ox + len, py + oy + 1);
			g.strokePath();
		}
	}

	private drawDarkStoneDetails(g: Phaser.GameObjects.Graphics, px: number, py: number, tx: number, ty: number) {
		// Scattered debris dots
		const count = 2 + Math.floor(tileHash(tx, ty, 1100) * 3);
		for (let i = 0; i < count; i++) {
			const ox = tileHash(tx, ty, 1200 + i) * (TILE_SIZE - 4) + 2;
			const oy = tileHash(tx, ty, 1300 + i) * (TILE_SIZE - 4) + 2;
			g.fillStyle(0x1a1a1a, 0.5);
			g.fillRect(px + ox, py + oy, 2, 1);
		}

	}

	private drawDarkWallDetails(g: Phaser.GameObjects.Graphics, px: number, py: number, tx: number, ty: number) {
		// Vertical crack
		if (tileHash(tx, ty, 1400) > 0.6) {
			const cx = px + tileHash(tx, ty, 1401) * (TILE_SIZE - 6) + 3;
			g.lineStyle(1, 0x191919, 0.6);
			g.beginPath();
			g.moveTo(cx, py + 1);
			g.lineTo(cx - 1, py + TILE_SIZE / 2);
			g.lineTo(cx + 1, py + TILE_SIZE - 1);
			g.strokePath();
		}

		// Horizontal mortar
		g.lineStyle(1, 0x1a1a1a, 0.3);
		g.beginPath();
		g.moveTo(px, py + TILE_SIZE / 2);
		g.lineTo(px + TILE_SIZE, py + TILE_SIZE / 2);
		g.strokePath();
	}

	// ── Per-frame update: animated water ripples and wind ─────────────────────
	update(time: number) {
		const cam = this.scene.cameras.main;
		const camL = cam.scrollX - TILE_SIZE * 2;
		const camR = cam.scrollX + cam.width / cam.zoom + TILE_SIZE * 2;
		const camT = cam.scrollY - TILE_SIZE * 2;
		const camB = cam.scrollY + cam.height / cam.zoom + TILE_SIZE * 2;

		// 1. Update tree sway (wind animation)
		// We update this every frame for smooth motion
		const windTime = time * 0.001;
		for (let i = 0; i < this.treeSprites.length; i++) {
			const sprite = this.treeSprites[i];
			if (!sprite.active) continue;

			// Viewport culling for trees
			if (sprite.x < camL || sprite.x > camR || sprite.y < camT || sprite.y > camB) {
				continue;
			}

			// Calculate a low-frequency ambient wind sway
			// Use the tree's position as a phase offset so they don't move in rigid unison,
			// creating a rolling wave effect across the forest
			const phaseX = sprite.x * 0.005;
			const phaseY = sprite.y * 0.002;
			
			// Combine a slow, deep wave with a slightly faster, smaller jitter
			const wave1 = Math.sin(windTime * 0.8 + phaseX + phaseY);
			const wave2 = Math.cos(windTime * 1.5 + phaseX * 2);
			
			// Resulting rotation is very subtle (a few degrees)
			const rot = (wave1 * 0.03) + (wave2 * 0.015);
			sprite.setRotation(rot);
		}

		// 2. Update water ripples
		// Only redraw graphics every 4 frames (~15 FPS) to save CPU
		if (this.waterOverlay && this.waterTiles.length > 0 && Math.floor(time / 66) % 2 === 0) {
			this.waterOverlay.clear();

			for (const { px, py } of this.waterTiles) {
				// Viewport culling
				if (px + TILE_SIZE < camL || px > camR || py + TILE_SIZE < camT || py > camB) continue;

				const phase = (time * 0.001 + px * 0.02 + py * 0.03);
				const alpha = 0.08 + Math.sin(phase) * 0.06;
				const offsetX = Math.sin(phase * 1.3) * 2;

				this.waterOverlay.lineStyle(1, 0x77ccdd, Math.max(0, alpha));
				this.waterOverlay.beginPath();
				this.waterOverlay.moveTo(px + 4 + offsetX, py + TILE_SIZE / 2);
				this.waterOverlay.lineTo(px + TILE_SIZE - 4 + offsetX, py + TILE_SIZE / 2 + 1);
				this.waterOverlay.strokePath();
			}
		}
	}

	destroy() {
		for (const sprite of this.treeSprites) {
			sprite.destroy();
		}
		this.treeSprites = [];
		this.waterOverlay?.destroy();
		this.waterTiles = [];
	}
}
