import Phaser from "phaser";
import { Callbacks, type Room } from "@colyseus/sdk";
import type { NetworkManager } from "../network/NetworkManager";
import type { WelcomeData } from "@abraxas/shared";
import { InputHandler } from "../systems/InputHandler";
import { CameraController } from "../systems/CameraController";
import { SoundManager } from "../assets/SoundManager";
import { TILE_SIZE, DIRECTION_DELTA, ITEMS, i18n } from "@abraxas/shared";
import type { Direction } from "@abraxas/shared";
import type { PlayerState } from "../ui/Sidebar";
import { SpriteManager } from "../managers/SpriteManager";
import { EffectManager } from "../managers/EffectManager";
import { GameEventHandler } from "../handlers/GameEventHandler";
import { AudioManager } from "../managers/AudioManager";

import type { GameState } from "../../../server/src/schema/GameState";
import type { Player } from "../../../server/src/schema/Player";
import type { Drop } from "../../../server/src/schema/Drop";

type StateCallback = (state: PlayerState) => void;
type KillFeedCallback = (killer: string, victim: string) => void;
export type ConsoleCallback = (text: string, color?: string) => void;
export type PlayerRightClickCallback = (sessionId: string, name: string, screenX: number, screenY: number) => void;

export class GameScene extends Phaser.Scene {
	private network: NetworkManager;
	private onStateUpdate: StateCallback;
	private onKillFeed?: KillFeedCallback;
	private onConsoleMessage?: ConsoleCallback;
	private onReady?: () => void;
	private onPttChange?: (recording: boolean) => void;
	private onPlayerRightClick?: PlayerRightClickCallback;
	private room!: Room<GameState>;
	private welcome!: WelcomeData;
	private spriteManager!: SpriteManager;
	private effectManager!: EffectManager;
	private inputHandler!: InputHandler;
	private cameraController!: CameraController;
	private soundManager!: SoundManager;
	private audioManager: AudioManager;
	private gameEventHandler!: GameEventHandler;

	private collisionGrid: number[][] = [];
	private stateUnsubscribers: (() => void)[] = [];

	private targetingRangeTiles = 0;
	private rangeOverlay: Phaser.GameObjects.Graphics | null = null;
	private tileHighlight: Phaser.GameObjects.Graphics | null = null;
	private lastOverlayCenterX = -1;
	private lastOverlayCenterY = -1;

	private muteKey?: Phaser.Input.Keyboard.Key;
	private debugText?: Phaser.GameObjects.Text;

	// Map baking — chunks are baked lazily one per update() tick as the camera approaches them
	private bakedChunks = new Set<string>();
	private chunkBakeQueue: Array<{ cx: number; cy: number }> = [];
	private dropVisuals = new Map<
		string,
		{
			arc: Phaser.GameObjects.Arc;
			tween: Phaser.Tweens.Tween;
			emitter: Phaser.GameObjects.Particles.ParticleEmitter;
			label: Phaser.GameObjects.Text;
			color: number;
			tileX: number;
			tileY: number;
		}
	>();
	private handleVisibilityChange = () => {
		if (document.visibilityState === "visible") {
			const webAudio = this.sound as Phaser.Sound.WebAudioSoundManager;
			if (webAudio.context?.state === "suspended") {
				webAudio.context.resume();
			}
		}
	};

	constructor(
		network: NetworkManager,
		audioManager: AudioManager,
		onStateUpdate: StateCallback,
		onKillFeed?: KillFeedCallback,
		onConsoleMessage?: ConsoleCallback,
		onReady?: () => void,
		onPttChange?: (recording: boolean) => void,
		onPlayerRightClick?: PlayerRightClickCallback,
	) {
		super({ key: "GameScene" });
		this.network = network;
		this.audioManager = audioManager;
		this.onStateUpdate = onStateUpdate;
		this.onKillFeed = onKillFeed;
		this.onConsoleMessage = onConsoleMessage;
		this.onReady = onReady;
		this.onPttChange = onPttChange;
		this.onPlayerRightClick = onPlayerRightClick;
	}

	create() {
		this.room = this.network.getRoom();
		this.welcome = this.network.getWelcomeData();
		this.collisionGrid = this.welcome.collision;
		// Map chunks are baked lazily in update() via scheduleNearbyChunks()

		this.sound.pauseOnBlur = false;

		this.soundManager = new SoundManager(this);
		this.soundManager.startMusic();

		this.muteKey = this.input.keyboard?.addKey(
			Phaser.Input.Keyboard.KeyCodes.BACKTICK,
		);
		this.muteKey?.on("down", () => {
			this.soundManager.toggleMute();
		});

		this.network.onAudioData = (sessionId, data) => {
			this.audioManager.playAudioChunk(data);
			this.spriteManager.setSpeaking(sessionId, true, 300);
		};

		this.input.mouse?.disableContextMenu();

		this.cameraController = new CameraController(this.cameras.main);
		this.cameraController.applyFixedZoom();
		this.scale.on("resize", () => this.cameraController.applyFixedZoom());

		this.spriteManager = new SpriteManager(
			this,
			this.cameraController,
			() => this.room.sessionId,
		);
		this.effectManager = new EffectManager(this, this.spriteManager);

		const localPlayer = this.room.state.players.get(this.room.sessionId);
		const classType = localPlayer?.classType ?? "WARRIOR";
		this.inputHandler = new InputHandler(
			this,
			this.network,
			classType,
			(direction) => this.onLocalMove(direction),
			(rangeTiles) => this.onEnterTargeting(rangeTiles),
			() => this.onExitTargeting(),
			(tileX, tileY) => {
				let targetNpcId: string | null = null;
				for (const [id, npc] of this.room.state.npcs) {
					if (npc.tileX === tileX && npc.tileY === tileY) {
						targetNpcId = id;
						break;
					}
				}
				if (targetNpcId) this.network.sendInteract(targetNpcId);
			},
			() => {
				this.audioManager.startRecording((data) =>
					this.network.sendAudio(data),
				);
				this.onPttChange?.(true);
			},
			() => {
				this.audioManager.stopRecording();
				this.onPttChange?.(false);
			},
			(tileX, tileY, screenX, screenY) => {
				for (const [sessionId, player] of this.room.state.players) {
					if (sessionId === this.room.sessionId) continue;
					if (player.tileX === tileX && player.tileY === tileY && player.alive) {
						this.onPlayerRightClick?.(sessionId, player.name, screenX, screenY);
						return;
					}
				}
			},
		);

		const $state = Callbacks.get(this.room);
		const unsub = (...fns: (() => void)[]) =>
			this.stateUnsubscribers.push(...fns);

		const playerOnChangeUnsubs = new Map<string, () => void>();
		const npcOnChangeUnsubs = new Map<string, () => void>();

		unsub(
			$state.onAdd("players", (player, sessionId) => {
				this.spriteManager.addPlayer(player, sessionId);
				this.spriteManager.syncPlayer(player, sessionId);
				const isLocal = sessionId === this.room.sessionId;
				const onChangeUnsub = $state.onChange(player, () => {
					this.spriteManager.syncPlayer(player, sessionId);
					if (isLocal) this.pushSidebarUpdate(player);
				});
				playerOnChangeUnsubs.set(sessionId, onChangeUnsub);
				unsub(onChangeUnsub);
				if (isLocal) this.pushSidebarUpdate(player);
			}),
			$state.onRemove("players", (_player, sessionId) => {
				playerOnChangeUnsubs.get(sessionId)?.();
				playerOnChangeUnsubs.delete(sessionId);
				this.spriteManager.removePlayer(sessionId);
			}),
			$state.onAdd("drops", (drop, id) => this.addDrop(drop, id)),
			$state.onRemove("drops", (_drop, id) => this.removeDrop(id)),
			$state.onAdd("npcs", (npc, id) => {
				this.spriteManager.addNpc(npc, id);
				this.spriteManager.syncNpc(npc, id);
				const onChangeUnsub = $state.onChange(npc, () =>
					this.spriteManager.syncNpc(npc, id),
				);
				npcOnChangeUnsubs.set(id, onChangeUnsub);
				unsub(onChangeUnsub);
			}),
			$state.onRemove("npcs", (_npc, id) => {
				npcOnChangeUnsubs.get(id)?.();
				npcOnChangeUnsubs.delete(id);
				this.spriteManager.removePlayer(id);
			}),
		);

		this.gameEventHandler = new GameEventHandler(
			this.room,
			this.spriteManager,
			this.effectManager,
			this.soundManager,
			this.inputHandler,
			this.onConsoleMessage,
			this.onKillFeed,
		);
		this.gameEventHandler.setupListeners();

		if (import.meta.env.DEV) {
			this.debugText = this.add.text(10, 10, "", {
				fontSize: "16px",
				color: "#ffffff",
				stroke: "#000000",
				strokeThickness: 4,
				fontFamily: "'Courier New', Courier, monospace",
			});
			this.debugText.setScrollFactor(0);
			this.debugText.setDepth(100);
		}

		document.addEventListener("visibilitychange", this.handleVisibilityChange);

		this.onReady?.();
	}

	update(time: number, delta: number) {
		// Schedule nearby chunks into the bake queue each tick
		this.scheduleNearbyChunks();
		// Bake one queued chunk per tick — keeps each rAF well under 16ms
		if (this.chunkBakeQueue.length > 0) {
			const next = this.chunkBakeQueue.shift();
			if (next) this.bakeMapChunk(next);
		}

		this.inputHandler.update(time, () => this.getMouseTile());
		this.spriteManager.update(delta);

		if (this.inputHandler.targeting) {
			const lp = this.room.state.players.get(this.room.sessionId);
			if (lp && (!lp.alive || lp.stunned)) this.inputHandler.cancelTargeting();
			this.updateTargetingOverlay();
		}

		// Show drop labels only within 5 tiles of the local player (Diablo 2-style)
		const lp = this.room.state.players.get(this.room.sessionId);
		if (lp) {
			for (const [, v] of this.dropVisuals) {
				const dist =
					Math.abs(v.tileX - lp.tileX) + Math.abs(v.tileY - lp.tileY);
				v.label.setVisible(dist <= 5);
			}
		}

		const localSprite = this.spriteManager.getSprite(this.room.sessionId);
		if (this.debugText && localSprite) {
			this.debugText.setText(
				`X: ${localSprite.predictedTileX} Y: ${localSprite.predictedTileY}`,
			);
		}
	}

	shutdown() {
		document.removeEventListener(
			"visibilitychange",
			this.handleVisibilityChange,
		);
		this.gameEventHandler.destroy();
		for (const unsub of this.stateUnsubscribers) unsub();
		this.stateUnsubscribers = [];
		this.inputHandler.destroy();
		if (this.muteKey) this.input.keyboard?.removeKey(this.muteKey);
		this.soundManager.stopMusic();
	}

	triggerMove(direction: Direction) {
		this.inputHandler.triggerMove(direction, this.time.now);
	}

	triggerAttack() {
		this.inputHandler.handleAttackInput();
	}

	triggerCast(spellId: string) {
		this.network.sendCast(spellId, 0, 0);
	}

	startSpellTargeting(spellId: string, rangeTiles: number) {
		this.inputHandler.cancelTargeting();
		if (rangeTiles > 0) {
			this.inputHandler.enterTargeting({ mode: "spell", spellId, rangeTiles });
		} else {
			this.network.sendCast(spellId, 0, 0);
		}
	}

	private clearTargetingOverlay() {
		this.rangeOverlay?.destroy();
		this.rangeOverlay = null;
		this.tileHighlight?.destroy();
		this.tileHighlight = null;
		this.lastOverlayCenterX = -1;
		this.lastOverlayCenterY = -1;
	}

	private onEnterTargeting(rangeTiles: number) {
		this.clearTargetingOverlay();
		this.targetingRangeTiles = rangeTiles;
		this.input.setDefaultCursor("crosshair");
		this.rangeOverlay = this.add.graphics();
		this.rangeOverlay.setDepth(1);
		this.tileHighlight = this.add.graphics();
		this.tileHighlight.setDepth(2);
	}

	private onExitTargeting() {
		this.input.setDefaultCursor("default");
		this.targetingRangeTiles = 0;
		this.clearTargetingOverlay();
	}

	private updateTargetingOverlay() {
		const localSprite = this.spriteManager.getSprite(this.room.sessionId);
		if (!localSprite) return;

		const cx = localSprite.predictedTileX;
		const cy = localSprite.predictedTileY;
		const range = this.targetingRangeTiles;

		if (
			this.rangeOverlay &&
			(cx !== this.lastOverlayCenterX || cy !== this.lastOverlayCenterY)
		) {
			this.lastOverlayCenterX = cx;
			this.lastOverlayCenterY = cy;
			this.rangeOverlay.clear();
			this.rangeOverlay.fillStyle(0x44aaff, 0.15);
			this.rangeOverlay.lineStyle(1, 0x44aaff, 0.3);

			for (let dy = -range; dy <= range; dy++) {
				for (let dx = -range; dx <= range; dx++) {
					if (Math.sqrt(dx * dx + dy * dy) > range + 0.5) continue;
					const tx = cx + dx;
					const ty = cy + dy;
					if (
						tx < 0 ||
						ty < 0 ||
						tx >= this.welcome.mapWidth ||
						ty >= this.welcome.mapHeight
					)
						continue;
					if (this.collisionGrid[ty]?.[tx] === 1) continue;
					const px = tx * TILE_SIZE;
					const py = ty * TILE_SIZE;
					this.rangeOverlay.fillRect(px, py, TILE_SIZE, TILE_SIZE);
					this.rangeOverlay.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
				}
			}
		}

		if (this.tileHighlight) {
			const mouseTile = this.getMouseTile();
			this.tileHighlight.clear();
			this.tileHighlight.lineStyle(2, 0xffff00, 0.8);
			this.tileHighlight.strokeRect(
				mouseTile.x * TILE_SIZE,
				mouseTile.y * TILE_SIZE,
				TILE_SIZE,
				TILE_SIZE,
			);
		}
	}

	private pushSidebarUpdate(player: Player): void {
		this.onStateUpdate({
			name: player.name,
			classType: player.classType,
			hp: player.hp,
			maxHp: player.maxHp,
			mana: player.mana,
			maxMana: player.maxMana,
			alive: player.alive,
			str: player.str,
			agi: player.agi,
			intStat: player.intStat,
			gold: player.gold,
			stealthed: player.stealthed,
			stunned: player.stunned,
			level: player.level,
			xp: player.xp,
			maxXp: player.maxXp,
			inventory: this.buildInventory(player),
			equipment: {
				weapon: player.equipWeapon,
				armor: player.equipArmor,
				shield: player.equipShield,
				helmet: player.equipHelmet,
				ring: player.equipRing,
			},
		});
	}

	private buildInventory(player: Player) {
		if (!player.inventory) return [];
		return Array.from(player.inventory).map((item) => ({
			itemId: item.itemId,
			quantity: item.quantity,
			slotIndex: item.slotIndex,
		}));
	}

	/** Draws the entire map onto a single persistent Graphics object. */
	/**
	 * Called every update() tick. Looks at the camera world position and enqueues
	 * any un-baked chunks within BAKE_RADIUS chunks of the camera for lazy baking.
	 * Chunks are sorted nearest-first so the player sees them in order.
	 */
	private scheduleNearbyChunks() {
		const { mapWidth, mapHeight } = this.welcome;
		const CHUNK = 25;
		const BAKE_RADIUS = 2; // chunks around the camera to keep baked

		const cam = this.cameras.main;
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

	/**
	 * Bakes one map chunk into a Canvas texture and places a static Image.
	 * Called once per update() tick from the queue so each frame stays fast.
	 *
	 * The Graphics object is never added to the display list and is destroyed
	 * immediately after generateTexture(), leaving only a lightweight Image quad.
	 */
	private bakeMapChunk({ cx, cy }: { cx: number; cy: number }) {
		const { mapWidth, mapHeight, collision, tileTypes } = this.welcome;
		const CHUNK = 25;
		const chW = Math.min(CHUNK, mapWidth - cx);
		const chH = Math.min(CHUNK, mapHeight - cy);
		const T = TILE_SIZE;
		const chPxW = chW * T;
		const chPxH = chH * T;

		const g = this.make.graphics({ add: false });

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
		this.add.image(cx * T, cy * T, key).setOrigin(0, 0).setDepth(0);
		this.bakedChunks.add(`${cx},${cy}`);
	}

	private getMouseTile(): { x: number; y: number } {
		const pointer = this.input.activePointer;
		const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
		return {
			x: Math.floor(worldPoint.x / TILE_SIZE),
			y: Math.floor(worldPoint.y / TILE_SIZE),
		};
	}

	private onLocalMove(direction: Direction) {
		const sprite = this.spriteManager.getSprite(this.room.sessionId);
		if (!sprite) return;

		const delta = DIRECTION_DELTA[direction];
		const nextX = sprite.predictedTileX + delta.dx;
		const nextY = sprite.predictedTileY + delta.dy;

		const { mapWidth, mapHeight } = this.welcome;
		if (nextX < 0 || nextX >= mapWidth || nextY < 0 || nextY >= mapHeight)
			return;
		if (this.collisionGrid[nextY]?.[nextX] === 1) return;

		for (const [sid, p] of this.room.state.players) {
			if (sid === this.room.sessionId) continue;
			if (p.alive && p.tileX === nextX && p.tileY === nextY) return;
		}
		for (const [_sid, n] of this.room.state.npcs) {
			if (n.alive && n.tileX === nextX && n.tileY === nextY) return;
		}

		sprite.setFacing(direction);
		sprite.predictMove(direction);
		this.soundManager.playStep();
	}

	private addDrop(drop: Drop, id: string) {
		const px = drop.tileX * TILE_SIZE + TILE_SIZE / 2;
		const py = drop.tileY * TILE_SIZE + TILE_SIZE / 2;
		const color = this.dropColor(drop);
		const isRare = drop.itemType === "item" && ITEMS[drop.itemId]?.rarity === "rare";

		const arc = this.add.circle(px, py, isRare ? 7 : 6, color).setDepth(5);

		// Gentle bob — rare items bob a bit more dramatically
		const tween = this.tweens.add({
			targets: arc,
			y: py - (isRare ? 6 : 4),
			duration: isRare ? 700 : 900,
			yoyo: true,
			repeat: -1,
			ease: "Sine.InOut",
		});

		// Lazy-create sparkle texture
		if (!this.textures.exists("drop-spark")) {
			const g = this.add.graphics();
			g.fillStyle(0xffffff, 1);
			g.fillCircle(2, 2, 2);
			g.generateTexture("drop-spark", 4, 4);
			g.destroy();
		}

		const emitter = this.add.particles(px, py, "drop-spark", {
			tint: [color, 0xffffff],
			speed: { min: 8, max: 22 },
			angle: { min: 0, max: 360 },
			scale: { start: 0.55, end: 0 },
			alpha: { start: 0.85, end: 0 },
			lifespan: { min: 380, max: 780 },
			quantity: isRare ? 2 : 1,
			frequency: isRare ? 100 : 180,
			gravityY: -18,
		});
		emitter.setDepth(6);

		// Item name label — hidden until player is within range (shown in update())
		const labelStr = this.dropLabelText(drop);
		const labelColor = this.dropLabelColor(drop);
		const label = this.add
			.text(px, py + 10, labelStr, {
				fontSize: isRare ? "9px" : "8px",
				color: labelColor,
				stroke: "#000000",
				strokeThickness: 3,
				fontFamily: "'Courier New', Courier, monospace",
				fontStyle: isRare ? "bold" : "normal",
			})
			.setOrigin(0.5, 0)
			.setDepth(7)
			.setVisible(false);

		// Landing effect only for freshly spawned drops (not pre-existing when player joins)
		const ageMs = Date.now() - drop.spawnedAt;
		if (ageMs < 3000 && this.effectManager) {
			this.effectManager.playDropLanded(drop.tileX, drop.tileY, color);
		}

		this.dropVisuals.set(id, {
			arc,
			tween,
			emitter,
			label,
			color,
			tileX: drop.tileX,
			tileY: drop.tileY,
		});
	}

	private removeDrop(id: string) {
		const visual = this.dropVisuals.get(id);
		if (!visual) return;

		const { arc, tween, emitter, label, color } = visual;

		// Colored pickup burst matching item rarity/type
		if (this.textures.exists("drop-spark")) {
			const burst = this.add.particles(arc.x, arc.y, "drop-spark", {
				tint: [color, 0xffffff],
				speed: { min: 30, max: 90 },
				angle: { min: 0, max: 360 },
				scale: { start: 0.65, end: 0 },
				alpha: { start: 1, end: 0 },
				lifespan: { min: 200, max: 460 },
			});
			burst.setDepth(6);
			burst.explode(16);
			this.time.delayedCall(520, () => burst.destroy());
		}

		tween.stop();
		emitter.destroy();
		label.destroy();
		arc.destroy();
		this.dropVisuals.delete(id);
	}

	/** Circle color for a drop based on item type and rarity — like Diablo 2. */
	private dropColor(drop: Drop): number {
		if (drop.itemType === "gold") return 0xffcc00;
		const item = ITEMS[drop.itemId];
		if (!item) return 0xffffff;
		if (item.slot === "consumable") {
			const e = item.consumeEffect;
			if (e?.healHp && !e?.healMana) return 0xff3333;  // health potion — red
			if (e?.healMana && !e?.healHp) return 0x4466ff;  // mana potion — blue
			return 0xaaffaa;                                  // other consumable — green
		}
		switch (item.rarity) {
			case "common":   return 0xdddddd;
			case "uncommon": return 0x4488ff;
			case "rare":     return 0xffaa00;
			default:         return 0xffffff;
		}
	}

	/** CSS color string for the drop name label, matching Diablo 2 rarity conventions. */
	private dropLabelColor(drop: Drop): string {
		if (drop.itemType === "gold") return "#ffcc00";
		const item = ITEMS[drop.itemId];
		if (!item) return "#ffffff";
		if (item.slot === "consumable") {
			const e = item.consumeEffect;
			if (e?.healHp && !e?.healMana) return "#ff6666";
			if (e?.healMana && !e?.healHp) return "#6699ff";
			return "#aaffaa";
		}
		switch (item.rarity) {
			case "common":   return "#dddddd";
			case "uncommon": return "#6699ff";
			case "rare":     return "#ffbb44";
			default:         return "#ffffff";
		}
	}

	/** Human-readable label for a drop — "Iron Sword", "42 Gold", "Health Potion (x3)", etc. */
	private dropLabelText(drop: Drop): string {
		if (drop.itemType === "gold") return `${drop.goldAmount} Gold`;
		const item = ITEMS[drop.itemId];
		if (!item) return drop.itemId;
		// Resolve i18n key → actual name; fall back to humanising the item ID
		let name: string;
		try {
			const translated = i18n.t(item.name);
			name = translated !== item.name ? translated : "";
		} catch {
			name = "";
		}
		if (!name) {
			name = drop.itemId
				.split("_")
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(" ");
		}
		return drop.quantity > 1 ? `${name} (${drop.quantity})` : name;
	}
}
