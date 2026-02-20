import type { Direction, NpcEntityState, PlayerEntityState, WelcomeData } from "@abraxas/shared";
import { AudioAssets, CLASS_STATS, DIRECTION_DELTA, ITEMS, i18n, TILE_SIZE, ServerMessageType } from "@abraxas/shared";
import { Callbacks, type Room } from "@colyseus/sdk";
import Phaser from "phaser";
import type { Drop } from "../../../server/src/schema/Drop";
import type { GameState } from "../../../server/src/schema/GameState";
import type { Player } from "../../../server/src/schema/Player";
import { SoundManager } from "../assets/SoundManager";
import { GameEventHandler } from "../handlers/GameEventHandler";
import type { AudioManager } from "../managers/AudioManager";
import { EffectManager } from "../managers/EffectManager";
import { SpriteManager } from "../managers/SpriteManager";
import type { NetworkManager } from "../network/NetworkManager";
import { CameraController } from "../systems/CameraController";
import { DropManager } from "../systems/DropManager";
import { InputHandler } from "../systems/InputHandler";
import { MapBaker } from "../systems/MapBaker";
import { WeatherManager } from "../managers/WeatherManager";
import { LightManager } from "../managers/LightManager";
import type { PlayerState } from "../ui/sidebar/types";

type StateCallback = (state: PlayerState) => void;
type KillFeedCallback = (killer: string, victim: string) => void;
export type ConsoleCallback = (
  text: string,
  color?: string,
  channel?: "global" | "group" | "whisper" | "system" | "combat",
) => void;
type PlayerRightClickCallback = (
  sessionId: string,
  name: string,
  screenX: number,
  screenY: number,
) => void;
type NpcRightClickCallback = (
  sessionId: string,
  name: string,
  type: string,
  screenX: number,
  screenY: number,
) => void;
export type GMMapClickCallback = (tileX: number, tileY: number) => void;

export class GameScene extends Phaser.Scene {
  private network: NetworkManager;
  private onStateUpdate: StateCallback;
  private onKillFeed?: KillFeedCallback;
  private onConsoleMessage?: ConsoleCallback;
  private onReady?: (sm: SoundManager) => void;
  private onPttChange?: (recording: boolean) => void;
  private onPlayerRightClick?: PlayerRightClickCallback;
  private onNpcRightClick?: NpcRightClickCallback;
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
  private weatherManager!: WeatherManager;
  private lightManager!: LightManager;
  private ambientOverlay!: Phaser.GameObjects.Graphics;

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
      const webAudio: any = this.sound;
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
    onNpcRightClick?: NpcRightClickCallback,
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
    this.onNpcRightClick = onNpcRightClick;
    this.onGMMapClick = onGMMapClick;
  }

  create() {
    this.room = this.network.getRoom();
    this.welcome = this.network.getWelcomeData();
    this.collisionGrid = this.welcome.collision;

    this.sound.pauseOnBlur = false;
    this.soundManager = new SoundManager(this);
    this.soundManager.startMusic();

    // Start ambiance based on map
    if (this.welcome.roomMapName && this.welcome.roomMapName.includes("arena")) {
      this.soundManager.startAmbiance(AudioAssets.AMBIANCE_WIND);
    } else {
      this.soundManager.startAmbiance(AudioAssets.AMBIANCE_CRICKETS);
    }

    this.onReady?.(this.soundManager);

    this.muteKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
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

    this.spriteManager = new SpriteManager(this, this.cameraController, () => this.room.sessionId);
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
        let targetNpc: { id: string; npcType: string } | undefined;
        for (const [id, npc] of this.room.state.npcs) {
          if (npc.tileX === tileX && npc.tileY === tileY) {
            targetNpc = { id, npcType: npc.npcType };
            break;
          }
        }
        if (targetNpc) {
          if (targetNpc.npcType === "horse") {
            this.network.sendTame(targetNpc.id);
          } else {
            this.network.sendInteract(targetNpc.id);
          }
        }
      },
      () => {
        this.audioManager.startRecording((data) => this.network.sendAudio(data));
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
        for (const [id, npc] of this.room.state.npcs) {
          if (npc.tileX === tileX && npc.tileY === tileY && npc.alive) {
            this.onNpcRightClick?.(id, i18n.t(`npc.${npc.npcType}`, npc.npcType), npc.npcType, screenX, screenY);
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
    const unsub = (...fns: (() => void)[]) => this.stateUnsubscribers.push(...fns);

    const playerOnChangeUnsubs = new Map<string, () => void>();
    const npcOnChangeUnsubs = new Map<string, () => void>();

    unsub(
      $state.onAdd("players", (player, sessionId) => {
        const pState = player as unknown as PlayerEntityState;
        this.spriteManager.addPlayer(pState, sessionId);
        this.spriteManager.syncPlayer(pState, sessionId);
        const isLocal = sessionId === this.room.sessionId;

        // Phaser sprite sync: fires on any property change (position, hp, facing…)
        const onChangeUnsub = $state.onChange(player, () => {
          this.spriteManager.syncPlayer(player as unknown as PlayerEntityState, sessionId);
        });
        playerOnChangeUnsubs.set(sessionId, onChangeUnsub);
        unsub(onChangeUnsub);

        if (isLocal) {
          this.pushSidebarUpdate(player);

          // React sidebar sync: use per-field listen() so that movement
          // (tileX/tileY changes every step) does NOT trigger React re-renders.
          // Only the fields actually displayed in the sidebar are observed here.
          for (const field of [
            "hp",
            "maxHp",
            "mana",
            "maxMana",
            "alive",
            "str",
            "agi",
            "intStat",
            "gold",
            "stealthed",
            "stunned",
            "level",
            "xp",
            "maxXp",
            "equipWeapon",
            "equipArmor",
            "equipShield",
            "equipHelmet",
            "equipRing",
            "equipMount",
          ] as const) {
            unsub($state.listen(player, field, () => this.pushSidebarUpdate(player)));
          }

          unsub(
            $state.listen(player, "equipMount", (newMount, oldMount) => {
              if (newMount && newMount !== oldMount) {
                this.soundManager.playMount();
              }
            }),
          );

          unsub(
            $state.listen(player, "speedOverride", (newVal) => {
              if (newVal > 0) {
                this.inputHandler.setSpeed(newVal);
              } else {
                const stats = CLASS_STATS[player.classType];
                this.inputHandler.setSpeed(stats.speedTilesPerSecond);
              }
            }),
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
        const nState = npc as unknown as NpcEntityState;
        this.spriteManager.addNpc(nState, id);
        this.spriteManager.syncNpc(nState, id);
        // Guard: Colyseus throws a refId error when onChange is called on objects
        // that arrived via the initial state snapshot (before they are fully
        // registered in the ReferenceTracker).  We catch and ignore those errors
        // — subsequent server patches will still trigger onChange correctly.
        try {
          const onChangeUnsub = $state.onChange(npc, () =>
            this.spriteManager.syncNpc(npc as unknown as NpcEntityState, id),
          );
          npcOnChangeUnsubs.set(id, onChangeUnsub);
          unsub(onChangeUnsub);
        } catch (e) {
          // Expected for snapshot-loaded NPCs — state is already synced above.
        }
      }),
      $state.onRemove("npcs", (_npc, id) => {
        npcOnChangeUnsubs.get(id)?.();
        npcOnChangeUnsubs.delete(id);
        this.spriteManager.removePlayer(id);
      }),
    );

    this.weatherManager = new WeatherManager(this);
    this.lightManager = new LightManager(this);
    this.lightManager.enable();

    this.gameEventHandler = new GameEventHandler(
      this.room,
      this.spriteManager,
      this.effectManager,
      this.soundManager,
      this.inputHandler,
      this.onConsoleMessage,
      this.onKillFeed,
      // Item #11-16: Camera shake callback
      (intensity: number, durationMs: number) => {
        this.cameras.main.shake(durationMs, intensity);
      },
      // Item #13-14: Camera flash callback
      (r: number, g: number, b: number, durationMs: number) => {
        this.cameras.main.flash(durationMs, r, g, b);
      },
      // Item #17, #19: Camera zoom callback
      (zoom: number, durationMs: number) => {
        this.cameras.main.zoomTo(zoom, durationMs / 2);
        this.time.delayedCall(durationMs / 2, () => {
          this.cameras.main.zoomTo(1, durationMs / 2);
        });
      },
      this.lightManager,
    );
    this.gameEventHandler.setupListeners();

    this.ambientOverlay = this.add.graphics();
    this.ambientOverlay.setDepth(2000); // Above everything but UI
    this.ambientOverlay.setScrollFactor(0);

    unsub(
      $state.listen("timeOfDay", (val) => this.updateAmbientLighting(val)),
      $state.listen("weather", (val) => this.weatherManager.updateWeather(val)),
    );

    // Initial state
    this.updateAmbientLighting(this.room.state.timeOfDay);
    this.weatherManager.updateWeather(this.room.state.weather);

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

  private updateAmbientLighting(time: number) {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    this.ambientOverlay.clear();

    let color = 0xffffff;
    let alpha = 0;

    // 0-5: Night (Deep Blue/Purple tint)
    // 5-8: Dawn (Orange/Pink tint)
    // 8-17: Day (No tint)
    // 17-20: Dusk (Vibrant Orange/Red)
    // 20-24: Night

    if (time < 5 || time > 20) {
      color = 0x111144; // Deep night blue
      alpha = 0.5;
    } else if (time >= 5 && time < 8) {
      // Dawn transition
      const t = (time - 5) / 3;
      color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x111144),
        Phaser.Display.Color.ValueToColor(0xff8844),
        100,
        t * 100
      ).color;
      alpha = 0.5 * (1 - t);
    } else if (time >= 17 && time < 20) {
      // Dusk transition
      const t = (time - 17) / 3;
      color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xffffff),
        Phaser.Display.Color.ValueToColor(0xcc4400),
        100,
        t * 100
      ).color;
      alpha = 0.4 * t;
    }

    if (alpha > 0) {
      this.ambientOverlay.fillStyle(color, alpha);
      this.ambientOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.ambientOverlay.fillRect(0, 0, width, height);
    }
  }

  update(time: number, delta: number) {
    this.inputHandler.update(time, () => this.getMouseTile());
    this.spriteManager.update(delta);
    this.lightManager.update(time);

    if (this.inputHandler.targeting) {
      const lp = this.room.state.players.get(this.room.sessionId);
      if (lp && (!lp.alive || lp.stunned)) this.inputHandler.cancelTargeting();
      this.updateTargetingOverlay();
    }

    const localSprite = this.spriteManager.getSprite(this.room.sessionId);
    if (this.debugText && localSprite) {
      this.debugText.setText(`X: ${localSprite.predictedTileX} Y: ${localSprite.predictedTileY}`);
    }
  }

  shutdown() {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.gameEventHandler.destroy();
    this.lightManager?.destroy();
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

    if (this.rangeOverlay && (cx !== this.lastOverlayCenterX || cy !== this.lastOverlayCenterY)) {
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
          if (tx < 0 || ty < 0 || tx >= this.welcome.mapWidth || ty >= this.welcome.mapHeight)
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

  private isInSafeZone(x: number, y: number): boolean {
    if (!this.welcome.safeZones) return false;
    for (const zone of this.welcome.safeZones) {
      if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) {
        return true;
      }
    }
    return false;
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
      inSafeZone: this.isInSafeZone(player.tileX, player.tileY),
      guildId: player.guildId,
      inventory: this.buildInventory(player),
      equipment: {
        weapon: player.equipWeapon?.itemId,
        armor: player.equipArmor?.itemId,
        shield: player.equipShield?.itemId,
        helmet: player.equipHelmet?.itemId,
        ring: player.equipRing?.itemId,
        mount: player.equipMount?.itemId,
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
    if (nextX < 0 || nextX >= mapWidth || nextY < 0 || nextY >= mapHeight) return;
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
