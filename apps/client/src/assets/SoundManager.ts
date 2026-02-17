import Phaser from "phaser";

export class SoundManager {
  private scene: Phaser.Scene;
  private music: Phaser.Sound.BaseSound | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  playStep() {
    const key = Math.random() < 0.5 ? "sfx-step1" : "sfx-step2";
    this.scene.sound.play(key, { volume: 0.3 });
  }

  playAttack() {
    this.scene.sound.play("sfx-attack", { volume: 0.5 });
  }

  playSpell() {
    this.scene.sound.play("sfx-spell", { volume: 0.5 });
  }

  playHit() {
    this.scene.sound.play("sfx-hit", { volume: 0.4 });
  }

  playDeath() {
    this.scene.sound.play("sfx-death", { volume: 0.6 });
  }

  playHeal() {
    this.scene.sound.play("sfx-heal", { volume: 0.5 });
  }

  playClick() {
    this.scene.sound.play("sfx-click", { volume: 0.3 });
  }

  startMusic() {
    if (this.music) return;
    this.music = this.scene.sound.add("music-arena", { loop: true, volume: 0.15 });
    this.music.play();
  }

  stopMusic() {
    if (this.music) {
      this.music.stop();
      this.music.destroy();
      this.music = null;
    }
  }
}
