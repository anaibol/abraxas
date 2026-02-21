import { ABILITIES, TILE_SIZE, i18n } from "@abraxas/shared";
import Phaser from "phaser";
import { FONTS, getGameTextResolution } from "../ui/tokens";
import type { SpriteManager } from "./SpriteManager";
import { gameSettings } from "../settings/gameSettings";

// ── Particle burst configuration ─────────────────────────────────────────────

type BurstConfig = {
  colors: number[];
  count: number;
  speed: { min: number; max: number };
  scale: { start: number; end: number };
  lifespan: { min: number; max: number };
  angle?: { min: number; max: number };
  radius?: number;
  blendMode?: number;
  rotate?: { start: number; end: number };
  alpha?: { start: number; end: number };

  // ── Physics ──────────────────────────────────────────────────────────────
  gravityX?: number;
  gravityY?: number;
  accelerationX?: Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType;
  accelerationY?: Phaser.Types.GameObjects.Particles.EmitterOpOnEmitType;
  maxVelocityX?: number;
  maxVelocityY?: number;
  bounce?: number;
  bounds?: { x: number; y: number; width: number; height: number };
  collideBottom?: boolean;

  // ── Color interpolation (overrides `colors` tint when set) ───────────────
  color?: number[];       // lifecycle color gradient, e.g. [0xffffff, 0xff8800, 0xff2200, 0x331100]
  colorEase?: string;     // easing for color transitions, e.g. "Quad.Out"

  // ── Easing curves ────────────────────────────────────────────────────────
  scaleEase?: string;     // e.g. "Cubic.Out" for non-linear scale
  alphaEase?: string;     // e.g. "Sine.In" for natural fade

  // ── Independent axes ─────────────────────────────────────────────────────
  scaleX?: { start: number; end: number };
  scaleY?: { start: number; end: number };
  speedX?: { min: number; max: number };
  speedY?: { min: number; max: number };

  // ── Zones ────────────────────────────────────────────────────────────────
  emitZone?: Phaser.Types.GameObjects.Particles.EmitZoneData;
  deathZone?: Phaser.Types.GameObjects.Particles.DeathZoneObject;

  // ── Attraction / Implosion ───────────────────────────────────────────────
  moveToX?: number;
  moveToY?: number;

  // ── Callbacks ────────────────────────────────────────────────────────────
  onEmit?: Phaser.Types.GameObjects.Particles.ParticleEmitterCallback;
  onDeath?: Phaser.Types.GameObjects.Particles.ParticleDeathCallback;

  // ── Misc ─────────────────────────────────────────────────────────────────
  hold?: number;          // ms to hold at end of life before recycling
};

// ── Element-based physics presets ─────────────────────────────────────────────
// Spread these into BurstConfig to get physically correct defaults per element.

const PHYSICS = {
  /** Hot particles rise (buoyancy), affected by thermals */
  FIRE: { gravityY: -65, accelerationY: { min: -20, max: -80 }, maxVelocityY: 200 } as Partial<BurstConfig>,
  /** Cold particles drift slowly, lateral air resistance */
  ICE: { gravityY: 12, accelerationX: { min: -15, max: 15 }, maxVelocityX: 60 } as Partial<BurstConfig>,
  /** Holy particles float upward gently */
  HOLY: { gravityY: -40, accelerationY: { min: -5, max: -20 } } as Partial<BurstConfig>,
  /** Dark particles sink, heavy */
  DARK: { gravityY: 30, maxVelocityY: 80 } as Partial<BurstConfig>,
  /** Poison bubbles up slowly */
  POISON: { gravityY: -20, accelerationY: { min: -10, max: 10 }, bounce: 0.3 } as Partial<BurstConfig>,
  /** Earth debris falls with strong gravity, bounces on ground */
  EARTH: { gravityY: 180, bounce: 0.4, collideBottom: true } as Partial<BurstConfig>,
  /** Lightning — no gravity, extreme speed */
  LIGHTNING: { gravityY: 0, maxVelocityX: 400, maxVelocityY: 400 } as Partial<BurstConfig>,
  /** Smoke rises and decelerates, volumetric expansion */
  SMOKE: { gravityY: -14, maxVelocityY: 50, scaleEase: "Cubic.Out", alphaEase: "Sine.In" } as Partial<BurstConfig>,
} as const;

// ── Procedural texture keys ───────────────────────────────────────────────────

const TEX = {
  CIRCLE: "fx-circle", // soft radial-gradient glowing circle  (16×16)
  STAR: "fx-star", // 4-point star — holy, stun, buffs     (16×16)
  SHARD: "fx-shard", // elongated diamond — ice, lightning    (12×6)
  SMOKE: "fx-smoke", // large fuzzy blob — smoke, aoe clouds  (32×32)
  SPARK: "fx-spark", // bright plus/cross — electricity, embers (8×8)
  RING: "fx-ring", // thin circle outline — orbiting rings  (16×16)
  CROSS: "fx-cross", // larger plus/cross — holy, heal, divine  (12×12)
  ARROW: "fx-arrow", // sharp arrow texture for physical projectiles (16×16)
};

type TexKey = "CIRCLE" | "STAR" | "SHARD" | "SMOKE" | "SPARK" | "RING" | "CROSS" | "ARROW";

// ── FxRecipe: data-driven spell effect system ────────────────────────────────

type FxRing  = { color: number; start: number; end: number; duration: number; alpha?: number; width?: number; delay?: number };
type FxFlash = { color: number; size: number; duration: number };
type FxBurstEntry = BurstConfig & { tex: TexKey; delay?: number };

type FxHelper = "createThickSmoke" | "createCampfire" | "createLightningStrike" | "createFrostExplosion"
  | "createEarthShatter" | "createPoisonCloud" | "createVines" | "createMeteorFall" | "createWaterSplash"
  | "createRain" | "createAcidSplash";

type FxRecipe = {
  flash?: FxFlash;
  rings?: FxRing[];
  bursts?: FxBurstEntry[];
  helpers?: FxHelper[];
};

/** Lookup table for data-driven spell effects. Complex effects (chain_lightning, meteor_strike) stay as custom methods. */
const SPELL_FX: Record<string, FxRecipe> = {
  // ── Mage ──
  ice_bolt: {
    rings: [{ color: 0x44ddff, start: 4, end: 40, duration: 198, alpha: 0.85, width: 1 }],
    bursts: [
      { tex: "SHARD", colors: [], color: [0xffffff, 0x88eeff, 0x44aaff, 0x224488], count: 11, speed: { min: 80, max: 190 }, scale: { start: 0.45, end: 0.0 }, lifespan: { min: 180, max: 372 }, rotate: { start: 0, end: 360 }, ...PHYSICS.ICE },
      { tex: "CIRCLE", colors: [], color: [0xffffff, 0xaaeeff, 0x4488cc], count: 7, speed: { min: 15, max: 55 }, scale: { start: 0.2, end: 0.0 }, scaleEase: "Sine.Out", lifespan: { min: 330, max: 570 }, ...PHYSICS.ICE, gravityY: -28, radius: 10 },
    ],
  },
  arcane_surge: {
    flash: { color: 0xaa44ff, size: 23, duration: 60 },
    rings: [
      { color: 0x8844ff, start: 5, end: 50, duration: 252, alpha: 0.85, width: 2 },
      { color: 0xffffff, start: 5, end: 42, duration: 186, alpha: 0.7, width: 1, delay: 60 },
    ],
    bursts: [
      { tex: "CIRCLE", colors: [], color: [0xffffff, 0xcc88ff, 0xaa44ff, 0x330066], colorEase: "Quad.Out", count: 17, speed: { min: 70, max: 200 }, scale: { start: 0.52, end: 0.0 }, scaleEase: "Cubic.Out", lifespan: { min: 210, max: 450 }, gravityY: -32, radius: 5 },
    ],
  },
  mana_shield: {
    rings: [{ color: 0x4488ff, start: 5, end: 36, duration: 228, alpha: 0.85, width: 1 }],
    bursts: [
      { tex: "CIRCLE", colors: [0x4488ff, 0x88bbff, 0xccddff], count: 12, speed: { min: 20, max: 62 }, scale: { start: 0.36, end: 0.0 }, lifespan: { min: 240, max: 492 }, gravityY: -30, radius: 11 },
      { tex: "RING", colors: [0x4488ff, 0xffffff], count: 4, speed: { min: 10, max: 30 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 360, max: 660 }, rotate: { start: 0, end: 360 }, radius: 14 },
    ],
  },
  // ── Warrior ──
  war_cry: {
    rings: [
      { color: 0xff6600, start: 5, end: 65, duration: 300, alpha: 0.85, width: 2 },
      { color: 0xffcc00, start: 5, end: 60, duration: 288, alpha: 0.5, width: 1, delay: 100 },
    ],
    bursts: [{ tex: "CIRCLE", colors: [], color: [0xffffff, 0xffcc00, 0xff6600, 0x442200], colorEase: "Quad.Out", count: 14, speed: { min: 40, max: 120 }, scale: { start: 0.42, end: 0.0 }, lifespan: { min: 210, max: 420 }, ...PHYSICS.FIRE, radius: 13 }],
  },
  whirlwind: {
    flash: { color: 0xcccccc, size: 22, duration: 80 },
    rings: [{ color: 0xcccccc, start: 5, end: 52, duration: 240, alpha: 0.85, width: 2 }],
    bursts: [
      { tex: "SHARD", colors: [0xcccccc, 0xffffff, 0xaaccff], count: 14, speed: { min: 90, max: 220 }, scale: { start: 0.42, end: 0.0 }, lifespan: { min: 120, max: 288 }, angle: { min: 0, max: 360 }, rotate: { start: 0, end: 720 } },
      { tex: "SPARK", colors: [0xffffff, 0xffcc88], count: 8, speed: { min: 50, max: 140 }, scale: { start: 0.26, end: 0.0 }, lifespan: { min: 90, max: 228 }, angle: { min: 0, max: 360 } },
    ],
  },
  battle_shout: {
    rings: [
      { color: 0xffcc00, start: 5, end: 72, duration: 312, alpha: 0.85, width: 2 },
      { color: 0xffcc00, start: 5, end: 85, duration: 348, alpha: 0.5, width: 1, delay: 120 },
    ],
    bursts: [{ tex: "CIRCLE", colors: [0xffcc00, 0xffee88, 0xffffff], count: 12, speed: { min: 30, max: 90 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 240, max: 468 }, radius: 14 }],
  },
  enrage: {
    flash: { color: 0xff4400, size: 28, duration: 72 },
    rings: [{ color: 0xff4400, start: 5, end: 52, duration: 276, alpha: 0.85, width: 2 }],
    bursts: [{ tex: "CIRCLE", colors: [], color: [0xffffff, 0xff8800, 0xff2200, 0x440000], colorEase: "Quad.Out", count: 16, speed: { min: 70, max: 165 }, scale: { start: 0.45, end: 0.0 }, scaleEase: "Cubic.Out", lifespan: { min: 240, max: 492 }, ...PHYSICS.FIRE, radius: 13 }],
  },
  // ── Priest / Holy ──
  holy_nova: {
    flash: { color: 0xffffff, size: 29, duration: 60 },
    rings: [
      { color: 0xffffcc, start: 5, end: 60, duration: 270, alpha: 0.9, width: 2 },
      { color: 0xffcc88, start: 5, end: 60, duration: 285, alpha: 0.5, width: 1, delay: 100 },
    ],
    bursts: [{ tex: "STAR", colors: [], color: [0xffffff, 0xffff88, 0xffcc00, 0x886600], colorEase: "Sine.Out", count: 16, speed: { min: 40, max: 140 }, scale: { start: 0.45, end: 0.0 }, lifespan: { min: 240, max: 510 }, rotate: { start: 0, end: 360 }, ...PHYSICS.HOLY }],
  },
  heal: {
    flash: { color: 0x44ff88, size: 20, duration: 72 },
    rings: [{ color: 0x33dd66, start: 5, end: 42, duration: 228, alpha: 0.85, width: 1 }],
    bursts: [
      { tex: "CROSS", colors: [], color: [0xffffff, 0x88ffcc, 0x44ff88, 0x228844], count: 12, speed: { min: 20, max: 80 }, scale: { start: 0.42, end: 0.0 }, lifespan: { min: 300, max: 570 }, rotate: { start: 0, end: 360 }, ...PHYSICS.HOLY, gravityY: -48, radius: 9 },
      { tex: "CIRCLE", colors: [0x33dd66, 0x88ffaa], count: 8, speed: { min: 15, max: 50 }, scale: { start: 0.26, end: 0.0 }, scaleEase: "Sine.Out", lifespan: { min: 360, max: 660 }, ...PHYSICS.HOLY, gravityY: -55, radius: 13 },
      { tex: "STAR", colors: [0xffffff, 0xaaffcc], count: 4, speed: { min: 25, max: 55 }, scale: { start: 0.29, end: 0.0 }, lifespan: { min: 420, max: 720 }, rotate: { start: 0, end: 360 }, ...PHYSICS.HOLY, gravityY: -60, radius: 11 },
    ],
  },
  divine_shield: {
    flash: { color: 0xffff88, size: 27, duration: 72 },
    rings: [
      { color: 0xffdd44, start: 5, end: 48, duration: 252, alpha: 0.9, width: 2 },
      { color: 0xffee88, start: 5, end: 50, duration: 342, alpha: 0.7, width: 1, delay: 100 },
    ],
    bursts: [{ tex: "STAR", colors: [], color: [0xffffff, 0xffff88, 0xffcc00, 0x886600], count: 10, speed: { min: 15, max: 60 }, scale: { start: 0.36, end: 0.0 }, lifespan: { min: 360, max: 660 }, rotate: { start: 0, end: 360 }, ...PHYSICS.HOLY, gravityY: -42, radius: 16 }],
  },
  holy_strike: {
    flash: { color: 0xffffaa, size: 18, duration: 80 },
    rings: [{ color: 0xffdd44, start: 4, end: 35, duration: 180, alpha: 0.85, width: 1 }],
    bursts: [{ tex: "STAR", colors: [], color: [0xffffff, 0xffff88, 0xffcc00], count: 8, speed: { min: 50, max: 130 }, scale: { start: 0.36, end: 0.0 }, lifespan: { min: 150, max: 330 }, rotate: { start: 0, end: 360 }, ...PHYSICS.HOLY }],
  },
  // ── Rogue ──
  smoke_bomb: {
    flash: { color: 0x333333, size: 24, duration: 60 },
    rings: [
      { color: 0x444444, start: 5, end: 55, duration: 300, alpha: 0.75, width: 2 },
      { color: 0x222222, start: 5, end: 70, duration: 408, alpha: 0.45, width: 1, delay: 100 },
    ],
    bursts: [
      { tex: "SMOKE", colors: [], color: [0x666666, 0x444444, 0x333333, 0x111111], count: 20, speed: { min: 20, max: 70 }, scale: { start: 0.78, end: 0.13 }, ...PHYSICS.SMOKE, lifespan: { min: 360, max: 840 }, gravityY: -18, radius: 18, blendMode: 0, alpha: { start: 0.7, end: 0 } },
    ],
  },
  hemorrhage: {
    flash: { color: 0xdd2222, size: 16, duration: 80 },
    rings: [{ color: 0xcc1111, start: 4, end: 36, duration: 192, alpha: 0.85, width: 1 }],
    bursts: [
      { tex: "CIRCLE", colors: [], color: [0xff4444, 0xdd0000, 0x880000, 0x220000], count: 11, speed: { min: 50, max: 140 }, scale: { start: 0.39, end: 0.0 }, lifespan: { min: 150, max: 312 }, gravityY: 55, radius: 5 },
      { tex: "CIRCLE", colors: [0xff4444, 0xcc0000], count: 6, speed: { min: 30, max: 80 }, scale: { start: 0.23, end: 0.0 }, lifespan: { min: 240, max: 468 }, angle: { min: 210, max: 330 }, gravityY: 120, ...PHYSICS.EARTH, bounce: 0.2 },
    ],
  },
  backstab: {
    flash: { color: 0xff4444, size: 15, duration: 60 },
    rings: [{ color: 0xff4444, start: 4, end: 28, duration: 150, alpha: 0.85, width: 1 }],
    bursts: [{ tex: "SPARK", colors: [0xff4444, 0xffaa44, 0xffffff], count: 7, speed: { min: 60, max: 160 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 90, max: 210 }, angle: { min: -40, max: 40 } }],
  },
  stealth: {
    rings: [{ color: 0x6644aa, start: 40, end: 5, duration: 240, alpha: 0.7, width: 1 }],
    bursts: [
      { tex: "SMOKE", colors: [], color: [0x332255, 0x221133, 0x110022, 0x000000], count: 12, speed: { min: 10, max: 40 }, scale: { start: 0.52, end: 0.0 }, ...PHYSICS.SMOKE, lifespan: { min: 300, max: 630 }, gravityY: -15, radius: 14, blendMode: 0, alpha: { start: 0.55, end: 0 } },
      { tex: "CIRCLE", colors: [0x6644aa, 0x8866cc], count: 5, speed: { min: 15, max: 45 }, scale: { start: 0.2, end: 0.0 }, lifespan: { min: 240, max: 450 }, ...PHYSICS.DARK, gravityY: -35, radius: 11 },
    ],
  },
  evasion: {
    flash: { color: 0x44ccff, size: 19, duration: 60 },
    rings: [
      { color: 0x44ccff, start: 5, end: 42, duration: 216, alpha: 0.85, width: 1 },
    ],
    bursts: [
      { tex: "SHARD", colors: [0x44ccff, 0xaaeeff, 0xffffff], count: 10, speed: { min: 80, max: 190 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 120, max: 252 }, rotate: { start: 0, end: 360 } },
    ],
  },
  // ── Hunter ──
  aimed_shot: {
    flash: { color: 0xffaa44, size: 15, duration: 80 },
    rings: [{ color: 0xffaa44, start: 4, end: 36, duration: 180, alpha: 0.85, width: 1 }],
    bursts: [
      { tex: "SPARK", colors: [0xffaa44, 0xffcc88, 0xffffff], count: 9, speed: { min: 80, max: 200 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 120, max: 270 }, angle: { min: -30, max: 30 } },
      { tex: "CIRCLE", colors: [0xffaa44, 0xff8800], count: 5, speed: { min: 20, max: 55 }, scale: { start: 0.2, end: 0.0 }, lifespan: { min: 180, max: 360 }, radius: 7 },
    ],
  },
  multi_shot: {
    rings: [{ color: 0x88ff44, start: 4, end: 37, duration: 204, alpha: 0.75, width: 1 }],
    bursts: [{ tex: "SHARD", colors: [0x88ff44, 0xffee44, 0xffffff], count: 11, speed: { min: 90, max: 190 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 150, max: 306 }, angle: { min: -65, max: 65 }, rotate: { start: 0, end: 180 } }],
  },
  mark_target: {
    flash: { color: 0xff4444, size: 14, duration: 80 },
    rings: [{ color: 0xff4444, start: 4, end: 30, duration: 180, alpha: 0.85, width: 1 }],
    bursts: [{ tex: "CROSS", colors: [0xff4444, 0xffaa44, 0xffffff], count: 6, speed: { min: 20, max: 55 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 240, max: 450 }, rotate: { start: 0, end: 360 } }],
  },
  curse: {
    rings: [{ color: 0x8800aa, start: 5, end: 40, duration: 240, alpha: 0.8, width: 2 }],
    bursts: [
      { tex: "SMOKE", colors: [], color: [0x440066, 0x330044, 0x220022, 0x110011], count: 11, speed: { min: 15, max: 55 }, scale: { start: 0.52, end: 0.0 }, ...PHYSICS.DARK, lifespan: { min: 300, max: 660 }, gravityY: -22, radius: 13, blendMode: 0, alpha: { start: 0.6, end: 0 } },
      { tex: "CIRCLE", colors: [], color: [0xff88ff, 0xcc44ff, 0x8800aa, 0x330044], colorEase: "Quad.Out", count: 8, speed: { min: 30, max: 92 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 210, max: 432 }, ...PHYSICS.DARK, gravityY: -36, radius: 7 },
    ],
  },
  // ── NPC effects ──
  fire_breath: {
    rings: [{ color: 0xff4400, start: 5, end: 72, duration: 312, alpha: 0.85, width: 3 }],
    bursts: [
      { tex: "CIRCLE", colors: [], color: [0xffffff, 0xffcc00, 0xff4400, 0x441100], colorEase: "Quad.Out", count: 24, speed: { min: 60, max: 185 }, scale: { start: 0.59, end: 0.0 }, scaleEase: "Cubic.Out", lifespan: { min: 240, max: 552 }, ...PHYSICS.FIRE, radius: 27 },
      { tex: "SMOKE", colors: [0x883300, 0x441100], count: 9, speed: { min: 20, max: 62 }, scale: { start: 0.72, end: 0.13 }, lifespan: { min: 360, max: 750 }, ...PHYSICS.SMOKE, gravityY: -22, radius: 24, blendMode: 0, alpha: { start: 0.52, end: 0 } },
    ],
  },
  frost_breath: {
    rings: [
      { color: 0x44aaff, start: 5, end: 68, duration: 324, alpha: 0.8, width: 2 },
      { color: 0xffffff, start: 5, end: 52, duration: 264, alpha: 0.5, width: 1, delay: 85 },
    ],
    bursts: [
      { tex: "SHARD", colors: [], color: [0xffffff, 0x88eeff, 0x44aaff, 0x224466], count: 15, speed: { min: 60, max: 165 }, scale: { start: 0.39, end: 0.0 }, lifespan: { min: 240, max: 456 }, rotate: { start: 0, end: 270 }, ...PHYSICS.ICE, radius: 24 },
      { tex: "SMOKE", colors: [0x88ccff, 0xaaddff], count: 8, speed: { min: 15, max: 47 }, scale: { start: 0.59, end: 0.13 }, ...PHYSICS.SMOKE, lifespan: { min: 360, max: 672 }, gravityY: -16, radius: 27, blendMode: 0, alpha: { start: 0.42, end: 0 } },
    ],
  },
  banshee_wail: {
    rings: [
      { color: 0x8844cc, start: 5, end: 78, duration: 372, alpha: 0.8, width: 3 },
      { color: 0xcc44ff, start: 5, end: 62, duration: 306, alpha: 0.55, width: 1, delay: 105 },
    ],
    bursts: [
      { tex: "SMOKE", colors: [], color: [0xcc44ff, 0x880088, 0x4400aa, 0x110022], count: 13, speed: { min: 20, max: 68 }, scale: { start: 0.52, end: 0.0 }, ...PHYSICS.DARK, lifespan: { min: 360, max: 750 }, gravityY: -22, radius: 33, blendMode: 0, alpha: { start: 0.62, end: 0 } },
      { tex: "CIRCLE", colors: [], color: [0xff88ff, 0xcc44ff, 0x8844cc, 0x220044], colorEase: "Quad.Out", count: 9, speed: { min: 30, max: 92 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 240, max: 492 }, ...PHYSICS.DARK, gravityY: -36, radius: 20 },
    ],
  },
  shadow_bolt: {
    rings: [{ color: 0x330044, start: 5, end: 42, duration: 222, alpha: 0.8, width: 2 }],
    bursts: [
      { tex: "CIRCLE", colors: [], color: [0xff44ff, 0x8800aa, 0x550055, 0x220033], colorEase: "Quad.Out", count: 16, speed: { min: 60, max: 178 }, scale: { start: 0.45, end: 0.0 }, lifespan: { min: 210, max: 432 }, ...PHYSICS.DARK, radius: 4 },
      { tex: "SMOKE", colors: [0x110022, 0x330033], count: 7, speed: { min: 15, max: 50 }, scale: { start: 0.59, end: 0.07 }, ...PHYSICS.SMOKE, lifespan: { min: 300, max: 612 }, gravityY: -16, radius: 11, blendMode: 0, alpha: { start: 0.5, end: 0 } },
    ],
  },
  soul_drain: {
    rings: [{ color: 0x4422aa, start: 4, end: 30, duration: 192, alpha: 0.8, width: 1 }],
    bursts: [{ tex: "CIRCLE", colors: [0x4422aa, 0x8844cc, 0xaaaaff], count: 10, speed: { min: 20, max: 72 }, scale: { start: 0.36, end: 0.0 }, lifespan: { min: 240, max: 492 }, gravityY: -48, radius: 7 }],
  },
  web_shot: {
    rings: [{ color: 0x888888, start: 5, end: 32, duration: 216, alpha: 0.7, width: 1 }],
    bursts: [{ tex: "CIRCLE", colors: [0x888888, 0xaaaaaa, 0xffffff], count: 10, speed: { min: 30, max: 92 }, scale: { start: 0.26, end: 0.0 }, lifespan: { min: 180, max: 396 }, radius: 7 }],
  },
  // ── Paladin ──
  consecration: {
    rings: [
      { color: 0xffcc00, start: 5, end: 48, duration: 288, alpha: 0.85, width: 2 },
      { color: 0xff6600, start: 5, end: 36, duration: 228, alpha: 0.6, width: 1, delay: 80 },
    ],
    bursts: [
      { tex: "CIRCLE", colors: [], color: [0xffffff, 0xffcc00, 0xff6600, 0x441100], colorEase: "Quad.Out", count: 16, speed: { min: 50, max: 145 }, scale: { start: 0.42, end: 0.0 }, scaleEase: "Cubic.Out", lifespan: { min: 240, max: 504 }, ...PHYSICS.HOLY, gravityY: -32, radius: 19 },
      { tex: "STAR", colors: [], color: [0xffffff, 0xffee44, 0xffcc00], count: 7, speed: { min: 25, max: 72 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 300, max: 552 }, rotate: { start: 0, end: 360 }, ...PHYSICS.HOLY, gravityY: -42, radius: 15 },
    ],
  },
  // ── Druid ──
  bear_form: {
    flash: { color: 0x8B5E3C, size: 26, duration: 90 },
    rings: [{ color: 0x8B5E3C, start: 6, end: 52, duration: 300, alpha: 0.8, width: 2 }],
    bursts: [
      { tex: "SMOKE", colors: [], color: [0x8B5E3C, 0x6B4226, 0x5C3A1C, 0x2A1A0E], count: 15, speed: { min: 30, max: 95 }, scale: { start: 0.65, end: 0.07 }, ...PHYSICS.SMOKE, lifespan: { min: 300, max: 660 }, gravityY: -18, radius: 20, blendMode: 0, alpha: { start: 0.7, end: 0 } },
      { tex: "CIRCLE", colors: [], color: [0xFFEECC, 0xD2A679, 0x8B5E3C, 0x442211], count: 8, speed: { min: 50, max: 130 }, scale: { start: 0.36, end: 0.0 }, lifespan: { min: 210, max: 420 }, ...PHYSICS.EARTH, gravityY: 60, radius: 11 },
    ],
  },
  cat_form: {
    rings: [{ color: 0x44FF88, start: 4, end: 40, duration: 216, alpha: 0.8, width: 1 }],
    bursts: [
      { tex: "SHARD", colors: [0x44FF88, 0xAAFFCC, 0xFFFFFF], count: 12, speed: { min: 100, max: 240 }, scale: { start: 0.36, end: 0.0 }, lifespan: { min: 108, max: 228 }, angle: { min: 0, max: 360 }, rotate: { start: 0, end: 180 } },
      { tex: "CIRCLE", colors: [0x44FF88, 0x88FFCC], count: 6, speed: { min: 30, max: 80 }, scale: { start: 0.23, end: 0.0 }, lifespan: { min: 180, max: 360 }, gravityY: -40,
      maxVelocityY: 60, radius: 10 },
    ],
  },
  // ── Necromancer ──
  summon: {
    rings: [
      { color: 0x220033, start: 5, end: 40, duration: 288, alpha: 0.7, width: 2 },
      { color: 0x8844CC, start: 5, end: 30, duration: 228, alpha: 0.4, width: 1, delay: 80 },
    ],
    bursts: [
      { tex: "SMOKE", colors: [], color: [0x550055, 0x330033, 0x220022, 0x110011], count: 14, speed: { min: 15, max: 55 }, scale: { start: 0.65, end: 0.07 }, ...PHYSICS.DARK, lifespan: { min: 420, max: 900 }, gravityY: -40, maxVelocityY: 50, radius: 13, blendMode: 0, alpha: { start: 0.65, end: 0 } },
      { tex: "CIRCLE", colors: [], color: [0xff88ff, 0xCC44FF, 0x8800CC, 0x330066], colorEase: "Quad.Out", count: 9, speed: { min: 30, max: 90 }, scale: { start: 0.36, end: 0.0 }, lifespan: { min: 240, max: 510 }, ...PHYSICS.DARK, gravityY: -60, radius: 9 },
    ],
  },
  // ── Default fallback ──
  _default: {
    rings: [{ color: 0xaaaaff, start: 4, end: 32, duration: 192, alpha: 0.7, width: 1 }],
    bursts: [{ tex: "CIRCLE", colors: [0xffffff, 0xaaaaff], count: 9, speed: { min: 40, max: 105 }, scale: { start: 0.33, end: 0.0 }, lifespan: { min: 180, max: 372 } }],
  },
};

/** Alias map: spellId → recipe key (for effects that reuse another recipe). */
const SPELL_FX_ALIASES: Record<string, string> = {
  poison_arrow: "poison", envenom: "poison", poison_bite: "poison",
  judgment: "holy_strike", lay_on_hands: "heal", aura_of_protection: "divine_shield",
  holy_bolt: "smite", summon_zombie: "summon", summon_skeleton: "summon",
  soul_blast: "soul_drain", execute: "backstab", leap: "earthquake",
  cleave: "whirlwind", berserker_rage: "enrage", shadowstep: "stealth",
  fan_of_knives: "multi_shot", detect_invisibility: "divine_shield",
  cleanse_paralysis: "divine_shield",
};

// ── EffectManager ─────────────────────────────────────────────────────────────


export class EffectManager {
  private texturesReady = false;
  /** Persistent emitters (teleport pads) — tracked so destroy() can clean them up. */
  private teleportEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(
    private scene: Phaser.Scene,
    private spriteManager: SpriteManager,
  ) {}

  /** Clean up all persistent emitters. Call from GameScene.shutdown(). */
  public destroy() {
    for (const e of this.teleportEmitters) {
      try { e.destroy(); } catch { /* already destroyed */ }
    }
    this.teleportEmitters = [];
  }

  /**
   * Returns true if the world pixel position (px, py) is within the current
   * camera viewport (plus a small margin). Use to skip effects that the player
   * cannot see, saving particle CPU budget.
   */
  private isOnScreen(px: number, py: number, margin = 80): boolean {
    const wv = this.scene.cameras.main.worldView;
    return (
      px >= wv.left - margin &&
      px <= wv.right + margin &&
      py >= wv.top - margin &&
      py <= wv.bottom + margin
    );
  }

  // ── Texture generation ────────────────────────────────────────────────────

  private ensureTextures() {
    if (this.texturesReady) return;
    this.texturesReady = true;

    // fx-circle — soft radial glow with power-curve falloff: very bright centre,
    // fast transparent fade toward the edge for crisp, punchy glow particles.
    if (!this.scene.textures.exists(TEX.CIRCLE)) {
      const g = this.scene.add.graphics();
      for (let r = 8; r >= 1; r--) {
        const t = (r - 1) / 8; // 0 = innermost, 1 = outermost
        const a = (1 - t) ** 1.8; // power curve → bright centre, quick falloff
        g.fillStyle(0xffffff, a);
        g.fillCircle(8, 8, r);
      }
      g.generateTexture(TEX.CIRCLE, 16, 16);
      g.destroy();
    }

    // fx-star — 8-point star with a soft glow halo behind it (sparkle / holy / buffs)
    if (!this.scene.textures.exists(TEX.STAR)) {
      const g = this.scene.add.graphics();
      // Soft glow halo drawn first so the crisp star sits on top
      for (let r = 7; r >= 1; r--) {
        const a = (1 - r / 7) ** 1.5 * 0.55;
        g.fillStyle(0xffffff, a);
        g.fillCircle(8, 8, r);
      }
      // Sharp 8-point star
      g.fillStyle(0xffffff, 1);
      const outer = 7,
        inner = 2.5,
        cx = 8,
        cy = 8;
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

    // fx-shard — elongated diamond with soft fringe for ice / wind shards
    if (!this.scene.textures.exists(TEX.SHARD)) {
      const g = this.scene.add.graphics();
      // Slightly larger translucent outer shadow for a frosted-edge look
      g.fillStyle(0xffffff, 0.35);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(6, 0),
          new Phaser.Math.Vector2(12, 3),
          new Phaser.Math.Vector2(6, 6),
          new Phaser.Math.Vector2(0, 3),
        ],
        true,
      );
      // Bright inner core
      g.fillStyle(0xffffff, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(6, 1),
          new Phaser.Math.Vector2(11, 3),
          new Phaser.Math.Vector2(6, 5),
          new Phaser.Math.Vector2(1, 3),
        ],
        true,
      );
      g.generateTexture(TEX.SHARD, 12, 6);
      g.destroy();
    }

    // fx-smoke — large feathered blob; cubic easing for very diffuse, cloud-like edges
    if (!this.scene.textures.exists(TEX.SMOKE)) {
      const g = this.scene.add.graphics();
      const steps = 32; // sub-pixel steps → smoother gradient
      for (let i = 0; i <= steps; i++) {
        const r = 16 * (1 - i / steps);
        const t = r / 16; // 1=outer, 0=centre
        const a = (1 - t) ** 0.38 * 0.8;
        g.fillStyle(0xffffff, a);
        g.fillCircle(16, 16, r);
      }
      g.generateTexture(TEX.SMOKE, 32, 32);
      g.destroy();
    }

    // fx-spark — bright plus/cross with a radial glow centre for hot-ember / electric looks
    if (!this.scene.textures.exists(TEX.SPARK)) {
      const g = this.scene.add.graphics();
      // Soft radial glow behind the cross
      for (let r = 4; r >= 1; r--) {
        const a = (1 - (r - 1) / 4) ** 2 * 0.55;
        g.fillStyle(0xffffff, a);
        g.fillCircle(4, 4, r);
      }
      // Bright cross bars
      g.fillStyle(0xffffff, 1);
      g.fillRect(3, 0, 2, 8); // vertical
      g.fillRect(0, 3, 8, 2); // horizontal
      g.generateTexture(TEX.SPARK, 8, 8);
      g.destroy();
    }

    // fx-ring — thin circle outline with a soft double-stroke glow (orbiting rings / halos)
    if (!this.scene.textures.exists(TEX.RING)) {
      const g = this.scene.add.graphics();
      // Soft outer glow
      g.lineStyle(4, 0xffffff, 0.28);
      g.strokeCircle(8, 8, 6);
      // Bright core stroke
      g.lineStyle(2, 0xffffff, 1);
      g.strokeCircle(8, 8, 6);
      g.generateTexture(TEX.RING, 16, 16);
      g.destroy();
    }

    // fx-cross — plus/cross with a soft circular glow behind it (holy, heal, divine)
    if (!this.scene.textures.exists(TEX.CROSS)) {
      const g = this.scene.add.graphics();
      // Soft glow disc behind the cross
      for (let r = 5; r >= 1; r--) {
        const a = (1 - r / 5) ** 1.5 * 0.45;
        g.fillStyle(0xffffff, a);
        g.fillCircle(6, 6, r);
      }
      // Sharp cross arms
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 4, 12, 4); // horizontal
      g.generateTexture(TEX.CROSS, 12, 12);
      g.destroy();
    }

    // fx-arrow — A sharp triangle attached to a thin line for physical projectiles (arrows/bolts)
    if (!this.scene.textures.exists(TEX.ARROW)) {
      const g = this.scene.add.graphics();
      // Draw flying right by default
      g.fillStyle(0xffffff, 1);
      g.fillPoints(
        [
          new Phaser.Math.Vector2(14, 8),  // Tip
          new Phaser.Math.Vector2(6, 4),   // Upper barb
          new Phaser.Math.Vector2(6, 12),  // Lower barb
        ],
        true
      );
      // Shaft
      g.fillStyle(0xdddddd, 0.8);
      g.fillRect(0, 7, 6, 2);
      g.generateTexture(TEX.ARROW, 16, 16);
      g.destroy();
    }

    if (!this.scene.textures.exists("fx-scorch")) {
      const g = this.scene.add.graphics();
      // Dark burn mark with soft edge and noisy center
      for (let r = 16; r >= 1; r--) {
        const a = (1 - r / 16) ** 0.5 * 0.4;
        g.fillStyle(0x110800, a);
        g.fillCircle(16, 16, r);
      }
      g.fillStyle(0x000000, 0.6);
      g.fillCircle(16, 16, 8);
      g.generateTexture("fx-scorch", 32, 32);
      g.destroy();
    }
    if (!this.scene.textures.exists("fx-frost-patch")) {
      const g = this.scene.add.graphics();
      for (let r = 20; r >= 1; r--) {
        const a = (1 - r / 20) ** 0.8 * 0.3;
        g.fillStyle(0xddffff, a);
        g.fillCircle(20, 20, r);
      }
      g.generateTexture("fx-frost-patch", 40, 40);
      g.destroy();
    }
    if (!this.scene.textures.exists("fx-crater")) {
      const g = this.scene.add.graphics();
      // Outer cracked earth
      for (let r = 12; r >= 1; r--) {
        g.fillStyle(0x331100, (1 - r / 12) * 0.5);
        g.fillCircle(12, 12, r);
      }
      // Inner deep hole
      g.fillStyle(0x110500, 0.8);
      g.fillCircle(12, 12, 6);
      g.generateTexture("fx-crater", 24, 24);
      g.destroy();
    }

  }

  // ── Core drawing primitives ───────────────────────────────────────────────

  /** Item 81: Returns a count multiplier based on particle quality setting. */
  private particleMultiplier(): number {
    const q = gameSettings.get().particleQuality;
    if (q === "low") return 0.35;
    if (q === "medium") return 0.65;
    return 1.0;
  }

  /** One-shot particle burst at world pixel position. */
  
  /** 
   * Ground decal (scorch marks, frost patches, cracked earth).
   * Rendered under particles and entities, fades out over time.
   */
  public drawDecal(px: number, py: number, textureName: string, durationMs: number, scale: number = 1.0, alpha: number = 0.8) {
    this.ensureTextures();
    const decal = this.scene.add.sprite(px, py, textureName);
    decal.setDepth(0); // Ground layer
    decal.setOrigin(0.5, 0.5);
    decal.setScale(scale);
    decal.setAlpha(alpha);
    decal.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    
    // Fade out over duration
    this.scene.tweens.add({
      targets: decal,
      alpha: 0,
      duration: durationMs * 0.5,
      delay: durationMs * 0.5, // Hang around for half the duration before fading
      ease: "Power2",
      onComplete: () => decal.destroy(),
    });
  }

  /** One-shot particle burst at world pixel position. Forwards all BurstConfig physics/visual properties to Phaser 4. */
  private burst(px: number, py: number, textureKey: string, cfg: BurstConfig) {
    const scaledCount = Math.max(1, Math.round(cfg.count * this.particleMultiplier()));

    // ── Scale: wrap in easing config when scaleEase is set ──
    const scaleCfg = cfg.scaleX || cfg.scaleY
      ? undefined // handled per-axis below
      : cfg.scaleEase
        ? { start: cfg.scale.start, end: cfg.scale.end, ease: cfg.scaleEase }
        : cfg.scale;

    // ── Alpha: wrap in easing config when alphaEase is set ──
    const alphaCfg = cfg.alphaEase
      ? { start: (cfg.alpha ?? { start: 1, end: 0 }).start, end: (cfg.alpha ?? { start: 1, end: 0 }).end, ease: cfg.alphaEase }
      : cfg.alpha ?? { start: 1, end: 0 };

    const emitterCfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      speed: cfg.speed,
      lifespan: cfg.lifespan,
      angle: cfg.angle ?? { min: 0, max: 360 },
      gravityX: cfg.gravityX ?? 0,
      gravityY: cfg.gravityY ?? 0,
      x: cfg.radius ? { min: -cfg.radius, max: cfg.radius } : 0,
      y: cfg.radius ? { min: -cfg.radius, max: cfg.radius } : 0,
      blendMode: cfg.blendMode ?? Phaser.BlendModes.ADD,
      alpha: alphaCfg,
      rotate: cfg.rotate,
      advance: 0,
    };

    // ── Scale (uniform or per-axis) ──
    if (cfg.scaleX || cfg.scaleY) {
      if (cfg.scaleX) emitterCfg.scaleX = cfg.scaleEase
        ? { start: cfg.scaleX.start, end: cfg.scaleX.end, ease: cfg.scaleEase }
        : cfg.scaleX;
      if (cfg.scaleY) emitterCfg.scaleY = cfg.scaleEase
        ? { start: cfg.scaleY.start, end: cfg.scaleY.end, ease: cfg.scaleEase }
        : cfg.scaleY;
    } else if (scaleCfg) {
      emitterCfg.scale = scaleCfg;
    }

    // ── Color: lifecycle interpolation vs random tint pick ──
    if (cfg.color) {
      emitterCfg.color = cfg.color;
      if (cfg.colorEase) emitterCfg.colorEase = cfg.colorEase;
    } else {
      emitterCfg.tint = cfg.colors;
    }

    // ── Independent speed axes ──
    if (cfg.speedX) emitterCfg.speedX = cfg.speedX;
    if (cfg.speedY) emitterCfg.speedY = cfg.speedY;

    // ── Acceleration ──
    if (cfg.accelerationX != null) emitterCfg.accelerationX = cfg.accelerationX;
    if (cfg.accelerationY != null) emitterCfg.accelerationY = cfg.accelerationY;

    // ── Velocity limits ──
    if (cfg.maxVelocityX != null) emitterCfg.maxVelocityX = cfg.maxVelocityX;
    if (cfg.maxVelocityY != null) emitterCfg.maxVelocityY = cfg.maxVelocityY;

    // ── Bounce + Bounds ──
    if (cfg.bounce != null) emitterCfg.bounce = cfg.bounce;
    if (cfg.bounds) {
      emitterCfg.bounds = cfg.bounds;
      if (cfg.collideBottom !== false) emitterCfg.collideBottom = cfg.collideBottom ?? true;
    }

    // ── Zones ──
    if (cfg.emitZone) emitterCfg.emitZone = cfg.emitZone;
    if (cfg.deathZone) emitterCfg.deathZone = cfg.deathZone;

    // ── Point attraction ──
    if (cfg.moveToX != null) emitterCfg.moveToX = cfg.moveToX;
    if (cfg.moveToY != null) emitterCfg.moveToY = cfg.moveToY;

    // ── Hold (keep particle alive after alpha reaches 0) ──
    if (cfg.hold != null) emitterCfg.hold = cfg.hold;

    // ── Callbacks ──
    if (cfg.onEmit) emitterCfg.emitCallback = cfg.onEmit;
    if (cfg.onDeath) emitterCfg.deathCallback = cfg.onDeath;

    const emitter = this.scene.add.particles(px, py, textureKey, emitterCfg);
    emitter.setDepth(15);
    emitter.explode(scaledCount);
    this.scene.time.delayedCall(cfg.lifespan.max + (cfg.hold ?? 0) + 120, () => emitter.destroy());
  }

  /**
   * Creates a persistent, looping particle effect for a teleport pad.
   * Emitters are tracked so they can be destroyed on scene shutdown.
   */
  public createTeleportEffect(px: number, py: number) {
    this.ensureTextures();

    // Base glowing aura on the ground
    const aura = this.scene.add
      .particles(px, py + 8, TEX.CIRCLE, {
        tint: [0xaaffff, 0xffffff, 0x4488ff],
        scale: { start: 0.78, end: 0.52 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 2000,
        frequency: 500,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(1);

    // Magical stars floating upwards continuously
    const stars = this.scene.add
      .particles(px, py, TEX.STAR, {
        tint: [0xffffff, 0xaaffff],
        scale: { start: 0.26, end: 0.0 },
        alpha: { start: 1, end: 0 },
        speed: { min: 10, max: 30 },
        angle: { min: 250, max: 290 }, // Flowing upwards
        gravityY: -10,
        lifespan: { min: 900, max: 1500 },
        frequency: 200,
        rotate: { start: 0, end: 360 },
        x: { min: -12, max: 12 },
        y: { min: 0, max: 8 },
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(2);

    this.teleportEmitters.push(aura, stars);
  }

  /**
   * Animated expanding ring drawn with Graphics.
   * Starts at startRadius and expands to endRadius over durationMs, fading out.
   */
  private ring(
    px: number,
    py: number,
    color: number,
    startRadius: number,
    endRadius: number,
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
   * Three glow passes: wide soft halo → medium glow → bright core.
   * Optional branching splits a secondary bolt off ~40% down the main bolt.
   */
  private lightning(
    x: number,
    y: number,
    color = 0xffffff,
    height = 120,
    segments = 10,
    branch = false,
  ) {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(16);
    gfx.setBlendMode(Phaser.BlendModes.ADD);

    const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(x, y - height)];
    for (let i = 1; i < segments; i++) {
      pts.push(
        new Phaser.Math.Vector2(
          x + Phaser.Math.Between(-30, 30),
          y - height + (height * i) / segments,
        ),
      );
    }
    pts.push(new Phaser.Math.Vector2(x, y));

    // Wide soft halo → medium glow → sharp bright core
    gfx.lineStyle(10, color, 0.07);
    gfx.strokePoints(pts, false);
    gfx.lineStyle(5, color, 0.18);
    gfx.strokePoints(pts, false);
    gfx.lineStyle(2, color, 0.95);
    gfx.strokePoints(pts, false);

    // Optional branch: diverges from ~40% down at a randomised side angle
    if (branch) {
      const bi = Math.floor(segments * 0.4);
      const origin = pts[bi];
      const dir = Phaser.Math.Between(0, 1) ? 1 : -1;
      const bPts: Phaser.Math.Vector2[] = [origin.clone()];
      for (let i = 1; i <= 4; i++) {
        bPts.push(
          new Phaser.Math.Vector2(
            origin.x + dir * (10 + i * 12) + Phaser.Math.Between(-8, 8),
            origin.y + (height * 0.38 * i) / 4,
          ),
        );
      }
      gfx.lineStyle(4, color, 0.1);
      gfx.strokePoints(bPts, false);
      gfx.lineStyle(1.5, color, 0.65);
      gfx.strokePoints(bPts, false);
    }

    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 132,
      delay: 80,
      ease: "Power2.In",
      onComplete: () => gfx.destroy(),
    });
  }

  // ── Spell-specific effect functions ──────────────────────────────────────

  private fx_fireball(px: number, py: number) {
    // ── 1. Initial flash & shockwave ──────────────────────────────────────
    this.flash(px, py, 0xffffff, 32, 42);
    this.ring(px, py, 0xff4400, 5, 42, 220, 0.9, 3);
    this.scene.time.delayedCall(25, () => this.ring(px, py, 0xff8800, 10, 60, 300, 0.45, 2));

    // ── 2. Core fireball blast — hot gas with color lifecycle (white→orange→red→dark) ──
    this.burst(px, py, TEX.CIRCLE, {
      colors: [],   // overridden by `color`
      color: [0xffffff, 0xffcc44, 0xff6600, 0xff2200, 0x331100],
      colorEase: "Quad.Out",
      count: 14,
      speed: { min: 60, max: 180 },
      scale: { start: 0.46, end: 0.0 },
      scaleEase: "Cubic.Out",
      lifespan: { min: 120, max: 300 },
      ...PHYSICS.FIRE,
      radius: 5,
    });

    // ── 3. Heavy embers — parabolic arcs, bounce off ground ────────────
    this.burst(px, py, TEX.SPARK, {
      colors: [0xff6600, 0xffaa00, 0xffdd44],
      count: 10,
      speed: { min: 80, max: 200 },
      scale: { start: 0.28, end: 0.0 },
      lifespan: { min: 250, max: 500 },
      ...PHYSICS.EARTH,
      gravityY: 140,
      bounce: 0.3,
      bounds: { x: px - 80, y: py - 100, width: 160, height: 110 },
      angle: { min: 200, max: 340 },
      radius: 4,
    });

    // ── 4. Smoke ─────────────────────────────────────────────────────────
    this.createThickSmoke(px, py);

    // ── 5. Delayed secondary sparks — lighter, with gentle float ─────────
    this.scene.time.delayedCall(40, () => {
      this.burst(px, py, TEX.SPARK, {
        colors: [],
        color: [0xffee88, 0xff8800, 0x441100],
        count: 6,
        speed: { min: 30, max: 90 },
        scale: { start: 0.22, end: 0.0 },
        lifespan: { min: 180, max: 360 },
        gravityY: 60,
        radius: 10,
      });
    });
  }



  private fx_thunderstorm(px: number, py: number) {
    // Use the new hyper-realistic lightning effect for the main strike
    this.createLightningStrike(px, py);

    // Two secondary strikes (reduced from 4 for perf)
    this.scene.time.delayedCall(36, () => {
      this.lightning(px - 38, py, 0xddddff, 108, 7);
      this.lightning(px + 32, py, 0xddddff, 118, 8);
    });

    // Horizontal electric sparks
    this.burst(px, py, TEX.SPARK, {
      colors: [0xffffff, 0xffffaa],
      count: 7,
      speed: { min: 80, max: 220 },
      scale: { start: 0.26, end: 0.0 },
      lifespan: { min: 36, max: 108 },
      angle: { min: 160, max: 200 },
      radius: 19,
    });
  }

  private fx_frost_nova(px: number, py: number) {
    // Utilize the realistic frost explosion
    this.createFrostExplosion(px, py);

    // Initial shockwave
    this.ring(px, py, 0x44ccff, 5, 72, 360, 0.9, 4);
    this.scene.time.delayedCall(54, () => this.ring(px, py, 0xffffff, 5, 57, 300, 0.6, 2));
    
    // Lingering deep cold particles — drift laterally with ICE physics
    this.burst(px, py, TEX.CIRCLE, {
      colors: [],
      color: [0xffffff, 0xaaddff, 0x4488cc, 0x223355],
      colorEase: "Sine.InOut",
      count: 8,
      speed: { min: 10, max: 40 },
      scale: { start: 0.26, end: 0.0 },
      scaleEase: "Sine.Out",
      lifespan: { min: 288, max: 540 },
      ...PHYSICS.ICE,
      gravityY: 15,
      radius: 35,
    });
  }



  private fx_shield_bash(px: number, py: number) {
    this.flash(px, py, 0xaaccff, 19, 48);
    
    // Add realistic earth shatter from the heavy impact
    this.createEarthShatter(px, py);

    this.burst(px, py, TEX.SPARK, {
      colors: [0xffffff, 0xaaccff, 0x6688cc],
      count: 10,
      speed: { min: 100, max: 220 },
      scale: { start: 0.31, end: 0.0 },
      lifespan: { min: 72, max: 180 },
      angle: { min: -55, max: 55 },
      ...PHYSICS.LIGHTNING,
    });
    // Stun stars pop up above the impact
    this.scene.time.delayedCall(54, () => {
      this.burst(px, py - TILE_SIZE, TEX.STAR, {
        colors: [0xffff00, 0xffcc00, 0xffffff],
        count: 2,
        speed: { min: 20, max: 55 },
        scale: { start: 0.31, end: 0.1 },
        lifespan: { min: 252, max: 360 },
        rotate: { start: 0, end: 720 },
        gravityY: -15,
        radius: 10,
      });
    });
  }





  private fx_poison(px: number, py: number) {
    this.ring(px, py, 0x44cc00, 4, 32, 222, 0.8, 2);
    
    // Utilize the realistic poison cloud
    this.createPoisonCloud(px, py);
    
    // An extra squirt of venom
    this.burst(px, py, TEX.CIRCLE, {
      colors: [], color: [0x88ff00, 0x44ff44, 0x00aa00, 0x003300],
      count: 4,
      speed: { min: 50, max: 120 },
      scale: { start: 0.31, end: 0.0 },
      lifespan: { min: 108, max: 252 },
      ...PHYSICS.POISON,
      gravityY: 150,
      maxVelocityY: 120,
    });
  }



  private fx_smite(px: number, py: number) {
    this.lightning(px, py, 0xffff88, 105, 6);
    this.ring(px, py, 0xffee44, 5, 30, 198, 0.85, 2);
    this.burst(px, py, TEX.STAR, {
      colors: [0xffff44, 0xffcc00, 0xffffff],
      count: 7,
      speed: { min: 90, max: 210 },
      scale: { start: 0.28, end: 0.0 },
      lifespan: { min: 90, max: 201 },
      angle: { min: 50, max: 130 },
      rotate: { start: 0, end: 360 },
    });
  }


  // ── New Spells ──────────────────────────────────────────────────────────


  private fx_meteor_strike(px: number, py: number) {
    // Drop the meteor
    this.createMeteorFall(px, py, 480);
    
    // Slight warning ring before impact
    this.ring(px, py, 0xff2200, 3, 50, 450, 0.4, 2);

    this.scene.time.delayedCall(480, () => {
      // Impact effects
      this.createEarthShatter(px, py);
      this.createCampfire(px, py);
      this.createThickSmoke(px, py);
      
      this.flash(px, py, 0xffffff, 64, 90);
      this.ring(px, py, 0xff4400, 8, 96, 360, 0.9, 4);
      
      // Massive explosion sparks — bounce off crater
      this.burst(px, py, TEX.SPARK, {
        colors: [],
        color: [0xffffff, 0xffff44, 0xff6600, 0x441100],
        colorEase: "Quad.Out",
        count: 17,
        speed: { min: 150, max: 350 },
        scale: { start: 0.52, end: 0.0 },
        lifespan: { min: 144, max: 360 },
        ...PHYSICS.EARTH,
        gravityY: 100,
        bounce: 0.3,
        bounds: { x: px - 100, y: py - 120, width: 200, height: 130 },
      });
    });
  }

  private fx_chain_lightning(casterSessionId: string | undefined, px: number, py: number) {
    // If we have a caster, draw a bolt from them to the target
    if (casterSessionId) {
      const sprite = this.spriteManager.getSprite(casterSessionId);
      if (sprite) {
        const sx = sprite.renderX;
        const sy = sprite.renderY - TILE_SIZE * 0.4;
        
        // Custom horizontal/diagonal bolt
        const gfx = this.scene.add.graphics();
        gfx.setDepth(16);
        gfx.setBlendMode(Phaser.BlendModes.ADD);

        const pts: Phaser.Math.Vector2[] = [new Phaser.Math.Vector2(sx, sy)];
        const segments = 8;
        for (let i = 1; i < segments; i++) {
          pts.push(
            new Phaser.Math.Vector2(
              sx + ((px - sx) * i) / segments + Phaser.Math.Between(-15, 15),
              sy + ((py - sy) * i) / segments + Phaser.Math.Between(-15, 15)
            )
          );
        }
        pts.push(new Phaser.Math.Vector2(px, py));

        gfx.lineStyle(6, 0xffffff, 0.2);
        gfx.strokePoints(pts, false);
        gfx.lineStyle(2, 0xaaffff, 0.9);
        gfx.strokePoints(pts, false);

        this.scene.tweens.add({
          targets: gfx,
          alpha: 0,
          duration: 54,
          ease: "Power2.In",
          onComplete: () => gfx.destroy(),
        });
      }
    }

    // Impact blast
    this.createLightningStrike(px, py);
    
    // Horizontal chaining sparks
    this.burst(px, py, TEX.SHARD, {
      colors: [0xffffff, 0xaaffff],
      count: 7,
      speed: { min: 100, max: 300 },
      scale: { start: 0.31, end: 0.0 },
      lifespan: { min: 72, max: 180 },
      angle: { min: -20, max: 20 }, // Shoot mostly right
      gravityY: 0,
    });
    this.burst(px, py, TEX.SHARD, {
      colors: [0xffffff, 0xaaffff],
      count: 7,
      speed: { min: 100, max: 300 },
      scale: { start: 0.31, end: 0.0 },
      lifespan: { min: 72, max: 180 },
      angle: { min: 160, max: 200 }, // Shoot mostly left
      gravityY: 0,
    });
  }

  private fx_entangling_roots(px: number, py: number) {
    this.createVines(px, py);
    this.ring(px, py, 0x44aa44, 4, 30, 240, 0.8, 2);
  }

  private fx_cleansing_rain(px: number, py: number) {
    this.createRain(px, py, 70); // 70px radius for a nice AoE shower
    this.flash(px, py - 20, 0x88ffff, 64, 120); // Soft flash in the clouds
  }

  private fx_acid_splash(px: number, py: number) {
    this.createAcidSplash(px, py);
    this.createPoisonCloud(px, py);
    this.flash(px, py, 0x44ff00, 24, 60);
  }

  private fx_earthquake(px: number, py: number) {
    this.createEarthShatter(px, py);
    
    // Multiple delayed rings for a shaking effect
    this.ring(px, py, 0x885522, 10, 64, 300, 0.8, 4);
    this.scene.time.delayedCall(90, () => this.ring(px, py, 0x663311, 10, 96, 360, 0.7, 3));
    this.scene.time.delayedCall(180, () => this.ring(px, py, 0x442200, 10, 120, 420, 0.5, 2));
    
    // Screen shaking is handled by camera, but we emphasize it with heavy particles
    this.burst(px, py, TEX.SMOKE, {
      colors: [], color: [0x885533, 0x553311, 0x442200, 0x221100],
      count: 14,
      speed: { min: 50, max: 150 },
      scale: { start: 0.52, end: 0.1 },
      ...PHYSICS.SMOKE,
      lifespan: { min: 216, max: 432 },
      gravityY: 0,
      radius: 26,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.6, end: 0 },
    });
  }


  private fx_tree_form(px: number, py: number) {
    // Rooted transformation — rising green nature mist
    this.ring(px, py, 0x228822, 5, 36, 312, 0.85, 3);
    this.createVines(px, py);
    this.burst(px, py, TEX.SMOKE, {
      colors: [], color: [0x66CC66, 0x44AA44, 0x228822, 0x114411],
      count: 7,
      speed: { min: 15, max: 50 },
      scale: { start: 0.47, end: 0.05 },
      lifespan: { min: 216, max: 468 },
      gravityY: -30,
      radius: 18,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.6, end: 0 },
    });
    this.burst(px, py, TEX.STAR, {
      colors: [0x88FF88, 0x44FF88, 0xFFFFFF],
      count: 4,
      speed: { min: 20, max: 65 },
      scale: { start: 0.26, end: 0.0 },
      lifespan: { min: 216, max: 396 },
      rotate: { start: 0, end: 360 },
      gravityY: -55,
      radius: 15,
    });
  }



  // ── Non-spell game-event effects ─────────────────────────────────────────

  /** Dark smoke burst + blood flash at a dying entity's position. */
  playDeath(targetSessionId: string) {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    this.ensureTextures();
    const px = sprite.renderX;
    const py = sprite.renderY - TILE_SIZE * 0.4;
    if (!this.isOnScreen(px, py)) return;

    // Brief white flash → red flash for dramatic impact
    this.flash(px, py, 0xffffff, 22, 60);
    this.scene.time.delayedCall(55, () => {
      this.flash(px, py, 0xdd0000, 32, 200);
      this.ring(px, py, 0x880000, 5, 40, 380, 0.7, 3);
    });
    this.burst(px, py, TEX.SMOKE, {
      colors: [], color: [0x440022, 0x330011, 0x220000, 0x110000],
      count: 15,
      speed: { min: 22, max: 85 },
      scale: { start: 0.65, end: 0.07 },
      ...PHYSICS.SMOKE,
      lifespan: { min: 360, max: 900 },
      gravityY: -14,
      radius: 13,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.7, end: 0 },
    });
    // Blood droplets falling downward — bounce off ground
    this.burst(px, py, TEX.CIRCLE, {
      colors: [], color: [0xff2222, 0x880000, 0x440000, 0x220000],
      count: 14,
      speed: { min: 50, max: 160 },
      scale: { start: 0.36, end: 0.0 },
      lifespan: { min: 180, max: 390 },
      radius: 6,
      ...PHYSICS.EARTH,
      gravityY: 85,
      bounce: 0.2,
      bounds: { x: px - 60, y: py - 60, width: 120, height: 70 },
    });
    // Blood splatter arcing upward
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff0000, 0xcc0000],
      count: 7,
      speed: { min: 60, max: 145 },
      scale: { start: 0.27, end: 0.0 },
      lifespan: { min: 120, max: 252 },
      angle: { min: 220, max: 320 },
      gravityY: 180,
    });
  }

  /**
   * Gold star explosion + screen flash for levelling up.
   * Replaces the simple "LEVEL UP!" floating text.
   */
  playLevelUp(targetSessionId: string) {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    this.ensureTextures();
    const px = sprite.renderX;
    const py = sprite.renderY - TILE_SIZE * 0.5;

    this.flash(px, py, 0xffff88, 60, 250);
    this.ring(px, py, 0xffff00, 5, 64, 700, 0.9, 6);
    this.scene.time.delayedCall(80, () => this.ring(px, py, 0xffd700, 5, 50, 580, 0.7, 4));
    this.scene.time.delayedCall(160, () => this.ring(px, py, 0xffffff, 5, 36, 460, 0.5, 2));
    // Primary spinning gold stars
    this.burst(px, py, TEX.STAR, {
      colors: [], color: [0xffffff, 0xffff88, 0xffd700, 0x886600],
      colorEase: "Sine.Out",
      count: 25,
      speed: { min: 55, max: 200 },
      scale: { start: 0.52, end: 0.0 },
      lifespan: { min: 360, max: 720 },
      rotate: { start: 0, end: 720 },
      radius: 7,
      ...PHYSICS.HOLY,
      gravityY: -40,
    });
    // Golden cross-shaped sparks
    this.burst(px, py, TEX.CROSS, {
      colors: [], color: [0xffffff, 0xffff88, 0xffcc00],
      count: 7,
      speed: { min: 25, max: 80 },
      scale: { start: 0.42, end: 0.0 },
      lifespan: { min: 480, max: 840 },
      rotate: { start: 0, end: 360 },
      ...PHYSICS.HOLY,
      gravityY: -50,
      radius: 18,
    });
    // Wide sparkle cloud
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffff44, 0xffd700, 0xffffff],
      count: 16,
      speed: { min: 35, max: 95 },
      scale: { start: 0.29, end: 0.0 },
      lifespan: { min: 420, max: 870 },
      gravityY: -62,
      radius: 26,
    });
    // Large styled text — bigger than normal floatText
    this.floatText(px, py - 56, "✦ LEVEL UP! ✦", "#ffff00", "16px");
  }

  /**
   * Brief ring + spark burst at the tile where a new item/gold just landed.
   * Color matches the item's rarity / type so players can spot rare drops at a glance.
   * Pass `isGold = true` for a premium golden shower effect.
   */
  playDropLanded(tileX: number, tileY: number, color: number, isGold = false) {
    this.ensureTextures();
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    if (!this.isOnScreen(px, py)) return;

    if (isGold) {
      // Two staggered rings + a shower of golden coins arcing upward
      this.ring(px, py, 0xffdd44, 10, 4, 380, 0.85, 3);
      this.scene.time.delayedCall(80, () => this.ring(px, py, 0xffaa00, 8, 3, 300, 0.55, 2));
      this.burst(px, py, TEX.STAR, {
        colors: [0xffee44, 0xffcc00, 0xffffff],
        count: 8,
        speed: { min: 30, max: 90 },
        scale: { start: 0.49, end: 0.0 },
        lifespan: { min: 168, max: 336 },
        angle: { min: 230, max: 310 }, // arc upward
        rotate: { start: 0, end: 540 },
        gravityY: 120,
        blendMode: Phaser.BlendModes.ADD,
      });
    } else {
      this.ring(px, py, color, 8, 3, 300, 0.65, 2);
      this.burst(px, py, TEX.SPARK, {
        colors: [color, 0xffffff],
        count: 4,
        speed: { min: 20, max: 55 },
        scale: { start: 0.26, end: 0.0 },
        lifespan: { min: 120, max: 270 },
        radius: 3,
      });
    }
  }

  /** Mint flash + rising sparkles when a player respawns at a tile. */
  playRespawn(targetSessionId: string) {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    this.ensureTextures();
    const px = sprite.renderX;
    const py = sprite.renderY;

    this.flash(px, py, 0x44ffaa, 32, 220);
    this.ring(px, py, 0x44ffaa, 5, 42, 460, 0.8, 3);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0x44ffaa, 0xaaffee],
      count: 10,
      speed: { min: 20, max: 72 },
      scale: { start: 0.29, end: 0.0 },
      lifespan: { min: 240, max: 492 },
      gravityY: -45,
      radius: 13,
    });
    this.burst(px, py, TEX.STAR, {
      colors: [0xffffff, 0x88ffcc],
      count: 4,
      speed: { min: 25, max: 60 },
      scale: { start: 0.33, end: 0.0 },
      lifespan: { min: 330, max: 570 },
      rotate: { start: 0, end: 360 },
      gravityY: -50,
      radius: 10,
    });
  }

  /**
   * A ring contracting inward toward the caster while a spell is winding up.
   * The ring color reflects the spell's school/effect.
   */
  playCastWindup(sessionId: string, spellId: string) {
    const sprite = this.spriteManager.getSprite(sessionId);
    if (!sprite) return;
    this.ensureTextures();
    const color = this.spellWindupColor(spellId);
    const px = sprite.renderX;
    const py = sprite.renderY - TILE_SIZE * 0.4;
    // Two contracting rings at different radii/timings for a charging effect
    this.ring(px, py, color, 34, 4, 200, 0.7, 2);
    this.scene.time.delayedCall(60, () => this.ring(px, py, color, 20, 3, 140, 0.5, 1));
    // Small particle spray to draw the eye
    this.burst(px, py, TEX.SPARK, {
      colors: [color],
      count: 3,
      speed: { min: 10, max: 28 },
      scale: { start: 0.2, end: 0.0 },
      lifespan: { min: 60, max: 120 },
      radius: 14,
    });
  }


  // ── Recipe-based effect player ───────────────────────────────────────────────

  /** Renders a data-driven FxRecipe at the given world pixel position. */
  private playRecipe(px: number, py: number, recipe: FxRecipe) {
    if (recipe.flash) this.flash(px, py, recipe.flash.color, recipe.flash.size, recipe.flash.duration);
    if (recipe.rings) {
      for (const r of recipe.rings) {
        const play = () => this.ring(px, py, r.color, r.start, r.end, r.duration, r.alpha ?? 0.85, r.width ?? 3);
        r.delay ? this.scene.time.delayedCall(r.delay, play) : play();
      }
    }
    if (recipe.bursts) {
      for (const b of recipe.bursts) {
        const { tex, delay, ...cfg } = b;
        const play = () => this.burst(px, py, TEX[tex], cfg);
        delay ? this.scene.time.delayedCall(delay, play) : play();
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Plays the full layered visual effect for a spell at a tile position. */
  playSpellEffect(spellId: string, targetTileX: number, targetTileY: number, casterSessionId?: string) {
    this.ensureTextures();
    const px = targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const py = targetTileY * TILE_SIZE + TILE_SIZE / 2;
    if (!this.isOnScreen(px, py)) return;

    // Custom effects that need scene helpers or special logic
    switch (spellId) {
      case "fireball":        return this.fx_fireball(px, py);
      case "thunderstorm":    return this.fx_thunderstorm(px, py);
      case "frost_nova":      return this.fx_frost_nova(px, py);
      case "shield_bash":     return this.fx_shield_bash(px, py);
      case "smite":           return this.fx_smite(px, py);
      case "poison_arrow": case "envenom": case "poison_bite":
                              return this.fx_poison(px, py);
      case "meteor_strike":   return this.fx_meteor_strike(px, py);
      case "chain_lightning":  return this.fx_chain_lightning(casterSessionId, px, py);
      case "entangling_roots": return this.fx_entangling_roots(px, py);
      case "cleansing_rain":  return this.fx_cleansing_rain(px, py);
      case "acid_splash":     return this.fx_acid_splash(px, py);
      case "earthquake":      return this.fx_earthquake(px, py);
      case "tree_form":       return this.fx_tree_form(px, py);
    }

    // Data-driven effects: resolve alias, find recipe, play it
    const key = SPELL_FX_ALIASES[spellId] ?? spellId;
    const recipe = SPELL_FX[key] ?? SPELL_FX._default;
    this.playRecipe(px, py, recipe);
  }

  /** Plays a melee hit burst at the target's world position. */
  playMeleeHit(targetSessionId: string | null) {
    if (!targetSessionId) return;
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    this.ensureTextures();
    const px = sprite.renderX;
    const py = sprite.renderY - TILE_SIZE * 0.5;
    if (!this.isOnScreen(px, py)) return;
    this.flash(px, py, 0xff4444, 16, 60);
    this.burst(px, py, TEX.SPARK, {
      colors: [0xff4444, 0xff8844, 0xffcc88, 0xffffff],
      count: 8,
      speed: { min: 50, max: 115 },
      scale: { start: 0.36, end: 0.0 },
      lifespan: { min: 90, max: 234 },
      angle: { min: -55, max: 55 },
    });
  }

  showDamage(targetSessionId: string, amount: number, type: "physical" | "magic" | "dot" | "dodged" | "parried") {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    
    if (type === "dodged" || type === "parried") {
      const text = type === "dodged" ? i18n.t("game.dodged") : i18n.t("game.parried");
      this.floatText(sprite.renderX, sprite.renderY - 20, text, "#aaaaaa", "10px");
      return;
    }
    
    // Use red for all damage (physical, magic, dot) as per user request
    const color = "#ff4444";
    const prefix = "-";
    const size = type === "dot" ? "10px" : "12px";
    this.floatText(sprite.renderX, sprite.renderY - 20, `${prefix}${amount}`, color, size);
  }

  showHeal(targetSessionId: string, amount: number) {
    const sprite = this.spriteManager.getSprite(targetSessionId);
    if (!sprite) return;
    this.floatText(sprite.renderX, sprite.renderY - 20, `+${amount}`, "#33cc33", "12px");
  }

  showFloatingText(sessionId: string, text: string, color: string) {
    const sprite = this.spriteManager.getSprite(sessionId);
    if (!sprite) return;
    this.floatText(sprite.renderX, sprite.renderY - 28, text, color, "10px");
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** Returns a tint colour that visually represents the given spell's school/effect. */
  private spellWindupColor(spellId: string): number {
    const PER_SPELL: Record<string, number> = {
      fireball: 0xff4400,
      fire_breath: 0xff4400,
      enrage: 0xff6600,
      ice_bolt: 0x44aaff,
      frost_nova: 0x44aaff,
      frost_breath: 0x44aaff,
      thunderstorm: 0xffff44,
      smite: 0xffee44,
      holy_bolt: 0xffee44,
      arcane_surge: 0xcc44ff,
      shadow_bolt: 0x8800cc,
      heal: 0x44ff88,
      holy_nova: 0x44ff88,
      lay_on_hands: 0x44ff88,
      holy_strike: 0xffdd44,
      judgment: 0xffdd44,
      consecration: 0xffcc44,
      aura_of_protection: 0xffffff,
      divine_shield: 0xffffff,
      cleanse_paralysis: 0xffffff,
      stealth: 0x8888aa,
      smoke_bomb: 0x8888aa,
      detect_invisibility: 0x00ffff,
      summon_skeleton: 0x442266,
      curse: 0x8800cc,
      banshee_wail: 0x8800cc,
      soul_drain: 0x8844cc,
      hemorrhage: 0xcc0000,
      backstab: 0xcc0000,
      poison_arrow: 0x44cc00,
      envenom: 0x44cc00,
      poison_bite: 0x44cc00,
      war_cry: 0xff8800,
      battle_shout: 0xff9900,
      whirlwind: 0x88ff44,
      shield_bash: 0x88aaff,
      web_shot: 0x999999,
      mana_shield: 0x4488ff,
      evasion: 0x88ddff,
      mark_target: 0xff4444,
      aimed_shot: 0xff8800,
      multi_shot: 0xaaff44,
    };
    if (PER_SPELL[spellId]) return PER_SPELL[spellId];
    const spell = ABILITIES[spellId];
    if (!spell) return 0xaaaaff;
    if (spell.effect === "heal" || spell.effect === "aoe_heal") return 0x44ff88;
    if (spell.effect === "stun") return 0xffff44;
    if (spell.effect === "debuff") return 0xcc44ff;
    if (spell.effect === "stealth") return 0x888899;
    if (spell.effect === "dot") return 0x44cc00;
    if (spell.scalingStat === "int") return 0xcc44ff;
    if (spell.scalingStat === "agi") return 0x44ff44;
    return 0xff8800;
  }

  private floatText(x: number, y: number, content: string, color: string, fontSize: string) {
    const text = this.scene.add
      .text(x, y, content, {
        fontSize,
        color,
        fontFamily: FONTS.display,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
        resolution: getGameTextResolution(),
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.scene.tweens.add({
      targets: text,
      y: y - 28,
      alpha: 0,
      duration: 750,
      ease: "Power1",
      onComplete: () => text.destroy(),
    });
  }

  /**
   * Checks whether `spellId` warrants a projectile animation (ranged spell with
   * a meaningful travel distance) and launches one if so. Safe to call
   * unconditionally — all guard logic lives here.
   */
  maybeLaunchProjectile(
    casterSessionId: string,
    spellId: string,
    targetTileX: number,
    targetTileY: number,
  ) {
    const spell = ABILITIES[spellId];
    if (!spell || spell.rangeTiles <= 1) return;

    const sprite = this.spriteManager.getSprite(casterSessionId);
    if (!sprite) return;

    const casterTileX = Math.round(sprite.renderX / TILE_SIZE);
    const casterTileY = Math.round(sprite.renderY / TILE_SIZE);
    const dx = targetTileX - casterTileX;
    const dy = targetTileY - casterTileY;
    if (Math.sqrt(dx * dx + dy * dy) < 2) return;

    const travelMs = Math.max(120, spell.windupMs ?? 200);
    this.playProjectile(casterSessionId, spellId, targetTileX, targetTileY, travelMs);
  }

  /**
   * Evaluates an attacker and targets, launching a generic attack projectile if it's a ranged auto-attack.
   */
  maybeLaunchAttackProjectile(
    attackerSessionId: string,
    targetTileX: number,
    targetTileY: number,
  ) {
    const sprite = this.spriteManager.getSprite(attackerSessionId);
    if (!sprite) return;

    const casterTileX = Math.round(sprite.renderX / TILE_SIZE);
    const casterTileY = Math.round(sprite.renderY / TILE_SIZE);
    const dx = targetTileX - casterTileX;
    const dy = targetTileY - casterTileY;
    if (Math.sqrt(dx * dx + dy * dy) < 1.5) return;

    // Ranged auto-attacks generally have faster windups.
    // We don't have direct access to stats/class here easily, so we provide a generic physical-looking projectile.
    this.playArrowProjectile(attackerSessionId, targetTileX, targetTileY, 200);
  }

  /**
   * Animates a physical arrow projectile traveling from a caster sprite to a target tile.
   */
  private playArrowProjectile(
    casterSessionId: string,
    targetTileX: number,
    targetTileY: number,
    durationMs: number,
  ) {
    const sprite = this.spriteManager.getSprite(casterSessionId);
    if (!sprite) return;
    this.ensureTextures();

    const sx = sprite.renderX;
    const sy = sprite.renderY - TILE_SIZE * 0.4;
    const tx = targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const ty = targetTileY * TILE_SIZE + TILE_SIZE / 2;

    const angle = Phaser.Math.Angle.Between(sx, sy, tx, ty);
    
    const arrow = this.scene.add.image(sx, sy, TEX.ARROW);
    arrow.setDepth(16);
    arrow.setRotation(angle);

    const proxy = { t: 0 };
    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: durationMs,
      ease: "Linear",
      onUpdate: () => {
        const px = sx + (tx - sx) * proxy.t;
        const py = sy + (ty - sy) * proxy.t;
        arrow.setPosition(px, py);
      },
      onComplete: () => {
        arrow.destroy();
      },
    });
  }

  /**
   * Animates a projectile particle traveling from a caster sprite to a target
   * tile over `durationMs` milliseconds. Prefer `maybeLaunchProjectile` for
   * spell casts — this lower-level method skips range/distance guards.
   */
  playProjectile(
    casterSessionId: string,
    spellId: string,
    targetTileX: number,
    targetTileY: number,
    durationMs: number,
  ) {
    const sprite = this.spriteManager.getSprite(casterSessionId);
    if (!sprite) return;
    this.ensureTextures();

    const sx = sprite.renderX;
    const sy = sprite.renderY - TILE_SIZE * 0.4;
    const tx = targetTileX * TILE_SIZE + TILE_SIZE / 2;
    const ty = targetTileY * TILE_SIZE + TILE_SIZE / 2;

    const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
    if (dist < 4) return; // caster is at target, skip

    const { color, texKey, size } = this.projectileStyle(spellId);
    const orbSize = size * 1.5;

    // Glowing orb that travels source → target (larger, multi-layer glow)
    const orb = this.scene.add.graphics();
    orb.setDepth(16);
    orb.setBlendMode(Phaser.BlendModes.ADD);

    // Soft outer halo + bright core
    for (let r = Math.round(orbSize * 2); r >= 1; r--) {
      orb.fillStyle(color, (1 - (r - 1) / Math.round(orbSize * 2)) * 0.5);
      orb.fillCircle(0, 0, r);
    }
    for (let r = Math.round(orbSize); r >= 1; r--) {
      orb.fillStyle(color, 1 - (r - 1) / Math.round(orbSize));
      orb.fillCircle(0, 0, r);
    }
    orb.setPosition(sx, sy);

    // Trail with slight colour variation
    const trail = this.scene.add.particles(sx, sy, texKey, {
      speed: { min: 2, max: 15 },
      scale: { start: 0.36, end: 0.0 },
      lifespan: { min: 90, max: 192 },
      tint: [color, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      alpha: { start: 0.9, end: 0 },
      frequency: 22,
    });
    trail.setDepth(15);

    const proxy = { t: 0 };
    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: durationMs,
      ease: "Linear",
      onUpdate: () => {
        const px = sx + (tx - sx) * proxy.t;
        const py = sy + (ty - sy) * proxy.t;
        orb.setPosition(px, py);
        trail.setPosition(px, py);
      },
      onComplete: () => {
        orb.destroy();
        trail.destroy();
      },
    });
  }

  private projectileStyle(spellId: string): { color: number; texKey: string; size: number } {
    switch (spellId) {
      case "basic_attack":
        return { color: 0xdddddd, texKey: TEX.CIRCLE, size: 2 };
      case "shadow_bolt":
        return { color: 0x8800ff, texKey: TEX.CIRCLE, size: 4 };
      case "magic_dart":
        return { color: 0x88bbff, texKey: TEX.CIRCLE, size: 2 };
      case "fireball":
        return { color: 0xff5500, texKey: TEX.CIRCLE, size: 5 };
      case "ice_bolt":
        return { color: 0x44ccff, texKey: TEX.SHARD, size: 3 };
      case "web_shot":
        return { color: 0xbbbbaa, texKey: TEX.SPARK, size: 3 };
      case "poison_arrow":
      case "poison_bite":
        return { color: 0x44ff44, texKey: TEX.CIRCLE, size: 3 };
      case "aimed_shot":
      case "multi_shot":
        return { color: 0xffdd44, texKey: TEX.SHARD, size: 3 };
      case "soul_drain":
        return { color: 0x8844cc, texKey: TEX.CIRCLE, size: 3 };
      case "holy_strike":
      case "holy_bolt":
      case "smite":
        return { color: 0xffffaa, texKey: TEX.STAR, size: 4 };
      default:
        return { color: this.spellWindupColor(spellId), texKey: TEX.CIRCLE, size: 3 };
    }
  }

  // ── Realistic Elements ──────────────────────────────────────────────────

  /**
   * Realistic Campfire / Burning Effect
   * Creates a lingering fire effect that correctly dissipates at the top
   */
  public createCampfire(px: number, py: number) {
    this.ensureTextures();

    // The Core: Bright, hot, ADD blend mode
    this.burst(px, py + 4, TEX.CIRCLE, {
      colors: [0xffffff, 0xffff44, 0xffaa00, 0xff2200],
      count: 12,
      speed: { min: 10, max: 25 },
      scale: { start: 0.52, end: 0.0 },
      lifespan: { min: 300, max: 540 },
      gravityY: -20,
      radius: 3,
    });

    // The Flames: Orange/Red, ADD blend mode, larger but faster decay
    this.burst(px, py, TEX.SMOKE, {
      colors: [0xff4400, 0xff2200, 0xaa0000],
      count: 9,
      speed: { min: 20, max: 40 },
      scale: { start: 0.65, end: 0.13 },
      lifespan: { min: 360, max: 660 },
      gravityY: -30,
      radius: 6,
    });

    // The Embers: Tiny sparks, ADD blend mode, erratic upward movement
    this.burst(px, py - 4, TEX.SPARK, {
      colors: [0xffaa00, 0xff4400, 0xffffff],
      count: 6,
      speed: { min: 30, max: 70 },
      scale: { start: 0.26, end: 0.0 },
      lifespan: { min: 480, max: 960 },
      gravityY: -45,
      radius: 7,
      angle: { min: 240, max: 300 }, // mostly up
    });

    // Tiny bit of dark smoke right at the very top (optional but realistic)
    this.scene.time.delayedCall(200, () => {
      this.burst(px, py - 18, TEX.SMOKE, {
        colors: [0x444444, 0x222222],
        count: 4,
        speed: { min: 15, max: 30 },
        scale: { start: 0.33, end: 0.78 }, // expands as it rises
        lifespan: { min: 600, max: 1080 },
        gravityY: -15,
        radius: 5,
        blendMode: Phaser.BlendModes.NORMAL,
        alpha: { start: 0.4, end: 0 },
      });
    });
  }

  /**
   * Realistic Volumetric Smoke
   * Creates thick, opaque smoke that expands outward and upward
   */
  public createThickSmoke(px: number, py: number) {
    this.ensureTextures();
    const m = this.particleMultiplier();

    // The main body of smoke (quality-scaled)
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x888888, 0x666666, 0x444444, 0x333333],
      count: Math.max(5, Math.round(14 * m)),
      speed: { min: 12, max: 40 },
      scale: { start: 0.2, end: 0.72 },
      lifespan: { min: 400, max: 800 },
      ...PHYSICS.SMOKE,
      gravityY: -14,
      radius: 8,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.55, end: 0 },
    });

    // Initial blast wisp
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xaaaaaa, 0x888888],
      count: Math.max(3, Math.round(5 * m)),
      speed: { min: 30, max: 60 },
      scale: { start: 0.26, end: 0.0 },
      lifespan: { min: 180, max: 360 },
      gravityY: 0,
      radius: 3,
      blendMode: Phaser.BlendModes.NORMAL,
    });
  }

  /**
   * Realistic Water Splash
   * Uses strong gravity arcs and trailing mist to look fluid
   */
  public createWaterSplash(px: number, py: number) {
    this.ensureTextures();

    // The Impact Puddle: A brief expanding circle on the floor
    this.ring(px, py, 0x44aaff, 3, 24, 400, 0.6, 2);

    // The Main Splashes: Drops arcing upwards and falling rapidly back down
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0xccffff, 0x88ddff, 0x44aaff],
      count: 17,
      speed: { min: 80, max: 220 },
      scale: { start: 0.33, end: 0.0 },
      lifespan: { min: 240, max: 510 },
      gravityY: 450, // **Very heavy** downward pull
      angle: { min: 200, max: 340 }, // Bursting upwards in an arc
      blendMode: Phaser.BlendModes.ADD,
    });

    // The Mist: Fine water vapor hanging in the air after the heavy drops fall
    this.scene.time.delayedCall(50, () => {
      this.burst(px, py - 10, TEX.SMOKE, {
        colors: [0xccffff, 0x88ddff, 0xaaffff],
        count: 6,
        speed: { min: 10, max: 35 },
        scale: { start: 0.39, end: 0.98 },
        lifespan: { min: 360, max: 720 },
        gravityY: -5,
        radius: 10,
        blendMode: Phaser.BlendModes.NORMAL,
        alpha: { start: 0.5, end: 0 },
      });
    });

    // A few trailing sparkles representing tiny glinting droplets
    this.burst(px, py, TEX.SPARK, {
      colors: [0xffffff, 0xccffff],
      count: 5,
      speed: { min: 40, max: 120 },
      scale: { start: 0.2, end: 0.0 },
      lifespan: { min: 180, max: 420 },
      gravityY: 300,
      angle: { min: 220, max: 320 },
    });
  }

  /**
   * Realistic Lightning Strike
   * Creates a blinding flash, sharp branching electrical arcs, and lingering ozone smoke.
   */
  public createLightningStrike(px: number, py: number) {
    this.ensureTextures();
    const m = this.particleMultiplier();
    // Flash and Rings
    this.flash(px, py, 0xffffff, 80, 150);
    this.ring(px, py, 0xaaffff, 5, 120, 500, 0.9, 6);
    this.lightning(px, py, 0xffffff, 160, 12, true);

    // Ozone smoke (ionized air)
    this.burst(px, py, TEX.SMOKE, {
      colors: [0xccccff, 0x8888aa],
      count: Math.max(5, Math.round(10 * m)),
      speed: { min: 20, max: 60 },
      scale: { start: 0.98, end: 0.13 },
      lifespan: { min: 480, max: 900 },
      gravityY: -10,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.6, end: 0 },
    });

    // Crackling electrical sparks
    this.burst(px, py, TEX.SPARK, {
      colors: [0xffffff, 0xaaffff, 0xffff44],
      count: Math.max(10, Math.round(28 * m)),
      speed: { min: 100, max: 350 },
      scale: { start: 0.45, end: 0.0 },
      lifespan: { min: 120, max: 360 },
      gravityY: 150,
      angle: { min: 0, max: 360 },
    });
  }

  /**
   * Realistic Poison Cloud
   * Thick, billowing, slow-moving green toxic fog.
   */
  public createPoisonCloud(px: number, py: number) {
    this.ensureTextures();
    
    // Thick green toxic smoke
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x44ff44, 0x22aa22, 0x116611],
      count: 17,
      speed: { min: 15, max: 40 },
      scale: { start: 0.52, end: 2.27 }, // Expands massively
      lifespan: { min: 900, max: 2100 },
      gravityY: -5,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.85, end: 0 },
    });

    // Bubbling toxic droplets dripping down
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x88ff88, 0x44ff44],
      count: 10,
      speed: { min: 30, max: 80 },
      scale: { start: 0.33, end: 0.0 },
      lifespan: { min: 300, max: 600 },
      gravityY: 150,
      radius: 13,
    });
  }

  /**
   * Realistic Frost Explosion
   * Sharp, crystalline shards rapidly flying out, leaving behind a heavy freezing mist.
   */
  public createFrostExplosion(px: number, py: number) {
    this.ensureTextures();
    const m = this.particleMultiplier();

    this.ring(px, py, 0x88ddff, 6, 120, 500, 0.8, 4);

    // Sharp ice shards exploding outward
    this.burst(px, py, TEX.SHARD, {
      colors: [0xffffff, 0xccffff, 0x88ddff],
      count: Math.max(12, Math.round(40 * m)),
      speed: { min: 150, max: 450 },
      scale: { start: 0.59, end: 0.0 },
      lifespan: { min: 180, max: 420 },
      rotate: { start: 0, end: 720 },
      blendMode: Phaser.BlendModes.ADD,
    });

    // Freezing mist left behind
    this.burst(px, py, TEX.SMOKE, {
      colors: [0xddffff, 0xaaddff],
      count: Math.max(8, Math.round(20 * m)),
      speed: { min: 10, max: 50 },
      scale: { start: 0.33, end: 1.62 },
      lifespan: { min: 720, max: 1440 },
      gravityY: 25,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.7, end: 0 },
    });
  }

  /**
   * Realistic Earth Shatter / Dirt
   * Thick brown dust and heavy rock debris thrown up.
   */
  public createEarthShatter(px: number, py: number) {
    this.ensureTextures();
    
    // Dust cloud billowing upwards
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x664422, 0x442211, 0x221100],
      count: 17,
      speed: { min: 20, max: 70 },
      scale: { start: 0.39, end: 1.82 },
      lifespan: { min: 480, max: 1080 },
      gravityY: -10,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.8, end: 0 },
    });

    // Rock debris falling back down heavily
    this.burst(px, py, TEX.SPARK, {
      colors: [0x554433, 0x332211],
      count: 15,
      speed: { min: 100, max: 200 },
      scale: { start: 0.45, end: 0.13 },
      lifespan: { min: 240, max: 540 },
      gravityY: 500, // Very heavy rocks
      angle: { min: 200, max: 340 }, // Arcing upwards first
      blendMode: Phaser.BlendModes.NORMAL,
    });
  }

  /**
   * Realistic Meteor Fall
   * A blazing fireball dropping from the sky to hit the target.
   */
  public createMeteorFall(px: number, py: number, durationMs: number = 800) {
    this.ensureTextures();
    // Start way off-screen high up
    const startY = py - 600;

    const orb = this.scene.add.graphics();
    orb.setDepth(16);
    orb.setBlendMode(Phaser.BlendModes.ADD);

    const orbSize = 15;
    const color = 0xff3300;

    // Glowing core
    for (let r = orbSize; r >= 1; r--) {
      orb.fillStyle(color, 1 - (r - 1) / orbSize);
      orb.fillCircle(0, 0, r);
    }
    orb.setPosition(px, startY);

    // Thick black/red flaming trail
    const trail = this.scene.add.particles(px, startY, TEX.SMOKE, {
      speed: { min: 10, max: 50 },
      scale: { start: 0.98, end: 0.0 },
      lifespan: { min: 240, max: 480 },
      tint: [0xff4400, 0x221100, 0x441100],
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.8, end: 0 },
      frequency: 20,
    });
    trail.setDepth(15);

    const proxy = { t: 0 };
    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: durationMs,
      ease: "Cubic.In", // Starts slow and accelerates heavily
      onUpdate: () => {
        const currentY = startY + (py - startY) * proxy.t;
        orb.setPosition(px, currentY);
        trail.setPosition(px, currentY);
      },
      onComplete: () => {
        orb.destroy();
        trail.destroy();
      },
    });
  }

  /**
   * Realistic Vines / Roots
   * Earth and green spikes jutting upward to root a target.
   */
  public createVines(px: number, py: number) {
    this.ensureTextures();

    // Initial dirt kickup from the roots bursting out
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x553311, 0x332211],
      count: 7,
      speed: { min: 10, max: 35 },
      scale: { start: 0.33, end: 0.98 },
      lifespan: { min: 240, max: 480 },
      gravityY: -5,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.7, end: 0 },
    });

    // Spiky green vines shooting upwards around the target
    this.burst(px, py + 10, TEX.SHARD, {
      colors: [0x22aa22, 0x116611, 0x448822],
      count: 12,
      speed: { min: 60, max: 180 },
      scale: { start: 0.52, end: 0.13 },
      lifespan: { min: 480, max: 960 },
      angle: { min: 240, max: 300 }, // Shooting strictly upwards
      gravityY: 150, // They arch and stop, simulating grabbing
      blendMode: Phaser.BlendModes.NORMAL,
    });
  }

  /**
   * Cleansing Rain
   * A localized shower falling steadily from above.
   */
  public createRain(px: number, py: number, radius: number = 60) {
    this.ensureTextures();
    
    // Glowing holy/water ring on the ground indicating the healing area
    this.ring(px, py, 0x44ffcc, 5, radius, 1500, 0.5, 3);
    
    // Constant rain falling from above the area
    const emitter = this.scene.add.particles(px, py - 200, TEX.SHARD, {
      x: { min: -radius, max: radius },
      tint: [0x44ffcc, 0xccffff, 0xffffff],
      speed: { min: 250, max: 400 },
      angle: 90, // Falling straight down
      scale: { start: 0.26, end: 0.13 },
      lifespan: 600,
      frequency: 25,
      blendMode: Phaser.BlendModes.ADD,
      alpha: { start: 0.6, end: 0 },
    });
    emitter.setDepth(15);
    
    // Splash impacts on the ground
    const splashEmitter = this.scene.add.particles(px, py, TEX.CIRCLE, {
      x: { min: -radius, max: radius },
      y: { min: -radius/2, max: radius/2 }, // Elliptical ground area
      tint: [0x44ffcc, 0xffffff],
      speed: { min: 10, max: 30 },
      gravityY: 100,
      angle: { min: 220, max: 320 }, // Small upward splashes
      scale: { start: 0.13, end: 0.0 },
      lifespan: 300,
      frequency: 40,
      blendMode: Phaser.BlendModes.ADD,
    });
    splashEmitter.setDepth(14);

    // Stop emitting after duration
    this.scene.time.delayedCall(1500, () => {
      emitter.stop();
      splashEmitter.stop();
      this.scene.time.delayedCall(1000, () => {
        emitter.destroy();
        splashEmitter.destroy();
      });
    });
  }

  /**
   * Realistic Acid Splash
   * Bubbling corrosive green liquid impacting and splashing heavily.
   */
  public createAcidSplash(px: number, py: number) {
    this.ensureTextures();

    // The corrosive puddle
    this.ring(px, py, 0x88ff00, 4, 35, 800, 0.7, 3);

    // Heavy liquid splash, uses gravity to fall back down fast
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x44ff00, 0x88ff44, 0x22cc00],
      count: 20,
      speed: { min: 80, max: 200 },
      scale: { start: 0.39, end: 0.0 },
      lifespan: { min: 240, max: 540 },
      gravityY: 400, // Very heavy
      angle: { min: 200, max: 340 }, 
      blendMode: Phaser.BlendModes.NORMAL,
    });

    // Subtler toxic spray / mist hanging around
    this.scene.time.delayedCall(50, () => {
      this.burst(px, py - 10, TEX.SMOKE, {
        colors: [0x44ff00, 0x88ff44],
        count: 7,
        speed: { min: 10, max: 30 },
        scale: { start: 0.33, end: 0.98 },
        lifespan: { min: 360, max: 720 },
        gravityY: -5,
        blendMode: Phaser.BlendModes.NORMAL,
        alpha: { start: 0.6, end: 0 },
      });
    });
  }
}
