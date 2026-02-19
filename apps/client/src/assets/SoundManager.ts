import { gameSettings } from "../settings/gameSettings";
import type Phaser from "phaser";

// Base volumes baked into each sound; settings scale these.
const BASE_MUSIC_VOL = 0.15;
const BASE_SFX: Record<string, number> = {
  "sfx-step1":  0.3,
  "sfx-step2":  0.3,
  "sfx-attack": 0.5,
  "sfx-spell":  0.5,
  "sfx-hit":    0.4,
  "sfx-death":  0.6,
  "sfx-heal":   0.5,
};

export class SoundManager {
  private music: Phaser.Sound.BaseSound | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private scene: Phaser.Scene) {
    this.unsubscribe = gameSettings.subscribe((s) => {
      this.applyMusicVolume(s.musicVolume);
    });
  }

  private applyMusicVolume(vol: number) {
    if (!this.music) return;
    // Phaser WebAudioSound / HTML5Sound both expose `setVolume`
    (this.music as Phaser.Sound.WebAudioSound).setVolume(BASE_MUSIC_VOL * vol);
  }

  private play(key: string, opts?: Phaser.Types.Sound.SoundConfig) {
    try {
      const baseVol = BASE_SFX[key] ?? (opts?.volume ?? 0.5);
      const sfxVol = gameSettings.get().sfxVolume;
      this.scene.sound.play(key, { ...opts, volume: baseVol * sfxVol });
    } catch (e) {
      console.warn("Sound play failed:", e);
    }
  }

  playStep() {
    const key = Math.random() < 0.5 ? "sfx-step1" : "sfx-step2";
    this.play(key);
  }

  playAttack() { this.play("sfx-attack"); }
  playSpell()  { this.play("sfx-spell");  }
  playHit()    { this.play("sfx-hit");    }
  playDeath()  { this.play("sfx-death");  }
  playHeal()   { this.play("sfx-heal");   }

  startMusic() {
    if (this.music) return;
    const vol = gameSettings.get().musicVolume;
    this.music = this.scene.sound.add("music-arena", {
      loop: true,
      volume: BASE_MUSIC_VOL * vol,
    });
    this.music.play();
  }

  stopMusic() {
    if (this.music) {
      this.music.stop();
      this.music.destroy();
      this.music = null;
    }
    this.unsubscribe?.();
    this.unsubscribe = null;
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
