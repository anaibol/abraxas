import Phaser from "phaser";
import { gameSettings } from "../settings/gameSettings";

// Base volumes baked into each sound; settings scale these.
const BASE_MUSIC_VOL = 0.15;
const BASE_SFX: Record<string, number> = {
  "sfx-step1": 0.4,
  "sfx-step2": 0.4,
  "sfx-step3": 0.4,
  "sfx-step4": 0.4,
  "sfx-step5": 0.4,
  "sfx-attack1": 0.5,
  "sfx-attack2": 0.5,
  "sfx-attack3": 0.5,
  "sfx-spell": 0.5,
  "sfx-hit1": 0.5,
  "sfx-hit2": 0.5,
  "sfx-hit3": 0.5,
  "sfx-death": 0.6,
  "sfx-heal": 0.5,
  "sfx-click": 0.4,
  "sfx-click-hover": 0.2,
  "sfx-click-open": 0.4,
  "sfx-click-close": 0.4,
  "sfx-levelup": 0.6,
  "sfx-notification": 0.7,
  "sfx-mount": 0.5,
  "sfx-buff": 0.6,
  "sfx-stealth": 0.6,
  "sfx-summon": 0.6,
  "sfx-magic-hit": 0.5,
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
    if (
      this.music instanceof Phaser.Sound.WebAudioSound ||
      this.music instanceof Phaser.Sound.HTML5AudioSound
    ) {
      this.music.setVolume(BASE_MUSIC_VOL * vol);
    }
  }

  private play(key: string, opts?: Phaser.Types.Sound.SoundConfig) {
    try {
      const baseVol = BASE_SFX[key] ?? opts?.volume ?? 0.5;
      const sfxVol = gameSettings.get().sfxVolume;
      this.scene.sound.play(key, { ...opts, volume: baseVol * sfxVol });
    } catch (e) {
      console.warn("Sound play failed:", e);
    }
  }

  private playRandom(prefix: string, count: number, opts?: Phaser.Types.Sound.SoundConfig) {
    const rnd = Math.floor(Math.random() * count) + 1; // 1 to count
    this.play(`${prefix}${rnd}`, opts);
  }

  playStep() {
    this.playRandom("sfx-step", 5);
  }
  playAttack() {
    this.playRandom("sfx-attack", 3);
  }
  playSpell() {
    this.play("sfx-spell");
  }
  playHit() {
    this.playRandom("sfx-hit", 3);
  }
  playDeath() {
    this.play("sfx-death");
  }
  playHeal() {
    this.play("sfx-heal");
  }
  playLevelUp() {
    this.play("sfx-levelup");
  }
  playNotification() {
    this.play("sfx-notification");
  }
  playMount() {
    this.play("sfx-mount");
  }
  playBuff() {
    this.play("sfx-buff");
  }
  playStealth() {
    this.play("sfx-stealth");
  }
  playSummon() {
    this.play("sfx-summon");
  }
  playMagicHit() {
    this.play("sfx-magic-hit");
  }

  playUIClick() {
    this.play("sfx-click");
  }
  playUIHover() {
    this.play("sfx-click-hover");
  }
  playUIOpen() {
    this.play("sfx-click-open");
  }
  playUIClose() {
    this.play("sfx-click-close");
  }

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
