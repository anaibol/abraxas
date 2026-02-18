import Phaser from "phaser";
import type { Room } from "@colyseus/sdk";
import type { NetworkManager } from "../network/NetworkManager";
import type { WelcomeData } from "@abraxas/shared";
import { InputHandler } from "../systems/InputHandler";
import { CameraController } from "../systems/CameraController";
import { SoundManager } from "../assets/SoundManager";
import { AoGrhResolver } from "../assets/AoGrhResolver";
import { TILE_SIZE, DIRECTION_DELTA } from "@abraxas/shared";
import type { Direction } from "@abraxas/shared";
import type { PlayerState } from "../ui/Sidebar";
import { SpriteManager } from "../managers/SpriteManager";
import { EffectManager } from "../managers/EffectManager";
import { GameEventHandler } from "../handlers/GameEventHandler";
import { AudioManager } from "../managers/AudioManager";

import { GameState } from "../../../server/src/schema/GameState";
import { Player } from "../../../server/src/schema/Player";
import { Npc } from "../../../server/src/schema/Npc";
import { Drop } from "../../../server/src/schema/Drop";

export type StateCallback = (state: PlayerState) => void;
export type KillFeedCallback = (killer: string, victim: string) => void;
export type ConsoleCallback = (text: string, color?: string) => void;

/** Typed wrapper for Colyseus MapSchema onAdd/onRemove (client SDK v2 doesn't expose these in its types) */
type ObservableMap<T> = {
  onAdd(callback: (item: T, key: string) => void, triggerAll?: boolean): void;
  onRemove(callback: (item: T, key: string) => void): void;
};

export class GameScene extends Phaser.Scene {
  private network: NetworkManager<GameState>;
  private onStateUpdate: StateCallback;
  private onKillFeed?: KillFeedCallback;
  private onConsoleMessage?: ConsoleCallback;
  private onReady?: () => void;
  private onError?: (message: string) => void;
  private room!: Room<GameState>;
  private welcome!: WelcomeData;
  private resolver!: AoGrhResolver;

  private spriteManager!: SpriteManager;
  private effectManager!: EffectManager;
  private inputHandler!: InputHandler;
  private cameraController!: CameraController;
  private soundManager!: SoundManager;
  private audioManager!: AudioManager;

  private collisionGrid: number[][] = [];
  private lastSidebarUpdate = 0;

  // Targeting overlay state
  private targetingRangeTiles = 0;
  private rangeOverlay: Phaser.GameObjects.Graphics | null = null;
  private tileHighlight: Phaser.GameObjects.Graphics | null = null;
  private lastOverlayCenterX = -1;
  private lastOverlayCenterY = -1;

  private debugText?: Phaser.GameObjects.Text;

  // Drop rendering
  private dropGraphics = new Map<string, Phaser.GameObjects.Arc>();

  constructor(
    network: NetworkManager<GameState>,
    onStateUpdate: StateCallback,
    onKillFeed?: KillFeedCallback,
    onConsoleMessage?: ConsoleCallback,
    onReady?: () => void,
    onError?: (message: string) => void,
  ) {
    super({ key: "GameScene" });
    this.network = network;
    this.onStateUpdate = onStateUpdate;
    this.onKillFeed = onKillFeed;
    this.onConsoleMessage = onConsoleMessage;
    this.onReady = onReady;
    this.onError = onError;
  }

  create() {
    this.room = this.network.getRoom();
    this.welcome = this.network.getWelcomeData();
    const resolver = this.registry.get("aoResolver");
    if (resolver instanceof AoGrhResolver) {
      this.resolver = resolver;
    }

    const worldW = this.welcome.mapWidth * TILE_SIZE;
    const worldH = this.welcome.mapHeight * TILE_SIZE;

    this.collisionGrid = this.welcome.collision;
    this.drawMap();

    // Sound
    this.soundManager = new SoundManager(this);
    this.soundManager.startMusic();

    // Audio Chat
    this.audioManager = new AudioManager();
    this.audioManager
      .init()
      .catch((err) => console.warn("Audio Context init failed:", err));

    this.network.onAudioData = (sessionId, data) => {
      this.audioManager.playAudioChunk(data);
      // Show speaking indicator via SpriteManager helper
      this.spriteManager.setSpeaking(sessionId, true, 300);
    };

    // Disable right-click context menu
    this.input.mouse?.disableContextMenu();

    // Camera setup
    this.cameraController = new CameraController(
      this.cameras.main,
      worldW,
      worldH,
    );

    // Managers
    this.spriteManager = new SpriteManager(
      this,
      this.cameraController,
      () => this.room.state,
      () => this.room.sessionId,
    );
    this.effectManager = new EffectManager(
      this,
      this.resolver,
      this.spriteManager,
    );

    // Input setup
    const localPlayer = this.room.state.players.get(this.room.sessionId);
    const classType = localPlayer?.classType ?? "warrior";
    this.inputHandler = new InputHandler(
      this,
      this.network,
      classType,
      TILE_SIZE,
      (direction) => this.onLocalMove(direction),
      (rangeTiles) => this.onEnterTargeting(rangeTiles),
      () => this.onExitTargeting(),
      (tileX, tileY) => {
        // Find if there is an NPC at this tile
        let targetNpcId: string | null = null;
        for (const [id, npc] of this.room.state.npcs) {
          if (npc.tileX === tileX && npc.tileY === tileY) {
            targetNpcId = id;
            break;
          }
        }
        if (targetNpcId) {
          this.network.sendInteract(targetNpcId);
        }
      },
      () =>
        this.audioManager.startRecording((data) =>
          this.network.sendAudio(data),
        ),
      () => this.audioManager.stopRecording(),
    );

    // Listen for player add/remove/change
    (this.room.state.players as unknown as ObservableMap<Player>).onAdd(
      (player, sessionId) => {
        this.spriteManager.addPlayer(player, sessionId);
      },
    );

    (this.room.state.players as unknown as ObservableMap<Player>).onRemove(
      (_player, sessionId) => {
        this.spriteManager.removePlayer(sessionId);
      },
    );

    // Game Event Handler
    const gameEventHandler = new GameEventHandler(
      this.room,
      this.spriteManager,
      this.effectManager,
      this.soundManager,
      this.inputHandler,
      this.onConsoleMessage,
      this.onKillFeed,
      this.onError,
    );
    gameEventHandler.setupListeners();

    // Drops
    (this.room.state.drops as unknown as ObservableMap<Drop>).onAdd(
      (drop, id) => {
        this.addDrop(drop, id);
      },
    );

    (this.room.state.drops as unknown as ObservableMap<Drop>).onRemove(
      (_drop, id) => {
        this.removeDrop(id);
      },
    );

    // NPCs
    (this.room.state.npcs as unknown as ObservableMap<Npc>).onAdd((npc, id) => {
      this.spriteManager.addNpc(npc, id);
    });

    (this.room.state.npcs as unknown as ObservableMap<Npc>).onRemove(
      (_npc, id) => {
        this.spriteManager.removeNpc(id);
      },
    );

    // Debug text
    this.debugText = this.add.text(10, 10, "", {
      fontSize: "16px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 4,
      fontFamily: "'Courier New', Courier, monospace",
    });
    this.debugText.setScrollFactor(0);
    this.debugText.setDepth(100);

    // Notify ready
    this.onReady?.();
  }

  update(time: number, delta: number) {
    // Process input
    this.inputHandler.update(time, () => this.getMouseTile());

    // Update sprites
    this.spriteManager.update(time, delta);

    // Cancel targeting on death or stun
    if (this.inputHandler.targeting) {
      const lp = this.room.state.players.get(this.room.sessionId);
      if (lp && (!lp.alive || lp.stunned)) {
        this.inputHandler.cancelTargeting();
      }
    }

    // Update targeting overlay
    if (this.inputHandler.targeting) {
      this.updateTargetingOverlay();
    }

    // Push local player stats to React sidebar (throttled to ~10 fps)
    this.lastSidebarUpdate += delta;
    if (this.lastSidebarUpdate >= 100) {
      this.lastSidebarUpdate = 0;
      const localPlayer = this.room.state.players.get(this.room.sessionId);
      if (localPlayer) {
        const inventory = this.buildInventory(localPlayer);
        this.onStateUpdate({
          name: localPlayer.name,
          classType: localPlayer.classType,
          hp: localPlayer.hp,
          maxHp: localPlayer.maxHp,
          mana: localPlayer.mana,
          maxMana: localPlayer.maxMana,
          alive: localPlayer.alive,
          str: localPlayer.str,
          agi: localPlayer.agi,
          intStat: localPlayer.intStat,
          gold: localPlayer.gold,
          stealthed: localPlayer.stealthed,
          stunned: localPlayer.stunned,
          inventory,
          equipment: {
            weapon: localPlayer.equipWeapon ?? "",
            armor: localPlayer.equipArmor ?? "",
            shield: localPlayer.equipShield ?? "",
            helmet: localPlayer.equipHelmet ?? "",
            ring: localPlayer.equipRing ?? "",
          },
        });
      }
    }

    // Camera
    const localSprite = this.spriteManager.getSprite(this.room.sessionId);
    if (localSprite) {
      this.cameraController.update(localSprite);
    }

    // Update effects
    this.effectManager.update(time);

    // Update debug text
    if (this.debugText && localSprite) {
      this.debugText.setText(
        `X: ${localSprite.predictedTileX} Y: ${localSprite.predictedTileY}`,
      );
    }
  }

  // --- Targeting visual feedback ---

  private onEnterTargeting(rangeTiles: number) {
    this.targetingRangeTiles = rangeTiles;
    this.input.setDefaultCursor("crosshair");

    this.rangeOverlay = this.add.graphics();
    this.rangeOverlay.setDepth(1);

    this.tileHighlight = this.add.graphics();
    this.tileHighlight.setDepth(2);

    this.lastOverlayCenterX = -1;
    this.lastOverlayCenterY = -1;
  }

  private onExitTargeting() {
    this.input.setDefaultCursor("default");
    this.targetingRangeTiles = 0;

    if (this.rangeOverlay) {
      this.rangeOverlay.destroy();
      this.rangeOverlay = null;
    }
    if (this.tileHighlight) {
      this.tileHighlight.destroy();
      this.tileHighlight = null;
    }
    this.lastOverlayCenterX = -1;
    this.lastOverlayCenterY = -1;
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
          if (Math.abs(dx) + Math.abs(dy) > range) continue;
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

  private onInvalidTarget() {
    const localSprite = this.spriteManager.getSprite(this.room.sessionId);
    if (!localSprite) return;

    this.effectManager.showNotification(
      this.room.sessionId,
      "Invalid target",
      "#ff8800",
    );
  }

  private buildInventory(localPlayer: Player) {
    const inventory: { itemId: string; quantity: number; slotIndex: number }[] =
      [];
    if (!localPlayer.inventory) return inventory;
    for (const item of localPlayer.inventory) {
      inventory.push({
        itemId: item.itemId,
        quantity: item.quantity,
        slotIndex: item.slotIndex,
      });
    }
    return inventory;
  }

  private drawMap() {
    const { mapWidth, mapHeight, collision } = this.welcome;

    const grassTex = this.textures.get("tile-grass");
    for (let v = 0; v < 4; v++) {
      grassTex.add(v, 0, v * 32, 0, 32, 32);
    }

    const wallTex = this.textures.get("tile-wall");
    wallTex.add(1, 0, 0, 0, 32, 32);

    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const isWall = collision[y]?.[x] === 1;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        if (isWall) {
          const tile = this.add.image(px, py, "tile-wall", 1);
          tile.setOrigin(0, 0);
          tile.setDepth(0);
        } else {
          const variant = ((x * 7 + y * 13) & 0x7fffffff) % 4;
          const tile = this.add.image(px, py, "tile-grass", variant);
          tile.setOrigin(0, 0);
          tile.setDepth(0);
        }
      }
    }
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

    // Check collision with other entities (using room state as source of truth)
    for (const [sid, p] of this.room.state.players) {
      if (sid === this.room.sessionId) continue;
      if (p.alive && p.tileX === nextX && p.tileY === nextY) return;
    }
    for (const [sid, n] of this.room.state.npcs) {
      if (n.alive && n.tileX === nextX && n.tileY === nextY) return;
    }

    sprite.predictMove(direction);
    this.soundManager.playStep();
  }

  // --- Event handlers ---

  private addDrop(drop: Drop, id: string) {
    const px = drop.tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = drop.tileY * TILE_SIZE + TILE_SIZE / 2;
    const circle = this.add.circle(px, py, 6, 0xffcc00);
    circle.setDepth(5);
    this.dropGraphics.set(id, circle);
  }

  private removeDrop(id: string) {
    const g = this.dropGraphics.get(id);
    if (g) {
      g.destroy();
      this.dropGraphics.delete(id);
    }
  }
}
