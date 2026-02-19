import Phaser from "phaser";
import { Callbacks, type Room } from "@colyseus/sdk";
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

import type { GameState } from "../../../server/src/schema/GameState";
import type { Player } from "../../../server/src/schema/Player";
import type { Drop } from "../../../server/src/schema/Drop";

type StateCallback = (state: PlayerState) => void;
type KillFeedCallback = (killer: string, victim: string) => void;
export type ConsoleCallback = (text: string, color?: string) => void;

export class GameScene extends Phaser.Scene {
  private network: NetworkManager;
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
  private stateUnsubscribers: (() => void)[] = [];

  private targetingRangeTiles = 0;
  private rangeOverlay: Phaser.GameObjects.Graphics | null = null;
  private tileHighlight: Phaser.GameObjects.Graphics | null = null;
  private lastOverlayCenterX = -1;
  private lastOverlayCenterY = -1;

  private debugText?: Phaser.GameObjects.Text;
  private dropGraphics = new Map<string, Phaser.GameObjects.Arc>();

  constructor(
    network: NetworkManager,
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

    this.soundManager = new SoundManager(this);
    this.soundManager.startMusic();

    this.audioManager = new AudioManager();

    this.network.onAudioData = (sessionId, data) => {
      this.audioManager.playAudioChunk(data);
      this.spriteManager.setSpeaking(sessionId, true, 300);
    };

    this.input.mouse?.disableContextMenu();

    this.cameraController = new CameraController(
      this.cameras.main,
      worldW,
      worldH,
    );

    this.spriteManager = new SpriteManager(
      this,
      this.cameraController,
      () => this.room.sessionId,
    );
    this.effectManager = new EffectManager(
      this,
      this.resolver,
      this.spriteManager,
    );

    const localPlayer = this.room.state.players.get(this.room.sessionId);
    const classType = localPlayer?.classType ?? "WARRIOR";
    this.inputHandler = new InputHandler(
      this,
      this.network,
      classType,
      TILE_SIZE,
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
      () => this.audioManager.startRecording((data) => this.network.sendAudio(data)),
      () => this.audioManager.stopRecording(),
    );

    const $state = Callbacks.get(this.room);
    const unsub = (...fns: (() => void)[]) => this.stateUnsubscribers.push(...fns);

    unsub(
      $state.onAdd("players", (player, sessionId) => {
        this.spriteManager.addPlayer(player, sessionId);
        this.spriteManager.syncPlayer(player, sessionId);
        const isLocal = sessionId === this.room.sessionId;
        unsub($state.onChange(player, () => {
          this.spriteManager.syncPlayer(player, sessionId);
          if (isLocal) this.pushSidebarUpdate(player);
        }));
        if (isLocal) this.pushSidebarUpdate(player);
      }),
      $state.onRemove("players", (_player, sessionId) => {
        this.spriteManager.removePlayer(sessionId);
      }),
      $state.onAdd("drops", (drop, id) => this.addDrop(drop, id)),
      $state.onRemove("drops", (_drop, id) => this.removeDrop(id)),
      $state.onAdd("npcs", (npc, id) => {
        this.spriteManager.addNpc(npc, id);
        this.spriteManager.syncNpc(npc, id);
        unsub($state.onChange(npc, () => this.spriteManager.syncNpc(npc, id)));
      }),
      $state.onRemove("npcs", (_npc, id) => this.spriteManager.removeNpc(id)),
    );

    new GameEventHandler(
      this.room,
      this.spriteManager,
      this.effectManager,
      this.soundManager,
      this.inputHandler,
      this.onConsoleMessage,
      this.onKillFeed,
      this.onError,
    ).setupListeners();

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

    this.onReady?.();
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
    if (localSprite) this.cameraController.update(localSprite);

    if (this.debugText && localSprite) {
      this.debugText.setText(
        `X: ${localSprite.predictedTileX} Y: ${localSprite.predictedTileY}`,
      );
    }
  }

  shutdown() {
    for (const unsub of this.stateUnsubscribers) unsub();
    this.stateUnsubscribers = [];
  }

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
    this.rangeOverlay?.destroy();
    this.rangeOverlay = null;
    this.tileHighlight?.destroy();
    this.tileHighlight = null;
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
      inventory: this.buildInventory(player),
      equipment: {
        weapon: player.equipWeapon ?? "",
        armor: player.equipArmor ?? "",
        shield: player.equipShield ?? "",
        helmet: player.equipHelmet ?? "",
        ring: player.equipRing ?? "",
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
          this.add.image(px, py, "tile-wall", 1).setOrigin(0, 0).setDepth(0);
        } else {
          const variant = ((x * 7 + y * 13) & 0x7fffffff) % 4;
          this.add.image(px, py, "tile-grass", variant).setOrigin(0, 0).setDepth(0);
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
    if (nextX < 0 || nextX >= mapWidth || nextY < 0 || nextY >= mapHeight) return;
    if (this.collisionGrid[nextY]?.[nextX] === 1) return;

    for (const [sid, p] of this.room.state.players) {
      if (sid === this.room.sessionId) continue;
      if (p.alive && p.tileX === nextX && p.tileY === nextY) return;
    }
    for (const [_sid, n] of this.room.state.npcs) {
      if (n.alive && n.tileX === nextX && n.tileY === nextY) return;
    }

    sprite.predictMove(direction);
    this.soundManager.playStep();
  }

  private addDrop(drop: Drop, id: string) {
    const px = drop.tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = drop.tileY * TILE_SIZE + TILE_SIZE / 2;
    this.dropGraphics.set(id, this.add.circle(px, py, 6, 0xffcc00).setDepth(5));
  }

  private removeDrop(id: string) {
    const g = this.dropGraphics.get(id);
    if (g) {
      g.destroy();
      this.dropGraphics.delete(id);
    }
  }
}
