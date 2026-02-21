import Phaser from "phaser";
import { WelcomeData, TILE_SIZE } from "@abraxas/shared";

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

export class MapBaker {
	private waterTiles: { px: number; py: number }[] = [];
	private waterOverlay?: Phaser.GameObjects.Graphics;
	private treeSprites: Phaser.GameObjects.Sprite[] = [];

	constructor(private scene: Phaser.Scene, private welcome: WelcomeData) {
		this.generateTreeTextures();
		this.bakeEntireMap();
	}

	// ── Pre-generate reusable textures for tree types ─────────────────────────
	private generateTreeTextures() {
		// Only generate if they don't already exist (e.g. across scene restarts)
		if (this.scene.textures.exists("tree_oak")) return;

		const g = this.scene.add.graphics();

		// 1. Oak tree (Round, puffy, classic RPG tree)
		g.clear();
		let radius = 26;
		g.fillStyle(0xffffff, 1.0);
		g.fillCircle(30, 24, radius);
		g.fillCircle(16, 36, radius * 0.7);
		g.fillCircle(44, 36, radius * 0.7);
		g.fillCircle(30, 10, radius * 0.8);
		
		g.generateTexture("tree_oak_mask", 60, 60);

		// 2. Pine tree (Tall, triangular, layered)
		g.clear();
		g.fillStyle(0xffffff, 1.0);
		g.fillTriangle(30, 0, 10, 35, 50, 35);
		g.fillTriangle(30, 15, 5, 50, 55, 50);
		g.fillTriangle(30, 30, 0, 65, 60, 65);
		
		g.generateTexture("tree_pine_mask", 60, 70);

		// 3. Willow tree (Drooping, wide, organic)
		g.clear();
		g.fillStyle(0xffffff, 1.0);
		g.fillCircle(35, 20, 22);
		g.fillCircle(15, 30, 15);
		g.fillCircle(55, 30, 15);
		g.fillRoundedRect(10, 20, 15, 35, 8);
		g.fillRoundedRect(45, 20, 15, 35, 8);
		g.fillRoundedRect(25, 25, 20, 40, 10);
		
		g.generateTexture("tree_willow_mask", 70, 70);

		g.destroy();
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
		img.setDepth(0);

		// ── Water ripple overlay (animated in update) ────────────────────────
		if (this.waterTiles.length > 0) {
			this.waterOverlay = this.scene.add.graphics();
			this.waterOverlay.setDepth(0.5);
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
		const cx = px + TILE_SIZE / 2;
		const cy = py + TILE_SIZE / 2 + 12; // Base of the tree is lower down

		// Trunk (drawn into the base ground layer `g` for 1 draw call)
		const trunkWidth = 4 + tileHash(tx, ty, 10) * 4;
		const trunkHeight = 16 + tileHash(tx, ty, 11) * 12;
		g.fillStyle(0x3d2a14, 1.0);
		g.fillRect(cx - trunkWidth / 2, cy - trunkHeight, trunkWidth, trunkHeight);
		
		// Add a shadow on one side of the trunk
		g.fillStyle(0x2b1c0b, 0.6);
		g.fillRect(cx, cy - trunkHeight, trunkWidth / 2, trunkHeight);

		// Determine tree archetype based on tile hash
		const archetypeHash = tileHash(tx, ty, 600);
		let texKey = "tree_oak_mask";
		let tint = 0x1f4a16;
		
		if (archetypeHash < 0.33) {
			texKey = "tree_pine_mask";
			tint = varyColor(0x184224, tx, ty, 601, 15); // Dark, bluer green
		} else if (archetypeHash < 0.66) {
			texKey = "tree_oak_mask";
			tint = varyColor(0x27591e, tx, ty, 602, 12); // Rich mid green
		} else {
			texKey = "tree_willow_mask";
			tint = varyColor(0x3a6b2b, tx, ty, 603, 10); // Lighter, yellow green
		}

		// Calculate size variation
		const scale = 0.8 + tileHash(tx, ty, 604) * 0.5; // 0.8x to 1.3x size

		// Place a Sprite instead of a Graphics object
		const sprite = this.scene.add.sprite(cx, cy - trunkHeight + 5, texKey);
		sprite.setOrigin(0.5, 1.0); // Anchor at bottom center of canopy
		sprite.setScale(scale);
		sprite.setTint(tint);
		sprite.setAlpha(0.95);
		
		// Sort the tree based on its geometric base Y
		sprite.setDepth(cy / TILE_SIZE);
		
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
