import { ABILITIES, TILE_SIZE } from "@abraxas/shared";
import Phaser from "phaser";
import { FONTS } from "../ui/tokens";
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
  gravityY?: number;
  radius?: number;
  blendMode?: number;
  rotate?: { start: number; end: number };
  alpha?: { start: number; end: number };
};

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
} as const;

// ── FxRecipe: data-driven spell effect system ────────────────────────────────

type FxRing  = { color: number; start: number; end: number; duration: number; alpha?: number; width?: number; delay?: number };
type FxFlash = { color: number; size: number; duration: number };
type FxBurstEntry = BurstConfig & { tex: keyof typeof TEX; delay?: number };
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
    rings: [{ color: 0x44ddff, start: 4, end: 40, duration: 330, alpha: 0.85, width: 3 }],
    bursts: [
      { tex: "SHARD", colors: [0x88eeff, 0x44aaff, 0xccffff, 0xffffff], count: 22, speed: { min: 80, max: 190 }, scale: { start: 0.7, end: 0 }, lifespan: { min: 300, max: 620 }, rotate: { start: 0, end: 360 } },
      { tex: "CIRCLE", colors: [0xffffff, 0xaaeeff], count: 14, speed: { min: 15, max: 55 }, scale: { start: 0.3, end: 0 }, lifespan: { min: 550, max: 950 }, gravityY: -28, radius: 16 },
    ],
  },
  arcane_surge: {
    flash: { color: 0xaa44ff, size: 36, duration: 100 },
    rings: [
      { color: 0x8844ff, start: 5, end: 50, duration: 420, alpha: 0.85, width: 4 },
      { color: 0xffffff, start: 5, end: 42, duration: 310, alpha: 0.7, width: 2, delay: 60 },
    ],
    bursts: [
      { tex: "CIRCLE", colors: [0xaa44ff, 0xcc88ff, 0xffccff, 0xffffff], count: 34, speed: { min: 70, max: 200 }, scale: { start: 0.8, end: 0 }, lifespan: { min: 350, max: 750 }, gravityY: -32, radius: 8 },
    ],
  },
  mana_shield: {
    rings: [{ color: 0x4488ff, start: 5, end: 36, duration: 380, alpha: 0.85, width: 3 }],
    bursts: [
      { tex: "CIRCLE", colors: [0x4488ff, 0x88bbff, 0xccddff], count: 24, speed: { min: 20, max: 62 }, scale: { start: 0.55, end: 0 }, lifespan: { min: 400, max: 820 }, gravityY: -30, radius: 18 },
      { tex: "RING", colors: [0x4488ff, 0xffffff], count: 8, speed: { min: 10, max: 30 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 600, max: 1100 }, rotate: { start: 0, end: 360 }, radius: 22 },
    ],
  },
  // ── Warrior ──
  war_cry: {
    rings: [
      { color: 0xff6600, start: 5, end: 65, duration: 500, alpha: 0.85, width: 4 },
      { color: 0xffcc00, start: 5, end: 60, duration: 480, alpha: 0.5, width: 3, delay: 100 },
    ],
    bursts: [{ tex: "CIRCLE", colors: [0xff6600, 0xffaa00, 0xffee44], count: 28, speed: { min: 40, max: 120 }, scale: { start: 0.65, end: 0 }, lifespan: { min: 350, max: 700 }, radius: 20 }],
  },
  whirlwind: {
    flash: { color: 0xcccccc, size: 34, duration: 80 },
    rings: [{ color: 0xcccccc, start: 5, end: 52, duration: 400, alpha: 0.85, width: 4 }],
    bursts: [
      { tex: "SHARD", colors: [0xcccccc, 0xffffff, 0xaaccff], count: 28, speed: { min: 90, max: 220 }, scale: { start: 0.65, end: 0 }, lifespan: { min: 200, max: 480 }, angle: { min: 0, max: 360 }, rotate: { start: 0, end: 720 } },
      { tex: "SPARK", colors: [0xffffff, 0xffcc88], count: 16, speed: { min: 50, max: 140 }, scale: { start: 0.4, end: 0 }, lifespan: { min: 150, max: 380 }, angle: { min: 0, max: 360 } },
    ],
  },
  battle_shout: {
    rings: [
      { color: 0xffcc00, start: 5, end: 72, duration: 520, alpha: 0.85, width: 4 },
      { color: 0xffcc00, start: 5, end: 85, duration: 580, alpha: 0.5, width: 3, delay: 120 },
    ],
    bursts: [{ tex: "CIRCLE", colors: [0xffcc00, 0xffee88, 0xffffff], count: 24, speed: { min: 30, max: 90 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 400, max: 780 }, radius: 22 }],
  },
  enrage: {
    flash: { color: 0xff4400, size: 44, duration: 120 },
    rings: [{ color: 0xff4400, start: 5, end: 52, duration: 460, alpha: 0.85, width: 4 }],
    bursts: [{ tex: "CIRCLE", colors: [0xff2200, 0xff8800, 0xffcc00], count: 32, speed: { min: 70, max: 165 }, scale: { start: 0.7, end: 0 }, lifespan: { min: 400, max: 820 }, radius: 20 }],
  },
  // ── Priest / Holy ──
  holy_nova: {
    flash: { color: 0xffffff, size: 46, duration: 100 },
    rings: [
      { color: 0xffffcc, start: 5, end: 60, duration: 450, alpha: 0.9, width: 4 },
      { color: 0xffcc88, start: 5, end: 60, duration: 475, alpha: 0.5, width: 2, delay: 100 },
    ],
    bursts: [{ tex: "STAR", colors: [0xffffff, 0xffff88, 0xffee44, 0xffcc00], count: 32, speed: { min: 40, max: 140 }, scale: { start: 0.7, end: 0 }, lifespan: { min: 400, max: 850 }, rotate: { start: 0, end: 360 }, gravityY: -30 }],
  },
  heal: {
    flash: { color: 0x44ff88, size: 32, duration: 120 },
    rings: [{ color: 0x33dd66, start: 5, end: 42, duration: 380, alpha: 0.85, width: 3 }],
    bursts: [
      { tex: "CROSS", colors: [0x44ff88, 0xffffff, 0xaaffcc], count: 24, speed: { min: 20, max: 80 }, scale: { start: 0.65, end: 0 }, lifespan: { min: 500, max: 950 }, rotate: { start: 0, end: 360 }, gravityY: -48, radius: 14 },
      { tex: "CIRCLE", colors: [0x33dd66, 0x88ffaa], count: 16, speed: { min: 15, max: 50 }, scale: { start: 0.4, end: 0 }, lifespan: { min: 600, max: 1100 }, gravityY: -55, radius: 20 },
      { tex: "STAR", colors: [0xffffff, 0xaaffcc], count: 8, speed: { min: 25, max: 55 }, scale: { start: 0.45, end: 0 }, lifespan: { min: 700, max: 1200 }, rotate: { start: 0, end: 360 }, gravityY: -60, radius: 18 },
    ],
  },
  divine_shield: {
    flash: { color: 0xffff88, size: 42, duration: 120 },
    rings: [
      { color: 0xffdd44, start: 5, end: 48, duration: 420, alpha: 0.9, width: 4 },
      { color: 0xffee88, start: 5, end: 50, duration: 570, alpha: 0.7, width: 3, delay: 100 },
    ],
    bursts: [{ tex: "STAR", colors: [0xffffff, 0xffff44, 0xffcc00], count: 20, speed: { min: 15, max: 60 }, scale: { start: 0.55, end: 0 }, lifespan: { min: 600, max: 1100 }, rotate: { start: 0, end: 360 }, gravityY: -42, radius: 26 }],
  },
  holy_strike: {
    flash: { color: 0xffffaa, size: 28, duration: 80 },
    rings: [{ color: 0xffdd44, start: 4, end: 35, duration: 300, alpha: 0.85, width: 3 }],
    bursts: [{ tex: "STAR", colors: [0xffffff, 0xffff88, 0xffcc00], count: 16, speed: { min: 50, max: 130 }, scale: { start: 0.55, end: 0 }, lifespan: { min: 250, max: 550 }, rotate: { start: 0, end: 360 } }],
  },
  // ── Rogue ──
  smoke_bomb: {
    flash: { color: 0x333333, size: 38, duration: 100 },
    rings: [
      { color: 0x444444, start: 5, end: 55, duration: 500, alpha: 0.75, width: 4 },
      { color: 0x222222, start: 5, end: 70, duration: 680, alpha: 0.45, width: 3, delay: 100 },
    ],
    bursts: [
      { tex: "SMOKE", colors: [0x222222, 0x333333, 0x444444, 0x555555], count: 40, speed: { min: 20, max: 70 }, scale: { start: 1.2, end: 0.2 }, lifespan: { min: 600, max: 1400 }, gravityY: -18, radius: 28, blendMode: 0 /* NORMAL */, alpha: { start: 0.7, end: 0 } },
    ],
  },
  hemorrhage: {
    flash: { color: 0xdd2222, size: 26, duration: 80 },
    rings: [{ color: 0xcc1111, start: 4, end: 36, duration: 320, alpha: 0.85, width: 3 }],
    bursts: [
      { tex: "CIRCLE", colors: [0xff2222, 0xdd0000, 0x880000], count: 22, speed: { min: 50, max: 140 }, scale: { start: 0.6, end: 0 }, lifespan: { min: 250, max: 520 }, gravityY: 55, radius: 8 },
      { tex: "CIRCLE", colors: [0xff4444, 0xcc0000], count: 12, speed: { min: 30, max: 80 }, scale: { start: 0.35, end: 0 }, lifespan: { min: 400, max: 780 }, angle: { min: 210, max: 330 }, gravityY: 120 },
    ],
  },
  backstab: {
    flash: { color: 0xff4444, size: 24, duration: 60 },
    rings: [{ color: 0xff4444, start: 4, end: 28, duration: 250, alpha: 0.85, width: 3 }],
    bursts: [{ tex: "SPARK", colors: [0xff4444, 0xffaa44, 0xffffff], count: 14, speed: { min: 60, max: 160 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 150, max: 350 }, angle: { min: -40, max: 40 } }],
  },
  stealth: {
    rings: [{ color: 0x6644aa, start: 40, end: 5, duration: 400, alpha: 0.7, width: 3 }],
    bursts: [
      { tex: "SMOKE", colors: [0x332255, 0x221133, 0x110022], count: 24, speed: { min: 10, max: 40 }, scale: { start: 0.8, end: 0 }, lifespan: { min: 500, max: 1050 }, gravityY: -15, radius: 22, blendMode: 0, alpha: { start: 0.55, end: 0 } },
      { tex: "CIRCLE", colors: [0x6644aa, 0x8866cc], count: 10, speed: { min: 15, max: 45 }, scale: { start: 0.3, end: 0 }, lifespan: { min: 400, max: 750 }, gravityY: -35, radius: 18 },
    ],
  },
  evasion: {
    flash: { color: 0x44ccff, size: 30, duration: 100 },
    rings: [
      { color: 0x44ccff, start: 5, end: 42, duration: 360, alpha: 0.85, width: 3 },
    ],
    bursts: [
      { tex: "SHARD", colors: [0x44ccff, 0xaaeeff, 0xffffff], count: 20, speed: { min: 80, max: 190 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 200, max: 420 }, rotate: { start: 0, end: 360 } },
    ],
  },
  // ── Hunter ──
  aimed_shot: {
    flash: { color: 0xffaa44, size: 24, duration: 80 },
    rings: [{ color: 0xffaa44, start: 4, end: 36, duration: 300, alpha: 0.85, width: 3 }],
    bursts: [
      { tex: "SPARK", colors: [0xffaa44, 0xffcc88, 0xffffff], count: 18, speed: { min: 80, max: 200 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 200, max: 450 }, angle: { min: -30, max: 30 } },
      { tex: "CIRCLE", colors: [0xffaa44, 0xff8800], count: 10, speed: { min: 20, max: 55 }, scale: { start: 0.3, end: 0 }, lifespan: { min: 300, max: 600 }, radius: 12 },
    ],
  },
  multi_shot: {
    rings: [{ color: 0x88ff44, start: 4, end: 37, duration: 340, alpha: 0.75, width: 3 }],
    bursts: [{ tex: "SHARD", colors: [0x88ff44, 0xffee44, 0xffffff], count: 22, speed: { min: 90, max: 190 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 250, max: 510 }, angle: { min: -65, max: 65 }, rotate: { start: 0, end: 180 } }],
  },
  mark_target: {
    flash: { color: 0xff4444, size: 22, duration: 80 },
    rings: [{ color: 0xff4444, start: 4, end: 30, duration: 300, alpha: 0.85, width: 3 }],
    bursts: [{ tex: "CROSS", colors: [0xff4444, 0xffaa44, 0xffffff], count: 12, speed: { min: 20, max: 55 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 400, max: 750 }, rotate: { start: 0, end: 360 } }],
  },
  curse: {
    rings: [{ color: 0x8800aa, start: 5, end: 40, duration: 400, alpha: 0.8, width: 4 }],
    bursts: [
      { tex: "SMOKE", colors: [0x440066, 0x220033, 0x110022], count: 22, speed: { min: 15, max: 55 }, scale: { start: 0.8, end: 0 }, lifespan: { min: 500, max: 1100 }, gravityY: -22, radius: 20, blendMode: 0, alpha: { start: 0.6, end: 0 } },
      { tex: "CIRCLE", colors: [0x8800aa, 0xcc44ff, 0xff88ff], count: 16, speed: { min: 30, max: 92 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 350, max: 720 }, gravityY: -36, radius: 12 },
    ],
  },
  // ── NPC effects ──
  fire_breath: {
    rings: [{ color: 0xff4400, start: 5, end: 72, duration: 520, alpha: 0.85, width: 5 }],
    bursts: [
      { tex: "CIRCLE", colors: [0xff2200, 0xff7700, 0xffcc00, 0xffee88], count: 48, speed: { min: 60, max: 185 }, scale: { start: 0.9, end: 0 }, lifespan: { min: 400, max: 920 }, gravityY: -35, radius: 42 },
      { tex: "SMOKE", colors: [0x883300, 0x441100], count: 18, speed: { min: 20, max: 62 }, scale: { start: 1.1, end: 0.2 }, lifespan: { min: 600, max: 1250 }, gravityY: -22, radius: 37, blendMode: 0, alpha: { start: 0.52, end: 0 } },
    ],
  },
  frost_breath: {
    rings: [
      { color: 0x44aaff, start: 5, end: 68, duration: 540, alpha: 0.8, width: 4 },
      { color: 0xffffff, start: 5, end: 52, duration: 440, alpha: 0.5, width: 2, delay: 85 },
    ],
    bursts: [
      { tex: "SHARD", colors: [0x44ccff, 0x88eeff, 0xffffff], count: 30, speed: { min: 60, max: 165 }, scale: { start: 0.6, end: 0 }, lifespan: { min: 400, max: 760 }, rotate: { start: 0, end: 270 }, radius: 38 },
      { tex: "SMOKE", colors: [0x88ccff, 0xaaddff], count: 16, speed: { min: 15, max: 47 }, scale: { start: 0.9, end: 0.2 }, lifespan: { min: 600, max: 1120 }, gravityY: -16, radius: 42, blendMode: 0, alpha: { start: 0.42, end: 0 } },
    ],
  },
  banshee_wail: {
    rings: [
      { color: 0x8844cc, start: 5, end: 78, duration: 620, alpha: 0.8, width: 5 },
      { color: 0xcc44ff, start: 5, end: 62, duration: 510, alpha: 0.55, width: 3, delay: 105 },
    ],
    bursts: [
      { tex: "SMOKE", colors: [0xcc44ff, 0x880088, 0x4400aa], count: 26, speed: { min: 20, max: 68 }, scale: { start: 0.8, end: 0 }, lifespan: { min: 600, max: 1250 }, gravityY: -22, radius: 52, blendMode: 0, alpha: { start: 0.62, end: 0 } },
      { tex: "CIRCLE", colors: [0x8844cc, 0xcc44ff], count: 18, speed: { min: 30, max: 92 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 400, max: 820 }, gravityY: -36, radius: 32 },
    ],
  },
  shadow_bolt: {
    rings: [{ color: 0x330044, start: 5, end: 42, duration: 370, alpha: 0.8, width: 4 }],
    bursts: [
      { tex: "CIRCLE", colors: [0x220033, 0x550055, 0x8800aa, 0xff44ff], count: 32, speed: { min: 60, max: 178 }, scale: { start: 0.7, end: 0 }, lifespan: { min: 350, max: 720 }, radius: 7 },
      { tex: "SMOKE", colors: [0x110022, 0x330033], count: 15, speed: { min: 15, max: 50 }, scale: { start: 0.9, end: 0.1 }, lifespan: { min: 500, max: 1020 }, gravityY: -16, radius: 17, blendMode: 0, alpha: { start: 0.5, end: 0 } },
    ],
  },
  soul_drain: {
    rings: [{ color: 0x4422aa, start: 4, end: 30, duration: 320, alpha: 0.8, width: 3 }],
    bursts: [{ tex: "CIRCLE", colors: [0x4422aa, 0x8844cc, 0xaaaaff], count: 20, speed: { min: 20, max: 72 }, scale: { start: 0.55, end: 0 }, lifespan: { min: 400, max: 820 }, gravityY: -48, radius: 11 }],
  },
  web_shot: {
    rings: [{ color: 0x888888, start: 5, end: 32, duration: 360, alpha: 0.7, width: 3 }],
    bursts: [{ tex: "CIRCLE", colors: [0x888888, 0xaaaaaa, 0xffffff], count: 20, speed: { min: 30, max: 92 }, scale: { start: 0.4, end: 0 }, lifespan: { min: 300, max: 660 }, radius: 11 }],
  },
  // ── Paladin ──
  consecration: {
    rings: [
      { color: 0xffcc00, start: 5, end: 48, duration: 480, alpha: 0.85, width: 4 },
      { color: 0xff6600, start: 5, end: 36, duration: 380, alpha: 0.6, width: 3, delay: 80 },
    ],
    bursts: [
      { tex: "CIRCLE", colors: [0xff6600, 0xffcc00, 0xffffff, 0xffee44], count: 32, speed: { min: 50, max: 145 }, scale: { start: 0.65, end: 0 }, lifespan: { min: 400, max: 840 }, gravityY: -32, radius: 30 },
      { tex: "STAR", colors: [0xffffff, 0xffee44], count: 14, speed: { min: 25, max: 72 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 500, max: 920 }, rotate: { start: 0, end: 360 }, gravityY: -42, radius: 24 },
    ],
  },
  // ── Druid ──
  bear_form: {
    flash: { color: 0x8B5E3C, size: 40, duration: 150 },
    rings: [{ color: 0x8B5E3C, start: 6, end: 52, duration: 500, alpha: 0.8, width: 4 }],
    bursts: [
      { tex: "SMOKE", colors: [0x6B4226, 0xA07040, 0x5C3A1C], count: 30, speed: { min: 30, max: 95 }, scale: { start: 1.0, end: 0.1 }, lifespan: { min: 500, max: 1100 }, gravityY: -18, radius: 32, blendMode: 0, alpha: { start: 0.7, end: 0 } },
      { tex: "CIRCLE", colors: [0x8B5E3C, 0xD2A679, 0xFFEECC], count: 16, speed: { min: 50, max: 130 }, scale: { start: 0.55, end: 0 }, lifespan: { min: 350, max: 700 }, radius: 18 },
    ],
  },
  cat_form: {
    rings: [{ color: 0x44FF88, start: 4, end: 40, duration: 360, alpha: 0.8, width: 3 }],
    bursts: [
      { tex: "SHARD", colors: [0x44FF88, 0xAAFFCC, 0xFFFFFF], count: 24, speed: { min: 100, max: 240 }, scale: { start: 0.55, end: 0 }, lifespan: { min: 180, max: 380 }, angle: { min: 0, max: 360 }, rotate: { start: 0, end: 180 } },
      { tex: "CIRCLE", colors: [0x44FF88, 0x88FFCC], count: 12, speed: { min: 30, max: 80 }, scale: { start: 0.35, end: 0 }, lifespan: { min: 300, max: 600 }, gravityY: -40, radius: 16 },
    ],
  },
  // ── Necromancer ──
  summon: {
    rings: [
      { color: 0x220033, start: 5, end: 40, duration: 480, alpha: 0.7, width: 4 },
      { color: 0x8844CC, start: 5, end: 30, duration: 380, alpha: 0.4, width: 2, delay: 80 },
    ],
    bursts: [
      { tex: "SMOKE", colors: [0x110022, 0x330033, 0x550055], count: 28, speed: { min: 15, max: 55 }, scale: { start: 1.0, end: 0.1 }, lifespan: { min: 700, max: 1500 }, gravityY: -40, radius: 20, blendMode: 0, alpha: { start: 0.65, end: 0 } },
      { tex: "CIRCLE", colors: [0xCC44FF, 0x8800CC, 0x4400AA], count: 18, speed: { min: 30, max: 90 }, scale: { start: 0.55, end: 0 }, lifespan: { min: 400, max: 850 }, gravityY: -60, radius: 14 },
    ],
  },
  // ── Default fallback ──
  _default: {
    rings: [{ color: 0xaaaaff, start: 4, end: 32, duration: 320, alpha: 0.7, width: 2 }],
    bursts: [{ tex: "CIRCLE", colors: [0xffffff, 0xaaaaff], count: 18, speed: { min: 40, max: 105 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 300, max: 620 } }],
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
  private burst(px: number, py: number, textureKey: string, cfg: BurstConfig) {
    const scaledCount = Math.max(1, Math.round(cfg.count * this.particleMultiplier()));
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
    emitter.explode(scaledCount);
    this.scene.time.delayedCall(cfg.lifespan.max + 120, () => emitter.destroy());
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
        scale: { start: 1.2, end: 0.8 },
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
        scale: { start: 0.4, end: 0 },
        alpha: { start: 1, end: 0 },
        speed: { min: 10, max: 30 },
        angle: { min: 250, max: 290 }, // Flowing upwards
        gravityY: -10,
        lifespan: { min: 1500, max: 2500 },
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
      duration: 220,
      delay: 80,
      ease: "Power2.In",
      onComplete: () => gfx.destroy(),
    });
  }

  // ── Spell-specific effect functions ──────────────────────────────────────

  private fx_fireball(px: number, py: number) {
    this.flash(px, py, 0xffffff, 40, 80);
    this.ring(px, py, 0xff4400, 5, 58, 400, 0.9, 4);
    // Delayed shockwave ring at larger radius
    this.scene.time.delayedCall(50, () => this.ring(px, py, 0xff8800, 10, 85, 580, 0.5, 3));
    
    // Massive fireball burst
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff2200, 0xff7700, 0xffcc00, 0xffee88],
      count: 50,
      speed: { min: 80, max: 240 },
      scale: { start: 1.0, end: 0 },
      lifespan: { min: 400, max: 900 },
      gravityY: -40,
      radius: 10,
    });
    
    // Add realistic thick smoke for the subsequent explosion
    this.createThickSmoke(px, py);
    
    this.scene.time.delayedCall(80, () => {
      // Hot embers scattered outward
      this.burst(px, py, TEX.SPARK, {
        colors: [0xff6600, 0xffaa00, 0xffff44],
        count: 35,
        speed: { min: 50, max: 150 },
        scale: { start: 0.6, end: 0 },
        lifespan: { min: 600, max: 1200 },
        gravityY: -60,
        radius: 20,
      });
    });
  }

  private fx_ice_bolt(px: number, py: number) {
    this.ring(px, py, 0x44ddff, 4, 40, 330, 0.85, 3);
    this.burst(px, py, TEX.SHARD, {
      colors: [0x88eeff, 0x44aaff, 0xccffff, 0xffffff],
      count: 22,
      speed: { min: 80, max: 190 },
      scale: { start: 0.7, end: 0 },
      lifespan: { min: 300, max: 620 },
      rotate: { start: 0, end: 360 },
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0xaaeeff],
      count: 14,
      speed: { min: 15, max: 55 },
      scale: { start: 0.3, end: 0 },
      lifespan: { min: 550, max: 950 },
      gravityY: -28,
      radius: 16,
    });
  }

  private fx_thunderstorm(px: number, py: number) {
    // Use the new hyper-realistic lightning effect for the main strike
    this.createLightningStrike(px, py);

    // Two secondary strikes (reduced from 4 for perf)
    this.scene.time.delayedCall(60, () => {
      this.lightning(px - 38, py, 0xddddff, 108, 7);
      this.lightning(px + 32, py, 0xddddff, 118, 8);
    });

    // Horizontal electric sparks
    this.burst(px, py, TEX.SPARK, {
      colors: [0xffffff, 0xffffaa],
      count: 22,
      speed: { min: 80, max: 220 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 100, max: 300 },
      angle: { min: 160, max: 200 },
      radius: 30,
    });
  }

  private fx_frost_nova(px: number, py: number) {
    // Utilize the realistic frost explosion
    this.createFrostExplosion(px, py);

    // Initial shockwave
    this.ring(px, py, 0x44ccff, 5, 90, 600, 0.9, 5);
    this.scene.time.delayedCall(90, () => this.ring(px, py, 0xffffff, 5, 72, 500, 0.6, 2));
    
    // Lingering deep cold particles
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x88ddff, 0xffffff],
      count: 25,
      speed: { min: 10, max: 40 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 800, max: 1500 },
      gravityY: 15, // Falling snow
      radius: 55,
    });
  }

  private fx_arcane_surge(px: number, py: number) {
    this.flash(px, py, 0xff44ff, 60, 110);
    this.ring(px, py, 0xcc44ff, 5, 58, 400, 0.9, 5);
    this.scene.time.delayedCall(60, () => this.ring(px, py, 0xffffff, 5, 42, 310, 0.7, 2));
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xcc44ff, 0xff44cc, 0xff88ff, 0xffffff],
      count: 55,
      speed: { min: 100, max: 270 },
      scale: { start: 0.85, end: 0 },
      lifespan: { min: 450, max: 960 },
      radius: 12,
    });
    this.burst(px, py, TEX.STAR, {
      colors: [0xffffff, 0xcc88ff],
      count: 16,
      speed: { min: 30, max: 100 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 600, max: 1100 },
      rotate: { start: 0, end: 720 },
      gravityY: -20,
      radius: 26,
    });
  }

  private fx_war_cry(px: number, py: number) {
    this.ring(px, py, 0xff8800, 5, 85, 620, 0.8, 5);
    this.scene.time.delayedCall(100, () => this.ring(px, py, 0xffcc00, 5, 60, 480, 0.5, 3));
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff8800, 0xffcc00, 0xffff00],
      count: 30,
      speed: { min: 60, max: 145 },
      scale: { start: 0.65, end: 0 },
      lifespan: { min: 350, max: 720 },
      radius: 22,
    });
  }

  private fx_whirlwind(px: number, py: number) {
    this.ring(px, py, 0x88ff44, 5, 55, 480, 0.7, 4);
    this.burst(px, py, TEX.SHARD, {
      colors: [0x88ff44, 0x44cc44, 0xffff44, 0xffffff],
      count: 32,
      speed: { min: 100, max: 240 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 450, max: 820 },
      rotate: { start: 0, end: 540 },
      radius: 30,
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xccff88, 0xffffff],
      count: 20,
      speed: { min: 30, max: 80 },
      scale: { start: 0.35, end: 0 },
      lifespan: { min: 400, max: 760 },
      gravityY: -25,
      radius: 24,
    });
  }

  private fx_shield_bash(px: number, py: number) {
    this.flash(px, py, 0xaaccff, 24, 80);
    
    // Add realistic earth shatter from the heavy impact
    this.createEarthShatter(px, py);

    this.burst(px, py, TEX.SPARK, {
      colors: [0xffffff, 0xaaccff, 0x6688cc],
      count: 30,
      speed: { min: 100, max: 220 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 200, max: 500 },
      angle: { min: -55, max: 55 },
    });
    // Stun stars pop up above the impact
    this.scene.time.delayedCall(90, () => {
      this.burst(px, py - TILE_SIZE, TEX.STAR, {
        colors: [0xffff00, 0xffcc00, 0xffffff],
        count: 7,
        speed: { min: 20, max: 55 },
        scale: { start: 0.6, end: 0.2 },
        lifespan: { min: 700, max: 1000 },
        rotate: { start: 0, end: 720 },
        gravityY: -15,
        radius: 16,
      });
    });
  }

  private fx_battle_shout(px: number, py: number) {
    this.flash(px, py, 0xff8800, 65, 130);
    this.ring(px, py, 0xff8800, 5, 105, 720, 0.78, 6);
    this.scene.time.delayedCall(120, () => this.ring(px, py, 0xffcc00, 5, 85, 580, 0.5, 3));
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff8800, 0xffcc00, 0xffff00],
      count: 30,
      speed: { min: 55, max: 135 },
      scale: { start: 0.62, end: 0 },
      lifespan: { min: 400, max: 720 },
      radius: 26,
    });
  }

  private fx_holy_nova(px: number, py: number) {
    this.flash(px, py, 0xffffff, 55, 120);
    this.ring(px, py, 0xffee44, 5, 94, 720, 0.9, 6);
    this.scene.time.delayedCall(100, () => this.ring(px, py, 0xffcc88, 5, 60, 475, 0.5, 2));
    this.burst(px, py, TEX.STAR, {
      colors: [0xffffff, 0xffffaa, 0xffcc44],
      count: 36,
      speed: { min: 80, max: 230 },
      scale: { start: 0.7, end: 0 },
      lifespan: { min: 500, max: 1000 },
      rotate: { start: 0, end: 540 },
      radius: 12,
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0xffffa0],
      count: 20,
      speed: { min: 20, max: 65 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 700, max: 1300 },
      gravityY: -68,
      radius: 58,
    });
  }

  private fx_heal(px: number, py: number) {
    this.flash(px, py, 0x44ff88, 28, 100);
    this.ring(px, py, 0x44ff88, 5, 44, 440, 0.85, 3);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x44ff88, 0x22cc66, 0x88ffcc, 0xffffff],
      count: 30,
      speed: { min: 15, max: 65 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 600, max: 1200 },
      gravityY: -68,
      radius: 18,
    });
    // Cross-shaped healing sparks rising upward
    this.burst(px, py, TEX.CROSS, {
      colors: [0xffffff, 0xaaffcc, 0x44ff88],
      count: 12,
      speed: { min: 15, max: 48 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 700, max: 1250 },
      rotate: { start: 0, end: 180 },
      gravityY: -55,
      radius: 24,
    });
    this.burst(px, py, TEX.STAR, {
      colors: [0xffffff, 0xaaffcc],
      count: 9,
      speed: { min: 20, max: 55 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 650, max: 1050 },
      rotate: { start: 0, end: 360 },
      gravityY: -45,
      radius: 22,
    });
  }

  private fx_divine_shield(px: number, py: number) {
    this.flash(px, py, 0xffffff, 50, 160);
    this.ring(px, py, 0xffffff, 5, 60, 470, 0.9, 5);
    this.scene.time.delayedCall(100, () => this.ring(px, py, 0xffee88, 5, 50, 570, 0.7, 3));
    this.burst(px, py, TEX.STAR, {
      colors: [0xffffff, 0xffffee, 0xffee88],
      count: 28,
      speed: { min: 55, max: 135 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 450, max: 860 },
      rotate: { start: 0, end: 540 },
      radius: 24,
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0xffffcc],
      count: 20,
      speed: { min: 20, max: 62 },
      scale: { start: 0.4, end: 0 },
      lifespan: { min: 600, max: 1120 },
      gravityY: -42,
      radius: 30,
    });
  }

  private fx_smoke_bomb(px: number, py: number) {
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x555566, 0x333344, 0x222255, 0x444455],
      count: 32,
      speed: { min: 30, max: 90 },
      scale: { start: 1.2, end: 0.3 },
      lifespan: { min: 650, max: 1450 },
      gravityY: -10,
      radius: 24,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.7, end: 0 },
    });
    this.ring(px, py, 0x8888aa, 5, 55, 420, 0.6, 3);
    // Stun stars inside the cloud
    this.scene.time.delayedCall(100, () => {
      this.burst(px, py, TEX.STAR, {
        colors: [0xffffaa, 0xffcc00],
        count: 10,
        speed: { min: 30, max: 75 },
        scale: { start: 0.5, end: 0 },
        lifespan: { min: 500, max: 900 },
        rotate: { start: 0, end: 720 },
        gravityY: -20,
        radius: 32,
      });
    });
  }

  private fx_hemorrhage(px: number, py: number) {
    this.ring(px, py, 0xcc0000, 5, 30, 310, 0.8, 3);
    // Blood drops dripping down
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xcc0000, 0x880000, 0xff4422],
      count: 26,
      speed: { min: 25, max: 85 },
      scale: { start: 0.65, end: 0 },
      lifespan: { min: 350, max: 760 },
      gravityY: 105,
      radius: 8,
    });
    // Life sparks rising up to caster (drained life)
    this.burst(px, py, TEX.SPARK, {
      colors: [0xff2244, 0xff6688, 0xff88aa],
      count: 14,
      speed: { min: 20, max: 58 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 500, max: 920 },
      gravityY: -72,
      radius: 14,
    });
  }

  private fx_backstab(px: number, py: number) {
    this.flash(px, py, 0xff0000, 28, 80);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff2222, 0xcc0000, 0xff8844, 0xffffff],
      count: 24,
      speed: { min: 70, max: 165 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 200, max: 460 },
      angle: { min: -70, max: 70 },
    });
  }

  private fx_stealth(px: number, py: number) {
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x888888, 0xaaaaaa, 0x444466, 0x222244],
      count: 26,
      speed: { min: 10, max: 40 },
      scale: { start: 0.85, end: 0 },
      lifespan: { min: 650, max: 1250 },
      gravityY: -16,
      radius: 24,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.62, end: 0 },
    });
    this.burst(px, py, TEX.STAR, {
      colors: [0x8888cc, 0x4444aa, 0xffffff],
      count: 12,
      speed: { min: 15, max: 48 },
      scale: { start: 0.45, end: 0 },
      lifespan: { min: 500, max: 1050 },
      rotate: { start: 0, end: 360 },
      gravityY: -28,
      radius: 20,
      blendMode: Phaser.BlendModes.NORMAL,
    });
  }

  private fx_poison(px: number, py: number) {
    this.ring(px, py, 0x44cc00, 4, 32, 370, 0.8, 3);
    
    // Utilize the realistic poison cloud
    this.createPoisonCloud(px, py);
    
    // An extra squirt of venom
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x44ff44, 0x00aa00, 0x88ff00],
      count: 15,
      speed: { min: 50, max: 120 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 300, max: 700 },
      gravityY: 120,
    });
  }

  private fx_holy_strike(px: number, py: number) {
    this.flash(px, py, 0xffee44, 24, 80);
    this.ring(px, py, 0xffcc00, 5, 30, 310, 0.75, 3);
    this.burst(px, py, TEX.STAR, {
      colors: [0xffee44, 0xffcc00, 0xffffff, 0xffffaa],
      count: 20,
      speed: { min: 60, max: 145 },
      scale: { start: 0.55, end: 0 },
      lifespan: { min: 300, max: 620 },
      rotate: { start: 0, end: 360 },
    });
  }

  private fx_smite(px: number, py: number) {
    this.lightning(px, py, 0xffff88, 105, 6);
    this.ring(px, py, 0xffee44, 5, 38, 330, 0.85, 3);
    this.burst(px, py, TEX.STAR, {
      colors: [0xffff44, 0xffcc00, 0xffffff],
      count: 22,
      speed: { min: 90, max: 210 },
      scale: { start: 0.55, end: 0 },
      lifespan: { min: 250, max: 560 },
      angle: { min: 50, max: 130 },
      rotate: { start: 0, end: 360 },
    });
  }

  private fx_curse(px: number, py: number) {
    this.ring(px, py, 0x8800cc, 5, 48, 520, 0.85, 4);
    this.burst(px, py, TEX.SMOKE, {
      colors: [0xcc44ff, 0x880088, 0x4400aa],
      count: 20,
      speed: { min: 15, max: 58 },
      scale: { start: 0.7, end: 0 },
      lifespan: { min: 500, max: 1060 },
      gravityY: -32,
      radius: 14,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.65, end: 0 },
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x8844ff, 0xff44ff],
      count: 14,
      speed: { min: 30, max: 90 },
      scale: { start: 0.45, end: 0 },
      lifespan: { min: 450, max: 920 },
      gravityY: -36,
      radius: 16,
    });
  }

  private fx_mark_target(px: number, py: number) {
    this.ring(px, py, 0xff3333, 5, 38, 420, 0.85, 3);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff4444, 0xcc00cc, 0xff88cc],
      count: 18,
      speed: { min: 25, max: 78 },
      scale: { start: 0.45, end: 0 },
      lifespan: { min: 500, max: 920 },
      gravityY: -28,
      radius: 14,
    });
  }

  private fx_mana_shield(px: number, py: number) {
    this.ring(px, py, 0x4488ff, 5, 42, 440, 0.85, 4);
    this.burst(px, py, TEX.RING, {
      colors: [0x4488ff, 0x88aaff, 0xccddff],
      count: 20,
      speed: { min: 30, max: 82 },
      scale: { start: 0.8, end: 0.3 },
      lifespan: { min: 500, max: 960 },
      gravityY: -22,
      radius: 22,
      rotate: { start: 0, end: 180 },
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x88aaff, 0xffffff],
      count: 14,
      speed: { min: 20, max: 72 },
      scale: { start: 0.35, end: 0 },
      lifespan: { min: 450, max: 860 },
      gravityY: -26,
      radius: 19,
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
            count: 5,
            speed: { min: 160, max: 290 },
            scale: { start: 0.7, end: 0 },
            lifespan: { min: 150, max: 300 },
            angle: { min: 173, max: 187 },
          },
        );
      });
    }
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffffff, 0xccddff, 0x88aaff, 0xaaffee],
      count: 18,
      speed: { min: 30, max: 82 },
      scale: { start: 0.4, end: 0 },
      lifespan: { min: 350, max: 760 },
      gravityY: -36,
      radius: 20,
    });
  }

  private fx_aimed_shot(px: number, py: number) {
    this.ring(px, py, 0xff8800, 4, 34, 340, 0.8, 3);
    this.burst(px, py, TEX.SPARK, {
      colors: [0xff8800, 0xffcc44, 0xffffff],
      count: 20,
      speed: { min: 80, max: 190 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 200, max: 510 },
      angle: { min: 150, max: 210 },
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff8800, 0xffcc44],
      count: 12,
      speed: { min: 20, max: 62 },
      scale: { start: 0.4, end: 0 },
      lifespan: { min: 300, max: 620 },
      gravityY: 32,
      radius: 13,
    });
  }

  private fx_multi_shot(px: number, py: number) {
    this.ring(px, py, 0x88ff44, 4, 37, 340, 0.75, 3);
    this.burst(px, py, TEX.SHARD, {
      colors: [0x88ff44, 0xffee44, 0xffffff],
      count: 22,
      speed: { min: 90, max: 190 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 250, max: 510 },
      angle: { min: -65, max: 65 },
      rotate: { start: 0, end: 180 },
    });
  }

  private fx_enrage(px: number, py: number) {
    this.flash(px, py, 0xff4400, 44, 120);
    this.ring(px, py, 0xff4400, 5, 52, 460, 0.85, 4);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff2200, 0xff8800, 0xffcc00],
      count: 32,
      speed: { min: 70, max: 165 },
      scale: { start: 0.7, end: 0 },
      lifespan: { min: 400, max: 820 },
      radius: 20,
    });
  }

  private fx_fire_breath(px: number, py: number) {
    this.ring(px, py, 0xff4400, 5, 72, 520, 0.85, 5);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff2200, 0xff7700, 0xffcc00, 0xffee88],
      count: 48,
      speed: { min: 60, max: 185 },
      scale: { start: 0.9, end: 0 },
      lifespan: { min: 400, max: 920 },
      gravityY: -35,
      radius: 42,
    });
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x883300, 0x441100],
      count: 18,
      speed: { min: 20, max: 62 },
      scale: { start: 1.1, end: 0.2 },
      lifespan: { min: 600, max: 1250 },
      gravityY: -22,
      radius: 37,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.52, end: 0 },
    });
  }

  private fx_frost_breath(px: number, py: number) {
    this.ring(px, py, 0x44aaff, 5, 68, 540, 0.8, 4);
    this.scene.time.delayedCall(85, () => this.ring(px, py, 0xffffff, 5, 52, 440, 0.5, 2));
    this.burst(px, py, TEX.SHARD, {
      colors: [0x44ccff, 0x88eeff, 0xffffff],
      count: 30,
      speed: { min: 60, max: 165 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 400, max: 760 },
      rotate: { start: 0, end: 270 },
      radius: 38,
    });
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x88ccff, 0xaaddff],
      count: 16,
      speed: { min: 15, max: 47 },
      scale: { start: 0.9, end: 0.2 },
      lifespan: { min: 600, max: 1120 },
      gravityY: -16,
      radius: 42,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.42, end: 0 },
    });
  }

  private fx_banshee_wail(px: number, py: number) {
    this.ring(px, py, 0x8844cc, 5, 78, 620, 0.8, 5);
    this.scene.time.delayedCall(105, () => this.ring(px, py, 0xcc44ff, 5, 62, 510, 0.55, 3));
    this.burst(px, py, TEX.SMOKE, {
      colors: [0xcc44ff, 0x880088, 0x4400aa],
      count: 26,
      speed: { min: 20, max: 68 },
      scale: { start: 0.8, end: 0 },
      lifespan: { min: 600, max: 1250 },
      gravityY: -22,
      radius: 52,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.62, end: 0 },
    });
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x8844cc, 0xcc44ff],
      count: 18,
      speed: { min: 30, max: 92 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 400, max: 820 },
      gravityY: -36,
      radius: 32,
    });
  }

  private fx_shadow_bolt(px: number, py: number) {
    this.ring(px, py, 0x330044, 5, 42, 370, 0.8, 4);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x220033, 0x550055, 0x8800aa, 0xff44ff],
      count: 32,
      speed: { min: 60, max: 178 },
      scale: { start: 0.7, end: 0 },
      lifespan: { min: 350, max: 720 },
      radius: 7,
    });
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x110022, 0x330033],
      count: 15,
      speed: { min: 15, max: 50 },
      scale: { start: 0.9, end: 0.1 },
      lifespan: { min: 500, max: 1020 },
      gravityY: -16,
      radius: 17,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.5, end: 0 },
    });
  }

  private fx_soul_drain(px: number, py: number) {
    this.ring(px, py, 0x4422aa, 4, 30, 320, 0.8, 3);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x4422aa, 0x8844cc, 0xaaaaff],
      count: 20,
      speed: { min: 20, max: 72 },
      scale: { start: 0.55, end: 0 },
      lifespan: { min: 400, max: 820 },
      gravityY: -48,
      radius: 11,
    });
  }

  private fx_web_shot(px: number, py: number) {
    this.ring(px, py, 0x888888, 5, 32, 360, 0.7, 3);
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x888888, 0xaaaaaa, 0xffffff],
      count: 20,
      speed: { min: 30, max: 92 },
      scale: { start: 0.4, end: 0 },
      lifespan: { min: 300, max: 660 },
      radius: 11,
    });
  }

  // ── New Spells ──────────────────────────────────────────────────────────

  private fx_meteor_strike(px: number, py: number) {
    // Drop the meteor
    this.createMeteorFall(px, py, 800);
    
    // Slight warning ring before impact
    this.ring(px, py, 0xff2200, 3, 50, 750, 0.4, 2);

    this.scene.time.delayedCall(800, () => {
      // Impact effects
      this.createEarthShatter(px, py);
      this.createCampfire(px, py);
      this.createThickSmoke(px, py);
      
      this.flash(px, py, 0xffffff, 80, 150);
      this.ring(px, py, 0xff4400, 8, 120, 600, 0.9, 5);
      
      // Massive explosion sparks
      this.burst(px, py, TEX.SPARK, {
        colors: [0xffffff, 0xffff44, 0xff6600],
        count: 50,
        speed: { min: 150, max: 350 },
        scale: { start: 1.0, end: 0 },
        lifespan: { min: 400, max: 1000 },
        gravityY: 100, // Sparks fall back heavily
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
          duration: 150,
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
      count: 20,
      speed: { min: 100, max: 300 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 200, max: 500 },
      angle: { min: -20, max: 20 }, // Shoot mostly right
      gravityY: 0,
    });
    this.burst(px, py, TEX.SHARD, {
      colors: [0xffffff, 0xaaffff],
      count: 20,
      speed: { min: 100, max: 300 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 200, max: 500 },
      angle: { min: 160, max: 200 }, // Shoot mostly left
      gravityY: 0,
    });
  }

  private fx_entangling_roots(px: number, py: number) {
    this.createVines(px, py);
    this.ring(px, py, 0x44aa44, 4, 30, 400, 0.8, 3);
  }

  private fx_cleansing_rain(px: number, py: number) {
    this.createRain(px, py, 70); // 70px radius for a nice AoE shower
    this.flash(px, py - 20, 0x88ffff, 80, 200); // Soft flash in the clouds
  }

  private fx_acid_splash(px: number, py: number) {
    this.createAcidSplash(px, py);
    this.createPoisonCloud(px, py);
    this.flash(px, py, 0x44ff00, 30, 100);
  }

  private fx_earthquake(px: number, py: number) {
    this.createEarthShatter(px, py);
    
    // Multiple delayed rings for a shaking effect
    this.ring(px, py, 0x885522, 10, 80, 500, 0.8, 5);
    this.scene.time.delayedCall(150, () => this.ring(px, py, 0x663311, 10, 120, 600, 0.7, 4));
    this.scene.time.delayedCall(300, () => this.ring(px, py, 0x442200, 10, 150, 700, 0.5, 3));
    
    // Screen shaking is handled by camera, but we emphasize it with heavy particles
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x553311, 0x442200],
      count: 40,
      speed: { min: 50, max: 150 },
      scale: { start: 1.0, end: 0.2 },
      lifespan: { min: 600, max: 1200 },
      gravityY: 0,
      radius: 40,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.6, end: 0 },
    });
  }


  private fx_tree_form(px: number, py: number) {
    // Rooted transformation — rising green nature mist
    this.ring(px, py, 0x228822, 5, 46, 520, 0.85, 4);
    this.createVines(px, py);
    this.burst(px, py, TEX.SMOKE, {
      colors: [0x228822, 0x44AA44, 0x66CC66],
      count: 22,
      speed: { min: 15, max: 50 },
      scale: { start: 0.9, end: 0.1 },
      lifespan: { min: 600, max: 1300 },
      gravityY: -30,
      radius: 28,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.6, end: 0 },
    });
    this.burst(px, py, TEX.STAR, {
      colors: [0x88FF88, 0x44FF88, 0xFFFFFF],
      count: 12,
      speed: { min: 20, max: 65 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 600, max: 1100 },
      rotate: { start: 0, end: 360 },
      gravityY: -55,
      radius: 24,
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
      colors: [0x330011, 0x110000, 0x220000, 0x440022],
      count: 30,
      speed: { min: 22, max: 85 },
      scale: { start: 1.0, end: 0.1 },
      lifespan: { min: 600, max: 1500 },
      gravityY: -14,
      radius: 20,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.7, end: 0 },
    });
    // Blood droplets falling downward
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff2222, 0x880000, 0x440000],
      count: 28,
      speed: { min: 50, max: 160 },
      scale: { start: 0.55, end: 0 },
      lifespan: { min: 300, max: 650 },
      radius: 10,
      gravityY: 85,
    });
    // Blood splatter arcing upward
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xff0000, 0xcc0000],
      count: 14,
      speed: { min: 60, max: 145 },
      scale: { start: 0.42, end: 0 },
      lifespan: { min: 200, max: 420 },
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
      colors: [0xffff00, 0xffd700, 0xffffff, 0xffee88],
      count: 50,
      speed: { min: 55, max: 200 },
      scale: { start: 0.8, end: 0 },
      lifespan: { min: 600, max: 1200 },
      rotate: { start: 0, end: 720 },
      radius: 12,
      gravityY: -40,
    });
    // Golden cross-shaped sparks
    this.burst(px, py, TEX.CROSS, {
      colors: [0xffffff, 0xffff44],
      count: 14,
      speed: { min: 25, max: 80 },
      scale: { start: 0.65, end: 0 },
      lifespan: { min: 800, max: 1400 },
      rotate: { start: 0, end: 360 },
      gravityY: -50,
      radius: 28,
    });
    // Wide sparkle cloud
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xffff44, 0xffd700, 0xffffff],
      count: 32,
      speed: { min: 35, max: 95 },
      scale: { start: 0.45, end: 0 },
      lifespan: { min: 700, max: 1450 },
      gravityY: -62,
      radius: 40,
    });
    // Large styled text — bigger than normal floatText
    this.floatText(px, py - 56, "✦ LEVEL UP! ✦", "#ffff00", "18px");
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
        count: 16,
        speed: { min: 30, max: 90 },
        scale: { start: 0.75, end: 0 },
        lifespan: { min: 280, max: 560 },
        angle: { min: 230, max: 310 }, // arc upward
        rotate: { start: 0, end: 540 },
        gravityY: 120,
        blendMode: Phaser.BlendModes.ADD,
      });
    } else {
      this.ring(px, py, color, 8, 3, 300, 0.65, 2);
      this.burst(px, py, TEX.SPARK, {
        colors: [color, 0xffffff],
        count: 8,
        speed: { min: 20, max: 55 },
        scale: { start: 0.4, end: 0 },
        lifespan: { min: 200, max: 450 },
        radius: 6,
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
      count: 20,
      speed: { min: 20, max: 72 },
      scale: { start: 0.45, end: 0 },
      lifespan: { min: 400, max: 820 },
      gravityY: -45,
      radius: 20,
    });
    this.burst(px, py, TEX.STAR, {
      colors: [0xffffff, 0x88ffcc],
      count: 8,
      speed: { min: 25, max: 60 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 550, max: 950 },
      rotate: { start: 0, end: 360 },
      gravityY: -50,
      radius: 16,
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
      count: 6,
      speed: { min: 10, max: 28 },
      scale: { start: 0.3, end: 0 },
      lifespan: { min: 100, max: 200 },
      radius: 22,
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

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
      count: 16,
      speed: { min: 50, max: 115 },
      scale: { start: 0.55, end: 0 },
      lifespan: { min: 150, max: 390 },
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
    // The following code snippet was provided by the user, but it is syntactically incorrect
    // and references a 'sprite' variable that is not available in this function's scope.
    // To make the file syntactically correct as per the instructions,
    // I am inserting the provided snippet as a comment.
    // if (sprite.classType === "MAGE" || sprite.classType === "CLERIC") {
    //   // Light blue for mages, soft yellow/gold for clerics
    //   color = sprite.classType === "MAGE" ? 0x88bbff : 0xffffaa;
    // }
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
      scale: { start: 0.55, end: 0 },
      lifespan: { min: 150, max: 320 },
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
        return { color: 0xdddddd, texKey: TEX.CIRCLE, size: 4 };
      case "shadow_bolt":
        return { color: 0x8800ff, texKey: TEX.CIRCLE, size: 7 };
      case "magic_dart":
        return { color: 0x88bbff, texKey: TEX.CIRCLE, size: 4 };
      case "fireball":
        return { color: 0xff5500, texKey: TEX.CIRCLE, size: 8 };
      case "ice_bolt":
        return { color: 0x44ccff, texKey: TEX.SHARD, size: 6 };
      case "web_shot":
        return { color: 0xbbbbaa, texKey: TEX.SPARK, size: 5 };
      case "poison_arrow":
      case "poison_bite":
        return { color: 0x44ff44, texKey: TEX.CIRCLE, size: 5 };
      case "aimed_shot":
      case "multi_shot":
        return { color: 0xffdd44, texKey: TEX.SHARD, size: 5 };
      case "soul_drain":
        return { color: 0x8844cc, texKey: TEX.CIRCLE, size: 6 };
      case "holy_strike":
      case "holy_bolt":
      case "smite":
        return { color: 0xffffaa, texKey: TEX.STAR, size: 7 };
      default:
        return { color: this.spellWindupColor(spellId), texKey: TEX.CIRCLE, size: 6 };
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
      count: 24,
      speed: { min: 10, max: 25 },
      scale: { start: 0.8, end: 0 },
      lifespan: { min: 500, max: 900 },
      gravityY: -20,
      radius: 6,
    });

    // The Flames: Orange/Red, ADD blend mode, larger but faster decay
    this.burst(px, py, TEX.SMOKE, {
      colors: [0xff4400, 0xff2200, 0xaa0000],
      count: 18,
      speed: { min: 20, max: 40 },
      scale: { start: 1.0, end: 0.2 },
      lifespan: { min: 600, max: 1100 },
      gravityY: -30,
      radius: 10,
    });

    // The Embers: Tiny sparks, ADD blend mode, erratic upward movement
    this.burst(px, py - 4, TEX.SPARK, {
      colors: [0xffaa00, 0xff4400, 0xffffff],
      count: 12,
      speed: { min: 30, max: 70 },
      scale: { start: 0.4, end: 0 },
      lifespan: { min: 800, max: 1600 },
      gravityY: -45,
      radius: 12,
      angle: { min: 240, max: 300 }, // mostly up
    });

    // Tiny bit of dark smoke right at the very top (optional but realistic)
    this.scene.time.delayedCall(200, () => {
      this.burst(px, py - 18, TEX.SMOKE, {
        colors: [0x444444, 0x222222],
        count: 8,
        speed: { min: 15, max: 30 },
        scale: { start: 0.5, end: 1.2 }, // expands as it rises
        lifespan: { min: 1000, max: 1800 },
        gravityY: -15,
        radius: 8,
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
      colors: [0x888888, 0x666666, 0x444444, 0x222222],
      count: Math.max(8, Math.round(30 * m)),
      speed: { min: 10, max: 45 },
      scale: { start: 0.5, end: 2.8 },
      lifespan: { min: 1800, max: 3500 },
      gravityY: -8,
      radius: 18,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.85, end: 0 },
    });

    // Initial blast
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0xaaaaaa, 0x888888],
      count: Math.max(4, Math.round(10 * m)),
      speed: { min: 40, max: 80 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 400, max: 800 },
      gravityY: 0,
      radius: 5,
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
      count: 35,
      speed: { min: 80, max: 220 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 400, max: 850 },
      gravityY: 450, // **Very heavy** downward pull
      angle: { min: 200, max: 340 }, // Bursting upwards in an arc
      blendMode: Phaser.BlendModes.ADD,
    });

    // The Mist: Fine water vapor hanging in the air after the heavy drops fall
    this.scene.time.delayedCall(50, () => {
      this.burst(px, py - 10, TEX.SMOKE, {
        colors: [0xccffff, 0x88ddff, 0xaaffff],
        count: 12,
        speed: { min: 10, max: 35 },
        scale: { start: 0.6, end: 1.5 },
        lifespan: { min: 600, max: 1200 },
        gravityY: -5,
        radius: 16,
        blendMode: Phaser.BlendModes.NORMAL,
        alpha: { start: 0.5, end: 0 },
      });
    });

    // A few trailing sparkles representing tiny glinting droplets
    this.burst(px, py, TEX.SPARK, {
      colors: [0xffffff, 0xccffff],
      count: 10,
      speed: { min: 40, max: 120 },
      scale: { start: 0.3, end: 0 },
      lifespan: { min: 300, max: 700 },
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
      scale: { start: 1.5, end: 0.2 },
      lifespan: { min: 800, max: 1500 },
      gravityY: -10,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.6, end: 0 },
    });

    // Crackling electrical sparks
    this.burst(px, py, TEX.SPARK, {
      colors: [0xffffff, 0xaaffff, 0xffff44],
      count: Math.max(10, Math.round(28 * m)),
      speed: { min: 100, max: 350 },
      scale: { start: 0.7, end: 0 },
      lifespan: { min: 200, max: 600 },
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
      count: 35,
      speed: { min: 15, max: 40 },
      scale: { start: 0.8, end: 3.5 }, // Expands massively
      lifespan: { min: 1500, max: 3500 },
      gravityY: -5,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.85, end: 0 },
    });

    // Bubbling toxic droplets dripping down
    this.burst(px, py, TEX.CIRCLE, {
      colors: [0x88ff88, 0x44ff44],
      count: 20,
      speed: { min: 30, max: 80 },
      scale: { start: 0.5, end: 0 },
      lifespan: { min: 500, max: 1000 },
      gravityY: 150,
      radius: 20,
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
      scale: { start: 0.9, end: 0 },
      lifespan: { min: 300, max: 700 },
      rotate: { start: 0, end: 720 },
      blendMode: Phaser.BlendModes.ADD,
    });

    // Freezing mist left behind
    this.burst(px, py, TEX.SMOKE, {
      colors: [0xddffff, 0xaaddff],
      count: Math.max(8, Math.round(20 * m)),
      speed: { min: 10, max: 50 },
      scale: { start: 0.5, end: 2.5 },
      lifespan: { min: 1200, max: 2400 },
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
      count: 35,
      speed: { min: 20, max: 70 },
      scale: { start: 0.6, end: 2.8 },
      lifespan: { min: 800, max: 1800 },
      gravityY: -10,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.8, end: 0 },
    });

    // Rock debris falling back down heavily
    this.burst(px, py, TEX.SPARK, {
      colors: [0x554433, 0x332211],
      count: 30,
      speed: { min: 100, max: 200 },
      scale: { start: 0.7, end: 0.2 },
      lifespan: { min: 400, max: 900 },
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
      scale: { start: 1.5, end: 0 },
      lifespan: { min: 400, max: 800 },
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
      count: 15,
      speed: { min: 10, max: 35 },
      scale: { start: 0.5, end: 1.5 },
      lifespan: { min: 400, max: 800 },
      gravityY: -5,
      blendMode: Phaser.BlendModes.NORMAL,
      alpha: { start: 0.7, end: 0 },
    });

    // Spiky green vines shooting upwards around the target
    this.burst(px, py + 10, TEX.SHARD, {
      colors: [0x22aa22, 0x116611, 0x448822],
      count: 25,
      speed: { min: 60, max: 180 },
      scale: { start: 0.8, end: 0.2 },
      lifespan: { min: 800, max: 1600 },
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
      scale: { start: 0.4, end: 0.2 },
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
      scale: { start: 0.2, end: 0 },
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
      count: 40,
      speed: { min: 80, max: 200 },
      scale: { start: 0.6, end: 0 },
      lifespan: { min: 400, max: 900 },
      gravityY: 400, // Very heavy
      angle: { min: 200, max: 340 }, 
      blendMode: Phaser.BlendModes.NORMAL,
    });

    // Subtler toxic spray / mist hanging around
    this.scene.time.delayedCall(50, () => {
      this.burst(px, py - 10, TEX.SMOKE, {
        colors: [0x44ff00, 0x88ff44],
        count: 15,
        speed: { min: 10, max: 30 },
        scale: { start: 0.5, end: 1.5 },
        lifespan: { min: 600, max: 1200 },
        gravityY: -5,
        blendMode: Phaser.BlendModes.NORMAL,
        alpha: { start: 0.6, end: 0 },
      });
    });
  }
}
