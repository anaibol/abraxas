import Phaser from "phaser";
import { TILE_SIZE } from "@abraxas/shared";

// ── Item #22: Light preset enum ───────────────────────────────────────────────
export const enum LightPreset {
  CAMPFIRE  = "campfire",
  TORCH     = "torch",
  SUMMON    = "summon",
  EXPLOSION = "explosion",
  FROST     = "frost",
  HOLY      = "holy",
  SHADOW    = "shadow",
  ELECTRIC  = "electric",
  HEAL      = "heal",
  PLAYER    = "player",
}

interface PresetConfig {
  color: number;
  radius: number;
  intensity: number;
  flickerSpeed: number; // item #28
}

const PRESET_CONFIGS: Record<LightPreset, PresetConfig> = {
  [LightPreset.CAMPFIRE]:  { color: 0xff7722, radius: 200, intensity: 1.8, flickerSpeed: 0.004 },
  [LightPreset.TORCH]:     { color: 0xff9944, radius: 140, intensity: 1.4, flickerSpeed: 0.005 },
  [LightPreset.SUMMON]:    { color: 0x4488ff, radius: 120, intensity: 1.5, flickerSpeed: 0.012 },
  [LightPreset.EXPLOSION]: { color: 0xff6622, radius: 260, intensity: 3.5, flickerSpeed: 0 },
  [LightPreset.FROST]:     { color: 0x88ccff, radius: 160, intensity: 2.0, flickerSpeed: 0.006 },
  [LightPreset.HOLY]:      { color: 0xffe066, radius: 180, intensity: 2.0, flickerSpeed: 0.003 },
  [LightPreset.SHADOW]:    { color: 0x9944cc, radius: 140, intensity: 1.8, flickerSpeed: 0.02 },
  [LightPreset.ELECTRIC]:  { color: 0xccddff, radius: 200, intensity: 2.2, flickerSpeed: 0.025 },
  [LightPreset.HEAL]:      { color: 0x44ee66, radius: 160, intensity: 1.8, flickerSpeed: 0.003 },
  [LightPreset.PLAYER]:    { color: 0xffffff, radius: 80,  intensity: 0.6, flickerSpeed: 0 },
};

export interface ManagedLight {
  light: Phaser.GameObjects.Light;
  baseIntensity: number;
  baseRadius: number;
  flickerOffset: number;
  flickerSpeed: number;  // item #28
  preset: LightPreset;
  /** If set, this light pulses its radius between baseRadius and maxRadius. Item #29 */
  radiusPulseMax?: number;
}

/**
 * LightManager — Manages Phaser Lights2D point lights for the game world.
 *
 * Supports persistent flickering world lights, summon NPC lights, temporary
 * spell impact flashes, and a mobile player personal light.
 *
 * Full implementation of improvements #21–#30 and #31–#40.
 */
export class LightManager {
  private persistentLights = new Map<string, ManagedLight>();
  /** Item #21: Track active light count to avoid Phaser's hard cap. */
  private readonly MAX_LIGHTS = 48;
  private brightnessScale = 1;
  /** Item #23: Local player personal light. */
  private playerLight: Phaser.GameObjects.Light | null = null;
  private playerLightBaseIntensity = 0.6;
  private playerLightColor = 0xffffff;

  constructor(private scene: Phaser.Scene) {}

  /**
   * Enable the Lights2D pipeline.
   * Call once in GameScene.create() before any map objects are added.
   */
  enable(ambientR = 80, ambientG = 80, ambientB = 100) {
    this.scene.lights.enable();
    this.scene.lights.setAmbientColor(
      Phaser.Display.Color.GetColor(ambientR, ambientG, ambientB),
    );
  }

  /**
   * Item #27 — Sync ambient light to day/night time.
   * 0 = midnight (dark blue), 1 = noon (bright neutral)
   */
  setAmbientBrightness(normalised: number) {
    this.brightnessScale = Math.max(0.1, normalised);
    const v = Math.round(normalised * 110);
    const b = Math.round(v * 1.25); // keep a blue tint at night
    this.scene.lights.setAmbientColor(Phaser.Display.Color.GetColor(v, v, b));
  }

  // ── Item #21: Light count guard ───────────────────────────────────────────────
  private canAddLight(): boolean {
    return this.scene.lights.lights.length < this.MAX_LIGHTS;
  }

  /** Returns the current number of active Lights2D point lights (for debug display). */
  getLightCount(): number {
    return this.scene.lights.lights.length;
  }

  /**
   * Add a persistent, flickering world light using a preset or raw params.
   * Item #25 — fades in on creation.
   */
  addWorldLight(
    key: string,
    px: number,
    py: number,
    preset: LightPreset = LightPreset.CAMPFIRE,
    overrideColor?: number,
    overrideRadius?: number,
  ): ManagedLight | null {
    if (!this.canAddLight()) return null;

    const cfg = PRESET_CONFIGS[preset];
    const color = overrideColor ?? cfg.color;
    const radius = overrideRadius ?? cfg.radius;
    const { r, g, b } = Phaser.Display.Color.IntegerToRGB(color);

    // ── Item #25: Fade-in — start at 0, tween to baseIntensity ────────────────
    const light = this.scene.lights.addLight(px, py, radius, Phaser.Display.Color.GetColor(r, g, b), 0);
    const managed: ManagedLight = {
      light,
      baseIntensity: cfg.intensity,
      baseRadius: radius,
      flickerOffset: Math.random() * Math.PI * 2,
      flickerSpeed: cfg.flickerSpeed,
      preset,
    };
    this.persistentLights.set(key, managed);

    this.scene.tweens.add({
      targets: light,
      intensity: cfg.intensity,
      duration: 400,
      ease: "Quad.In",
    });

    return managed;
  }

  /**
   * Add a light for a summon NPC (mana_spring, explosive_trap, etc.).
   * Item #36: frost variants get icy-blue, fire get orange, etc.
   */
  addNpcLight(npcId: string, tileX: number, tileY: number, npcType = "summon") {
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;

    let preset = LightPreset.SUMMON;
    let pulseMax: number | undefined;

    if (npcType === "mana_spring") {
      preset = LightPreset.HEAL;
      pulseMax = 140; // item #29: Mana Spring pulses radius
    } else if (npcType.includes("fire") || npcType.includes("trap")) {
      preset = LightPreset.CAMPFIRE;
    } else if (npcType.includes("frost") || npcType.includes("ice")) {
      preset = LightPreset.FROST;
    } else if (npcType.includes("shadow") || npcType.includes("undead") || npcType.includes("skeleton")) {
      preset = LightPreset.SHADOW;
    }

    const managed = this.addWorldLight(npcId, px, py, preset);
    if (managed && pulseMax !== undefined) {
      managed.radiusPulseMax = pulseMax; // item #29
    }
    return managed;
  }

  /**
   * Item #26 — Fade-out light on NPC death before removing it.
   */
  removeNpcLight(npcId: string) {
    const managed = this.persistentLights.get(npcId);
    if (!managed) return;

    this.scene.tweens.add({
      targets: managed.light,
      intensity: 0,
      duration: 600,
      ease: "Quad.Out",
      onComplete: () => {
        if (this.scene?.lights) this.scene.lights.removeLight(managed.light);
      },
    });
    this.persistentLights.delete(npcId);
  }

  /**
   * Flash a temporary point light at a world position.
   * Item #24 — animates an expanding radius alongside fading intensity.
   */
  flashLight(
    px: number,
    py: number,
    preset: LightPreset = LightPreset.EXPLOSION,
    overrideColor?: number,
    durationMs = 350,
  ) {
    if (!this.canAddLight()) return;

    const cfg = PRESET_CONFIGS[preset];
    const color = overrideColor ?? cfg.color;
    const { r, g, b } = Phaser.Display.Color.IntegerToRGB(color);

    const startRadius = cfg.radius * 0.4;
    const endRadius   = cfg.radius * 1.6;

    const light = this.scene.lights.addLight(
      px, py, startRadius,
      Phaser.Display.Color.GetColor(r, g, b),
      cfg.intensity,
    );

    // ── Item #24: Expand radius + fade intensity simultaneously ────────────────
    this.scene.tweens.add({
      targets: light,
      intensity: 0,
      radius: endRadius,
      duration: durationMs,
      ease: "Quad.Out",
      onComplete: () => {
        if (this.scene?.lights) this.scene.lights.removeLight(light);
      },
    });
  }

  // ── Item #23: Personal player light ──────────────────────────────────────────
  /**
   * Create (if needed) and update the local player's position-tracked light.
   * Call each frame with the player's current pixel position.
   */
  updatePlayerLight(px: number, py: number) {
    if (!this.playerLight) {
      if (!this.canAddLight()) return;
      const { r, g, b } = Phaser.Display.Color.IntegerToRGB(this.playerLightColor);
      this.playerLight = this.scene.lights.addLight(
        px, py, 80,
        Phaser.Display.Color.GetColor(r, g, b),
        this.playerLightBaseIntensity * this.brightnessScale,
      );
    }
    this.playerLight.x = px;
    this.playerLight.y = py;
    this.playerLight.intensity = this.playerLightBaseIntensity * this.brightnessScale;
  }

  /**
   * Item #32: Dim the player light when stealth is active.
   * Item #33-34: Tint player light to class-buff color.
   */
  setPlayerLightColor(color: number, intensityMultiplier = 1.0) {
    this.playerLightColor = color;
    this.playerLightBaseIntensity = 0.6 * intensityMultiplier;
    if (!this.playerLight) return;
    const { r, g, b } = Phaser.Display.Color.IntegerToRGB(color);
    this.playerLight.setColor(Phaser.Display.Color.GetColor(r, g, b));
  }

  resetPlayerLightColor() {
    this.setPlayerLightColor(0xffffff, 1.0);
  }

  /**
   * Call every frame — animates flicker, radius pulse, and player light.
   */
  update(time: number) {
    for (const [, managed] of this.persistentLights) {
      const { flickerSpeed, flickerOffset } = managed;

      if (flickerSpeed > 0) {
        // Item #28: flickerSpeed is per-light, so campfires are slow and electric fast
        const s1 = Math.sin(time * flickerSpeed + flickerOffset);
        const s2 = Math.sin(time * flickerSpeed * 3.2 + flickerOffset * 2.3);
        const flicker = 1 + (s1 * 0.12 + s2 * 0.07);
        managed.light.intensity = managed.baseIntensity * flicker * this.brightnessScale;
      } else {
        managed.light.intensity = managed.baseIntensity * this.brightnessScale;
      }

      // ── Item #29: Mana Spring radius pulse ───────────────────────────────────
      if (managed.radiusPulseMax !== undefined) {
        const pulse = Math.sin(time * 0.001) * 0.5 + 0.5; // 0–1, 2s period
        managed.light.radius = managed.baseRadius + pulse * (managed.radiusPulseMax - managed.baseRadius);
      }
    }
  }

  destroy() {
    for (const [, managed] of this.persistentLights) {
      this.scene.lights.removeLight(managed.light);
    }
    this.persistentLights.clear();
    if (this.playerLight) {
      this.scene.lights.removeLight(this.playerLight);
      this.playerLight = null;
    }
    this.scene.lights.disable();
  }
}
