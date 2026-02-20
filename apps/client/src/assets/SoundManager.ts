import { AudioAssets } from "@abraxas/shared";
import Phaser from "phaser";
import { gameSettings } from "../settings/gameSettings";

// Base volumes baked into each sound; settings scale these.
const BASE_MUSIC_VOL = 0.15;
const BASE_SFX: Partial<Record<string, number>> = {
  [AudioAssets.KENNEY_RPG_AUDIO_FOOTSTEP00]: 0.4,
  [AudioAssets.KENNEY_RPG_AUDIO_FOOTSTEP01]: 0.4,
  [AudioAssets.KENNEY_RPG_AUDIO_FOOTSTEP02]: 0.4,
  [AudioAssets.KENNEY_RPG_AUDIO_FOOTSTEP03]: 0.4,
  [AudioAssets.KENNEY_RPG_AUDIO_FOOTSTEP04]: 0.4,
  [AudioAssets.KENNEY_RPG_AUDIO_DRAWKNIFE1]: 0.5,
  [AudioAssets.KENNEY_RPG_AUDIO_DRAWKNIFE2]: 0.5,
  [AudioAssets.KENNEY_RPG_AUDIO_DRAWKNIFE3]: 0.5,
  [AudioAssets.MAGIC_FX411]: 0.5,
  [AudioAssets.KENNEY_IMPACT_AUDIO_IMPACTMETAL_HEAVY_000]: 0.5,
  [AudioAssets.KENNEY_IMPACT_AUDIO_IMPACTMETAL_HEAVY_001]: 0.5,
  [AudioAssets.KENNEY_IMPACT_AUDIO_IMPACTMETAL_HEAVY_002]: 0.5,
  [AudioAssets.SONIDOS_14]: 0.6,
  [AudioAssets.MAGIC_REPLENISH]: 0.5,
  [AudioAssets.KENNEY_UI_AUDIO_CLICK_002]: 0.4,
  [AudioAssets.KENNEY_UI_AUDIO_TICK_001]: 0.2,
  [AudioAssets.KENNEY_UI_AUDIO_OPEN_001]: 0.4,
  [AudioAssets.KENNEY_UI_AUDIO_CLOSE_001]: 0.4,
  [AudioAssets.KENNEY_UI_AUDIO_MAXIMIZE_006]: 0.6,
  [AudioAssets.KENNEY_UI_AUDIO_BONG_001]: 0.7,
  [AudioAssets.KENNEY_RPG_AUDIO_CLOTHBELT]: 0.5,
  [AudioAssets.MAGIC_MONTAGE_SFX_20130926_031949]: 0.6,
  [AudioAssets.MAGIC_SHIMMER_1]: 0.6,
  [AudioAssets.MAGIC_GHOST_1]: 0.6,
  [AudioAssets.MAGIC_FX261]: 0.5,
  [AudioAssets.MISC_ARCHERS_SHOOTING]: 0.5,
  [AudioAssets.KENNEY_RPG_AUDIO_HANDLECOINS]: 0.7,
  [AudioAssets.KENNEY_UI_AUDIO_CONFIRMATION_001]: 0.6,
  [AudioAssets.KENNEY_UI_AUDIO_CONFIRMATION_002]: 0.6,
};

export class SoundManager {
  private music: Phaser.Sound.BaseSound | null = null;
  private unsubscribe: (() => void) | null = null;

  private currentAmbiance: Phaser.Sound.BaseSound | null = null;
  private ambianceVolume = 0.3;

  constructor(private scene: Phaser.Scene) {
    this.unsubscribe = gameSettings.subscribe((s) => {
      this.applyMusicVolume(s.musicVolume);
    });
  }

  private applyMusicVolume(vol: number) {
    if (!this.music) return;
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

  playStep() {
    const steps = [
      AudioAssets.KENNEY_RPG_AUDIO_FOOTSTEP00,
      AudioAssets.KENNEY_RPG_AUDIO_FOOTSTEP01,
      AudioAssets.KENNEY_RPG_AUDIO_FOOTSTEP02,
      AudioAssets.KENNEY_RPG_AUDIO_FOOTSTEP03,
      AudioAssets.KENNEY_RPG_AUDIO_FOOTSTEP04,
    ];
    this.play(steps[Math.floor(Math.random() * steps.length)]);
  }

  playAttack() {
    const attacks = [
      AudioAssets.KENNEY_RPG_AUDIO_DRAWKNIFE1,
      AudioAssets.KENNEY_RPG_AUDIO_DRAWKNIFE2,
      AudioAssets.KENNEY_RPG_AUDIO_DRAWKNIFE3,
    ];
    this.play(attacks[Math.floor(Math.random() * attacks.length)]);
  }

  playSpell() {
    this.play(AudioAssets.MAGIC_FX411);
  }

  playHit() {
    const hits = [
      AudioAssets.KENNEY_IMPACT_AUDIO_IMPACTMETAL_HEAVY_000,
      AudioAssets.KENNEY_IMPACT_AUDIO_IMPACTMETAL_HEAVY_001,
      AudioAssets.KENNEY_IMPACT_AUDIO_IMPACTMETAL_HEAVY_002,
    ];
    this.play(hits[Math.floor(Math.random() * hits.length)]);
  }

  playDeath() {
    this.play(AudioAssets.SONIDOS_14);
  }

  playHeal() {
    this.play(AudioAssets.MAGIC_REPLENISH);
  }

  playLevelUp() {
    this.play(AudioAssets.KENNEY_UI_AUDIO_MAXIMIZE_006);
  }

  playNotification() {
    this.play(AudioAssets.KENNEY_UI_AUDIO_BONG_001);
  }

  playMount() {
    this.play(AudioAssets.KENNEY_RPG_AUDIO_CLOTHBELT, { volume: 0.5 });
  }

  // Ambiance
  startAmbiance(key: typeof AudioAssets.AMBIANCE_WIND | typeof AudioAssets.AMBIANCE_CRICKETS) {
    if (this.currentAmbiance) {
      if (this.currentAmbiance.key === key) return;
      this.stopAmbiance();
    }
    this.currentAmbiance = this.scene.sound.add(key, { loop: true, volume: 0 });
    this.currentAmbiance.play();
    this.scene.tweens.add({
      targets: this.currentAmbiance,
      volume: this.ambianceVolume,
      duration: 2000,
    });
  }

  stopAmbiance() {
    if (!this.currentAmbiance) return;
    const sound = this.currentAmbiance;
    this.scene.tweens.add({
      targets: sound,
      volume: 0,
      duration: 2000,
      onComplete: () => {
        sound.stop();
        sound.destroy();
      },
    });
    this.currentAmbiance = null;
  }

  playNpcAttack(type: string) {
    if (type.includes("skeleton")) {
      this.play(AudioAssets.NPC_SKELETON_RATTLE, { volume: 0.4 });
    } else if (["dragon", "troll", "bear", "orc"].includes(type)) {
      this.play(AudioAssets.NPC_CREATURES_ROAR_01, { volume: 0.5 });
    } else {
      this.play(AudioAssets.NPC_CREATURES_GRUNT_01, { volume: 0.4 });
    }
  }

  playNpcDeath(type: string) {
    if (type.includes("skeleton")) {
      this.play(AudioAssets.NPC_SKELETON_RATTLE, { volume: 0.6 });
    } else if (["dragon", "troll", "bear", "orc"].includes(type)) {
      this.play(AudioAssets.NPC_CREATURES_SCREAM_01, { volume: 0.6 });
    } else {
      this.play(AudioAssets.NPC_CREATURES_HURT_01, { volume: 0.5 });
    }
  }

  playNpcLevelUp() {
    this.play(AudioAssets.KENNEY_UI_AUDIO_MAXIMIZE_008, { volume: 0.5 });
  }

  playBuff() {
    this.play(AudioAssets.MAGIC_MONTAGE_SFX_20130926_031949);
  }
  playStealth() {
    this.play(AudioAssets.MAGIC_SHIMMER_1);
  }
  playSummon() {
    this.play(AudioAssets.MAGIC_GHOST_1);
  }
  playMagicHit() {
    this.play(AudioAssets.MAGIC_FX261);
  }
  playBow() {
    this.play(AudioAssets.MISC_ARCHERS_SHOOTING);
  }
  playCoins() {
    this.play(AudioAssets.KENNEY_RPG_AUDIO_HANDLECOINS);
  }
  playQuestAccept() {
    this.play(AudioAssets.KENNEY_UI_AUDIO_CONFIRMATION_001);
  }
  playQuestComplete() {
    this.play(AudioAssets.KENNEY_UI_AUDIO_CONFIRMATION_002);
  }

  playUIClick() {
    this.play(AudioAssets.KENNEY_UI_AUDIO_CLICK_002);
  }
  playUIHover() {
    this.play(AudioAssets.KENNEY_UI_AUDIO_TICK_001);
  }
  playUIOpen() {
    this.play(AudioAssets.KENNEY_UI_AUDIO_OPEN_001);
  }
  playUIClose() {
    this.play(AudioAssets.KENNEY_UI_AUDIO_CLOSE_001);
  }

  startMusic() {
    if (this.music) return;
    const vol = gameSettings.get().musicVolume;
    this.music = this.scene.sound.add(AudioAssets.MUSICA_101, {
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
