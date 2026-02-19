import Phaser from "phaser";
import { TILE_SIZE } from "@abraxas/shared";
import type { SpriteManager } from "./SpriteManager";

type BurstConfig = {
  colors: number[];
  count: number;
  speed: { min: number; max: number };
  scale: { start: number; end: number };
  lifespan: { min: number; max: number };
  angle?: { min: number; max: number };
  /** Positive = fall, negative = float up. */
  gravityY?: number;
  /** Spawn radius around the origin. */
  radius?: number;
  /** Blend mode. Defaults to ADD (1). */
  blendMode?: number;
};

// ── Spell effect library ─────────────────────────────────────────────────────

const FX: Record<string, BurstConfig> = {
  // ── Warrior ────────────────────────────────────────────────────────────────
  war_cry: {
    colors: [0xffaa00, 0xff7700, 0xff4400],
    count: 28, speed: { min: 80, max: 180 },
    scale: { start: 0.7, end: 0 }, lifespan: { min: 400, max: 750 }, radius: 14,
  },
  shield_bash: {
    colors: [0xffffff, 0xaaccff, 0x6688cc],
    count: 18, speed: { min: 80, max: 150 },
    scale: { start: 0.6, end: 0 }, lifespan: { min: 200, max: 420 },
    angle: { min: -40, max: 40 },
  },
  whirlwind: {
    colors: [0x88ff44, 0x44cc44, 0xffff44, 0xffffff],
    count: 36, speed: { min: 100, max: 220 },
    scale: { start: 0.55, end: 0 }, lifespan: { min: 450, max: 850 }, radius: 28,
  },
  battle_shout: {
    colors: [0xff8800, 0xffcc00, 0xffff00],
    count: 24, speed: { min: 60, max: 130 },
    scale: { start: 0.6, end: 0 }, lifespan: { min: 350, max: 650 }, radius: 22,
  },

  // ── Mage ───────────────────────────────────────────────────────────────────
  fireball: {
    colors: [0xff2200, 0xff7700, 0xffcc00, 0xffee88],
    count: 40, speed: { min: 90, max: 200 },
    scale: { start: 1.0, end: 0 }, lifespan: { min: 450, max: 850 },
    gravityY: -50, radius: 6,
  },
  ice_bolt: {
    colors: [0x88ddff, 0x44aaff, 0xccffff, 0xffffff],
    count: 24, speed: { min: 50, max: 120 },
    scale: { start: 0.55, end: 0 }, lifespan: { min: 350, max: 650 },
  },
  thunderstorm: {
    colors: [0xffff44, 0xffffff, 0xddddff, 0xaaaaff],
    count: 45, speed: { min: 130, max: 260 },
    scale: { start: 0.45, end: 0 }, lifespan: { min: 200, max: 500 },
    angle: { min: 55, max: 125 }, radius: 36,
  },
  mana_shield: {
    colors: [0x4488ff, 0x88aaff, 0xccddff, 0xffffff],
    count: 30, speed: { min: 40, max: 90 },
    scale: { start: 0.4, end: 0 }, lifespan: { min: 450, max: 900 },
    gravityY: -25, radius: 22,
  },
  frost_nova: {
    colors: [0x44ccff, 0x88eeff, 0xffffff, 0xaaddff],
    count: 45, speed: { min: 110, max: 220 },
    scale: { start: 0.6, end: 0 }, lifespan: { min: 400, max: 700 }, radius: 8,
  },
  arcane_surge: {
    colors: [0xcc44ff, 0xff44cc, 0xff88ff, 0xffffff],
    count: 50, speed: { min: 110, max: 260 },
    scale: { start: 0.8, end: 0 }, lifespan: { min: 450, max: 950 }, radius: 12,
  },

  // ── Ranger ─────────────────────────────────────────────────────────────────
  multi_shot: {
    colors: [0x88ff44, 0x44cc44, 0xffee44, 0xffffff],
    count: 18, speed: { min: 90, max: 170 },
    scale: { start: 0.4, end: 0 }, lifespan: { min: 250, max: 500 },
    angle: { min: -65, max: 65 },
  },
  poison_arrow: {
    colors: [0x44ff44, 0x007700, 0x88ff00, 0x33cc00],
    count: 22, speed: { min: 20, max: 65 },
    scale: { start: 0.55, end: 0 }, lifespan: { min: 450, max: 950 },
    gravityY: 70, radius: 8,
  },
  evasion: {
    colors: [0xffffff, 0xccddff, 0x88aaff, 0xaaffee],
    count: 18, speed: { min: 30, max: 80 },
    scale: { start: 0.35, end: 0 }, lifespan: { min: 350, max: 750 },
    gravityY: -35, radius: 18,
  },
  aimed_shot: {
    colors: [0xff8800, 0xffcc44, 0xffffff],
    count: 22, speed: { min: 90, max: 180 },
    scale: { start: 0.5, end: 0 }, lifespan: { min: 250, max: 550 },
    angle: { min: 150, max: 210 },
  },
  mark_target: {
    colors: [0xff4444, 0xcc00cc, 0xff88cc, 0xffaaaa],
    count: 18, speed: { min: 30, max: 80 },
    scale: { start: 0.45, end: 0 }, lifespan: { min: 450, max: 850 },
    gravityY: -25, radius: 14,
  },

  // ── Rogue ──────────────────────────────────────────────────────────────────
  backstab: {
    colors: [0xff2222, 0xcc0000, 0xff8844, 0xffffff],
    count: 22, speed: { min: 70, max: 140 },
    scale: { start: 0.6, end: 0 }, lifespan: { min: 200, max: 450 },
    angle: { min: -70, max: 70 },
  },
  stealth: {
    colors: [0x888888, 0xaaaaaa, 0x444466, 0x222244],
    count: 22, speed: { min: 10, max: 35 },
    scale: { start: 0.7, end: 0 }, lifespan: { min: 550, max: 1100 },
    gravityY: -22, radius: 20, blendMode: 0,
  },
  envenom: {
    colors: [0x44ff44, 0x007700, 0xaaff22, 0x33cc00],
    count: 24, speed: { min: 20, max: 65 },
    scale: { start: 0.5, end: 0 }, lifespan: { min: 450, max: 950 },
    gravityY: 55, radius: 10,
  },
  smoke_bomb: {
    colors: [0x555555, 0x333344, 0x222255, 0x444444],
    count: 35, speed: { min: 30, max: 90 },
    scale: { start: 0.9, end: 0 }, lifespan: { min: 550, max: 1300 },
    gravityY: -12, radius: 18, blendMode: 0,
  },
  hemorrhage: {
    colors: [0xcc0000, 0x880000, 0xff4422, 0xff8866],
    count: 28, speed: { min: 30, max: 90 },
    scale: { start: 0.6, end: 0 }, lifespan: { min: 350, max: 750 },
    gravityY: 90, radius: 8,
  },

  // ── Cleric ─────────────────────────────────────────────────────────────────
  holy_strike: {
    colors: [0xffee44, 0xffcc00, 0xffffff, 0xffffaa],
    count: 26, speed: { min: 70, max: 150 },
    scale: { start: 0.6, end: 0 }, lifespan: { min: 320, max: 620 },
  },
  heal: {
    colors: [0x44ff88, 0x22cc66, 0x88ffcc, 0xffffff],
    count: 24, speed: { min: 20, max: 65 },
    scale: { start: 0.55, end: 0 }, lifespan: { min: 550, max: 1100 },
    gravityY: -55, radius: 18,
  },
  divine_shield: {
    colors: [0xffffff, 0xffffcc, 0xffee88, 0xf0d080],
    count: 32, speed: { min: 65, max: 130 },
    scale: { start: 0.55, end: 0 }, lifespan: { min: 450, max: 850 }, radius: 22,
  },
  holy_nova: {
    colors: [0xffffff, 0xffffaa, 0xffcc44, 0xffeedd],
    count: 50, speed: { min: 110, max: 220 },
    scale: { start: 0.65, end: 0 }, lifespan: { min: 450, max: 850 }, radius: 8,
  },
  curse: {
    colors: [0xcc44ff, 0x880088, 0x4400aa, 0xff44ff],
    count: 24, speed: { min: 30, max: 90 },
    scale: { start: 0.55, end: 0 }, lifespan: { min: 450, max: 950 },
    gravityY: -35, radius: 14,
  },
  smite: {
    colors: [0xffff44, 0xffcc00, 0xffffff, 0xff8800],
    count: 32, speed: { min: 110, max: 220 },
    scale: { start: 0.6, end: 0 }, lifespan: { min: 300, max: 600 },
    angle: { min: 55, max: 125 },
  },
};

const DEFAULT_FX: BurstConfig = {
  colors: [0xffffff, 0xaaaaff],
  count: 16, speed: { min: 40, max: 100 },
  scale: { start: 0.5, end: 0 }, lifespan: { min: 300, max: 600 },
};

const MELEE_HIT_FX: BurstConfig = {
  colors: [0xff4444, 0xff8844, 0xffcc88, 0xffffff],
  count: 14, speed: { min: 50, max: 110 },
  scale: { start: 0.55, end: 0 }, lifespan: { min: 150, max: 380 },
  angle: { min: -50, max: 50 },
};

// ── EffectManager ─────────────────────────────────────────────────────────────

export class EffectManager {
  /** Shared particle dot texture key. Generated once on first use. */
  private static readonly TEXTURE = "fx-dot";

  constructor(
    private scene: Phaser.Scene,
    private spriteManager: SpriteManager,
  ) {}

  /** Generates the shared particle dot texture if it doesn't already exist. */
  private ensureTexture() {
    if (this.scene.textures.exists(EffectManager.TEXTURE)) return;
    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(5, 5, 5);
    gfx.generateTexture(EffectManager.TEXTURE, 10, 10);
    gfx.destroy();
  }

  /** Plays a particle burst for a spell effect at a world tile position. */
  playSpellEffect(spellId: string, targetTileX: number, targetTileY: number) {
    this.ensureTexture();
    const cfg = FX[spellId] ?? DEFAULT_FX;
    const px = targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const py = targetTileY * TILE_SIZE + TILE_SIZE / 2;
    this.burst(px, py, cfg);
  }

  /** Plays a melee impact burst at a sprite's current world position. */
  playMeleeHit(targetSessionId: string | null) {
    if (!targetSessionId) return;
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    this.ensureTexture();
    this.burst(sprite.renderX, sprite.renderY - TILE_SIZE / 2, MELEE_HIT_FX);
  }

  showDamage(targetSessionId: string, amount: number, type: "physical" | "magic" | "dot") {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    const color = type === "magic" ? "#bb44ff" : type === "dot" ? "#44cc44" : "#ff4444";
    this.floatText(sprite.renderX, sprite.renderY - 30, `-${amount}`, color, "14px");
  }

  showHeal(targetSessionId: string, amount: number) {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    this.floatText(sprite.renderX, sprite.renderY - 30, `+${amount}`, "#33cc33", "14px");
  }

  showFloatingText(sessionId: string, text: string, color: string) {
    const sprite = this.spriteManager.getSprite(sessionId);
    if (!sprite) return;
    this.floatText(sprite.renderX, sprite.renderY - 40, text, color, "12px");
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private burst(px: number, py: number, cfg: BurstConfig) {
    const maxLife = cfg.lifespan.max;
    const emitter = this.scene.add.particles(px, py, EffectManager.TEXTURE, {
      speed: cfg.speed,
      scale: cfg.scale,
      lifespan: cfg.lifespan,
      angle: cfg.angle ?? { min: 0, max: 360 },
      tint: cfg.colors,
      gravityY: cfg.gravityY ?? 0,
      x: cfg.radius ? { min: -cfg.radius, max: cfg.radius } : 0,
      y: cfg.radius ? { min: -cfg.radius, max: cfg.radius } : 0,
      blendMode: cfg.blendMode ?? Phaser.BlendModes.ADD,
      alpha: { start: 1, end: 0 },
    });
    emitter.setDepth(15);
    emitter.explode(cfg.count);
    this.scene.time.delayedCall(maxLife + 100, () => emitter.destroy());
  }

  private floatText(x: number, y: number, content: string, color: string, fontSize: string) {
    const text = this.scene.add
      .text(x, y, content, {
        fontSize, color,
        fontFamily: "'Friz Quadrata', Georgia, serif",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 1200,
      ease: "Power1",
      onComplete: () => text.destroy(),
    });
  }
}
