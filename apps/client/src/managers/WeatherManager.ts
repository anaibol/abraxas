import Phaser from "phaser";
import { RENDER_LAYERS } from "../utils/depth";

export type WeatherType = "clear" | "rain" | "snow" | "fog" | "sandstorm" | "storm";

export class WeatherManager {
  private rainEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private snowEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fogEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private sandEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private sandCloudsEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private stormTimer: Phaser.Time.TimerEvent | null = null;
  private currentWeather: WeatherType = "clear";

  constructor(private scene: Phaser.Scene) {}

  public updateWeather(weatherType: WeatherType) {
    if (this.currentWeather === weatherType) return;
    this.currentWeather = weatherType;

    this.stopAll();

    switch (weatherType) {
      case "rain":      this.startRain(false); break;
      case "snow":      this.startSnow(); break;
      case "fog":       this.startFog(); break;
      case "sandstorm": this.startSandstorm(); break;
      case "storm":     this.startRain(true); this.startStormLightning(); break;
      default: break;
    }
  }

  private stopAll() {
    const fadeAndDestroy = (e: Phaser.GameObjects.Particles.ParticleEmitter | null) => {
      if (!e) return;
      e.stop();
      this.scene.time.delayedCall(2000, () => { e.destroy(); });
    };

    fadeAndDestroy(this.rainEmitter);        this.rainEmitter = null;
    fadeAndDestroy(this.snowEmitter);        this.snowEmitter = null;
    fadeAndDestroy(this.fogEmitter);         this.fogEmitter = null;
    fadeAndDestroy(this.sandEmitter);        this.sandEmitter = null;
    fadeAndDestroy(this.sandCloudsEmitter);  this.sandCloudsEmitter = null;

    if (this.stormTimer) {
      this.stormTimer.destroy();
      this.stormTimer = null;
    }
  }

  private startRain(isStorm: boolean = false) {
    if (!this.scene.textures.exists("fx-rain-drop-soft")) {
      const g = this.scene.add.graphics();
      // Softer, thinner rain drop with a slight gradient
      g.fillStyle(0xcceeff, 0.4);
      g.fillRect(0, 0, 1, 15);
      g.fillStyle(0xffffff, 0.8);
      g.fillRect(0, 5, 1, 5); // core
      g.generateTexture("fx-rain-drop-soft", 1, 15);
      g.destroy();
    }

    const frequency = isStorm ? 12 : 25;
    const speedYMin = isStorm ? 700 : 500;
    const speedYMax = isStorm ? 1000 : 700;
    const speedXMin = isStorm ? 80 : 10;
    const speedXMax = isStorm ? 150 : 40;
    const alphaStart = isStorm ? 0.6 : 0.4;
    const alphaEnd = isStorm ? 0.2 : 0.05;

    this.rainEmitter = this.scene.add.particles(0, 0, "fx-rain-drop-soft", {
      x: { min: -200, max: this.scene.cameras.main.width + 200 },
      y: -50,
      lifespan: 1500,
      speedY: { min: speedYMin, max: speedYMax },
      speedX: { min: speedXMin, max: speedXMax },
      scale: { min: 0.8, max: 1.2 },
      alpha: { start: alphaStart, end: alphaEnd },
      frequency: frequency,
      blendMode: Phaser.BlendModes.SCREEN,
      rotate: isStorm ? 15 : 5, 
    });
    this.rainEmitter.setScrollFactor(0);
    this.rainEmitter.setDepth(RENDER_LAYERS.WEATHER_FOG);
  }

  private startSnow() {
    if (!this.scene.textures.exists("fx-snow-soft")) {
      const g = this.scene.add.graphics();
      // Very soft radial gradient for a fluffy snowflake
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const r = 4 * (1 - i / steps);
        const a = (1 - r / 4) * 0.6;
        g.fillStyle(0xffffff, a);
        g.fillCircle(4, 4, r);
      }
      g.generateTexture("fx-snow-soft", 8, 8);
      g.destroy();
    }

    this.snowEmitter = this.scene.add.particles(0, 0, "fx-snow-soft", {
      x: { min: -100, max: this.scene.cameras.main.width + 100 },
      y: -20,
      lifespan: { min: 4000, max: 8000 },
      speedY: { min: 30, max: 70 },
      speedX: { min: -10, max: 10 },
      scale: { min: 0.4, max: 1.2 },
      alpha: { 
        onEmit: () => 0, 
        onUpdate: (particle: any, key: string, t: number) => {
          return t < 0.2 ? (t / 0.2) * 0.7 : ((1 - t) / 0.8) * 0.7;
        }
      },
      rotate: { min: 0, max: 360 },
      frequency: 45,
      blendMode: Phaser.BlendModes.SCREEN,
    });
    
    this.snowEmitter.setScrollFactor(0);
    this.snowEmitter.setDepth(RENDER_LAYERS.WEATHER_FOG);
  }

  private startFog() {
    this.ensureFogTexture();

    this.fogEmitter = this.scene.add.particles(0, 0, "fx-fog-patch", {
      x: { min: -200, max: this.scene.cameras.main.width + 200 },
      y: { min: -100, max: this.scene.cameras.main.height + 100 },
      lifespan: { min: 10000, max: 18000 },
      speedX: { min: 5, max: 15 },
      speedY: { min: -3, max: 3 },
      scale: { min: 2, max: 4.5 },
      alpha: { 
        onEmit: () => 0, 
        onUpdate: (particle: any, key: string, t: number) => {
          const maxAlpha = 0.25;
          return t < 0.3 ? (t / 0.3) * maxAlpha : (t > 0.7 ? ((1 - t) / 0.3) * maxAlpha : maxAlpha);
        }
      },
      frequency: 350,
      blendMode: Phaser.BlendModes.SCREEN,
    });
    this.fogEmitter.setScrollFactor(0);
    this.fogEmitter.setDepth(RENDER_LAYERS.WEATHER_FOG);
    
    // Pre-warm the fog so it doesn't just start empty
    this.fogEmitter.fastForward(8000);
  }

  private ensureFogTexture() {
    if (!this.scene.textures.exists("fx-fog-patch")) {
      const g = this.scene.add.graphics();
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        const r = 64 * (1 - i / steps);
        // Smoother falloff
        const a = Math.pow(1 - r / 64, 2) * 0.15;
        g.fillStyle(0xeef5ff, a);
        g.fillCircle(64, 64, r);
      }
      g.generateTexture("fx-fog-patch", 128, 128);
      g.destroy();
    }
  }

  private startSandstorm() {
    if (!this.scene.textures.exists("fx-sand-grain-soft")) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xd2b48c, 0.6);
      g.fillCircle(1.5, 1.5, 1.5);
      g.generateTexture("fx-sand-grain-soft", 3, 3);
      g.destroy();
    }
    
    this.ensureFogTexture();

    // Fast grains
    this.sandEmitter = this.scene.add.particles(0, 0, "fx-sand-grain-soft", {
      x: -50,
      y: { min: -100, max: this.scene.cameras.main.height + 100 },
      lifespan: { min: 800, max: 1500 },
      speedX: { min: 400, max: 800 },
      speedY: { min: -40, max: 40 },
      scale: { min: 0.5, max: 1.5 },
      alpha: { start: 0.6, end: 0 },
      frequency: 15,
      blendMode: Phaser.BlendModes.NORMAL,
    });
    this.sandEmitter.setScrollFactor(0);
    this.sandEmitter.setDepth(RENDER_LAYERS.WEATHER_FOG);

    // Drifting dust clouds
    this.sandCloudsEmitter = this.scene.add.particles(0, 0, "fx-fog-patch", {
      x: -150,
      y: { min: -100, max: this.scene.cameras.main.height + 100 },
      lifespan: { min: 4000, max: 7000 },
      speedX: { min: 200, max: 400 },
      speedY: { min: -20, max: 20 },
      scale: { min: 1.5, max: 4.0 },
      tint: 0xd2b48c,
      alpha: { 
        onEmit: () => 0, 
        onUpdate: (particle: any, key: string, t: number) => {
          const maxAlpha = 0.15;
          return t < 0.2 ? (t / 0.2) * maxAlpha : (t > 0.8 ? ((1 - t) / 0.2) * maxAlpha : maxAlpha);
        }
      },
      frequency: 180,
      blendMode: Phaser.BlendModes.NORMAL,
    });
    this.sandCloudsEmitter.setScrollFactor(0);
    this.sandCloudsEmitter.setDepth(RENDER_LAYERS.WEATHER_FOG);
    
    this.sandCloudsEmitter.fastForward(2000);
  }

  private startStormLightning() {
    const scheduleLightning = () => {
      const delay = Phaser.Math.Between(3000, 10000); // more sporadic
      this.stormTimer = this.scene.time.delayedCall(delay, () => {
        if (this.currentWeather !== "storm") return;
        
        // Subtle blue-ish flash
        this.scene.cameras.main.flash(80, 100, 120, 150, false, undefined, this);
        
        // Occasional double flash
        if (Math.random() < 0.3) {
             this.scene.time.delayedCall(120, () => {
                 if (this.currentWeather === "storm") {
                    this.scene.cameras.main.flash(120, 140, 160, 200, false, undefined, this);
                 }
             });
        }
        
        scheduleLightning();
      });
    };
    scheduleLightning();
  }
}
