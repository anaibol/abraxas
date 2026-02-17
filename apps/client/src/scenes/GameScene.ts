import Phaser from "phaser";
import type { Room } from "colyseus.js";
import type { NetworkManager, WelcomeData } from "../network/NetworkManager";
import { PlayerSprite } from "../entities/PlayerSprite";
import { InputHandler } from "../systems/InputHandler";
import { CameraController } from "../systems/CameraController";
import { SoundManager } from "../assets/SoundManager";
import type { AoGrhResolver } from "../assets/AoGrhResolver";
import { TILE_SIZE, DIRECTION_DELTA } from "@ao5/shared";
import type { Direction } from "@ao5/shared";
import type { PlayerState } from "../ui/Sidebar";

export type StateCallback = (state: PlayerState) => void;
export type KillFeedCallback = (killer: string, victim: string) => void;
export type ConsoleCallback = (text: string, color?: string) => void;

export class GameScene extends Phaser.Scene {
  private network: NetworkManager;
  private onStateUpdate: StateCallback;
  private onKillFeed?: KillFeedCallback;
  private onConsoleMessage?: ConsoleCallback;
  private room!: Room;
  private welcome!: WelcomeData;
  private resolver!: AoGrhResolver;

  private playerSprites = new Map<string, PlayerSprite>();
  private inputHandler!: InputHandler;
  private cameraController!: CameraController;
  private soundManager!: SoundManager;

  private damageTexts: { text: Phaser.GameObjects.Text; expireAt: number }[] = [];
  private collisionGrid: number[][] = [];
  private lastSidebarUpdate = 0;

  // Targeting overlay state
  private targetingRangeTiles = 0;
  private rangeOverlay: Phaser.GameObjects.Graphics | null = null;
  private tileHighlight: Phaser.GameObjects.Graphics | null = null;
  private lastOverlayCenterX = -1;
  private lastOverlayCenterY = -1;

  private debugText?: Phaser.GameObjects.Text;

  constructor(
    network: NetworkManager,
    onStateUpdate: StateCallback,
    onKillFeed?: KillFeedCallback,
    onConsoleMessage?: ConsoleCallback
  ) {
    super({ key: "GameScene" });
    this.network = network;
    this.onStateUpdate = onStateUpdate;
    this.onKillFeed = onKillFeed;
    this.onConsoleMessage = onConsoleMessage;
  }

  create() {
    this.room = this.network.getRoom();
    this.welcome = this.network.getWelcomeData();
    this.resolver = this.registry.get("aoResolver") as AoGrhResolver;

    const worldW = this.welcome.mapWidth * TILE_SIZE;
    const worldH = this.welcome.mapHeight * TILE_SIZE;

    this.collisionGrid = this.welcome.collision;
    this.drawMap();

    // Sound
    this.soundManager = new SoundManager(this);
    this.soundManager.startMusic();

    // Disable right-click context menu
    this.input.mouse?.disableContextMenu();

    // Camera setup
    this.cameraController = new CameraController(
      this.cameras.main,
      worldW,
      worldH
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
    );

    // Listen for player add/remove/change
    this.room.state.players.onAdd((player: any, sessionId: string) => {
      this.addPlayer(player, sessionId);
    });

    this.room.state.players.onRemove((_player: any, sessionId: string) => {
      this.removePlayer(sessionId);
    });

    // Listen for game events
    this.room.onMessage("attack_start", (data: any) => {
      this.onAttackStart(data);
    });

    this.room.onMessage("attack_hit", (data: any) => {
      this.onAttackHit(data);
    });

    this.room.onMessage("cast_start", (data: any) => {
      this.onCastStart(data);
    });

    this.room.onMessage("cast_hit", (data: any) => {
      this.onCastHit(data);
    });

    this.room.onMessage("damage", (data: any) => {
      this.onDamage(data);
    });

    this.room.onMessage("death", (data: any) => {
      this.onDeath(data);
    });

    this.room.onMessage("heal", (data: any) => {
      this.onHeal(data);
    });

    this.room.onMessage("buff_applied", (data: any) => {
      this.onBuffApplied(data);
    });

    this.room.onMessage("stun_applied", (data: any) => {
      this.onStunApplied(data);
    });

    this.room.onMessage("respawn", (data: any) => {
      this.onRespawn(data);
    });

    this.room.onMessage("kill_feed", (data: any) => {
      this.onKillFeed?.(data.killerName, data.victimName);
    });

    this.room.onMessage("invalid_target", () => {
      this.onInvalidTarget();
    });

    // Drops
    this.room.state.drops.onAdd((drop: any, id: string) => {
      this.addDrop(drop, id);
    });

    this.room.state.drops.onRemove((_drop: any, id: string) => {
      this.removeDrop(id);
    });

    // NPCs
    this.room.state.npcs.onAdd((npc: any, id: string) => {
        this.addNpc(npc, id);
    });

    this.room.state.npcs.onRemove((_npc: any, id: string) => {
        this.removeNpc(id);
    });

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
  }

  update(time: number, delta: number) {
    // Process input
    this.inputHandler.update(time, () => this.getMouseTile());

    // Update all player/npc sprites (interpolation)
    for (const [sessionId, sprite] of this.playerSprites) {
      let entity = this.room.state.players.get(sessionId) || this.room.state.npcs.get(sessionId);
      
      if (entity) {
        if (sprite.isLocal) {
          sprite.reconcileServer(entity.tileX, entity.tileY);
        } else {
          sprite.setTilePosition(entity.tileX, entity.tileY);
        }
        
        // NPC might not have facing? Add default.
        sprite.setFacing(entity.facing ?? 2); 
        sprite.updateHpMana(entity.hp, entity.maxHp); // NPC doesn't have mana? PlayerSprite might expect it.
        
        if ("classType" in entity) { // It's a player
            sprite.updateEquipment(
            entity.equipWeapon ?? "",
            entity.equipShield ?? "",
            entity.equipHelmet ?? ""
            );
        }

        if (!entity.alive) {
          sprite.container.setAlpha(0.3);
        } else if (entity.stealthed && !sprite.isLocal) {
          sprite.container.setAlpha(0.15);
        } else if (entity.stealthed && sprite.isLocal) {
          sprite.container.setAlpha(0.5);
        }
      }
      sprite.update(delta);
    }

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
        const inventory: { itemId: string; quantity: number; slotIndex: number }[] = [];
        if (localPlayer.inventory) {
          for (const item of localPlayer.inventory) {
            inventory.push({
              itemId: item.itemId,
              quantity: item.quantity,
              slotIndex: item.slotIndex,
            });
          }
        }

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
    const localSprite = this.playerSprites.get(this.room.sessionId);
    if (localSprite) {
      this.cameraController.update(localSprite);
    }

    // Expire damage texts
    this.damageTexts = this.damageTexts.filter((dt) => {
      if (time > dt.expireAt) {
        dt.text.destroy();
        return false;
      }
      dt.text.y -= 0.5;
      dt.text.setAlpha(Math.max(0, (dt.expireAt - time) / 1000));
      return true;
    });

    // Update debug text
    if (this.debugText && localSprite) {
      this.debugText.setText(
        `X: ${localSprite.predictedTileX} Y: ${localSprite.predictedTileY}`
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
    const localSprite = this.playerSprites.get(this.room.sessionId);
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
          if (Math.abs(dx) + Math.abs(dy) > range) continue;
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx < 0 || ty < 0 || tx >= this.welcome.mapWidth || ty >= this.welcome.mapHeight) continue;
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
        TILE_SIZE
      );
    }
  }

  private onInvalidTarget() {
    const localSprite = this.playerSprites.get(this.room.sessionId);
    if (!localSprite) return;

    const text = this.add.text(
      localSprite.renderX,
      localSprite.renderY - 40,
      "Invalid target",
      {
        fontSize: "12px",
        color: "#ff8800",
        fontFamily: "'Friz Quadrata', Georgia, serif",
        fontStyle: "bold",
      }
    );
    text.setOrigin(0.5);
    text.setDepth(20);
    this.damageTexts.push({ text, expireAt: this.time.now + 1200 });
  }

  private drawMap() {
    const { mapWidth, mapHeight, collision } = this.welcome;

    // Use the grass tile sheet (512×128) — crop 4 variants at (0,0), (32,0), (64,0), (96,0)
    // We create cropped textures from the grass tile sheet
    const grassTex = this.textures.get("tile-grass");
    for (let v = 0; v < 4; v++) {
      grassTex.add(v, 0, v * 32, 0, 32, 32);
    }

    // Wall tile: crop at (0,0) 32×32 from 64×64 image
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
          // Use seeded variant based on position for consistency
          const variant = ((x * 7 + y * 13) & 0x7fffffff) % 4;
          const tile = this.add.image(px, py, "tile-grass", variant);
          tile.setOrigin(0, 0);
          tile.setDepth(0);
        }
      }
    }
  }

  private addPlayer(player: any, sessionId: string) {
    if (this.playerSprites.has(sessionId)) return;

    const isLocal = sessionId === this.room.sessionId;
    const sprite = new PlayerSprite(
      this,
      sessionId,
      player.tileX,
      player.tileY,
      player.classType,
      player.name,
      isLocal
    );

    this.playerSprites.set(sessionId, sprite);

    if (isLocal) {
      this.cameraController.follow(sprite);
    }
  }

  private removePlayer(sessionId: string) {
    const sprite = this.playerSprites.get(sessionId);
    if (sprite) {
      sprite.destroy();
      this.playerSprites.delete(sessionId);
    }
  }

  private addNpc(npc: any, sessionId: string) {
      if (this.playerSprites.has(sessionId)) return;
      
      // Use NpcType as classType for now, assuming PlayerSprite & Resolver can handle it or we map it.
      // Need to ensure "orc", "skeleton" etc are handled by Resolver -> Body/Head lookup.
      // If not, they might be invisible or error. 
      // For now, let's pass the type and hope Resolver has entries or default.
      
      const sprite = new PlayerSprite(
          this,
          sessionId,
          npc.tileX,
          npc.tileY,
          npc.type, // Treat type as classType for visual resolution
          npc.type.toUpperCase(), // Name
          false
      );
      
      this.playerSprites.set(sessionId, sprite);
  }

  private removeNpc(sessionId: string) {
      this.removePlayer(sessionId); // Same logic
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
    const sprite = this.playerSprites.get(this.room.sessionId);
    if (!sprite) return;

    const delta = DIRECTION_DELTA[direction];
    const nextX = sprite.predictedTileX + delta.dx;
    const nextY = sprite.predictedTileY + delta.dy;

    const { mapWidth, mapHeight } = this.welcome;
    if (nextX < 0 || nextX >= mapWidth || nextY < 0 || nextY >= mapHeight) return;
    if (this.collisionGrid[nextY]?.[nextX] === 1) return;

    for (const [sid, _] of this.playerSprites) {
      if (sid === this.room.sessionId) continue;
      const other = this.room.state.players.get(sid);
      if (other && other.alive && other.tileX === nextX && other.tileY === nextY) return;
    }

    sprite.predictMove(direction);
    this.soundManager.playStep();
  }

  // --- Event handlers ---

  private onAttackStart(data: any) {
    const sprite = this.playerSprites.get(data.sessionId);
    if (sprite) {
      sprite.container.setAlpha(0.7);
      this.time.delayedCall(100, () => {
        sprite.container.setAlpha(1);
      });
      if (data.sessionId === this.room.sessionId) {
        this.onConsoleMessage?.("You attacked!", "#cccccc");
      }
    }
    this.soundManager.playAttack();
  }

  private onAttackHit(data: any) {
    if (data.targetSessionId) {
      const target = this.playerSprites.get(data.targetSessionId);
      if (target) {
        this.flashSprite(target, 0xff0000);
      }
    }
  }

  private onCastStart(data: any) {
    const sprite = this.playerSprites.get(data.sessionId);
    if (sprite) {
      sprite.container.setAlpha(0.8);
      this.time.delayedCall(140, () => {
        sprite.container.setAlpha(1);
      });
      if (data.sessionId === this.room.sessionId) {
        this.onConsoleMessage?.("You cast a spell!", "#aaaaff");
      }
    }
    this.soundManager.playSpell();
  }

  private onCastHit(data: any) {
    const px = data.targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const py = data.targetTileY * TILE_SIZE + TILE_SIZE / 2;

    // Use resolver-based FX: pick FX 1 (default spell impact) or from data.fxId
    const fxId = data.fxId ?? 1;
    const fxEntry = this.resolver.getFxEntry(fxId);
    if (!fxEntry) return;

    const animKey = this.resolver.ensureFxAnimation(this, fxEntry.animacion);
    if (!animKey) return;

    // Get first frame for initial texture
    const firstStatic = this.resolver.resolveStaticGrh(fxEntry.animacion);
    if (!firstStatic) return;

    const fxSprite = this.add.sprite(
      px + (fxEntry.offX ?? 0),
      py + (fxEntry.offY ?? 0),
      `ao-${firstStatic.grafico}`,
      `grh-${firstStatic.id}`
    );
    fxSprite.setDepth(15);
    fxSprite.setOrigin(0.5, 0.5);
    fxSprite.play(animKey);
    fxSprite.once("animationcomplete", () => {
      fxSprite.destroy();
    });
  }

  private onDamage(data: any) {
    const sprite = this.playerSprites.get(data.targetSessionId);
    if (sprite) {
      const color = data.type === "magic" ? "#bb44ff"
        : data.type === "dot" ? "#44cc44"
        : "#ff4444";
      const text = this.add.text(
        sprite.renderX,
        sprite.renderY - 30,
        `-${data.amount}`,
        {
          fontSize: "14px",
          color,
          fontFamily: "'Friz Quadrata', Georgia, serif",
          fontStyle: "bold",
        }
      );
      text.setOrigin(0.5);
      text.setDepth(20);

      this.damageTexts.push({
        text,
        expireAt: this.time.now + 1200,
      });

      // Console log
      if (data.targetSessionId === this.room.sessionId) {
        // I took damage
        this.onConsoleMessage?.(`You took ${data.amount} damage!`, "#ff4444");
      } else if (data.sessionId === this.room.sessionId) { // Assuming data.sessionId is source
        // I dealt damage (if we had source info here easily)
        // For now, let's just log if I am the source, or if I am the target
      }
    }
    this.soundManager.playHit();
  }

  private onDeath(data: any) {
    const sprite = this.playerSprites.get(data.sessionId);
    if (sprite) {
      sprite.container.setAlpha(0.3);
    }
    if (data.sessionId === this.room.sessionId) {
      this.inputHandler.cancelTargeting();
      this.onConsoleMessage?.("You have died!", "#ff0000");
    }
    this.soundManager.playDeath();
  }

  private onRespawn(data: any) {
    const sprite = this.playerSprites.get(data.sessionId);
    if (sprite) {
      sprite.container.setAlpha(1);
      sprite.setTilePosition(data.tileX, data.tileY);
      sprite.renderX = data.tileX * TILE_SIZE + TILE_SIZE / 2;
      sprite.renderY = data.tileY * TILE_SIZE + TILE_SIZE / 2;
    }
    if (data.sessionId === this.room.sessionId) {
        this.onConsoleMessage?.("You have respawned!", "#ffffff");
    }
  }

  private onHeal(data: any) {
    const sprite = this.playerSprites.get(data.sessionId);
    if (sprite) {
      const text = this.add.text(
        sprite.renderX,
        sprite.renderY - 30,
        `+${data.amount}`,
        {
          fontSize: "14px",
          color: "#33cc33",
          fontFamily: "'Friz Quadrata', Georgia, serif",
          fontStyle: "bold",
        }
      );
      text.setOrigin(0.5);
      text.setDepth(20);
      this.damageTexts.push({ text, expireAt: this.time.now + 1200 });

      if (data.sessionId === this.room.sessionId) {
        this.onConsoleMessage?.(`You healed for ${data.amount}!`, "#33cc33");
      }
    }
    this.soundManager.playHeal();
  }

  private onBuffApplied(data: any) {
    const sprite = this.playerSprites.get(data.sessionId);
    if (sprite) {
      const text = this.add.text(
        sprite.renderX,
        sprite.renderY - 40,
        "BUFF",
        {
          fontSize: "10px",
          color: "#d4a843",
          fontFamily: "'Friz Quadrata', Georgia, serif",
          fontStyle: "bold",
        }
      );
      text.setOrigin(0.5);
      text.setDepth(20);
      this.damageTexts.push({ text, expireAt: this.time.now + 1000 });
    }
  }

  private onStunApplied(data: any) {
    const sprite = this.playerSprites.get(data.targetSessionId);
    if (sprite) {
      const text = this.add.text(
        sprite.renderX,
        sprite.renderY - 40,
        "STUNNED",
        {
          fontSize: "10px",
          color: "#cccc33",
          fontFamily: "'Friz Quadrata', Georgia, serif",
          fontStyle: "bold",
        }
      );
      text.setOrigin(0.5);
      text.setDepth(20);
      this.damageTexts.push({ text, expireAt: this.time.now + 1500 });
      
      if (data.targetSessionId === this.room.sessionId) {
         this.onConsoleMessage?.("You are stunned!", "#cccc33");
      }
    }
  }

  private flashSprite(sprite: PlayerSprite, _color: number) {
    sprite.container.setAlpha(0.5);
    this.time.delayedCall(80, () => {
      sprite.container.setAlpha(1);
    });
  }

  // Drop rendering
  private dropGraphics = new Map<string, Phaser.GameObjects.Arc>();

  private addDrop(drop: any, id: string) {
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
