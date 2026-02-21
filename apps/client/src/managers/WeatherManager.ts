import Phaser from "phaser";
import { RENDER_LAYERS } from "../utils/depth";

export type WeatherType = "clear" | "rain" | "snow" | "fog" | "sandstorm" | "storm";

export class WeatherManager {
  private rainEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private snowEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fogEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private sandEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private stormTimer: Phaser.Time.TimerEvent | null = null;
  private currentWeather: WeatherType = "clear";

  constructor(private scene: Phaser.Scene) {}

  public updateWeather(weatherType: WeatherType) {
    if (this.currentWeather === weatherType) return;
    this.currentWeather = weatherType;

    this.stopAll();

    switch (weatherType) {
      case "rain":      this.startRain(); break;
      case "snow":      this.startSnow(); break;
      case "fog":       this.startFog(); break;
      case "sandstorm": this.startSandstorm(); break;
      case "storm":     this.startRain(); this.startStormLightning(); break;
      default: break;
    }
  }

  private stopAll() {
    const fadeAndDestroy = (e: Phaser.GameObjects.Particles.ParticleEmitter | null) => {
      if (!e) return;
      e.stop();
      this.scene.time.delayedCall(2000, () => { e.destroy(); });
    };

    fadeAndDestroy(this.rainEmitter);  this.rainEmitter = null;
    fadeAndDestroy(this.snowEmitter);  this.snowEmitter = null;
    fadeAndDestroy(this.fogEmitter);   this.fogEmitter = null;
    fadeAndDestroy(this.sandEmitter);  this.sandEmitter = null;

    if (this.stormTimer) {
      this.stormTimer.destroy();
      this.stormTimer = null;
    }
  }

  private startRain() {
    if (!this.scene.textures.exists("fx-rain-drop")) {
      const g = this.scene.add.graphics();
      g.fillStyle(0x88ccff, 0.6);
      g.fillRect(0, 0, 2, 20);
      g.generateTexture("fx-rain-drop", 2, 20);
      g.destroy();
    }

    this.rainEmitter = this.scene.add.particles(0, 0, "fx-rain-drop", {
      x: { min: 0, max: this.scene.cameras.main.width * 2 },
      y: -20,
      lifespan: 1500,
      speedY: { min: 600, max: 900 },
      speedX: { min: -100, max: -50 },
      scale: { start: 0.5, end: 1 },
      alpha: { start: 0.8, end: 0.2 },
      frequency: 18,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.rainEmitter.setScrollFactor(0);
    this.rainEmitter.setDepth(RENDER_LAYERS.WEATHER_FOG);
  }

  private startSnow() {
    if (!this.scene.textures.exists("fx-snow-flake")) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(4, 4, 4);
      g.generateTexture("fx-snow-flake", 8, 8);
      g.destroy();
    }

    this.snowEmitter = this.scene.add.particles(0, 0, "fx-snow-flake", {
      x: { min: 0, max: this.scene.cameras.main.width },
      y: -10,
      lifespan: 4000,
      speedY: { min: 100, max: 200 },
      speedX: { min: -50, max: 50 },
      scale: { start: 0.2, end: 0.5 },
      alpha: { start: 0.6, end: 0.1 },
      rotate: { start: 0, end: 360 },
      gravityY: 10,
      frequency: 30,
    });
    this.snowEmitter.setScrollFactor(0);
    this.snowEmitter.setDepth(RENDER_LAYERS.WEATHER_FOG);
  }

  /** Item 88 – Fog: large, slow-drifting translucent cloud particles. */
  private startFog() {
    if (!this.scene.textures.exists("fx-fog-patch")) {
      const g = this.scene.add.graphics();
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const r = 48 * (1 - i / steps);
        const a = (1 - r / 48) ** 0.4 * 0.22;
        g.fillStyle(0xaabbcc, a);
        g.fillCircle(48, 48, r);
      }
      g.generateTexture("fx-fog-patch", 96, 96);
      g.destroy();
    }

    this.fogEmitter = this.scene.add.particles(0, 0, "fx-fog-patch", {
      x: { min: 0, max: this.scene.cameras.main.width },
      y: { min: 0, max: this.scene.cameras.main.height },
      lifespan: { min: 8000, max: 14000 },
      speedX: { min: 10, max: 30 },
      speedY: { min: -5, max: 5 },
      scale: { start: 1.2, end: 2.5 },
      alpha: { start: 0.55, end: 0 },
      frequency: 300,
      blendMode: Phaser.BlendModes.NORMAL,
    });
    this.fogEmitter.setScrollFactor(0);
    this.fogEmitter.setDepth(RENDER_LAYERS.WEATHER_FOG);
  }

  /** Item 88 – Sandstorm: fast horizontal grit/dust particles. */
  private startSandstorm() {
    if (!this.scene.textures.exists("fx-sand-grain")) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xddaa66, 0.75);
      g.fillRect(0, 0, 4, 2);
      g.generateTexture("fx-sand-grain", 4, 2);
      g.destroy();
    }

    this.sandEmitter = this.scene.add.particles(0, 0, "fx-sand-grain", {
      x: -10,
      y: { min: 0, max: this.scene.cameras.main.height },
      lifespan: { min: 600, max: 1200 },
      speedX: { min: 600, max: 1000 },
      speedY: { min: -80, max: 80 },
      scale: { start: 0.8, end: 0.3 },
      alpha: { start: 0.9, end: 0 },
      frequency: 12,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.sandEmitter.setScrollFactor(0);
    this.sandEmitter.setDepth(RENDER_LAYERS.WEATHER_FOG);
  }

  /** Item 88 – Storm: rain + random camera lightning flashes. */
  private startStormLightning() {
    const scheduleLightning = () => {
      const delay = Phaser.Math.Between(1500, 5000);
      this.stormTimer = this.scene.time.delayedCall(delay, () => {
        if (this.currentWeather !== "storm") return;
        // Quick white flash to simulate lightning illumination
        this.scene.cameras.main.flash(120, 220, 220, 255, false, undefined, this);
        // Schedule next strike
        scheduleLightning();
      });
    };
    scheduleLightning();
  }
}
