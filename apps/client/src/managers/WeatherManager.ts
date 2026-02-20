import Phaser from "phaser";

export class WeatherManager {
  private rainEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private snowEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private currentWeather: string = "clear";

  constructor(private scene: Phaser.Scene) {}

  public updateWeather(weatherType: string) {
    if (this.currentWeather === weatherType) return;
    this.currentWeather = weatherType;

    this.stopAll();

    if (weatherType === "rain") {
      this.startRain();
    } else if (weatherType === "snow") {
      this.startSnow();
    }
  }

  private stopAll() {
    if (this.rainEmitter) {
      this.rainEmitter.stop();
      this.scene.time.delayedCall(2000, () => {
        this.rainEmitter?.destroy();
        this.rainEmitter = null;
      });
    }
    if (this.snowEmitter) {
      this.snowEmitter.stop();
      this.scene.time.delayedCall(2000, () => {
        this.snowEmitter?.destroy();
        this.snowEmitter = null;
      });
    }
  }

  private startRain() {
    // High-performance rain using thin vertical rectangles
    if (!this.scene.textures.exists("fx-rain-drop")) {
      const g = this.scene.add.graphics();
      g.fillStyle(0x88ccff, 0.6);
      g.fillRect(0, 0, 2, 20);
      g.generateTexture("fx-rain-drop", 2, 20);
      g.destroy();
    }

    this.rainEmitter = this.scene.add.particles(0, 0, "fx-rain-drop", {
      x: { min: 0, max: this.scene.cameras.main.width * 2 }, // Cover wide area
      y: -20,
      lifespan: 1500,
      speedY: { min: 600, max: 900 },
      speedX: { min: -100, max: -50 }, // Slanted rain
      scale: { start: 0.5, end: 1 },
      alpha: { start: 0.8, end: 0.2 },
      frequency: 10,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.rainEmitter.setScrollFactor(0); // Screen-space weather
    this.rainEmitter.setDepth(1000); // Top layer
  }

  private startSnow() {
    // Soft snow using small circles
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
      speedX: { min: -50, max: 50 }, // Wobbly snow
      scale: { start: 0.2, end: 0.5 },
      alpha: { start: 0.6, end: 0.1 },
      rotate: { start: 0, end: 360 },
      gravityY: 10,
      frequency: 30,
    });
    this.snowEmitter.setScrollFactor(0);
    this.snowEmitter.setDepth(1000);
  }

}

