import Phaser from "phaser";
import {
  TILE_SIZE,
  CLASS_STATS,
  NPC_STATS,
  CLASS_APPEARANCE,
  NPC_APPEARANCE,
  ITEMS,
  Direction,
  DIRECTION_DELTA,
} from "@abraxas/shared";
import {
  AoGrhResolver,
  type DirectionEntry,
  type BodyEntry,
} from "../assets/AoGrhResolver";

const DIR_NAME_MAP: Record<number, "down" | "up" | "left" | "right"> = {
  [Direction.DOWN]: "down",
  [Direction.UP]: "up",
  [Direction.LEFT]: "left",
  [Direction.RIGHT]: "right",
};

export class PlayerSprite {
  public container: Phaser.GameObjects.Container;
  private bodySprite: Phaser.GameObjects.Sprite;
  private headSprite: Phaser.GameObjects.Sprite | null = null;
  private weaponSprite: Phaser.GameObjects.Sprite | null = null;
  private shieldSprite: Phaser.GameObjects.Sprite | null = null;
  private helmetSprite: Phaser.GameObjects.Sprite | null = null;
  private nameText: Phaser.GameObjects.Text;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBar: Phaser.GameObjects.Rectangle;
  private speakingIcon: Phaser.GameObjects.Text;
  private chatBubbleText: Phaser.GameObjects.Text | null = null;

  public targetX: number;
  public targetY: number;
  public renderX: number;
  public renderY: number;
  public sessionId: string;
  public classType: string;
  public isLocal: boolean;
  private maxHp: number = 1;
  private pixelsPerSecond: number;

  private resolver: AoGrhResolver;
  private bodyEntry: BodyEntry;
  private headEntry: DirectionEntry | null;
  private currentDir: Direction = Direction.DOWN;
  private isMoving: boolean = false;

  private curWeaponAoId: number = 0;
  private curShieldAoId: number = 0;
  private curHelmetAoId: number = 0;

  public predictedTileX: number = 0;
  public predictedTileY: number = 0;
  private pendingPredictions = 0;
  private lastPredictTime = 0;
  private lastServerTileX = 0;
  private lastServerTileY = 0;

  constructor(
    scene: Phaser.Scene,
    sessionId: string,
    tileX: number,
    tileY: number,
    classType: string,
    name: string,
    isLocal: boolean,
  ) {
    this.sessionId = sessionId;
    this.classType = classType;
    this.isLocal = isLocal;

    const stats = CLASS_STATS[classType] || (NPC_STATS as Record<string, typeof NPC_STATS[keyof typeof NPC_STATS]>)[classType];
    if (!stats) {
      console.warn(
        `No stats found for class/type: ${classType}, defaulting to warrior`,
      );
      const defaultStats = CLASS_STATS.WARRIOR;
      this.pixelsPerSecond = defaultStats.speedTilesPerSecond * TILE_SIZE;
      this.maxHp = defaultStats.hp;
    } else {
      this.pixelsPerSecond = stats.speedTilesPerSecond * TILE_SIZE;
      this.maxHp = stats.hp;
    }

    const res = scene.registry.get("aoResolver");
    if (res instanceof AoGrhResolver) {
      this.resolver = res;
    } else {
      throw new Error("AoGrhResolver not found in registry");
    }
    const appearance =
      CLASS_APPEARANCE[classType] ??
      NPC_APPEARANCE[classType] ??
      CLASS_APPEARANCE.WARRIOR;
    const bodyEntryResult = this.resolver.getBodyEntry(appearance.bodyId);
    if (!bodyEntryResult) {
      throw new Error(`No body entry found for bodyId ${appearance.bodyId} (class/type: ${classType})`);
    }
    this.bodyEntry = bodyEntryResult;
    this.headEntry = this.resolver.getHeadEntry(appearance.headId);

    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    this.targetX = px;
    this.targetY = py;
    this.renderX = px;
    this.renderY = py;
    this.predictedTileX = tileX;
    this.predictedTileY = tileY;
    this.lastServerTileX = tileX;
    this.lastServerTileY = tileY;

    const bodyGrhId = this.bodyEntry.down;
    const bodyStatic = this.resolver.resolveStaticGrh(bodyGrhId);
    if (!bodyStatic) {
      throw new Error(`No static grh for bodyGrhId ${bodyGrhId} (class/type: ${classType})`);
    }
    this.bodySprite = scene.add.sprite(
      0,
      TILE_SIZE / 2,
      `ao-${bodyStatic.grafico}`,
      `grh-${bodyStatic.id}`,
    );
    this.bodySprite.setOrigin(0.5, 1);

    if (this.headEntry) {
      const headGrhId = this.headEntry.down;
      const headStatic = this.resolver.resolveStaticGrh(headGrhId);
      if (headStatic) {
        this.headSprite = scene.add.sprite(
          0,
          0,
          `ao-${headStatic.grafico}`,
          `grh-${headStatic.id}`,
        );
        this.headSprite.setOrigin(0.5, 0);
      }
    }
    this.updateHeadPosition();

    this.nameText = scene.add.text(0, TILE_SIZE / 2 + 6, name, {
      fontSize: "10px",
      color: isLocal ? "#ffffff" : "#cccccc",
      fontFamily: "'Friz Quadrata', Georgia, serif",
      shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 3, fill: true },
    });
    this.nameText.setOrigin(0.5, 0);

    const barWidth = TILE_SIZE - 6;
    this.hpBarBg = scene.add.rectangle(
      0,
      TILE_SIZE / 2 + 2,
      barWidth,
      3,
      0x333333,
    );
    this.hpBar = scene.add.rectangle(
      0,
      TILE_SIZE / 2 + 2,
      barWidth,
      3,
      0x33cc33,
    );

    this.hpBarBg.setVisible(false);
    this.hpBar.setVisible(false);

    this.speakingIcon = scene.add.text(0, -45, "🎤", {
      fontSize: "16px",
    });
    this.speakingIcon.setOrigin(0.5, 1);
    this.speakingIcon.setVisible(false);

    const containerChildren: Phaser.GameObjects.GameObject[] = [
      this.bodySprite,
      this.nameText,
      this.hpBarBg,
      this.hpBar,
      this.speakingIcon,
    ];
    if (this.headSprite) containerChildren.push(this.headSprite);

    this.container = scene.add.container(px, py, containerChildren);
    this.container.setDepth(10);

    this.container.setInteractive(
      new Phaser.Geom.Rectangle(-TILE_SIZE / 2, -TILE_SIZE, TILE_SIZE, TILE_SIZE * 2),
      Phaser.Geom.Rectangle.Contains,
    );
    this.container.on("pointerover", () => {
      this.hpBarBg.setVisible(true);
      this.hpBar.setVisible(true);
    });
    this.container.on("pointerout", () => {
      this.hpBarBg.setVisible(false);
      this.hpBar.setVisible(false);
    });

    // Ensure body walk animation exists for the initial direction
    this.resolver.ensureAnimation(scene, bodyGrhId, "body");
  }

  private updateHeadPosition() {
    const dirName = DIR_NAME_MAP[this.currentDir];
    const bodyStatic = this.resolver.resolveStaticGrh(this.bodyEntry[dirName]);
    const bodyH = bodyStatic ? bodyStatic.height : 45;
    const bodyTopY = TILE_SIZE / 2 - bodyH;
    const offX = this.bodyEntry.offHeadX ?? 0;
    const offY = this.bodyEntry.offHeadY ?? 0;
    if (this.headSprite) {
      this.headSprite.setPosition(offX, bodyTopY + offY);
    }
    if (this.helmetSprite) {
      this.helmetSprite.setPosition(offX, bodyTopY + offY);
    }
  }

  setTilePosition(tileX: number, tileY: number) {
    this.predictedTileX = tileX;
    this.predictedTileY = tileY;
    this.targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
    this.targetY = tileY * TILE_SIZE + TILE_SIZE / 2;
  }

  predictMove(direction: Direction) {
    const d = DIRECTION_DELTA[direction];
    if (d) {
      this.predictedTileX += d.dx;
      this.predictedTileY += d.dy;
      this.targetX = this.predictedTileX * TILE_SIZE + TILE_SIZE / 2;
      this.targetY = this.predictedTileY * TILE_SIZE + TILE_SIZE / 2;
      this.pendingPredictions++;
      this.lastPredictTime = performance.now();
    }
  }

  reconcileServer(serverTileX: number, serverTileY: number) {
    if (
      serverTileX !== this.lastServerTileX ||
      serverTileY !== this.lastServerTileY
    ) {
      this.lastServerTileX = serverTileX;
      this.lastServerTileY = serverTileY;
      if (this.pendingPredictions > 0) {
        this.pendingPredictions--;
      }
    }

    const timedOut =
      this.pendingPredictions > 0 &&
      performance.now() - this.lastPredictTime > 300;

    if (this.pendingPredictions === 0 || timedOut) {
      if (
        this.predictedTileX !== serverTileX ||
        this.predictedTileY !== serverTileY
      ) {
        this.predictedTileX = serverTileX;
        this.predictedTileY = serverTileY;
        this.targetX = serverTileX * TILE_SIZE + TILE_SIZE / 2;
        this.targetY = serverTileY * TILE_SIZE + TILE_SIZE / 2;
      }
      this.pendingPredictions = 0;
    }
  }

  setFacing(direction: Direction) {
    if (!this.container.scene) return;
    if (direction === this.currentDir) return;
    this.currentDir = direction;
    const dirName = DIR_NAME_MAP[direction];

    if (this.headEntry && this.headSprite) {
      const headGrhId = this.headEntry[dirName];
      const headStatic = this.resolver.resolveStaticGrh(headGrhId);
      if (headStatic) {
        this.headSprite.setTexture(
          `ao-${headStatic.grafico}`,
          `grh-${headStatic.id}`,
        );
      }
    }

    this.updateHeadPosition();

    if (this.isMoving) {
      this.playWalkAnims();
    } else {
      this.setIdleFrame();
    }

    this.updateEquipmentDirection();
    this.updateZOrder();
  }

  private setIdleFrame() {
    if (!this.container.scene) return;
    const dirName = DIR_NAME_MAP[this.currentDir];
    const bodyGrhId = this.bodyEntry[dirName];
    const bodyStatic = this.resolver.resolveStaticGrh(bodyGrhId);
    if (bodyStatic && this.bodySprite.active) {
      this.bodySprite.stop();
      this.bodySprite.setTexture(
        `ao-${bodyStatic.grafico}`,
        `grh-${bodyStatic.id}`,
      );
    }
    if (this.weaponSprite?.active) {
      const weaponEntry = this.resolver.getWeaponEntry(this.curWeaponAoId);
      if (weaponEntry) {
        const ws = this.resolver.resolveStaticGrh(weaponEntry[dirName]);
        if (ws) {
          this.weaponSprite.stop();
          this.weaponSprite.setTexture(`ao-${ws.grafico}`, `grh-${ws.id}`);
        }
      }
    }
    if (this.shieldSprite?.active) {
      const shieldEntry = this.resolver.getShieldEntry(this.curShieldAoId);
      if (shieldEntry) {
        const ss = this.resolver.resolveStaticGrh(shieldEntry[dirName]);
        if (ss) {
          this.shieldSprite.stop();
          this.shieldSprite.setTexture(`ao-${ss.grafico}`, `grh-${ss.id}`);
        }
      }
    }
  }

  private playWalkAnims() {
    const scene = this.container.scene;
    const dirName = DIR_NAME_MAP[this.currentDir];
    const bodyGrhId = this.bodyEntry[dirName];
    const bodyAnimKey = this.resolver.ensureAnimation(scene, bodyGrhId, "body");
    if (bodyAnimKey) {
      this.bodySprite.play(bodyAnimKey, true);
    }

    if (this.weaponSprite && this.curWeaponAoId) {
      const weaponEntry = this.resolver.getWeaponEntry(this.curWeaponAoId);
      if (weaponEntry) {
        const wAnimKey = this.resolver.ensureAnimation(
          scene,
          weaponEntry[dirName],
          "weapon",
        );
        if (wAnimKey) this.weaponSprite.play(wAnimKey, true);
      }
    }

    if (this.shieldSprite && this.curShieldAoId) {
      const shieldEntry = this.resolver.getShieldEntry(this.curShieldAoId);
      if (shieldEntry) {
        const sAnimKey = this.resolver.ensureAnimation(
          scene,
          shieldEntry[dirName],
          "shield",
        );
        if (sAnimKey) this.shieldSprite.play(sAnimKey, true);
      }
    }
  }

  private updateEquipmentDirection() {
    const dirName = DIR_NAME_MAP[this.currentDir];
    if (this.weaponSprite && this.curWeaponAoId) {
      const weaponEntry = this.resolver.getWeaponEntry(this.curWeaponAoId);
      if (weaponEntry) {
        if (this.isMoving) {
          const scene = this.container.scene;
          const wAnimKey = this.resolver.ensureAnimation(
            scene,
            weaponEntry[dirName],
            "weapon",
          );
          if (wAnimKey) this.weaponSprite.play(wAnimKey, true);
        } else {
          const ws = this.resolver.resolveStaticGrh(weaponEntry[dirName]);
          if (ws) {
            this.weaponSprite.stop();
            this.weaponSprite.setTexture(`ao-${ws.grafico}`, `grh-${ws.id}`);
          }
        }
      }
    }

    if (this.shieldSprite && this.curShieldAoId) {
      const shieldEntry = this.resolver.getShieldEntry(this.curShieldAoId);
      if (shieldEntry) {
        if (this.isMoving) {
          const scene = this.container.scene;
          const sAnimKey = this.resolver.ensureAnimation(
            scene,
            shieldEntry[dirName],
            "shield",
          );
          if (sAnimKey) this.shieldSprite.play(sAnimKey, true);
        } else {
          const ss = this.resolver.resolveStaticGrh(shieldEntry[dirName]);
          if (ss) {
            this.shieldSprite.stop();
            this.shieldSprite.setTexture(`ao-${ss.grafico}`, `grh-${ss.id}`);
          }
        }
      }
    }

    if (this.helmetSprite && this.curHelmetAoId) {
      const helmetEntry = this.resolver.getHelmetEntry(this.curHelmetAoId);
      if (helmetEntry) {
        const hs = this.resolver.resolveStaticGrh(helmetEntry[dirName]);
        if (hs) {
          this.helmetSprite.setTexture(`ao-${hs.grafico}`, `grh-${hs.id}`);
        }
      }
    }
  }

  private updateZOrder() {
    // Z-ordering within container: lower depth = rendered behind
    // body=3, head=4, helmet=5 always on top of body
    this.bodySprite.setDepth(3);
    if (this.headSprite) this.headSprite.setDepth(4);
    if (this.helmetSprite) this.helmetSprite.setDepth(5);

    switch (this.currentDir) {
      case Direction.DOWN:
        // Weapon in front, shield behind
        if (this.weaponSprite) this.weaponSprite.setDepth(7);
        if (this.shieldSprite) this.shieldSprite.setDepth(1);
        break;
      case Direction.UP:
        // Weapon behind, shield in front
        if (this.weaponSprite) this.weaponSprite.setDepth(1);
        if (this.shieldSprite) this.shieldSprite.setDepth(7);
        break;
      case Direction.LEFT:
        // Weapon behind, shield in front
        if (this.weaponSprite) this.weaponSprite.setDepth(1);
        if (this.shieldSprite) this.shieldSprite.setDepth(7);
        break;
      case Direction.RIGHT:
        // Weapon in front, shield behind
        if (this.weaponSprite) this.weaponSprite.setDepth(7);
        if (this.shieldSprite) this.shieldSprite.setDepth(1);
        break;
    }
  }

  setMoving(moving: boolean) {
    if (!this.container.scene) return;
    if (moving === this.isMoving) return;
    this.isMoving = moving;

    if (moving) {
      this.playWalkAnims();
    } else {
      this.setIdleFrame();
    }
  }

  /**
   * Update equipment visuals based on item IDs from server.
   * Pass empty string for no equipment in that slot.
   */
  updateEquipment(
    weaponItemId: string,
    shieldItemId: string,
    helmetItemId: string,
  ) {
    const scene = this.container.scene;
    const dirName = DIR_NAME_MAP[this.currentDir];

    // Resolve AO IDs from item defs
    const weaponItem = weaponItemId ? ITEMS[weaponItemId] : null;
    const shieldItem = shieldItemId ? ITEMS[shieldItemId] : null;
    const helmetItem = helmetItemId ? ITEMS[helmetItemId] : null;

    const newWeaponAoId = weaponItem?.aoWeaponId ?? 0;
    const newShieldAoId = shieldItem?.aoShieldId ?? 0;
    const newHelmetAoId = helmetItem?.aoHelmetId ?? 0;

    // Update weapon
    if (newWeaponAoId !== this.curWeaponAoId) {
      this.curWeaponAoId = newWeaponAoId;
      if (this.weaponSprite) {
        this.container.remove(this.weaponSprite, true);
        this.weaponSprite = null;
      }
      if (newWeaponAoId) {
        const weaponEntry = this.resolver.getWeaponEntry(newWeaponAoId);
        if (weaponEntry) {
          const ws = this.resolver.resolveStaticGrh(weaponEntry[dirName]);
          if (ws) {
            this.weaponSprite = scene.add.sprite(
              0,
              TILE_SIZE / 2,
              `ao-${ws.grafico}`,
              `grh-${ws.id}`,
            );
            this.weaponSprite.setOrigin(0.5, 1);
            this.container.add(this.weaponSprite);
            if (this.isMoving) {
              const wAnimKey = this.resolver.ensureAnimation(
                scene,
                weaponEntry[dirName],
                "weapon",
              );
              if (wAnimKey) this.weaponSprite.play(wAnimKey, true);
            }
          }
        }
      }
    }

    // Update shield
    if (newShieldAoId !== this.curShieldAoId) {
      this.curShieldAoId = newShieldAoId;
      if (this.shieldSprite) {
        this.container.remove(this.shieldSprite, true);
        this.shieldSprite = null;
      }
      if (newShieldAoId) {
        const shieldEntry = this.resolver.getShieldEntry(newShieldAoId);
        if (shieldEntry) {
          const ss = this.resolver.resolveStaticGrh(shieldEntry[dirName]);
          if (ss) {
            this.shieldSprite = scene.add.sprite(
              0,
              TILE_SIZE / 2,
              `ao-${ss.grafico}`,
              `grh-${ss.id}`,
            );
            this.shieldSprite.setOrigin(0.5, 1);
            this.container.add(this.shieldSprite);
            if (this.isMoving) {
              const sAnimKey = this.resolver.ensureAnimation(
                scene,
                shieldEntry[dirName],
                "shield",
              );
              if (sAnimKey) this.shieldSprite.play(sAnimKey, true);
            }
          }
        }
      }
    }

    // Update helmet
    if (newHelmetAoId !== this.curHelmetAoId) {
      this.curHelmetAoId = newHelmetAoId;
      if (this.helmetSprite) {
        this.container.remove(this.helmetSprite, true);
        this.helmetSprite = null;
      }
      if (newHelmetAoId) {
        const helmetEntry = this.resolver.getHelmetEntry(newHelmetAoId);
        if (helmetEntry) {
          const hs = this.resolver.resolveStaticGrh(helmetEntry[dirName]);
          if (hs) {
            this.helmetSprite = scene.add.sprite(
              0,
              0,
              `ao-${hs.grafico}`,
              `grh-${hs.id}`,
            );
            this.helmetSprite.setOrigin(0.5, 0);
            this.container.add(this.helmetSprite);
            this.updateHeadPosition();
          }
        }
      }
    }

    this.updateZOrder();
  }

  updateHpMana(hp: number, _mana: number) {
    const hpRatio = Math.max(0, hp / this.maxHp);
    const barWidth = TILE_SIZE - 6;

    this.hpBar.width = barWidth * hpRatio;
    this.hpBar.x = -(barWidth * (1 - hpRatio)) / 2;

    if (hpRatio > 0.5) {
      this.hpBar.setFillStyle(0x33cc33);
    } else if (hpRatio > 0.25) {
      this.hpBar.setFillStyle(0xcccc33);
    } else {
      this.hpBar.setFillStyle(0xcc3333);
    }
  }

  update(delta: number) {
    if (!this.container.scene) return;
    const dx = this.targetX - this.renderX;
    const dy = this.targetY - this.renderY;
    const distSq = dx * dx + dy * dy;

    this.setMoving(distSq > 1);

    if (distSq < 0.25 || distSq > (TILE_SIZE * 4) ** 2) {
      this.renderX = this.targetX;
      this.renderY = this.targetY;
    } else {
      const dist = Math.sqrt(distSq);
      const maxMove = this.pixelsPerSecond * (delta / 1000);
      if (maxMove >= dist) {
        this.renderX = this.targetX;
        this.renderY = this.targetY;
      } else {
        this.renderX += (dx / dist) * maxMove;
        this.renderY += (dy / dist) * maxMove;
      }
    }

    this.container.setPosition(this.renderX, this.renderY);
  }

  showSpeakingIndicator(visible: boolean) {
    if (this.speakingIcon) {
      this.speakingIcon.setVisible(visible);
    }
  }

  showChatBubble(message: string) {
    const scene = this.container.scene;
    if (!scene) return;

    if (this.chatBubbleText) {
      this.chatBubbleText.destroy();
      this.chatBubbleText = null;
    }

    const maxLen = 80;
    const display = message.length > maxLen ? `${message.substring(0, maxLen)}…` : message;

    const bodyTopY = TILE_SIZE / 2 - (this.bodySprite.height || 45);
    const textY = bodyTopY - 14;

    const text = scene.add.text(0, textY, display, {
      fontSize: "10px",
      color: "#ffffff",
      fontFamily: "'Friz Quadrata', Georgia, serif",
      wordWrap: { width: 110 },
      align: "center",
      shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 4, fill: true },
    });
    text.setOrigin(0.5, 1);

    this.chatBubbleText = text;
    this.container.add(text);

    const floatOffset = 6;
    text.setY(textY + floatOffset);
    text.setAlpha(0);

    scene.tweens.add({
      targets: text,
      alpha: 1,
      y: `-=${floatOffset}`,
      duration: 250,
      ease: "Power2.Out",
      onComplete: () => {
        scene.time.delayedCall(3500, () => {
          if (this.chatBubbleText !== text) return;
          scene.tweens.add({
            targets: text,
            alpha: 0,
            duration: 600,
            ease: "Power2.In",
            onComplete: () => {
              if (this.chatBubbleText === text) {
                text.destroy();
                this.chatBubbleText = null;
              }
            },
          });
        });
      },
    });
  }

  destroy() {
    this.chatBubbleText?.destroy();
    this.container.destroy();
  }
}
