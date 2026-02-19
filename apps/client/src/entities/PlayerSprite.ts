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
import { FONTS } from "../ui/tokens";

const DIR_NAME_MAP: Record<number, "down" | "up" | "left" | "right"> = {
  [Direction.DOWN]: "down",
  [Direction.UP]: "up",
  [Direction.LEFT]: "left",
  [Direction.RIGHT]: "right",
};

const GAME_TEXT_STYLE = {
  fontFamily: FONTS.display,
  fontSize: "13px",
  shadow: { offsetX: 1, offsetY: 1, color: "#000000", blur: 3, fill: true },
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

  private meditationEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private isMeditating: boolean = false;

  // ── Status-effect persistent visuals ───────────────────────────────────────
  /** Stars spinning above the head while stunned. */
  private stunEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Green drips while a DoT / poison is active. */
  private poisonEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Golden shimmer while a buff is active. */
  private buffEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Purple smoke while a debuff is active. */
  private debuffEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** Glowing ring + white sparkles while invulnerable. */
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
  ) {
    this.sessionId = sessionId;
    this.classType = classType;
    this.isLocal = isLocal;

    const stats = CLASS_STATS[classType] || (NPC_STATS as Record<string, typeof NPC_STATS[keyof typeof NPC_STATS]>)[classType];
    if (!stats) {
      console.warn(`No stats found for class/type: ${classType}, defaulting to warrior`);
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
    this.bodySprite = scene.add.sprite(0, TILE_SIZE / 2, `ao-${bodyStatic.grafico}`, `grh-${bodyStatic.id}`);
    this.bodySprite.setOrigin(0.5, 1);

    if (this.headEntry) {
      const headGrhId = this.headEntry.down;
      const headStatic = this.resolver.resolveStaticGrh(headGrhId);
      if (headStatic) {
        this.headSprite = scene.add.sprite(0, 0, `ao-${headStatic.grafico}`, `grh-${headStatic.id}`);
        this.headSprite.setOrigin(0.5, 0);
      }
    }
    this.updateHeadPosition();

    this.nameText = scene.add.text(0, TILE_SIZE / 2 + 6, name, {
      ...GAME_TEXT_STYLE,
      color: isLocal ? "#ffffff" : "#cccccc",
    });
    this.nameText.setOrigin(0.5, 0);

    const barWidth = TILE_SIZE - 6;
    this.hpBarBg = scene.add.rectangle(0, TILE_SIZE / 2 + 2, barWidth, 3, 0x333333);
    this.hpBar = scene.add.rectangle(0, TILE_SIZE / 2 + 2, barWidth, 3, 0x33cc33);
    this.hpBarBg.setVisible(false);
    this.hpBar.setVisible(false);

    this.speakingIcon = scene.add.text(0, -45, "🎤", { fontSize: "16px" });
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
    this.container.on("pointerover", () => { this.hpBarBg.setVisible(true); this.hpBar.setVisible(true); });
    this.container.on("pointerout", () => { this.hpBarBg.setVisible(false); this.hpBar.setVisible(false); });

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
    this.applyStaticEquipmentFrame(this.weaponSprite, this.curWeaponAoId, (id) => this.resolver.getWeaponEntry(id));
    this.applyStaticEquipmentFrame(this.shieldSprite, this.curShieldAoId, (id) => this.resolver.getShieldEntry(id));
    this.applyStaticEquipmentFrame(this.helmetSprite, this.curHelmetAoId, (id) => this.resolver.getHelmetEntry(id));
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
    this.applyStaticEquipmentFrame(this.helmetSprite, this.curHelmetAoId, (id) => this.resolver.getHelmetEntry(id));
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
    } else {
      this.setIdleFrame();
    }
  }

  /** Update equipment visuals based on item IDs from server. Pass empty string for an empty slot. */
  updateEquipment(weaponItemId: string, shieldItemId: string, helmetItemId: string) {
    const newWeaponAoId = weaponItemId ? (ITEMS[weaponItemId]?.aoWeaponId ?? 0) : 0;
    const newShieldAoId = shieldItemId ? (ITEMS[shieldItemId]?.aoShieldId ?? 0) : 0;
    const newHelmetAoId = helmetItemId ? (ITEMS[helmetItemId]?.aoHelmetId ?? 0) : 0;

    if (newWeaponAoId !== this.curWeaponAoId) {
      this.curWeaponAoId = newWeaponAoId;
      this.weaponSprite = this.replaceEquipmentSprite(
        this.weaponSprite, newWeaponAoId,
        (id) => this.resolver.getWeaponEntry(id),
        "weapon", TILE_SIZE / 2, 1,
      );
    }

    if (newShieldAoId !== this.curShieldAoId) {
      this.curShieldAoId = newShieldAoId;
      this.shieldSprite = this.replaceEquipmentSprite(
        this.shieldSprite, newShieldAoId,
        (id) => this.resolver.getShieldEntry(id),
        "shield", TILE_SIZE / 2, 1,
      );
    }

    if (newHelmetAoId !== this.curHelmetAoId) {
      this.curHelmetAoId = newHelmetAoId;
      this.helmetSprite = this.replaceEquipmentSprite(
        this.helmetSprite, newHelmetAoId,
        (id) => this.resolver.getHelmetEntry(id),
        null, 0, 0,
      );
      if (newHelmetAoId) this.updateHeadPosition();
    }

    this.updateZOrder();
  }

  // ── Status effect API ─────────────────────────────────────────────────────

  /** Ensures a small star texture exists (shared by stun + holy bursts). */
  private ensureStatusTextures(scene: Phaser.Scene) {
    if (!scene.textures.exists("status-star")) {
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      const cx = 8, cy = 8, outer = 7, inner = 2.5;
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
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
      g.generateTexture("status-dot", 8, 8);
      g.destroy();
    }
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
    const scene = this.container.scene;
    if (!scene || this.stunEmitter) return;
    this.ensureStatusTextures(scene);

    this.stunEmitter = scene.add.particles(
      this.renderX, this.renderY - TILE_SIZE * 1.4,
      "status-star",
      {
        tint: [0xffff00, 0xffcc00, 0xffffff],
        speed: { min: 18, max: 42 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.55, end: 0.15 },
        alpha: { start: 1, end: 0.4 },
        lifespan: { min: 650, max: 1050 },
        quantity: 1,
        frequency: 95,
        rotate: { start: 0, end: 720 },
      },
    );
    this.stunEmitter.setDepth(this.container.depth + 3);

    this.activeStatusTints.add("stun");
    this.refreshTint();
    scene.time.delayedCall(durationMs, () => this.clearStun());
  }

  clearStun() {
    this.stunEmitter?.destroy();
    this.stunEmitter = null;
    this.activeStatusTints.delete("stun");
    this.refreshTint();
  }

  // ── applyPoison / clearPoison ─────────────────────────────────────────────

  applyPoison(durationMs: number) {
    const scene = this.container.scene;
    if (!scene || this.poisonEmitter) return;
    this.ensureStatusTextures(scene);

    this.poisonEmitter = scene.add.particles(
      this.renderX, this.renderY - TILE_SIZE * 0.2,
      "status-dot",
      {
        tint: [0x44ff44, 0x007700, 0x88ff00, 0x33cc00],
        speed: { min: 8, max: 24 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.45, end: 0 },
        alpha: { start: 0.9, end: 0 },
        lifespan: { min: 700, max: 1200 },
        quantity: 1,
        frequency: 80,
        gravityY: 60,
        x: { min: -10, max: 10 },
      },
    );
    this.poisonEmitter.setDepth(this.container.depth + 2);

    this.activeStatusTints.add("poison");
    this.refreshTint();
    scene.time.delayedCall(durationMs, () => this.clearPoison());
  }

  clearPoison() {
    this.poisonEmitter?.destroy();
    this.poisonEmitter = null;
    this.activeStatusTints.delete("poison");
    this.refreshTint();
  }

  // ── applyBuff / clearBuff ─────────────────────────────────────────────────

  applyBuff(durationMs: number) {
    const scene = this.container.scene;
    if (!scene || this.buffEmitter) return;
    this.ensureStatusTextures(scene);

    this.buffEmitter = scene.add.particles(
      this.renderX, this.renderY,
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
    );
    this.buffEmitter.setDepth(this.container.depth + 2);

    this.activeStatusTints.add("buff");
    this.refreshTint();
    scene.time.delayedCall(durationMs, () => this.clearBuff());
  }

  clearBuff() {
    this.buffEmitter?.destroy();
    this.buffEmitter = null;
    this.activeStatusTints.delete("buff");
    this.refreshTint();
  }

  // ── applyDebuff / clearDebuff ─────────────────────────────────────────────

  applyDebuff(durationMs: number) {
    const scene = this.container.scene;
    if (!scene || this.debuffEmitter) return;
    this.ensureStatusTextures(scene);

    this.debuffEmitter = scene.add.particles(
      this.renderX, this.renderY,
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
    );
    this.debuffEmitter.setDepth(this.container.depth + 1);

    this.activeStatusTints.add("debuff");
    this.refreshTint();
    scene.time.delayedCall(durationMs, () => this.clearDebuff());
  }

  clearDebuff() {
    this.debuffEmitter?.destroy();
    this.debuffEmitter = null;
    this.activeStatusTints.delete("debuff");
    this.refreshTint();
  }

  // ── applyInvulnerable / clearInvulnerable ─────────────────────────────────

  applyInvulnerable(durationMs: number) {
    const scene = this.container.scene;
    if (!scene || this.invulnRing) return;
    this.ensureStatusTextures(scene);

    // Rotating halo ring inside the container
    const ring = scene.add.graphics();
    ring.lineStyle(3, 0xffffff, 0.85);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    // Slightly flattened ellipse for a 3-D-halo feel
    ring.strokeEllipse(0, -TILE_SIZE * 0.35, TILE_SIZE * 1.55, TILE_SIZE * 0.45);
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

    // Orbiting white sparkles (world-space emitter)
    this.invulnEmitter = scene.add.particles(
      this.renderX, this.renderY,
      "status-star",
      {
        tint: [0xffffff, 0xeef8ff, 0xffee88],
        speed: { min: 15, max: 38 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.38, end: 0 },
        alpha: { start: 0.9, end: 0 },
        lifespan: { min: 500, max: 850 },
        quantity: 1,
        frequency: 85,
        gravityY: -18,
        x: { min: -TILE_SIZE * 0.6, max: TILE_SIZE * 0.6 },
        rotate: { start: 0, end: 360 },
      },
    );
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

  // ── Meditation texture helper (unchanged position in file) ─────────────────

  private ensureFireTexture(scene: Phaser.Scene) {
    if (scene.textures.exists("meditation-fire")) return;
    const gfx = scene.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(6, 6, 6);
    gfx.generateTexture("meditation-fire", 12, 12);
    gfx.destroy();
  }

  setMeditating(meditating: boolean) {
    const scene = this.container.scene;
    if (!scene || meditating === this.isMeditating) return;
    this.isMeditating = meditating;

    if (meditating) {
      this.ensureFireTexture(scene);
      this.meditationEmitter = scene.add.particles(
        this.renderX,
        this.renderY,
        "meditation-fire",
        {
          x: { min: -8, max: 8 },
          y: { min: -TILE_SIZE * 1.1, max: -TILE_SIZE * 0.1 },
          scale: { start: 0.55, end: 0 },
          alpha: { start: 0.9, end: 0 },
          tint: [0xff2200, 0xff6600, 0xffaa00, 0xffdd00],
          speed: { min: 12, max: 30 },
          angle: { min: 260, max: 280 },
          lifespan: { min: 450, max: 850 },
          quantity: 3,
          frequency: 45,
        },
      );
      this.meditationEmitter.setDepth(this.container.depth + 2);
    } else if (this.meditationEmitter) {
      this.meditationEmitter.destroy();
      this.meditationEmitter = null;
    }
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

    const wx = this.renderX;
    const wy = this.renderY;
    if (this.meditationEmitter)  this.meditationEmitter.setPosition(wx, wy);
    if (this.stunEmitter)        this.stunEmitter.setPosition(wx, wy - TILE_SIZE * 1.4);
    if (this.poisonEmitter)      this.poisonEmitter.setPosition(wx, wy - TILE_SIZE * 0.2);
    if (this.buffEmitter)        this.buffEmitter.setPosition(wx, wy);
    if (this.debuffEmitter)      this.debuffEmitter.setPosition(wx, wy);
    if (this.invulnEmitter)      this.invulnEmitter.setPosition(wx, wy);
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
    this.meditationEmitter = null;
    this.stunEmitter?.destroy();
    this.poisonEmitter?.destroy();
    this.buffEmitter?.destroy();
    this.debuffEmitter?.destroy();
    this.invulnEmitter?.destroy();
    this.invulnRingTween?.stop();
    this.tintTween?.stop();
    this.container.destroy();
  }
}
