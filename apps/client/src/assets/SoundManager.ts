import type Phaser from "phaser";

export class SoundManager {
  private music: Phaser.Sound.BaseSound | null = null;

  constructor(private scene: Phaser.Scene) {}

  private play(key: string, opts?: Phaser.Types.Sound.SoundConfig) {
    try {
      this.scene.sound.play(key, opts);
    } catch (e) {
      // Swallow play errors in browsers that restrict audio autoplay
      console.warn("Sound play failed:", e);
    }
  }

  playStep() {
    const key = Math.random() < 0.5 ? "sfx-step1" : "sfx-step2";
    this.play(key, { volume: 0.3 });
  }

  playAttack() {
    this.play("sfx-attack", { volume: 0.5 });
  }
  playSpell() {
    this.play("sfx-spell", { volume: 0.5 });
  }
  playHit() {
    this.play("sfx-hit", { volume: 0.4 });
  }
  playDeath() {
    this.play("sfx-death", { volume: 0.6 });
  }
  playHeal() {
    this.play("sfx-heal", { volume: 0.5 });
  }
  startMusic() {
    if (this.music) return;
    this.music = this.scene.sound.add("music-arena", {
      loop: true,
      volume: 0.15,
    });
    this.music.play();
  }

  stopMusic() {
    if (this.music) {
      this.music.stop();
      this.music.destroy();
      this.music = null;
    }
  }

  toggleMute(): boolean {
    const muted = !this.scene.sound.mute;
    this.scene.sound.mute = muted;
    return muted;
  }

  get muted(): boolean {
    return this.scene.sound.mute;
  }
}
