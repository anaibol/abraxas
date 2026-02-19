import Phaser from "phaser";
import { TILE_SIZE } from "@abraxas/shared";
import type { SpriteManager } from "./SpriteManager";
import { FONTS } from "../ui/tokens";

// ── Particle burst configuration ─────────────────────────────────────────────

type BurstConfig = {
  colors: number[];
  count: number;
  speed: { min: number; max: number };
  scale: { start: number; end: number };
  lifespan: { min: number; max: number };
  angle?: { min: number; max: number };
  gravityY?: number;
  radius?: number;
  blendMode?: number;
  rotate?: { start: number; end: number };
  alpha?: { start: number; end: number };
};

// ── Procedural texture keys ───────────────────────────────────────────────────

const TEX = {
  CIRCLE: "fx-circle",   // soft radial-gradient glowing circle  (16×16)
  STAR:   "fx-star",     // 4-point star — holy, stun, buffs     (16×16)
  SHARD:  "fx-shard",    // elongated diamond — ice, lightning    (12×6)
  SMOKE:  "fx-smoke",    // large fuzzy blob — smoke, aoe clouds  (32×32)
  SPARK:  "fx-spark",    // tiny pixel — electricity, embers      (4×4)
  RING:   "fx-ring",     // thin circle outline — orbiting rings  (16×16)
} as const;

// ── EffectManager ─────────────────────────────────────────────────────────────

export class EffectManager {
  private texturesReady = false;

  constructor(
    private scene: Phaser.Scene,
    private spriteManager: SpriteManager,
  ) {}

  // ── Texture generation ────────────────────────────────────────────────────

  private ensureTextures() {
    if (this.texturesReady) return;
    this.texturesReady = true;

    // fx-circle — soft radial glow: bright centre fading to transparent edge
    if (!this.scene.textures.exists(TEX.CIRCLE)) {
      const g = this.scene.add.graphics();
      for (let r = 8; r >= 1; r--) {
        g.fillStyle(0xffffff, 1 - (r - 1) / 8);
        g.fillCircle(8, 8, r);
      }
      g.generateTexture(TEX.CIRCLE, 16, 16);
      g.destroy();
    }

    // fx-star — 4-point star shape
    if (!this.scene.textures.exists(TEX.STAR)) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      const outer = 7, inner = 2.5, cx = 8, cy = 8;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        pts.push(new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
      }
      g.fillPoints(pts, true);
      g.generateTexture(TEX.STAR, 16, 16);
      g.destroy();
    }

    // fx-shard — elongated diamond / ice crystal
    if (!this.scene.textures.exists(TEX.SHARD)) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillPoints(
        [new Phaser.Math.Vector2(6, 0), new Phaser.Math.Vector2(12, 3), new Phaser.Math.Vector2(6, 6), new Phaser.Math.Vector2(0, 3)],
        true,
      );
      g.generateTexture(TEX.SHARD, 12, 6);
      g.destroy();
    }

    // fx-smoke — large soft blob with inverse radial fade
    if (!this.scene.textures.exists(TEX.SMOKE)) {
      const g = this.scene.add.graphics();
      for (let r = 16; r >= 1; r--) {
        const a = Math.pow(1 - r / 16, 0.4) * 0.85;
        g.fillStyle(0xffffff, a);
        g.fillCircle(16, 16, r);
      }
      g.generateTexture(TEX.SMOKE, 32, 32);
      g.destroy();
    }

    // fx-spark — tiny bright 4×4 pixel
    if (!this.scene.textures.exists(TEX.SPARK)) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture(TEX.SPARK, 4, 4);
      g.destroy();
    }

    // fx-ring — thin circle outline particle (orbits / halos)
    if (!this.scene.textures.exists(TEX.RING)) {
      const g = this.scene.add.graphics();
      g.lineStyle(2, 0xffffff, 1);
      g.strokeCircle(8, 8, 6);
      g.generateTexture(TEX.RING, 16, 16);
      g.destroy();
    }
  }

  // ── Core drawing primitives ───────────────────────────────────────────────

  /** One-shot particle burst at world pixel position. */
  private burst(px: number, py: number, textureKey: string, cfg: BurstConfig) {
    const emitter = this.scene.add.particles(px, py, textureKey, {
      speed: cfg.speed,
      scale: cfg.scale,
      lifespan: cfg.lifespan,
      angle: cfg.angle ?? { min: 0, max: 360 },
      tint: cfg.colors,
      gravityY: cfg.gravityY ?? 0,
      x: cfg.radius ? { min: -cfg.radius, max: cfg.radius } : 0,
      y: cfg.radius ? { min: -cfg.radius, max: cfg.radius } : 0,
      blendMode: cfg.blendMode ?? Phaser.BlendModes.ADD,
      alpha: cfg.alpha ?? { start: 1, end: 0 },
      rotate: cfg.rotate,
    });
    emitter.setDepth(15);
    emitter.explode(cfg.count);
    this.scene.time.delayedCall(cfg.lifespan.max + 120, () => emitter.destroy());
  }

  /**
   * Animated expanding ring drawn with Graphics.
   * Starts at startRadius and expands to endRadius over durationMs, fading out.
   */
  private ring(
    px: number, py: number,
    color: number,
    startRadius: number, endRadius: number,
    durationMs: number,
    alpha = 0.85,
    lineWidth = 3,
  ) {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(14);
    const proxy = { t: 0 };
    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: durationMs,
      ease: "Cubic.Out",
      onUpdate: () => {
        const r = startRadius + (endRadius - startRadius) * proxy.t;
        const a = alpha * (1 - proxy.t);
        gfx.clear();
        gfx.lineStyle(lineWidth, color, a);
        gfx.strokeCircle(px, py, r);
      },
      onComplete: () => gfx.destroy(),
    });
  }

  /** Instant bright circle flash that quickly fades. */
  private flash(px: number, py: number, color: number, size: number, durationMs: number) {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(16);
    gfx.setBlendMode(Phaser.BlendModes.ADD);
    gfx.fillStyle(color, 0.9);
    gfx.fillCircle(px, py, size);
    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: durationMs,
      ease: "Power2.In",
      onComplete: () => gfx.destroy(),
    });
  }

  /**
   * Jagged lightning bolt drawn from (x, y−height) down to (x, y).
   * Two passes: outer glow + bright core.
   */
  private lightning(
    x: number, y: number,
    color = 0xffffff,
    height = 120,
    segments = 8,
  ) {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(16);
    gfx.setBlendMode(Phaser.BlendModes.ADD);

    const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(x, y - height)];
    for (let i = 1; i < segments; i++) {
      pts.push(new Phaser.Math.Vector2(
        x + Phaser.Math.Between(-24, 24),
        y - height + (height * i) / segments,
      ));
    }
    pts.push(new Phaser.Math.Vector2(x, y));

    gfx.lineStyle(6, color, 0.2);
    gfx.strokePoints(pts, false);
    gfx.lineStyle(2, color, 0.95);
    gfx.strokePoints(pts, false);

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 200,
      delay: 80,
      ease: "Power2.In",
      onComplete: () => gfx.destroy(),
    });
  }

  // ── Spell-specific effect functions ──────────────────────────────────────

  private fx_fireball(px: number, py: number) {
    this.flash(px, py, 0xffffff, 32, 80);
    this.ring(px, py, 0xff4400, 5, 55, 380, 0.9, 4);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff2200, 0xff7700, 0xffcc00, 0xffee88],
      count: 40, speed: { min: 80, max: 210 },
      scale: { start: 0.9, end: 0 }, lifespan: { min: 400, max: 820 },
      gravityY: -40, radius: 6,
    });
    this.scene.time.delayedCall(80, () => {
      this.burst(px, py, TEX.SPARK, {
        colors: [0xff6600, 0xffaa00, 0xffff44],
        count: 22, speed: { min: 30, max: 80 },
        scale: { start: 0.6, end: 0 }, lifespan: { min: 600, max: 1100 },
        gravityY: -65, radius: 20,
      });
    });
  }

  private fx_ice_bolt(px: number, py: number) {
    this.ring(px, py, 0x44ddff, 4, 40, 330, 0.85, 3);
    this.burst(px, py, TEX.SHARD, {
      colors: [0x88eeff, 0x44aaff, 0xccffff, 0xffffff],
      count: 22, speed: { min: 80, max: 190 },
      scale: { start: 0.7, end: 0 }, lifespan: { min: 300, max: 620 },
      rotate: { start: 0, end: 360 },
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0xaaeeff],
      count: 14, speed: { min: 15, max: 55 },
      scale: { start: 0.3, end: 0 }, lifespan: { min: 550, max: 950 },
      gravityY: -28, radius: 16,
    });
  }

  private fx_thunderstorm(px: number, py: number) {
    this.lightning(px, py, 0xffffff, 140, 9);
    this.scene.time.delayedCall(55, () => {
      this.lightning(px - 32, py, 0xddddff, 100, 6);
      this.lightning(px + 28, py, 0xddddff, 110, 7);
    });
    this.ring(px, py, 0xffff44, 5, 70, 440, 0.8, 5);
    this.flash(px, py, 0xffffff, 55, 110);
    this.burst(px, py, TEX.SPARK, {
      colors: [0xffffff, 0xffffaa, 0xaaaaff],
      count: 45, speed: { min: 80, max: 210 },
      scale: { start: 0.5, end: 0 }, lifespan: { min: 150, max: 420 },
      angle: { min: 50, max: 130 }, gravityY: 230, radius: 45,
    });
  }

  private fx_frost_nova(px: number, py: number) {
    this.ring(px, py, 0x44ccff, 5, 85, 580, 0.9, 5);
    this.scene.time.delayedCall(90, () => this.ring(px, py, 0xffffff, 5, 68, 480, 0.6, 2));
    this.burst(px, py, TEX.SHARD, {
      colors: [0x44ccff, 0x88eeff, 0xffffff, 0xaaddff],
      count: 36, speed: { min: 90, max: 210 },
      scale: { start: 0.65, end: 0 }, lifespan: { min: 380, max: 720 },
      rotate: { start: 0, end: 180 }, radius: 8,
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x88ddff, 0xffffff],
      count: 18, speed: { min: 15, max: 50 },
      scale: { start: 0.35, end: 0 }, lifespan: { min: 600, max: 1100 },
      gravityY: -28, radius: 44,
    });
  }

  private fx_arcane_surge(px: number, py: number) {
    this.flash(px, py, 0xff44ff, 60, 110);
    this.ring(px, py, 0xcc44ff, 5, 58, 400, 0.9, 5);
    this.scene.time.delayedCall(60, () => this.ring(px, py, 0xffffff, 5, 42, 310, 0.7, 2));
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xcc44ff, 0xff44cc, 0xff88ff, 0xffffff],
      count: 55, speed: { min: 100, max: 270 },
      scale: { start: 0.85, end: 0 }, lifespan: { min: 450, max: 960 }, radius: 12,
    });
    this.burst(px, py, TEX.STAR, {
      colors: [0xffffff, 0xcc88ff],
      count: 16, speed: { min: 30, max: 100 },
      scale: { start: 0.6, end: 0 }, lifespan: { min: 600, max: 1100 },
      rotate: { start: 0, end: 720 }, gravityY: -20, radius: 26,
    });
  }

  private fx_war_cry(px: number, py: number) {
    this.ring(px, py, 0xff8800, 5, 85, 620, 0.8, 5);
    this.scene.time.delayedCall(100, () => this.ring(px, py, 0xffcc00, 5, 60, 480, 0.5, 3));
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff8800, 0xffcc00, 0xffff00],
      count: 30, speed: { min: 60, max: 145 },
      scale: { start: 0.65, end: 0 }, lifespan: { min: 350, max: 720 }, radius: 22,
    });
  }

  private fx_whirlwind(px: number, py: number) {
    this.ring(px, py, 0x88ff44, 5, 55, 480, 0.7, 4);
    this.burst(px, py, TEX.SHARD, {
      colors: [0x88ff44, 0x44cc44, 0xffff44, 0xffffff],
      count: 32, speed: { min: 100, max: 240 },
      scale: { start: 0.5, end: 0 }, lifespan: { min: 450, max: 820 },
      rotate: { start: 0, end: 540 }, radius: 30,
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xccff88, 0xffffff],
      count: 20, speed: { min: 30, max: 80 },
      scale: { start: 0.35, end: 0 }, lifespan: { min: 400, max: 760 },
      gravityY: -25, radius: 24,
    });
  }

  private fx_shield_bash(px: number, py: number) {
    this.flash(px, py, 0xaaccff, 24, 80);
    this.burst(px, py, TEX.SPARK, {
      colors: [0xffffff, 0xaaccff, 0x6688cc],
      count: 22, speed: { min: 70, max: 170 },
      scale: { start: 0.5, end: 0 }, lifespan: { min: 180, max: 420 },
      angle: { min: -55, max: 55 },
    });
    // Stun stars pop up above the impact
    this.scene.time.delayedCall(90, () => {
      this.burst(px, py - TILE_SIZE, TEX.STAR, {
        colors: [0xffff00, 0xffcc00, 0xffffff],
        count: 7, speed: { min: 20, max: 55 },
        scale: { start: 0.6, end: 0.2 }, lifespan: { min: 700, max: 1000 },
        rotate: { start: 0, end: 720 }, gravityY: -15, radius: 16,
      });
    });
  }

  private fx_battle_shout(px: number, py: number) {
    this.flash(px, py, 0xff8800, 65, 130);
    this.ring(px, py, 0xff8800, 5, 105, 720, 0.78, 6);
    this.scene.time.delayedCall(120, () => this.ring(px, py, 0xffcc00, 5, 85, 580, 0.5, 3));
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff8800, 0xffcc00, 0xffff00],
      count: 30, speed: { min: 55, max: 135 },
      scale: { start: 0.62, end: 0 }, lifespan: { min: 400, max: 720 }, radius: 26,
    });
  }

  private fx_holy_nova(px: number, py: number) {
    this.ring(px, py, 0xffee44, 5, 90, 680, 0.9, 5);
    this.scene.time.delayedCall(80, () => this.ring(px, py, 0xffffff, 5, 74, 570, 0.7, 3));
    this.scene.time.delayedCall(160, () => this.ring(px, py, 0xffcc88, 5, 58, 460, 0.5, 2));
    this.burst(px, py, TEX.STAR, {
      colors: [0xffffff, 0xffffaa, 0xffcc44],
      count: 36, speed: { min: 80, max: 210 },
      scale: { start: 0.65, end: 0 }, lifespan: { min: 500, max: 920 },
      rotate: { start: 0, end: 360 }, radius: 10,
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0xffffa0],
      count: 24, speed: { min: 20, max: 60 },
      scale: { start: 0.45, end: 0 }, lifespan: { min: 650, max: 1200 },
      gravityY: -65, radius: 55,
    });
  }

  private fx_heal(px: number, py: number) {
    this.ring(px, py, 0x44ff88, 5, 40, 400, 0.8, 3);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x44ff88, 0x22cc66, 0x88ffcc, 0xffffff],
      count: 24, speed: { min: 15, max: 60 },
      scale: { start: 0.55, end: 0 }, lifespan: { min: 550, max: 1120 },
      gravityY: -62, radius: 18,
    });
    this.burst(px, py, TEX.STAR, {
      colors: [0xffffff, 0xaaffcc],
      count: 9, speed: { min: 20, max: 55 },
      scale: { start: 0.5, end: 0 }, lifespan: { min: 650, max: 1050 },
      rotate: { start: 0, end: 360 }, gravityY: -45, radius: 22,
    });
  }

  private fx_divine_shield(px: number, py: number) {
    this.flash(px, py, 0xffffff, 50, 160);
    this.ring(px, py, 0xffffff, 5, 60, 470, 0.9, 5);
    this.scene.time.delayedCall(100, () => this.ring(px, py, 0xffee88, 5, 50, 570, 0.7, 3));
    this.burst(px, py, TEX.STAR, {
      colors: [0xffffff, 0xffffee, 0xffee88],
      count: 28, speed: { min: 55, max: 135 },
      scale: { start: 0.6, end: 0 }, lifespan: { min: 450, max: 860 },
      rotate: { start: 0, end: 540 }, radius: 24,
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0xffffcc],
      count: 20, speed: { min: 20, max: 62 },
      scale: { start: 0.4, end: 0 }, lifespan: { min: 600, max: 1120 },
      gravityY: -42, radius: 30,
    });
  }

  private fx_smoke_bomb(px: number, py: number) {
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x555566, 0x333344, 0x222255, 0x444455],
      count: 32, speed: { min: 30, max: 90 },
      scale: { start: 1.2, end: 0.3 }, lifespan: { min: 650, max: 1450 },
      gravityY: -10, radius: 24, blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.7, end: 0 },
    });
    this.ring(px, py, 0x8888aa, 5, 55, 420, 0.6, 3);
    // Stun stars inside the cloud
    this.scene.time.delayedCall(100, () => {
      this.burst(px, py, TEX.STAR, {
        colors: [0xffffaa, 0xffcc00],
        count: 10, speed: { min: 30, max: 75 },
        scale: { start: 0.5, end: 0 }, lifespan: { min: 500, max: 900 },
        rotate: { start: 0, end: 720 }, gravityY: -20, radius: 32,
      });
    });
  }

  private fx_hemorrhage(px: number, py: number) {
    this.ring(px, py, 0xcc0000, 5, 30, 310, 0.8, 3);
    // Blood drops dripping down
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xcc0000, 0x880000, 0xff4422],
      count: 26, speed: { min: 25, max: 85 },
      scale: { start: 0.65, end: 0 }, lifespan: { min: 350, max: 760 },
      gravityY: 105, radius: 8,
    });
    // Life sparks rising up to caster (drained life)
    this.burst(px, py, TEX.SPARK, {
      colors: [0xff2244, 0xff6688, 0xff88aa],
      count: 14, speed: { min: 20, max: 58 },
      scale: { start: 0.5, end: 0 }, lifespan: { min: 500, max: 920 },
      gravityY: -72, radius: 14,
    });
  }

  private fx_backstab(px: number, py: number) {
    this.flash(px, py, 0xff0000, 28, 80);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff2222, 0xcc0000, 0xff8844, 0xffffff],
      count: 24, speed: { min: 70, max: 165 },
      scale: { start: 0.6, end: 0 }, lifespan: { min: 200, max: 460 },
      angle: { min: -70, max: 70 },
    });
  }

  private fx_stealth(px: number, py: number) {
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x888888, 0xaaaaaa, 0x444466, 0x222244],
      count: 26, speed: { min: 10, max: 40 },
      scale: { start: 0.85, end: 0 }, lifespan: { min: 650, max: 1250 },
      gravityY: -16, radius: 24, blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.62, end: 0 },
    });
    this.burst(px, py, TEX.STAR, {
      colors: [0x8888cc, 0x4444aa, 0xffffff],
      count: 12, speed: { min: 15, max: 48 },
      scale: { start: 0.45, end: 0 }, lifespan: { min: 500, max: 1050 },
      rotate: { start: 0, end: 360 }, gravityY: -28, radius: 20,
      blendMode: Phaser.BlendModes.NORMAL,
    });
  }

  private fx_poison(px: number, py: number) {
    this.ring(px, py, 0x44cc00, 4, 32, 370, 0.8, 3);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x44ff44, 0x007700, 0x88ff00, 0x33cc00],
      count: 24, speed: { min: 20, max: 68 },
      scale: { start: 0.55, end: 0 }, lifespan: { min: 450, max: 970 },
      gravityY: 78, radius: 8,
    });
  }

  private fx_holy_strike(px: number, py: number) {
    this.flash(px, py, 0xffee44, 24, 80);
    this.ring(px, py, 0xffcc00, 5, 30, 310, 0.75, 3);
    this.burst(px, py, TEX.STAR, {
      colors: [0xffee44, 0xffcc00, 0xffffff, 0xffffaa],
      count: 20, speed: { min: 60, max: 145 },
      scale: { start: 0.55, end: 0 }, lifespan: { min: 300, max: 620 },
      rotate: { start: 0, end: 360 },
    });
  }

  private fx_smite(px: number, py: number) {
    this.lightning(px, py, 0xffff88, 105, 6);
    this.ring(px, py, 0xffee44, 5, 38, 330, 0.85, 3);
    this.burst(px, py, TEX.STAR, {
      colors: [0xffff44, 0xffcc00, 0xffffff],
      count: 22, speed: { min: 90, max: 210 },
      scale: { start: 0.55, end: 0 }, lifespan: { min: 250, max: 560 },
      angle: { min: 50, max: 130 }, rotate: { start: 0, end: 360 },
    });
  }

  private fx_curse(px: number, py: number) {
    this.ring(px, py, 0x8800cc, 5, 48, 520, 0.85, 4);
    this.burst(px, py, TEX.SMOKE, {
      colors: [0xcc44ff, 0x880088, 0x4400aa],
      count: 20, speed: { min: 15, max: 58 },
      scale: { start: 0.7, end: 0 }, lifespan: { min: 500, max: 1060 },
      gravityY: -32, radius: 14, blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.65, end: 0 },
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x8844ff, 0xff44ff],
      count: 14, speed: { min: 30, max: 90 },
      scale: { start: 0.45, end: 0 }, lifespan: { min: 450, max: 920 },
      gravityY: -36, radius: 16,
    });
  }

  private fx_mark_target(px: number, py: number) {
    this.ring(px, py, 0xff3333, 5, 38, 420, 0.85, 3);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff4444, 0xcc00cc, 0xff88cc],
      count: 18, speed: { min: 25, max: 78 },
      scale: { start: 0.45, end: 0 }, lifespan: { min: 500, max: 920 },
      gravityY: -28, radius: 14,
    });
  }

  private fx_mana_shield(px: number, py: number) {
    this.ring(px, py, 0x4488ff, 5, 42, 440, 0.85, 4);
    this.burst(px, py, TEX.RING, {
      colors: [0x4488ff, 0x88aaff, 0xccddff],
      count: 20, speed: { min: 30, max: 82 },
      scale: { start: 0.8, end: 0.3 }, lifespan: { min: 500, max: 960 },
      gravityY: -22, radius: 22, rotate: { start: 0, end: 180 },
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x88aaff, 0xffffff],
      count: 14, speed: { min: 20, max: 72 },
      scale: { start: 0.35, end: 0 }, lifespan: { min: 450, max: 860 },
      gravityY: -26, radius: 19,
    });
  }

  private fx_evasion(px: number, py: number) {
    // Four staggered speed-line bursts (wind blur effect)
    for (let i = 0; i < 4; i++) {
      this.scene.time.delayedCall(i * 55, () => {
        this.burst(
          px + Phaser.Math.Between(-22, 22),
          py + Phaser.Math.Between(-16, 16),
          TEX.SHARD,
          {
            colors: [0xffffff, 0xccddff, 0x88aaff],
            count: 5, speed: { min: 160, max: 290 },
            scale: { start: 0.7, end: 0 }, lifespan: { min: 150, max: 300 },
            angle: { min: 173, max: 187 },
          },
        );
      });
    }
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0xccddff, 0x88aaff, 0xaaffee],
      count: 18, speed: { min: 30, max: 82 },
      scale: { start: 0.4, end: 0 }, lifespan: { min: 350, max: 760 },
      gravityY: -36, radius: 20,
    });
  }

  private fx_aimed_shot(px: number, py: number) {
    this.ring(px, py, 0xff8800, 4, 34, 340, 0.8, 3);
    this.burst(px, py, TEX.SPARK, {
      colors: [0xff8800, 0xffcc44, 0xffffff],
      count: 20, speed: { min: 80, max: 190 },
      scale: { start: 0.6, end: 0 }, lifespan: { min: 200, max: 510 },
      angle: { min: 150, max: 210 },
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff8800, 0xffcc44],
      count: 12, speed: { min: 20, max: 62 },
      scale: { start: 0.4, end: 0 }, lifespan: { min: 300, max: 620 },
      gravityY: 32, radius: 13,
    });
  }

  private fx_multi_shot(px: number, py: number) {
    this.ring(px, py, 0x88ff44, 4, 37, 340, 0.75, 3);
    this.burst(px, py, TEX.SHARD, {
      colors: [0x88ff44, 0xffee44, 0xffffff],
      count: 22, speed: { min: 90, max: 190 },
      scale: { start: 0.5, end: 0 }, lifespan: { min: 250, max: 510 },
      angle: { min: -65, max: 65 }, rotate: { start: 0, end: 180 },
    });
  }

  private fx_enrage(px: number, py: number) {
    this.flash(px, py, 0xff4400, 44, 120);
    this.ring(px, py, 0xff4400, 5, 52, 460, 0.85, 4);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff2200, 0xff8800, 0xffcc00],
      count: 32, speed: { min: 70, max: 165 },
      scale: { start: 0.7, end: 0 }, lifespan: { min: 400, max: 820 }, radius: 20,
    });
  }

  private fx_fire_breath(px: number, py: number) {
    this.ring(px, py, 0xff4400, 5, 72, 520, 0.85, 5);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff2200, 0xff7700, 0xffcc00, 0xffee88],
      count: 48, speed: { min: 60, max: 185 },
      scale: { start: 0.9, end: 0 }, lifespan: { min: 400, max: 920 },
      gravityY: -35, radius: 42,
    });
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x883300, 0x441100],
      count: 18, speed: { min: 20, max: 62 },
      scale: { start: 1.1, end: 0.2 }, lifespan: { min: 600, max: 1250 },
      gravityY: -22, radius: 37, blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.52, end: 0 },
    });
  }

  private fx_frost_breath(px: number, py: number) {
    this.ring(px, py, 0x44aaff, 5, 68, 540, 0.8, 4);
    this.scene.time.delayedCall(85, () => this.ring(px, py, 0xffffff, 5, 52, 440, 0.5, 2));
    this.burst(px, py, TEX.SHARD, {
      colors: [0x44ccff, 0x88eeff, 0xffffff],
      count: 30, speed: { min: 60, max: 165 },
      scale: { start: 0.6, end: 0 }, lifespan: { min: 400, max: 760 },
      rotate: { start: 0, end: 270 }, radius: 38,
    });
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x88ccff, 0xaaddff],
      count: 16, speed: { min: 15, max: 47 },
      scale: { start: 0.9, end: 0.2 }, lifespan: { min: 600, max: 1120 },
      gravityY: -16, radius: 42, blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.42, end: 0 },
    });
  }

  private fx_banshee_wail(px: number, py: number) {
    this.ring(px, py, 0x8844cc, 5, 78, 620, 0.8, 5);
    this.scene.time.delayedCall(105, () => this.ring(px, py, 0xcc44ff, 5, 62, 510, 0.55, 3));
    this.burst(px, py, TEX.SMOKE, {
      colors: [0xcc44ff, 0x880088, 0x4400aa],
      count: 26, speed: { min: 20, max: 68 },
      scale: { start: 0.8, end: 0 }, lifespan: { min: 600, max: 1250 },
      gravityY: -22, radius: 52, blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.62, end: 0 },
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x8844cc, 0xcc44ff],
      count: 18, speed: { min: 30, max: 92 },
      scale: { start: 0.5, end: 0 }, lifespan: { min: 400, max: 820 },
      gravityY: -36, radius: 32,
    });
  }

  private fx_shadow_bolt(px: number, py: number) {
    this.ring(px, py, 0x330044, 5, 42, 370, 0.8, 4);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x220033, 0x550055, 0x8800aa, 0xff44ff],
      count: 32, speed: { min: 60, max: 178 },
      scale: { start: 0.7, end: 0 }, lifespan: { min: 350, max: 720 }, radius: 7,
    });
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x110022, 0x330033],
      count: 15, speed: { min: 15, max: 50 },
      scale: { start: 0.9, end: 0.1 }, lifespan: { min: 500, max: 1020 },
      gravityY: -16, radius: 17, blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.5, end: 0 },
    });
  }

  private fx_soul_drain(px: number, py: number) {
    this.ring(px, py, 0x4422aa, 4, 30, 320, 0.8, 3);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x4422aa, 0x8844cc, 0xaaaaff],
      count: 20, speed: { min: 20, max: 72 },
      scale: { start: 0.55, end: 0 }, lifespan: { min: 400, max: 820 },
      gravityY: -48, radius: 11,
    });
  }

  private fx_web_shot(px: number, py: number) {
    this.ring(px, py, 0x888888, 5, 32, 360, 0.7, 3);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x888888, 0xaaaaaa, 0xffffff],
      count: 20, speed: { min: 30, max: 92 },
      scale: { start: 0.4, end: 0 }, lifespan: { min: 300, max: 660 }, radius: 11,
    });
  }

  private fx_default(px: number, py: number) {
    this.ring(px, py, 0xaaaaff, 4, 32, 320, 0.7, 2);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0xaaaaff],
      count: 18, speed: { min: 40, max: 105 },
      scale: { start: 0.5, end: 0 }, lifespan: { min: 300, max: 620 },
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Plays the full layered visual effect for a spell at a tile position. */
  playSpellEffect(spellId: string, targetTileX: number, targetTileY: number) {
    this.ensureTextures();
    const px = targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const py = targetTileY * TILE_SIZE + TILE_SIZE / 2;

    switch (spellId) {
      case "fireball":     return this.fx_fireball(px, py);
      case "ice_bolt":     return this.fx_ice_bolt(px, py);
      case "thunderstorm": return this.fx_thunderstorm(px, py);
      case "frost_nova":   return this.fx_frost_nova(px, py);
      case "arcane_surge": return this.fx_arcane_surge(px, py);
      case "war_cry":      return this.fx_war_cry(px, py);
      case "whirlwind":    return this.fx_whirlwind(px, py);
      case "shield_bash":  return this.fx_shield_bash(px, py);
      case "battle_shout": return this.fx_battle_shout(px, py);
      case "holy_nova":    return this.fx_holy_nova(px, py);
      case "heal":         return this.fx_heal(px, py);
      case "divine_shield": return this.fx_divine_shield(px, py);
      case "smoke_bomb":   return this.fx_smoke_bomb(px, py);
      case "hemorrhage":   return this.fx_hemorrhage(px, py);
      case "backstab":     return this.fx_backstab(px, py);
      case "stealth":      return this.fx_stealth(px, py);
      case "poison_arrow":
      case "envenom":
      case "poison_bite":  return this.fx_poison(px, py);
      case "holy_strike":  return this.fx_holy_strike(px, py);
      case "smite":        return this.fx_smite(px, py);
      case "curse":        return this.fx_curse(px, py);
      case "mark_target":  return this.fx_mark_target(px, py);
      case "mana_shield":  return this.fx_mana_shield(px, py);
      case "evasion":      return this.fx_evasion(px, py);
      case "aimed_shot":   return this.fx_aimed_shot(px, py);
      case "multi_shot":   return this.fx_multi_shot(px, py);
      case "enrage":       return this.fx_enrage(px, py);
      case "fire_breath":  return this.fx_fire_breath(px, py);
      case "frost_breath": return this.fx_frost_breath(px, py);
      case "banshee_wail": return this.fx_banshee_wail(px, py);
      case "shadow_bolt":  return this.fx_shadow_bolt(px, py);
      case "soul_drain":   return this.fx_soul_drain(px, py);
      case "web_shot":     return this.fx_web_shot(px, py);
      default:             return this.fx_default(px, py);
    }
  }

  /** Plays a melee hit burst at the target's world position. */
  playMeleeHit(targetSessionId: string | null) {
    if (!targetSessionId) return;
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    this.ensureTextures();
    const px = sprite.renderX;
    const py = sprite.renderY - TILE_SIZE * 0.5;
    this.flash(px, py, 0xff4444, 16, 60);
    this.burst(px, py, TEX.SPARK, {
      colors: [0xff4444, 0xff8844, 0xffcc88, 0xffffff],
      count: 16, speed: { min: 50, max: 115 },
      scale: { start: 0.55, end: 0 }, lifespan: { min: 150, max: 390 },
      angle: { min: -55, max: 55 },
    });
  }

  showDamage(targetSessionId: string, amount: number, type: "physical" | "magic" | "dot") {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    const color = type === "magic" ? "#bb44ff" : type === "dot" ? "#44cc44" : "#ff4444";
    const prefix = type === "dot" ? "🐾" : type === "magic" ? "✦" : "⚔";
    const size = type === "dot" ? "11px" : "14px";
    this.floatText(sprite.renderX, sprite.renderY - 30, `${prefix}${amount}`, color, size);
  }

  showHeal(targetSessionId: string, amount: number) {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    this.floatText(sprite.renderX, sprite.renderY - 30, `+${amount}`, "#33cc33", "14px");
  }

  showFloatingText(sessionId: string, text: string, color: string) {
    const sprite = this.spriteManager.getSprite(sessionId);
    if (!sprite) return;
    this.floatText(sprite.renderX, sprite.renderY - 42, text, color, "11px");
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private floatText(x: number, y: number, content: string, color: string, fontSize: string) {
    const text = this.scene.add
      .text(x, y, content, {
        fontSize, color,
        fontFamily: FONTS.display,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.scene.tweens.add({
      targets: text,
      y: y - 42,
      alpha: 0,
      duration: 1250,
      ease: "Power1",
      onComplete: () => text.destroy(),
    });
  }
}
