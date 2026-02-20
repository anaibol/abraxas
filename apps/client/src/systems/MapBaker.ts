import Phaser from "phaser";
import { WelcomeData, TILE_SIZE } from "@abraxas/shared";

export class MapBaker {
	private graphics: Phaser.GameObjects.Graphics;

	constructor(private scene: Phaser.Scene, private welcome: WelcomeData) {
		this.graphics = this.scene.add.graphics();
		this.graphics.setDepth(0); // Render below players (depth 1+)
		this.bakeEntireMap();
	}

	private bakeEntireMap() {
		this.graphics.clear();

		const width = this.welcome.mapWidth;
		const height = this.welcome.mapHeight;
		const collision = this.welcome.collision;
		const tileTypes = this.welcome.tileTypes; // 0=grass, 1=wall, 2=tree, 3=water

		// Colors mapping
		// grass: #2d4c1e, wall: #555555, tree: #1b3a12, water: #1e4c6b
		const colors = {
			0: 0x2d4c1e, // Grass
			1: 0x555555, // Wall / Mountain
			2: 0x1b3a12, // Tree
			3: 0x1e4c6b, // Water
			4: 0x111111, // Dark Stone (Catacombs Floor)
			5: 0x222222, // Dark Wall (Catacombs Wall)
		};

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let color = colors[0]; // Default to grass

				if (tileTypes && tileTypes[y] && tileTypes[y][x] !== undefined) {
					const type = tileTypes[y][x];
					color = colors[type as keyof typeof colors] ?? colors[0];
				} else if (collision && collision[y] && collision[y][x] === 1) {
					// Fallback to collision map if tileTypes is missing
					color = colors[1]; // Wall
				}

				this.graphics.fillStyle(color, 1);
				this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
				
				// Optional: draw subtle grid lines for grass and stone tiles
				if (color === colors[0] || color === colors[4]) {
					this.graphics.lineStyle(1, 0x000000, 0.1);
					this.graphics.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
				}
			}
		}
	}

	update() {
		// Can be expanded later for dynamic chunk baking.
		// Currently bakes entirely on load.
	}
}
