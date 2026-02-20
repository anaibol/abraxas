import Phaser from "phaser";
import { TILE_SIZE } from "@abraxas/shared";

export interface ManagedLight {
  light: Phaser.GameObjects.Light;
  baseIntensity: number;
  flickerOffset: number;
}

/**
 * LightManager — Manages Phaser Lights2D point lights for the game world.
 *
 * Adds warm, flickering lights to campfires / torches, a cool-blue glow for
 * Mana Spring summons, and short-lived flash-lights for spell impacts.
 *
 * Call `enable()` once in GameScene.create(), then wire:
 *   - `addWorldLight()` for map decorations (campfires, torches)
 *   - `addNpcLight()` / `removeNpcLight()` for summons (mana_spring)
 *   - `flashLight()` for spell impacts
 *   - `update(time)` every frame for flicker animation
 */
export class LightManager {
  private persistentLights = new Map<string, ManagedLight>();
  private brightnessScale = 1;

  constructor(private scene: Phaser.Scene) {}

  /**
   * Enable the Lights2D pipeline and set a dim ambient so unlit areas are dark.
   * Call once in GameScene.create() BEFORE creating any map objects.
   */
  enable(ambientR = 80, ambientG = 80, ambientB = 100) {
    this.scene.lights.enable();
    this.scene.lights.setAmbientColor(
      Phaser.Display.Color.GetColor(ambientR, ambientG, ambientB),
    );
  }

  /** Adjust global brightness (0 = off, 1 = full). Used by day/night sync. */
  setAmbientBrightness(normalised: number) {
    this.brightnessScale = normalised;
    const v = Math.round(normalised * 100);
    this.scene.lights.setAmbientColor(Phaser.Display.Color.GetColor(v, v, Math.round(v * 1.2)));
  }

  /**
   * Add a persistent, flickering point light at a world-pixel position.
   * Typically called for campfires and torches on the map.
   */
  addWorldLight(
    key: string,
    px: number,
    py: number,
    color = 0xff8833,
    radius = 180,
    intensity = 1.8,
  ): ManagedLight {
    const { r, g, b } = Phaser.Display.Color.IntegerToRGB(color);
    const light = this.scene.lights.addLight(px, py, radius, Phaser.Display.Color.GetColor(r, g, b), intensity);
    const managed: ManagedLight = {
      light,
      baseIntensity: intensity,
      flickerOffset: Math.random() * Math.PI * 2,
    };
    this.persistentLights.set(key, managed);
    return managed;
  }

  /**
   * Add a cool-glowing light for a *friendly summon* NPC (e.g. mana_spring).
   */
  addNpcLight(
    npcId: string,
    tileX: number,
    tileY: number,
    color = 0x4488ff,
    radius = 120,
  ) {
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    return this.addWorldLight(npcId, px, py, color, radius, 1.5);
  }

  /** Remove a light that was added for a specific NPC (called on NPC death). */
  removeNpcLight(npcId: string) {
    const managed = this.persistentLights.get(npcId);
    if (!managed) return;
    this.scene.lights.removeLight(managed.light);
    this.persistentLights.delete(npcId);
  }

  /**
   * Flash a bright temporary light at a world position.
   * Perfect for spell impact (fireball → orange, frost nova → icy blue).
   */
  flashLight(
    px: number,
    py: number,
    color = 0xffffff,
    radius = 200,
    intensity = 3,
    durationMs = 300,
  ) {
    const { r, g, b } = Phaser.Display.Color.IntegerToRGB(color);
    const light = this.scene.lights.addLight(px, py, radius, Phaser.Display.Color.GetColor(r, g, b), intensity);

    this.scene.tweens.add({
      targets: light,
      intensity: 0,
      duration: durationMs,
      ease: "Quad.Out",
      onComplete: () => {
        this.scene.lights.removeLight(light);
      },
    });
  }

  /**
   * Call every frame so tracked lights flicker naturally.
   * @param time — Phaser's game time in ms (from `update(time, delta)`)
   */
  update(time: number) {
    for (const [, managed] of this.persistentLights) {
      // Composite flicker: two sine waves at different frequencies
      const s1 = Math.sin(time * 0.004 + managed.flickerOffset);
      const s2 = Math.sin(time * 0.013 + managed.flickerOffset * 2.3);
      const flicker = 1 + (s1 * 0.12 + s2 * 0.07);
      managed.light.intensity = managed.baseIntensity * flicker * this.brightnessScale;
    }
  }

  destroy() {
    for (const [, managed] of this.persistentLights) {
      this.scene.lights.removeLight(managed.light);
    }
    this.persistentLights.clear();
    this.scene.lights.disable();
  }
}
