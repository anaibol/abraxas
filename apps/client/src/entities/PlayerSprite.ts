import {
  CLASS_APPEARANCE,
  CLASS_STATS,
  DIRECTION_DELTA,
  Direction,
  ITEMS,
  NPC_APPEARANCE,
  NPC_STATS,
  TILE_SIZE,
} from "@abraxas/shared";
import Phaser from "phaser";
import { AoGrhResolver, type BodyEntry, type DirectionEntry } from "../assets/AoGrhResolver";
import { FONTS, getGameTextResolution } from "../ui/tokens";

const DIR_NAME_MAP: Record<number, "down" | "up" | "left" | "right"> = {
  [Direction.DOWN]: "down",
  [Direction.UP]: "up",
  [Direction.LEFT]: "left",
  [Direction.RIGHT]: "right",
};

const GAME_TEXT_STYLE = {
  fontFamily: FONTS.display,
  fontSize: "13px",
  resolution: getGameTextResolution(),
  shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 3, fill: true },
};

/** World-space Y offsets applied to each status emitter relative to the sprite origin. */
const STATUS_EMITTER_OFFSETS: Record<string, number> = {
  stun: -TILE_SIZE * 1.4,
  poison: -TILE_SIZE * 0.2,
};

export class PlayerSprite {
  public container: Phaser.GameObjects.Container;
  private bodySprite: Phaser.GameObjects.Sprite;
  private headSprite: Phaser.GameObjects.Sprite | null = null;
  private weaponSprite: Phaser.GameObjects.Sprite | null = null;
  private shieldSprite: Phaser.GameObjects.Sprite | null = null;
  private helmetSprite: Phaser.GameObjects.Sprite | null = null;
  private mountSprite: Phaser.GameObjects.Sprite | null = null;
  private nameText: Phaser.GameObjects.Text;
  private hpBarGfx: Phaser.GameObjects.Graphics;
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

  private defaultBodyId: number;
  private defaultHeadId: number;
  private curBodyId: number;
  private curHeadId: number;

  private curWeaponAoId: number = 0;
  private curShieldAoId: number = 0;
  private curHelmetAoId: number = 0;
  private curMountItemId: string = "";
  /** Item 85: active gait tween for mount bob animation. */
  private mountGaitTween: Phaser.Tweens.Tween | null = null;
  /** Item 85: speed bonus of currently equipped mount (drives gait style). */
  private curMountSpeedBonus = 0;

  public predictedTileX: number = 0;
  public predictedTileY: number = 0;
  private pendingPredictions = 0;
  private lastPredictTime = 0;
  private lastServerTileX = 0;
  private lastServerTileY = 0;

  private meditationEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private isMeditating: boolean = false;
  private meditationManaTier: number = -1;

  // ── Status-effect persistent visuals ───────────────────────────────────────
  /** Active particle emitters keyed by status name (stun / poison / buff / debuff). */
  private statusEmitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  /** Glowing ring + white sparkles while invulnerable (kept separate — has extra ring graphic). */
  private invulnEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Pulsing white ring added to the container during invulnerability. */
  private invulnRing: Phaser.GameObjects.Graphics | null = null;
  private invulnRingTween: Phaser.Tweens.Tween | null = null;
  /** Currently active body-tint tween (only one at a time by priority). */
  private tintTween: Phaser.Tweens.Tween | null = null;
  private activeStatusTints = new Set<"stun" | "poison" | "buff" | "debuff" | "invuln">();

  private get dirName(): "down" | "up" | "left" | "right" {
    return DIR_NAME_MAP[this.currentDir];
  }

  constructor(
    scene: Phaser.Scene,
    sessionId: string,
    tileX: number,
    tileY: number,
    classType: string,
    name: string,
    isLocal: boolean,
    role?: string,
  ) {
    this.sessionId = sessionId;
    this.classType = classType;
    this.isLocal = isLocal;

    const isClass = classType in CLASS_STATS;
    const isNpc = classType in NPC_STATS;

    const stats = isClass
      ? CLASS_STATS[classType as keyof typeof CLASS_STATS]
      : isNpc
        ? NPC_STATS[classType as keyof typeof NPC_STATS]
        : CLASS_STATS.WARRIOR;

    if (!isClass && !isNpc) {
      console.warn(`No stats found for class/type: ${classType}, defaulting to warrior`);
    }
    this.pixelsPerSecond = stats.speedTilesPerSecond * TILE_SIZE;
    this.maxHp = stats.hp;

    const res = scene.registry.get("aoResolver");
    if (res instanceof AoGrhResolver) {
      this.resolver = res;
    } else {
      throw new Error("AoGrhResolver not found in registry");
    }

    const isClassApp = classType in CLASS_APPEARANCE;
    const isNpcApp = classType in NPC_APPEARANCE;

    const appearance = isClassApp
      ? CLASS_APPEARANCE[classType as keyof typeof CLASS_APPEARANCE]
      : isNpcApp
        ? NPC_APPEARANCE[classType as keyof typeof NPC_APPEARANCE]
        : CLASS_APPEARANCE.WARRIOR;
    const bodyEntryResult = this.resolver.getBodyEntry(appearance.bodyId);
    if (!bodyEntryResult) {
      throw new Error(
        `No body entry found for bodyId ${appearance.bodyId} (class/type: ${classType})`,
      );
    }
    this.bodyEntry = bodyEntryResult;
    this.headEntry = this.resolver.getHeadEntry(appearance.headId);

    this.defaultBodyId = appearance.bodyId;
    this.defaultHeadId = appearance.headId;
    this.curBodyId = appearance.bodyId;
    this.curHeadId = appearance.headId;

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

    const isGM = role === "ADMIN" || role === "GM";
    const nameColor = isGM ? "#44ff44" : isLocal ? "#ffffff" : "#cccccc";
    this.nameText = scene.add.text(0, TILE_SIZE / 2 + 6, name, {
      ...GAME_TEXT_STYLE,
      color: nameColor,
    });
    this.nameText.setOrigin(0.5, 0);

    this.hpBarGfx = scene.add.graphics();
    this.hpBarGfx.setVisible(false);
    this.drawHpBar(1.0);

    this.speakingIcon = scene.add.text(0, -45, "🎤", { fontSize: "16px", resolution: getGameTextResolution() });
    this.speakingIcon.setOrigin(0.5, 1);
    this.speakingIcon.setVisible(false);

    const containerChildren: Phaser.GameObjects.GameObject[] = [
      this.bodySprite,
      this.nameText,
      this.hpBarGfx,
      this.speakingIcon,
    ];
    if (this.headSprite) containerChildren.push(this.headSprite);

    this.container = scene.add.container(px, py, containerChildren);
    this.container.setDepth(10);

    this.container.setInteractive(
      new Phaser.Geom.Rectangle(-TILE_SIZE / 2, -TILE_SIZE, TILE_SIZE, TILE_SIZE * 2),
      Phaser.Geom.Rectangle.Contains,
    );
    if (!isLocal) {
      this.container.on("pointerover", () => {
        this.hpBarGfx.setVisible(true);
      });
      this.container.on("pointerout", () => {
        this.hpBarGfx.setVisible(false);
      });
    }

    this.resolver.ensureAnimation(scene, bodyGrhId, "body");
  }

  private updateHeadPosition() {
    const bodyStatic = this.resolver.resolveStaticGrh(this.bodyEntry[this.dirName]);
    const bodyH = bodyStatic ? bodyStatic.height : 45;
    const bodyTopY = TILE_SIZE / 2 - bodyH;
    const offX = this.bodyEntry.offHeadX ?? 0;
    const offY = this.bodyEntry.offHeadY ?? 0;
    this.headSprite?.setPosition(offX, bodyTopY + offY);
    this.helmetSprite?.setPosition(offX, bodyTopY + offY);
  }

  updateAppearance(bodyId: number, headId: number) {
    const bid = bodyId || this.defaultBodyId;
    const hid = headId || this.defaultHeadId;

    if (bid === this.curBodyId && hid === this.curHeadId) return;

    this.curBodyId = bid;
    this.curHeadId = hid;

    const bodyEntryResult = this.resolver.getBodyEntry(bid);
    if (bodyEntryResult) {
      this.bodyEntry = bodyEntryResult;
    }
    this.headEntry = this.resolver.getHeadEntry(hid);

    // Force re-render of current frame
    if (this.isMoving) {
      this.playWalkAnims();
    } else {
      this.setIdleFrame();
    }
    this.updateHeadPosition();
    this.playPoof();
  }

  setTilePosition(tileX: number, tileY: number): boolean {
    const changed = this.predictedTileX !== tileX || this.predictedTileY !== tileY;
    this.predictedTileX = tileX;
    this.predictedTileY = tileY;
    this.targetX = tileX * TILE_SIZE + TILE_SIZE / 2;
    this.targetY = tileY * TILE_SIZE + TILE_SIZE / 2;
    return changed;
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
    if (serverTileX !== this.lastServerTileX || serverTileY !== this.lastServerTileY) {
      this.lastServerTileX = serverTileX;
      this.lastServerTileY = serverTileY;
      if (this.pendingPredictions > 0) this.pendingPredictions--;
    }

    const timedOut = this.pendingPredictions > 0 && performance.now() - this.lastPredictTime > 300;

    if (this.pendingPredictions === 0 || timedOut) {
      if (this.predictedTileX !== serverTileX || this.predictedTileY !== serverTileY) {
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

    if (this.headEntry && this.headSprite) {
      const headStatic = this.resolver.resolveStaticGrh(this.headEntry[this.dirName]);
      if (headStatic) {
        this.headSprite.setTexture(`ao-${headStatic.grafico}`, `grh-${headStatic.id}`);
      }
    }

    this.updateHeadPosition();

    if (this.isMoving) {
      this.playWalkAnims();
    } else {
      this.setIdleFrame();
    }

    this.updateZOrder();
  }

  private setIdleFrame() {
    if (!this.container.scene) return;
    const bodyGrhId = this.bodyEntry[this.dirName];
    const bodyStatic = this.resolver.resolveStaticGrh(bodyGrhId);
    if (bodyStatic && this.bodySprite.active) {
      this.bodySprite.stop();
      this.bodySprite.setTexture(`ao-${bodyStatic.grafico}`, `grh-${bodyStatic.id}`);
    }
    this.applyStaticEquipmentFrame(this.weaponSprite, this.curWeaponAoId, (id) =>
      this.resolver.getWeaponEntry(id),
    );
    this.applyStaticEquipmentFrame(this.shieldSprite, this.curShieldAoId, (id) =>
      this.resolver.getShieldEntry(id),
    );
    this.applyStaticEquipmentFrame(this.helmetSprite, this.curHelmetAoId, (id) =>
      this.resolver.getHelmetEntry(id),
    );
  }

  private playWalkAnims() {
    const scene = this.container.scene;
    const bodyGrhId = this.bodyEntry[this.dirName];
    const bodyAnimKey = this.resolver.ensureAnimation(scene, bodyGrhId, "body");
    if (bodyAnimKey) this.bodySprite.play(bodyAnimKey, true);

    if (this.weaponSprite && this.curWeaponAoId) {
      const entry = this.resolver.getWeaponEntry(this.curWeaponAoId);
      if (entry) {
        const animKey = this.resolver.ensureAnimation(scene, entry[this.dirName], "weapon");
        if (animKey) this.weaponSprite.play(animKey, true);
      }
    }

    if (this.shieldSprite && this.curShieldAoId) {
      const entry = this.resolver.getShieldEntry(this.curShieldAoId);
      if (entry) {
        const animKey = this.resolver.ensureAnimation(scene, entry[this.dirName], "shield");
        if (animKey) this.shieldSprite.play(animKey, true);
      }
    }

    // Helmet has no walk animation — update its directional texture only
    this.applyStaticEquipmentFrame(this.helmetSprite, this.curHelmetAoId, (id) =>
      this.resolver.getHelmetEntry(id),
    );
  }

  /** Sets a static (non-animated) frame for a single equipment sprite. */
  private applyStaticEquipmentFrame(
    sprite: Phaser.GameObjects.Sprite | null,
    aoId: number,
    getEntry: (id: number) => DirectionEntry | null | undefined,
  ) {
    if (!sprite?.active || !aoId) return;
    const entry = getEntry(aoId);
    if (!entry) return;
    const staticGrh = this.resolver.resolveStaticGrh(entry[this.dirName]);
    if (staticGrh) {
      sprite.stop();
      sprite.setTexture(`ao-${staticGrh.grafico}`, `grh-${staticGrh.id}`);
    }
  }

  /** Removes the old sprite and creates a new one for an equipment slot. */
  private replaceEquipmentSprite(
    oldSprite: Phaser.GameObjects.Sprite | null,
    newAoId: number,
    getEntry: (id: number) => DirectionEntry | null | undefined,
    animPrefix: string | null,
    posY: number,
    originY: number,
  ): Phaser.GameObjects.Sprite | null {
    if (oldSprite) this.container.remove(oldSprite, true);
    if (!newAoId) return null;

    const entry = getEntry(newAoId);
    if (!entry) return null;

    const grhId = entry[this.dirName];
    const staticGrh = this.resolver.resolveStaticGrh(grhId);
    if (!staticGrh) return null;

    const scene = this.container.scene;
    const sprite = scene.add.sprite(0, posY, `ao-${staticGrh.grafico}`, `grh-${staticGrh.id}`);
    sprite.setOrigin(0.5, originY);
    this.container.add(sprite);

    if (this.isMoving && animPrefix) {
      const animKey = this.resolver.ensureAnimation(scene, grhId, animPrefix);
      if (animKey) sprite.play(animKey, true);
    }

    return sprite;
  }

  private updateZOrder() {
    this.bodySprite.setDepth(3);
    if (this.headSprite) this.headSprite.setDepth(4);
    if (this.helmetSprite) this.helmetSprite.setDepth(5);

    const weaponFront = this.currentDir === Direction.DOWN || this.currentDir === Direction.RIGHT;
    if (this.weaponSprite) this.weaponSprite.setDepth(weaponFront ? 7 : 1);
    if (this.shieldSprite) this.shieldSprite.setDepth(weaponFront ? 1 : 7);
  }

  setMoving(moving: boolean) {
    if (!this.container.scene) return;
    if (moving === this.isMoving) return;
    this.isMoving = moving;
    if (moving) {
      this.playWalkAnims();
      this.startMountGait(); // item 85
    } else {
      this.setIdleFrame();
      this.stopMountGait(); // item 85
    }
  }

  // ── Item 85: Mount gait animation helpers ─────────────────────────────────

  private startMountGait() {
    if (!this.mountSprite || this.mountGaitTween) return;
    const scene = this.container.scene;
    if (!scene) return;

    // Gallop (fast mounts speedBonus ≥ 5): pronounced bob at 12hz
    // Trot (normal mounts): gentle sway at 7hz
    const isGallop = this.curMountSpeedBonus >= 5;
    const bobAmplitude = isGallop ? 5 : 3;
    const bobDuration = isGallop ? 85 : 140;

    const baseY = TILE_SIZE * 0.6;
    this.mountGaitTween = scene.tweens.add({
      targets: this.mountSprite,
      y: { from: baseY - bobAmplitude, to: baseY + bobAmplitude },
      duration: bobDuration,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  private stopMountGait() {
    if (!this.mountGaitTween) return;
    this.mountGaitTween.stop();
    this.mountGaitTween = null;
    // Reset mount sprite Y to its resting position
    if (this.mountSprite) this.mountSprite.setY(TILE_SIZE * 0.6);
  }

  /** Update equipment visuals based on item IDs from server. Pass empty string for an empty slot. */
  updateEquipment(
    weaponItemId: string,
    shieldItemId: string,
    helmetItemId: string,
    mountItemId: string = "",
  ) {
    const newWeaponAoId = weaponItemId ? (ITEMS[weaponItemId]?.aoWeaponId ?? 0) : 0;
    const newShieldAoId = shieldItemId ? (ITEMS[shieldItemId]?.aoShieldId ?? 0) : 0;
    const newHelmetAoId = helmetItemId ? (ITEMS[helmetItemId]?.aoHelmetId ?? 0) : 0;

    if (newWeaponAoId !== this.curWeaponAoId) {
      this.curWeaponAoId = newWeaponAoId;
      this.weaponSprite = this.replaceEquipmentSprite(
        this.weaponSprite,
        newWeaponAoId,
        (id) => this.resolver.getWeaponEntry(id),
        "weapon",
        TILE_SIZE / 2,
        1,
      );
    }

    if (newShieldAoId !== this.curShieldAoId) {
      this.curShieldAoId = newShieldAoId;
      this.shieldSprite = this.replaceEquipmentSprite(
        this.shieldSprite,
        newShieldAoId,
        (id) => this.resolver.getShieldEntry(id),
        "shield",
        TILE_SIZE / 2,
        1,
      );
    }

    if (newHelmetAoId !== this.curHelmetAoId) {
      this.curHelmetAoId = newHelmetAoId;
      this.helmetSprite = this.replaceEquipmentSprite(
        this.helmetSprite,
        newHelmetAoId,
        (id) => this.resolver.getHelmetEntry(id),
        null,
        0,
        0,
      );
      if (newHelmetAoId) this.updateHeadPosition();
    }

    // Mount rendering
    if (mountItemId !== this.curMountItemId) {
      this.curMountItemId = mountItemId;
      this.updateMountSprite(mountItemId);
    }

    this.updateZOrder();
  }

  /** Creates or removes the mount sprite based on whether a mount is equipped. */
  private updateMountSprite(mountItemId: string) {
    // Stop any running gait and remove existing mount sprite
    this.stopMountGait();
    if (this.mountSprite) {
      this.container.remove(this.mountSprite, true);
      this.mountSprite = null;
      // Restore normal body Y offset
      this.bodySprite.setY(TILE_SIZE / 2);
      this.headSprite?.setY(0);
    }

    if (!mountItemId) {
      this.curMountSpeedBonus = 0;
      return;
    }

    // Use the NPC appearance of the mount type
    const mountItem = ITEMS[mountItemId];
    if (!mountItem?.mountNpcType) return;

    // Item 85: store speed bonus to choose gait style
    this.curMountSpeedBonus = mountItem.stats?.speedBonus ?? 0;

    const mountAppearance = NPC_APPEARANCE[mountItem.mountNpcType];
    if (!mountAppearance) return;

    const scene = this.container.scene;
    const mountBodyEntry = this.resolver.getBodyEntry(mountAppearance.bodyId);
    if (!mountBodyEntry) return;

    const mountGrhId = mountBodyEntry[this.dirName];
    const mountStatic = this.resolver.resolveStaticGrh(mountGrhId);
    if (!mountStatic) return;

    this.mountSprite = scene.add.sprite(
      0,
      TILE_SIZE * 0.6,
      `ao-${mountStatic.grafico}`,
      `grh-${mountStatic.id}`,
    );
    this.mountSprite.setOrigin(0.5, 1);
    this.mountSprite.setDepth(2);
    this.container.addAt(this.mountSprite, 0);

    // Shift the rider slightly upward so it sits on the mount
    this.bodySprite.setY(TILE_SIZE / 2 - 12);
    this.headSprite?.setY(-12);

    this.resolver.ensureAnimation(scene, mountGrhId, "mount");

    // If already moving when mount is equipped, start gait immediately
    if (this.isMoving) this.startMountGait();
  }

  // ── Status effect API ─────────────────────────────────────────────────────

  /** Ensures small particle textures exist (shared by stun, poison, buff, etc.). */
  private ensureStatusTextures(scene: Phaser.Scene) {
    if (!scene.textures.exists("status-star")) {
      const g = scene.add.graphics();
      // Soft glow halo behind the star
      for (let r = 7; r >= 1; r--) {
        g.fillStyle(0xffffff, (1 - r / 7) ** 1.5 * 0.5);
        g.fillCircle(8, 8, r);
      }
      // Sharp 8-point star on top
      g.fillStyle(0xffffff, 1);
      const cx = 8,
        cy = 8,
        outer = 7,
        inner = 2.5;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        pts.push(new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
      }
      g.fillPoints(pts, true);
      g.generateTexture("status-star", 16, 16);
      g.destroy();
    }
    if (!scene.textures.exists("status-dot")) {
      // Soft radial glow instead of a flat solid circle
      const g = scene.add.graphics();
      for (let r = 4; r >= 1; r--) {
        const a = (1 - (r - 1) / 4) ** 1.8;
        g.fillStyle(0xffffff, a);
        g.fillCircle(4, 4, r);
      }
      g.generateTexture("status-dot", 8, 8);
      g.destroy();
    }
  }

  /** Spawns a named status emitter and schedules its auto-clear. */
  private applyStatusEffect(
    name: "stun" | "poison" | "buff" | "debuff",
    texture: string,
    config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
    offsetY: number,
    depth: number,
    durationMs: number,
  ): void {
    const scene = this.container.scene;
    if (!scene || this.statusEmitters.has(name)) return;
    this.ensureStatusTextures(scene);
    const emitter = scene.add.particles(this.renderX, this.renderY + offsetY, texture, config);
    emitter.setDepth(this.container.depth + depth);
    this.statusEmitters.set(name, emitter);
    this.activeStatusTints.add(name);
    this.refreshTint();
    scene.time.delayedCall(durationMs, () => this.clearStatusEffect(name));
  }

  /** Destroys a named status emitter and refreshes tint. */
  private clearStatusEffect(name: "stun" | "poison" | "buff" | "debuff"): void {
    this.statusEmitters.get(name)?.destroy();
    this.statusEmitters.delete(name);
    this.activeStatusTints.delete(name);
    this.refreshTint();
  }

  /**
   * Applies a colour-pulsing tint to the body and head sprites.
   * Colour interpolates from white to `color` on a sine wave.
   */
  private applyTintPulse(color: number) {
    this.stopTintPulse();
    const tr = (color >> 16) & 0xff;
    const tg = (color >> 8) & 0xff;
    const tb = color & 0xff;
    const proxy = { t: 0 };
    this.tintTween = this.container.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
      onUpdate: () => {
        const t = proxy.t;
        const cr = Math.round(0xff + (tr - 0xff) * t);
        const cg = Math.round(0xff + (tg - 0xff) * t);
        const cb = Math.round(0xff + (tb - 0xff) * t);
        const c = (cr << 16) | (cg << 8) | cb;
        this.bodySprite.setTint(c);
        if (this.headSprite) this.headSprite.setTint(c);
      },
    });
  }

  private stopTintPulse() {
    this.tintTween?.stop();
    this.tintTween = null;
    this.bodySprite.clearTint();
    if (this.headSprite) this.headSprite.clearTint();
  }

  /** Re-evaluates which tint to show based on active status priorities. */
  private refreshTint() {
    if (this.activeStatusTints.has("stun")) {
      this.applyTintPulse(0xffff00); // yellow
    } else if (this.activeStatusTints.has("invuln")) {
      this.applyTintPulse(0xeef8ff); // bright white-blue
    } else if (this.activeStatusTints.has("poison")) {
      this.applyTintPulse(0x44ff44); // green
    } else if (this.activeStatusTints.has("debuff")) {
      this.applyTintPulse(0xcc44ff); // purple
    } else if (this.activeStatusTints.has("buff")) {
      this.applyTintPulse(0xffdd44); // gold
    } else {
      this.stopTintPulse();
    }
  }

  // ── applyStun / clearStun ─────────────────────────────────────────────────

  applyStun(durationMs: number) {
    this.applyStatusEffect(
      "stun",
      "status-star",
      {
        tint: [0xffff00, 0xffcc00, 0xffffff, 0xffee44],
        speed: { min: 20, max: 48 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.6, end: 0.12 },
        alpha: { start: 1, end: 0.3 },
        lifespan: { min: 700, max: 1100 },
        quantity: 2,
        frequency: 80,
        rotate: { start: 0, end: 720 },
        x: { min: -TILE_SIZE * 0.5, max: TILE_SIZE * 0.5 },
      },
      -TILE_SIZE * 1.4,
      3,
      durationMs,
    );
  }
  clearStun() {
    this.clearStatusEffect("stun");
  }

  // ── applyPoison / clearPoison ─────────────────────────────────────────────

  applyPoison(durationMs: number) {
    this.applyStatusEffect(
      "poison",
      "status-dot",
      {
        tint: [0x44ff44, 0x007700, 0x88ff00, 0x33cc00, 0xaaff00],
        speed: { min: 8, max: 28 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.52, end: 0 },
        alpha: { start: 0.95, end: 0 },
        lifespan: { min: 700, max: 1300 },
        quantity: 2,
        frequency: 60,
        gravityY: 65,
        x: { min: -12, max: 12 },
      },
      -TILE_SIZE * 0.2,
      2,
      durationMs,
    );
  }
  clearPoison() {
    this.clearStatusEffect("poison");
  }

  // ── applyBuff / clearBuff ─────────────────────────────────────────────────

  applyBuff(durationMs: number) {
    this.applyStatusEffect(
      "buff",
      "status-star",
      {
        tint: [0xffdd44, 0xffaa00, 0xffffff],
        speed: { min: 12, max: 32 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.38, end: 0 },
        alpha: { start: 0.85, end: 0 },
        lifespan: { min: 600, max: 950 },
        quantity: 1,
        frequency: 110,
        gravityY: -45,
        x: { min: -14, max: 14 },
        rotate: { start: 0, end: 360 },
      },
      0,
      2,
      durationMs,
    );
  }
  clearBuff() {
    this.clearStatusEffect("buff");
  }

  // ── applyDebuff / clearDebuff ─────────────────────────────────────────────

  applyDebuff(durationMs: number) {
    this.applyStatusEffect(
      "debuff",
      "status-dot",
      {
        tint: [0xcc44ff, 0x880088, 0x4400aa],
        speed: { min: 6, max: 20 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.75, end: 0 },
        lifespan: { min: 600, max: 1100 },
        quantity: 1,
        frequency: 100,
        gravityY: -28,
        blendMode: Phaser.BlendModes.NORMAL,
        x: { min: -12, max: 12 },
      },
      0,
      1,
      durationMs,
    );
  }
  clearDebuff() {
    this.clearStatusEffect("debuff");
  }

  // ── applyInvulnerable / clearInvulnerable ─────────────────────────────────

  applyInvulnerable(durationMs: number) {
    const scene = this.container.scene;
    if (!scene || this.invulnRing) return;
    this.ensureStatusTextures(scene);

    // Double-ellipse halo ring inside the container (outer + inner for depth)
    const ring = scene.add.graphics();
    ring.setBlendMode(Phaser.BlendModes.ADD);
    // Outer halo
    ring.lineStyle(2.5, 0xffffff, 0.85);
    ring.strokeEllipse(0, -TILE_SIZE * 0.35, TILE_SIZE * 1.62, TILE_SIZE * 0.5);
    // Inner halo (tighter, slightly blue-tinted)
    ring.lineStyle(1.5, 0x88ccff, 0.6);
    ring.strokeEllipse(0, -TILE_SIZE * 0.35, TILE_SIZE * 1.25, TILE_SIZE * 0.35);
    this.container.add(ring);
    this.invulnRing = ring;

    this.invulnRingTween = scene.tweens.add({
      targets: ring,
      alpha: { from: 0.5, to: 1 },
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    // Orbiting white sparkles (world-space emitter) — more particles, wider spread
    this.invulnEmitter = scene.add.particles(this.renderX, this.renderY, "status-star", {
      tint: [0xffffff, 0xeef8ff, 0xffee88, 0x88ccff],
      speed: { min: 18, max: 45 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.95, end: 0 },
      lifespan: { min: 500, max: 900 },
      quantity: 2,
      frequency: 65,
      gravityY: -20,
      x: { min: -TILE_SIZE * 0.7, max: TILE_SIZE * 0.7 },
      rotate: { start: 0, end: 360 },
    });
    this.invulnEmitter.setDepth(this.container.depth + 3);

    this.activeStatusTints.add("invuln");
    this.refreshTint();
    scene.time.delayedCall(durationMs, () => this.clearInvulnerable());
  }

  clearInvulnerable() {
    this.invulnRingTween?.stop();
    this.invulnRingTween = null;
    if (this.invulnRing) {
      this.container.remove(this.invulnRing, true);
      this.invulnRing = null;
    }
    this.invulnEmitter?.destroy();
    this.invulnEmitter = null;
    this.activeStatusTints.delete("invuln");
    this.refreshTint();
  }

  playPoof() {
    const scene = this.container.scene;
    if (!scene) return;
    this.ensureStatusTextures(scene);

    const emitter = scene.add.particles(this.renderX, this.renderY, "status-dot", {
      speed: { min: 40, max: 100 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 500,
      quantity: 15,
      tint: [0xffffff, 0xcccccc, 0x888888],
    });
    emitter.setDepth(this.container.depth + 10);
    emitter.explode();
    scene.time.delayedCall(500, () => emitter.destroy());
  }

  // ── Meditation ─────────────────────────────────────────────────────────────

  private ensureFireTexture(scene: Phaser.Scene) {
    if (scene.textures.exists("meditation-fire")) return;
    // Soft radial glow — the particle tint provides all the fire colouring,
    // so we just need a clean white glow shape with a bright, crisp centre.
    const g = scene.add.graphics();
    for (let r = 8; r >= 1; r--) {
      const t = (r - 1) / 8;
      const a = (1 - t) ** 1.6;
      g.fillStyle(0xffffff, a);
      g.fillCircle(8, 8, r);
    }
    g.generateTexture("meditation-fire", 16, 16);
    g.destroy();
  }

  setMeditating(meditating: boolean, maxMana: number = 100) {
    const scene = this.container.scene;
    if (!scene) return;

    // Compute mana tier based on total mana pool:
    // 0 = low (<100 maxMana, e.g. warriors), 1 = mid (100-300), 2 = high (>300, e.g. mages)
    const tier = maxMana < 100 ? 0 : maxMana < 300 ? 1 : 2;

    // If nothing changed, skip
    if (meditating === this.isMeditating && (!meditating || tier === this.meditationManaTier)) return;

    this.isMeditating = meditating;
    this.meditationManaTier = tier;

    // Always destroy the old emitter first
    if (this.meditationEmitter) {
      this.meditationEmitter.destroy();
      this.meditationEmitter = null;
    }

    if (meditating) {
      this.ensureFireTexture(scene);

      // Scale visual properties by mana tier
      const tints = [
        [0xff2200, 0xff4400, 0xff6600],               // low:  dim embers
        [0xff6600, 0xffaa00, 0xffdd00, 0xffee44],      // mid:  warm flames
        [0xffdd00, 0xffee88, 0xffffff, 0x88ccff],       // high: bright white-blue fire
      ][tier];
      const scaleStart = [0.28, 0.42, 0.58][tier];
      const quantity = [2, 3, 5][tier];
      const frequency = [65, 45, 30][tier];
      const xSpread = [6, 8, 12][tier];
      const speedMax = [22, 30, 42][tier];
      const lifespanMax = [650, 850, 1100][tier];

      this.meditationEmitter = scene.add.particles(this.renderX, this.renderY, "meditation-fire", {
        x: { min: -xSpread, max: xSpread },
        y: { min: -TILE_SIZE * 1.1, max: -TILE_SIZE * 0.1 },
        scale: { start: scaleStart, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: tints,
        speed: { min: 12, max: speedMax },
        angle: { min: 260, max: 280 },
        lifespan: { min: 450, max: lifespanMax },
        quantity,
        frequency,
      });
      this.meditationEmitter.setDepth(this.container.depth + 2);
    }
  }

  /** Redraws the HP bar Graphics with a border, dark track, coloured fill, and highlight strip. */
  private drawHpBar(hpRatio: number) {
    const barW = TILE_SIZE - 4;
    const barH = 4;
    const bx = -barW / 2;
    const by = TILE_SIZE / 2 + 1;

    this.hpBarGfx.clear();

    // 1px dark border/outline
    this.hpBarGfx.fillStyle(0x000000, 0.75);
    this.hpBarGfx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

    // Dark track background
    this.hpBarGfx.fillStyle(0x111111, 1);
    this.hpBarGfx.fillRect(bx, by, barW, barH);

    if (hpRatio > 0) {
      const fillW = Math.max(1, Math.round(barW * hpRatio));
      const fillColor = hpRatio > 0.5 ? 0x22cc44 : hpRatio > 0.25 ? 0xddcc22 : 0xcc2222;
      const hlColor = hpRatio > 0.5 ? 0x44ff77 : hpRatio > 0.25 ? 0xffee55 : 0xff5555;

      // Main fill
      this.hpBarGfx.fillStyle(fillColor, 1);
      this.hpBarGfx.fillRect(bx, by, fillW, barH);

      // 1px bright top highlight strip for a subtle 3-D bevel look
      this.hpBarGfx.fillStyle(hlColor, 0.5);
      this.hpBarGfx.fillRect(bx, by, fillW, 1);
    }
  }

  updateHpMana(hp: number, _mana: number) {
    this.drawHpBar(Math.max(0, hp / this.maxHp));
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

    const wx = this.renderX;
    const wy = this.renderY;
    this.meditationEmitter?.setPosition(wx, wy);
    for (const [name, emitter] of this.statusEmitters) {
      emitter.setPosition(wx, wy + (STATUS_EMITTER_OFFSETS[name] ?? 0));
    }
    this.invulnEmitter?.setPosition(wx, wy);
  }

  showSpeakingIndicator(visible: boolean) {
    this.speakingIcon.setVisible(visible);
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
      ...GAME_TEXT_STYLE,
      color: "#ffffff",
      shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 4, fill: true },
      wordWrap: { width: 110 },
      align: "center",
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
    this.meditationEmitter?.destroy();
    for (const emitter of this.statusEmitters.values()) emitter.destroy();
    this.statusEmitters.clear();
    this.invulnEmitter?.destroy();
    this.invulnRingTween?.stop();
    this.tintTween?.stop();
    // Pass `true` so Phaser also destroys all container children (bodySprite,
    // headSprite, weaponSprite, nameText, hpBarGfx, speakingIcon, etc.).
    // Without this, those objects remain on the display list and run every frame,
    // causing the "1072 sprites" display-list leak that tanks performance.
    this.container.destroy(true);
  }
}
