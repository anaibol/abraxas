import { AudioAssets } from "@abraxas/shared";
import Phaser from "phaser";
import { gameSettings } from "../settings/gameSettings";

// Base volumes baked into each sound; settings scale these.
const BASE_MUSIC_VOL = 0.15;
const BASE_SFX: Partial<Record<string, number>> = {
  [AudioAssets.STEP_1]: 0.4,
  [AudioAssets.STEP_2]: 0.4,
  [AudioAssets.STEP_3]: 0.4,
  [AudioAssets.STEP_4]: 0.4,
  [AudioAssets.STEP_5]: 0.4,
  [AudioAssets.ATTACK_1]: 0.5,
  [AudioAssets.ATTACK_2]: 0.5,
  [AudioAssets.ATTACK_3]: 0.5,
  [AudioAssets.SPELL]: 0.5,
  [AudioAssets.HIT_1]: 0.5,
  [AudioAssets.HIT_2]: 0.5,
  [AudioAssets.HIT_3]: 0.5,
  [AudioAssets.DEATH]: 0.6,
  [AudioAssets.HEAL]: 0.5,
  [AudioAssets.CLICK]: 0.4,
  [AudioAssets.CLICK_HOVER]: 0.2,
  [AudioAssets.CLICK_OPEN]: 0.4,
  [AudioAssets.CLICK_CLOSE]: 0.4,
  [AudioAssets.LEVEL_UP]: 0.6,
  [AudioAssets.NOTIFICATION]: 0.7,
  [AudioAssets.MOUNT]: 0.5,
  [AudioAssets.BUFF]: 0.6,
  [AudioAssets.STEALTH]: 0.6,
  [AudioAssets.SUMMON]: 0.6,
  [AudioAssets.MAGIC_HIT]: 0.5,
  [AudioAssets.BOW]: 0.5,
  [AudioAssets.COINS]: 0.7,
  [AudioAssets.QUEST_ACCEPT]: 0.6,
  [AudioAssets.QUEST_COMPLETE]: 0.6,
};

// ── Spell-specific SFX routing ────────────────────────────────────────────────
// Maps ability IDs to the audio asset path they should play.
// Unmapped abilities fall back to their general category in GameEventHandler.
const SPELL_SFX: Partial<Record<string, string>> = {
  // Mage
  fireball:           AudioAssets.SPELL,
  fire_breath:        AudioAssets.SPELL,
  meteor_strike:      AudioAssets.SPELL,
  ice_bolt:           AudioAssets.MAGIC_HIT,
  frost_nova:         AudioAssets.MAGIC_HIT,
  frost_breath:       AudioAssets.MAGIC_HIT,
  thunderstorm:       AudioAssets.BUFF,
  chain_lightning:    AudioAssets.BUFF,
  arcane_surge:       AudioAssets.STEALTH,
  spell_echo:         AudioAssets.STEALTH,
  blink:              AudioAssets.STEALTH,
  elemental_infusion: AudioAssets.STEALTH,
  mana_spring:        AudioAssets.HEAL,
  mana_shield:        AudioAssets.SUMMON,
  polymorph:          AudioAssets.MAGIC_HIT,
  // Warrior
  war_cry:            AudioAssets.NPC_ROAR,
  battle_shout:       AudioAssets.NPC_ROAR,
  whirlwind:          AudioAssets.ATTACK_1,
  shield_bash:        AudioAssets.HIT_1,
  cleave:             AudioAssets.ATTACK_2,
  execute:            AudioAssets.HIT_3,
  leap:               AudioAssets.NPC_ROAR,
  berserker_rage:     AudioAssets.NPC_ROAR,
  shield_wall:        AudioAssets.HIT_2,
  // Paladin
  judgment:           AudioAssets.BUFF,
  consecration:       AudioAssets.BUFF,
  holy_bolt:          AudioAssets.SPELL,
  lay_on_hands:       AudioAssets.HEAL,
  aura_of_protection: AudioAssets.SUMMON,
  // Cleric
  holy_strike:        AudioAssets.HIT_1,
  holy_nova:          AudioAssets.BUFF,
  smite:              AudioAssets.SPELL,
  divine_shield:      AudioAssets.SUMMON,
  heal:               AudioAssets.HEAL,
  // Ranger
  multi_shot:         AudioAssets.BOW,
  poison_arrow:       AudioAssets.BOW,
  aimed_shot:         AudioAssets.BOW,
  eagle_eye:          AudioAssets.STEALTH,
  barrage:            AudioAssets.BOW,
  // Rogue
  backstab:           AudioAssets.ATTACK_3,
  envenom:            AudioAssets.ATTACK_1,
  smoke_bomb:         AudioAssets.MAGIC_HIT,
  hemorrhage:         AudioAssets.ATTACK_2,
  shadowstep:         AudioAssets.STEALTH,
  pickpocket:         AudioAssets.COINS,
  fan_of_knives:      AudioAssets.ATTACK_3,
  // Necromancer
  shadow_bolt:        AudioAssets.SUMMON,
  soul_drain:         AudioAssets.SUMMON,
  banshee_wail:       AudioAssets.NPC_SCREAM,
  summon_skeleton:    AudioAssets.NPC_RATTLE,
  summon_zombie:      AudioAssets.NPC_GRUNT,
  // Druid
  cleansing_rain:     AudioAssets.HEAL,
  entangling_roots:   AudioAssets.MAGIC_HIT,
  acid_splash:        AudioAssets.SPELL,
};

/**
 * Ability IDs that should also trigger a camera shake on cast/hit.
 * Exposed so GameEventHandler can import and check this.
 */
export const HEAVY_HIT_ABILITIES = new Set([
  "meteor_strike",
  "earthquake",
  "leap",
  "whirlwind",
  "execute",
  "barrage",
  "chain_lightning",
  "banshee_wail",
  "holy_nova",
  "thunderstorm",
  "consecration",
  "war_cry",
  "berserker_rage",
]);

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

  /** Play the most appropriate SFX for a given ability ID. */
  playSpellSfx(abilityId: string) {
    const sfxKey = SPELL_SFX[abilityId];
    if (sfxKey) {
      this.play(sfxKey);
    } else {
      this.playSpell(); // Generic fallback
    }
  }

  playStep() {
    const steps = [
      AudioAssets.STEP_1,
      AudioAssets.STEP_2,
      AudioAssets.STEP_3,
      AudioAssets.STEP_4,
      AudioAssets.STEP_5,
    ];
    this.play(steps[Math.floor(Math.random() * steps.length)]);
  }

  playAttack() {
    const attacks = [
      AudioAssets.ATTACK_1,
      AudioAssets.ATTACK_2,
      AudioAssets.ATTACK_3,
    ];
    this.play(attacks[Math.floor(Math.random() * attacks.length)]);
  }

  playSpell() {
    this.play(AudioAssets.SPELL);
  }

  playHit() {
    const hits = [
      AudioAssets.HIT_1,
      AudioAssets.HIT_2,
      AudioAssets.HIT_3,
    ];
    this.play(hits[Math.floor(Math.random() * hits.length)]);
  }

  playDeath() {
    this.play(AudioAssets.DEATH);
  }

  playHeal() {
    this.play(AudioAssets.HEAL);
  }

  playLevelUp() {
    this.play(AudioAssets.LEVEL_UP);
  }

  playNotification() {
    this.play(AudioAssets.NOTIFICATION);
  }

  playMount() {
    this.play(AudioAssets.MOUNT, { volume: 0.5 });
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
      this.play(AudioAssets.NPC_RATTLE, { volume: 0.4 });
    } else if (["dragon", "troll", "bear", "orc"].includes(type)) {
      this.play(AudioAssets.NPC_ROAR, { volume: 0.5 });
    } else {
      this.play(AudioAssets.NPC_GRUNT, { volume: 0.4 });
    }
  }

  playNpcDeath(type: string) {
    if (type.includes("skeleton")) {
      this.play(AudioAssets.NPC_RATTLE, { volume: 0.6 });
    } else if (["dragon", "troll", "bear", "orc"].includes(type)) {
      this.play(AudioAssets.NPC_SCREAM, { volume: 0.6 });
    } else {
      this.play(AudioAssets.NPC_HURT, { volume: 0.5 });
    }
  }

  playNpcLevelUp() {
    this.play(AudioAssets.NPC_LEVEL_UP, { volume: 0.5 });
  }

  playBuff() {
    this.play(AudioAssets.BUFF);
  }
  playStealth() {
    this.play(AudioAssets.STEALTH);
  }
  playSummon() {
    this.play(AudioAssets.SUMMON);
  }
  playMagicHit() {
    this.play(AudioAssets.MAGIC_HIT);
  }
  playBow() {
    this.play(AudioAssets.BOW);
  }
  playCoins() {
    this.play(AudioAssets.COINS);
  }
  playQuestAccept() {
    this.play(AudioAssets.QUEST_ACCEPT);
  }
  playQuestComplete() {
    this.play(AudioAssets.QUEST_COMPLETE);
  }

  playUIClick() {
    this.play(AudioAssets.CLICK);
  }
  playUIHover() {
    this.play(AudioAssets.CLICK_HOVER);
  }
  playUIOpen() {
    this.play(AudioAssets.CLICK_OPEN);
  }
  playUIClose() {
    this.play(AudioAssets.CLICK_CLOSE);
  }

  startMusic() {
    if (this.music) return;
    const vol = gameSettings.get().musicVolume;
    this.music = this.scene.sound.add(AudioAssets.MUSIC_ARENA, {
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
