import Phaser from "phaser";
import { Callbacks, type Room } from "@colyseus/sdk";
import type { NetworkManager } from "../network/NetworkManager";
import type { WelcomeData } from "@abraxas/shared";
import { InputHandler } from "../systems/InputHandler";
import { CameraController } from "../systems/CameraController";
import { SoundManager } from "../assets/SoundManager";
import { TILE_SIZE, DIRECTION_DELTA, ITEMS, i18n, CLASS_STATS } from "@abraxas/shared";
import type { Direction } from "@abraxas/shared";
import type { PlayerState } from "../ui/sidebar/types";
import { SpriteManager } from "../managers/SpriteManager";
import { EffectManager } from "../managers/EffectManager";
import { GameEventHandler } from "../handlers/GameEventHandler";
import { AudioManager } from "../managers/AudioManager";
import { MapBaker } from "../systems/MapBaker";
import { DropManager } from "../systems/DropManager";

import type { GameState } from "../../../server/src/schema/GameState";
import type { Player } from "../../../server/src/schema/Player";
import type { Drop } from "../../../server/src/schema/Drop";

type StateCallback = (state: PlayerState) => void;
type KillFeedCallback = (killer: string, victim: string) => void;
export type ConsoleCallback = (text: string, color?: string, channel?: "global" | "group" | "whisper" | "system" | "combat") => void;
type PlayerRightClickCallback = (sessionId: string, name: string, screenX: number, screenY: number) => void;
export type GMMapClickCallback = (tileX: number, tileY: number) => void;

export class GameScene extends Phaser.Scene {
	private network: NetworkManager;
	private onStateUpdate: StateCallback;
	private onKillFeed?: KillFeedCallback;
	private onConsoleMessage?: ConsoleCallback;
	private onReady?: (sm: SoundManager) => void;
	private onPttChange?: (recording: boolean) => void;
	private onPlayerRightClick?: PlayerRightClickCallback;
	private onGMMapClick?: GMMapClickCallback;
	private room!: Room<GameState>;
	private welcome!: WelcomeData;
	private spriteManager!: SpriteManager;
	private effectManager!: EffectManager;
	private inputHandler!: InputHandler;
	private cameraController!: CameraController;
	private soundManager!: SoundManager;
	private audioManager: AudioManager;
	private gameEventHandler!: GameEventHandler;
	private mapBaker!: MapBaker;
	private dropManager!: DropManager;

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
		onReady?: (sm: SoundManager) => void,
		onPttChange?: (recording: boolean) => void,
		onPlayerRightClick?: PlayerRightClickCallback,
		onGMMapClick?: GMMapClickCallback,
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
		this.onGMMapClick = onGMMapClick;
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

		// Hook into inner-map warp command to flash the screen
		this.network.onWarp = (data) => {
			if (data.targetMap === this.room.roomId) {
				this.cameras.main.flash(400, 200, 255, 255);
			}
		};

		this.spriteManager = new SpriteManager(
			this,
			this.cameraController,
			() => this.room.sessionId,
		);
		this.effectManager = new EffectManager(this, this.spriteManager);

		// Spawn visual indicators for all map teleporters
		if (this.welcome.warps) {
			for (const warp of this.welcome.warps) {
				const px = warp.x * TILE_SIZE + TILE_SIZE / 2;
				const py = warp.y * TILE_SIZE + TILE_SIZE / 2;
				this.effectManager.createTeleportEffect(px, py);
			}
		}

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
				// No player at this tile — GM teleport if the local player is a GM
				if (this.network.isGM) {
					this.onGMMapClick?.(tileX, tileY);
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

				// Phaser sprite sync: fires on any property change (position, hp, facing…)
				const onChangeUnsub = $state.onChange(player, () => {
					this.spriteManager.syncPlayer(player, sessionId);
				});
				playerOnChangeUnsubs.set(sessionId, onChangeUnsub);
				unsub(onChangeUnsub);

				if (isLocal) {
					this.pushSidebarUpdate(player);

					// React sidebar sync: use per-field listen() so that movement
					// (tileX/tileY changes every step) does NOT trigger React re-renders.
					// Only the fields actually displayed in the sidebar are observed here.
					for (const field of [
						"hp", "maxHp", "mana", "maxMana", "alive",
						"str", "agi", "intStat", "gold", "stealthed", "stunned",
						"level", "xp", "maxXp",
						"equipWeapon", "equipArmor", "equipShield", "equipHelmet", "equipRing",
					] as const) {
						unsub($state.listen(player, field, () => this.pushSidebarUpdate(player)));
					}

					unsub(
						$state.listen(player, "speedOverride", (newVal) => {
							if (newVal > 0) {
								this.inputHandler.setSpeed(newVal);
							} else {
								const stats = CLASS_STATS[player.classType];
								this.inputHandler.setSpeed(stats.speedTilesPerSecond);
							}
						})
					);

					// Inventory: item add/remove and per-item quantity changes
					unsub(
						$state.onAdd(player, "inventory", (item) => {
							this.pushSidebarUpdate(player);
							unsub($state.onChange(item, () => this.pushSidebarUpdate(player)));
						}),
						$state.onRemove(player, "inventory", () => this.pushSidebarUpdate(player)),
					);
				}
			}),
			$state.onRemove("players", (_player, sessionId) => {
				playerOnChangeUnsubs.get(sessionId)?.();
				playerOnChangeUnsubs.delete(sessionId);
				this.spriteManager.removePlayer(sessionId);
			}),
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

		this.onReady?.(this.soundManager);
	}

	update(time: number, delta: number) {
		this.inputHandler.update(time, () => this.getMouseTile());
		this.spriteManager.update(delta);

		if (this.inputHandler.targeting) {
			const lp = this.room.state.players.get(this.room.sessionId);
			if (lp && (!lp.alive || lp.stunned)) this.inputHandler.cancelTargeting();
			this.updateTargetingOverlay();
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
			pvpEnabled: player.pvpEnabled,
			guildId: player.groupId, // TODO: Update to player.guildId when it's populated
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
}
