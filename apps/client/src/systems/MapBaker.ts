import Phaser from "phaser";
import { TILE_SIZE, type WelcomeData } from "@abraxas/shared";

export class MapBaker {
	private bakedChunks = new Set<string>();
	private chunkBakeQueue: Array<{ cx: number; cy: number }> = [];

	constructor(
		private scene: Phaser.Scene,
		private welcome: WelcomeData
	) {}

	update() {
		this.scheduleNearbyChunks();
		if (this.chunkBakeQueue.length > 0) {
			const next = this.chunkBakeQueue.shift();
			if (next) this.bakeMapChunk(next);
		}
	}

	private scheduleNearbyChunks() {
		const { mapWidth, mapHeight } = this.welcome;
		const CHUNK = 25;
		const BAKE_RADIUS = 2; // chunks around the camera to keep baked

		const cam = this.scene.cameras.main;
		// Camera center in tile coords
		const camTileX = (cam.scrollX + cam.width / 2 / cam.zoom) / TILE_SIZE;
		const camTileY = (cam.scrollY + cam.height / 2 / cam.zoom) / TILE_SIZE;
		// Camera center in chunk coords
		const camChunkX = Math.floor(camTileX / CHUNK);
		const camChunkY = Math.floor(camTileY / CHUNK);

		const toQueue: Array<{ cx: number; cy: number; dist: number }> = [];

		for (let dy = -BAKE_RADIUS; dy <= BAKE_RADIUS; dy++) {
			for (let dx = -BAKE_RADIUS; dx <= BAKE_RADIUS; dx++) {
				const col = camChunkX + dx;
				const row = camChunkY + dy;
				const cx = col * CHUNK;
				const cy = row * CHUNK;
				if (cx < 0 || cy < 0 || cx >= mapWidth || cy >= mapHeight) continue;
				const key = `${cx},${cy}`;
				if (this.bakedChunks.has(key)) continue;
				if (this.chunkBakeQueue.some(c => c.cx === cx && c.cy === cy)) continue;
				toQueue.push({ cx, cy, dist: dx * dx + dy * dy });
			}
		}

		// Nearest chunks first
		toQueue.sort((a, b) => a.dist - b.dist);
		for (const { cx, cy } of toQueue) {
			this.chunkBakeQueue.push({ cx, cy });
		}
	}

	private bakeMapChunk({ cx, cy }: { cx: number; cy: number }) {
		const { mapWidth, mapHeight, collision, tileTypes } = this.welcome;
		const CHUNK = 25;
		const chW = Math.min(CHUNK, mapWidth - cx);
		const chH = Math.min(CHUNK, mapHeight - cy);
		const T = TILE_SIZE;
		const chPxW = chW * T;
		const chPxH = chH * T;

		const g = this.scene.make.graphics();

		g.fillStyle(0x4a8c2a, 1);
		g.fillRect(0, 0, chPxW, chPxH);

		for (let ty = cy; ty < cy + chH; ty++) {
			for (let tx = cx; tx < cx + chW; tx++) {
				const type =
					tileTypes?.[ty]?.[tx] ??
					(collision[ty]?.[tx] === 1 ? 1 : 0);
				const px = (tx - cx) * T;
				const py = (ty - cy) * T;
				const h = ((tx * 2246822519 + ty * 3266489917) >>> 0);

				switch (type) {
					case 0: {
						const shade = h % 3;
						if (shade === 0) {
							g.fillStyle(0x3e7a1e, 0.45);
							g.fillRect(px + (h & 7), py + ((h >> 4) & 7), 10, 8);
						} else if (shade === 1) {
							g.fillStyle(0x5aaa2c, 0.35);
							g.fillRect(px + ((h >> 2) & 15), py + ((h >> 6) & 15), 8, 6);
						}
						if ((h >> 8) % 7 === 0) {
							g.fillStyle(0x72cc40, 0.5);
							g.fillRect(px + ((h >> 10) & 27), py + ((h >> 14) & 27), 2, 4);
						}
						break;
					}
					case 1: {
						g.fillStyle(0x484848, 1);
						g.fillRect(px, py, T, T);
						g.fillStyle(0x606060, 1);
						g.fillRect(px + 1, py + 1, 14, 6);
						g.fillRect(px + 17, py + 1, 14, 6);
						g.fillRect(px + 1, py + 9, 8, 6);
						g.fillRect(px + 11, py + 9, 10, 6);
						g.fillRect(px + 23, py + 9, 8, 6);
						g.fillRect(px + 1, py + 17, 14, 6);
						g.fillRect(px + 17, py + 17, 14, 6);
						g.fillRect(px + 1, py + 25, 8, 5);
						g.fillRect(px + 11, py + 25, 10, 5);
						g.fillRect(px + 23, py + 25, 8, 5);
						g.fillStyle(0x2c2c2c, 1);
						g.fillRect(px, py, T, 1);
						g.fillRect(px, py + 8, T, 2);
						g.fillRect(px, py + 16, T, 2);
						g.fillRect(px, py + 24, T, 2);
						g.fillRect(px + 15, py, 2, 9);
						g.fillRect(px + 9, py + 8, 2, 9);
						g.fillRect(px + 21, py + 8, 2, 9);
						g.fillRect(px + 15, py + 16, 2, 9);
						g.fillRect(px + 9, py + 24, 2, 8);
						g.fillRect(px + 21, py + 24, 2, 8);
						g.fillStyle(0x7a7a7a, 0.5);
						g.fillRect(px + 1, py + 1, 14, 1);
						g.fillRect(px + 1, py + 1, 1, 6);
						g.fillRect(px + 17, py + 1, 14, 1);
						g.fillRect(px + 17, py + 1, 1, 6);
						break;
					}
					case 2: {
						g.fillStyle(0x2a5018, 1);
						g.fillRect(px, py, T, T);
						g.fillStyle(0x1a3a10, 0.55);
						g.fillCircle(px + 16, py + 19, 12);
						g.fillStyle(0x2c7c18, 1);
						g.fillCircle(px + 16, py + 13, 11);
						g.fillStyle(0x3a9820, 0.85);
						g.fillCircle(px + 12, py + 10, 7);
						g.fillCircle(px + 20, py + 10, 7);
						g.fillStyle(0x50c030, 0.65);
						g.fillCircle(px + 14, py + 8, 5);
						g.fillStyle(0x46280c, 1);
						g.fillRect(px + 13, py + 21, 6, 11);
						g.fillStyle(0x624014, 0.6);
						g.fillRect(px + 13, py + 21, 2, 11);
						break;
					}
					case 3: {
						g.fillStyle(0x0c2a68, 1);
						g.fillRect(px, py, T, T);
						g.fillStyle(0x1848b0, 0.7);
						g.fillRect(px, py, T, T);
						g.fillStyle(0x2860cc, 0.5);
						g.fillRect(px, py + 10, T, 10);
						g.fillStyle(0x58a0e8, 0.55);
						g.fillRect(px + 2, py + 5, 12, 2);
						g.fillRect(px + 18, py + 8, 10, 2);
						g.fillRect(px + 4, py + 17, 14, 2);
						g.fillRect(px + 20, py + 22, 8, 2);
						g.fillRect(px + 1, py + 26, 10, 2);
						g.fillStyle(0xa0d4ff, 0.28);
						g.fillRect(px + 6, py + 5, 3, 1);
						g.fillRect(px + 22, py + 9, 2, 1);
						break;
					}
				}
			}
		}

		const key = `map-chunk-${cx}-${cy}`;
		g.generateTexture(key, chPxW, chPxH);
		g.destroy();
		this.scene.add.image(cx * T, cy * T, key).setOrigin(0, 0).setDepth(0);
		this.bakedChunks.add(`${cx},${cy}`);
	}
}
