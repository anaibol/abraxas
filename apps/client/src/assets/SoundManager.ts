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
// Maps ability IDs to the audio asset path(s) they should play.
// Array values = random pick each cast to avoid audio fatigue (item #4).
const SPELL_SFX: Partial<Record<string, string | string[]>> = {
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
  // Warrior — melee abilities randomize between attack sounds (item #4)
  war_cry:            AudioAssets.NPC_ROAR,
  battle_shout:       AudioAssets.NPC_ROAR,
  whirlwind:          [AudioAssets.ATTACK_1, AudioAssets.ATTACK_2, AudioAssets.ATTACK_3],
  shield_bash:        [AudioAssets.HIT_1, AudioAssets.HIT_2],
  cleave:             [AudioAssets.ATTACK_2, AudioAssets.ATTACK_3],
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
  holy_strike:        [AudioAssets.HIT_1, AudioAssets.HIT_2],
  holy_nova:          AudioAssets.BUFF,
  smite:              AudioAssets.SPELL,
  divine_shield:      AudioAssets.SUMMON,
  heal:               AudioAssets.HEAL,
  // Ranger — all bow shots randomized
  multi_shot:         [AudioAssets.BOW, AudioAssets.BOW, AudioAssets.ATTACK_1],
  poison_arrow:       AudioAssets.BOW,
  aimed_shot:         AudioAssets.BOW,
  eagle_eye:          AudioAssets.STEALTH,
  barrage:            AudioAssets.BOW,
  // Rogue — stab sounds randomized
  backstab:           [AudioAssets.ATTACK_3, AudioAssets.ATTACK_1],
  envenom:            AudioAssets.ATTACK_1,
  smoke_bomb:         AudioAssets.MAGIC_HIT,
  hemorrhage:         [AudioAssets.ATTACK_2, AudioAssets.ATTACK_3],
  shadowstep:         AudioAssets.STEALTH,
  pickpocket:         AudioAssets.COINS,
  fan_of_knives:      [AudioAssets.ATTACK_3, AudioAssets.ATTACK_1, AudioAssets.ATTACK_2],
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

// ── Spell-impact SFX: separate sound that plays ON HIT, not on cast ───────────
// (item #9 — cast_start plays SPELL_SFX, cast_hit plays SPELL_IMPACT_SFX)
export const SPELL_IMPACT_SFX: Partial<Record<string, string | string[]>> = {
  fireball:           AudioAssets.SPELL,
  meteor_strike:      AudioAssets.SPELL,
  fire_breath:        AudioAssets.SPELL,
  ice_bolt:           AudioAssets.MAGIC_HIT,
  frost_nova:         AudioAssets.MAGIC_HIT,
  thunderstorm:       [AudioAssets.BUFF, AudioAssets.MAGIC_HIT],
  chain_lightning:    AudioAssets.MAGIC_HIT,
  shadow_bolt:        AudioAssets.MAGIC_HIT,
  banshee_wail:       AudioAssets.NPC_SCREAM,
  execute:            AudioAssets.HIT_3,
  whirlwind:          [AudioAssets.HIT_1, AudioAssets.HIT_2],
  holy_nova:          AudioAssets.BUFF,
  consecration:       AudioAssets.BUFF,
  earthquake:         [AudioAssets.HIT_1, AudioAssets.HIT_3],
  meteor_fall:        AudioAssets.HIT_3,
  acid_splash:        AudioAssets.MAGIC_HIT,
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

  // ── Item #1: SFX cooldown throttle per key ───────────────────────────────────
  // Prevents 10 simultaneous hit sounds from piling up on multi-hits.
  private lastPlayTime = new Map<string, number>();
  private readonly SFX_COOLDOWN_MS = 80;

  // ── Item #5: Don't repeat same key twice in <100ms ────────────────────────────
  private lastPlayedKey: string | null = null;
  private lastPlayedAt = 0;

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
    // ── Item #8: Preload guard ────────────────────────────────────────────────
    if (!this.scene.sound.get(key) && !this.scene.cache.audio.has(key)) {
      // Asset not loaded yet — silently skip
      return;
    }

    // ── Item #1: Throttle — skip if this key was played too recently ──────────
    const now = Date.now();
    const lastT = this.lastPlayTime.get(key) ?? 0;
    if (now - lastT < this.SFX_COOLDOWN_MS) return;
    this.lastPlayTime.set(key, now);

    // ── Item #5: Skip exact repeat within 100ms ───────────────────────────────
    if (this.lastPlayedKey === key && now - this.lastPlayedAt < 100) return;
    this.lastPlayedKey = key;
    this.lastPlayedAt = now;

    try {
      const baseVol = BASE_SFX[key] ?? opts?.volume ?? 0.5;
      const sfxVol = gameSettings.get().sfxVolume;

      // ── Item #2: Pitch randomization (±8%) ───────────────────────────────────
      const rate = (opts?.rate ?? 1) * (0.92 + Math.random() * 0.16);

      this.scene.sound.play(key, { ...opts, volume: baseVol * sfxVol, rate });
    } catch (e) {
      console.warn("Sound play failed:", e);
    }
  }

  /**
   * Play the most appropriate SFX for a given ability ID.
   * Supports array values in SPELL_SFX — picks one at random (item #4).
   */
  playSpellSfx(abilityId: string) {
    const sfxEntry = SPELL_SFX[abilityId];
    if (!sfxEntry) {
      this.playSpell();
      return;
    }
    const key = Array.isArray(sfxEntry)
      ? sfxEntry[Math.floor(Math.random() * sfxEntry.length)]
      : sfxEntry;
    this.play(key);
  }

  /**
   * Play the impact SFX for a spell (fires on cast_hit, not cast_start).
   * Item #9 — separate cast vs. impact audio.
   */
  playSpellImpactSfx(abilityId: string) {
    const sfxEntry = SPELL_IMPACT_SFX[abilityId];
    if (!sfxEntry) return; // Only impacts with defined sounds
    const key = Array.isArray(sfxEntry)
      ? sfxEntry[Math.floor(Math.random() * sfxEntry.length)]
      : sfxEntry;
    this.play(key);
  }

  /**
   * Item #3 — Distance-attenuated SFX: play at reduced volume based on
   * tile distance from the local player. Pass `distanceTiles = 0` for self.
   */
  playAttenuated(key: string, distanceTiles: number) {
    const MAX_AUDIBLE = 18; // tiles beyond which sound is inaudible
    if (distanceTiles >= MAX_AUDIBLE) return;
    const attenuationFactor = 1 - distanceTiles / MAX_AUDIBLE;
    this.play(key, { volume: attenuationFactor });
  }

  /**
   * Item #7 — Master volume that multiplicatively scales all BASE_SFX values.
   */
  setMasterSfxVolume(v: number) {
    for (const key of Object.keys(BASE_SFX)) {
      BASE_SFX[key] = (BASE_SFX[key] ?? 0.5) * v;
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

  // ── Item #6: Attack sounds per weapon type ────────────────────────────────────
  /**
   * Play an attack sound that tries to match the equipped weapon type.
   * @param weaponId — the equipped weapon item id (e.g. "iron_sword", "staff_mage")
   */
  playAttack(weaponId?: string) {
    if (weaponId) {
      if (weaponId.includes("bow") || weaponId.includes("crossbow")) {
        return this.play(AudioAssets.BOW);
      }
      if (weaponId.includes("staff") || weaponId.includes("wand")) {
        return this.play(AudioAssets.SPELL);
      }
      if (weaponId.includes("dagger") || weaponId.includes("knife")) {
        const daggers = [AudioAssets.ATTACK_1, AudioAssets.ATTACK_3];
        return this.play(daggers[Math.floor(Math.random() * daggers.length)]);
      }
    }
    const attacks = [AudioAssets.ATTACK_1, AudioAssets.ATTACK_2, AudioAssets.ATTACK_3];
    this.play(attacks[Math.floor(Math.random() * attacks.length)]);
  }

  playSpell() {
    this.play(AudioAssets.SPELL);
  }

  playHit() {
    const hits = [AudioAssets.HIT_1, AudioAssets.HIT_2, AudioAssets.HIT_3];
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

  // ── Item #10: Extended NPC type coverage ─────────────────────────────────────
  playNpcAttack(type: string) {
    if (type.includes("skeleton") || type.includes("undead") || type.includes("zombie")) {
      this.play(AudioAssets.NPC_RATTLE, { volume: 0.4 });
    } else if (type.includes("banshee") || type.includes("wraith")) {
      this.play(AudioAssets.NPC_SCREAM, { volume: 0.45 });
    } else if (["dragon", "troll", "bear", "orc", "ogre", "golem"].some(t => type.includes(t))) {
      this.play(AudioAssets.NPC_ROAR, { volume: 0.5 });
    } else if (["mage", "wizard", "witch", "necromancer"].some(t => type.includes(t))) {
      this.play(AudioAssets.SPELL, { volume: 0.45 });
    } else if (["archer", "ranger", "hunter"].some(t => type.includes(t))) {
      this.play(AudioAssets.BOW, { volume: 0.4 });
    } else if (["rogue", "bandit", "thief"].some(t => type.includes(t))) {
      const daggers = [AudioAssets.ATTACK_1, AudioAssets.ATTACK_3];
      this.play(daggers[Math.floor(Math.random() * daggers.length)], { volume: 0.4 });
    } else {
      this.play(AudioAssets.NPC_GRUNT, { volume: 0.4 });
    }
  }

  playNpcDeath(type: string) {
    if (type.includes("skeleton") || type.includes("zombie")) {
      this.play(AudioAssets.NPC_RATTLE, { volume: 0.6 });
    } else if (type.includes("banshee")) {
      this.play(AudioAssets.NPC_SCREAM, { volume: 0.7 });
    } else if (["dragon", "troll", "bear", "orc", "ogre"].some(t => type.includes(t))) {
      this.play(AudioAssets.NPC_SCREAM, { volume: 0.6 });
    } else {
      this.play(AudioAssets.NPC_HURT, { volume: 0.5 });
    }
  }

  playNpcLevelUp() {
    this.play(AudioAssets.NPC_LEVEL_UP, { volume: 0.5 });
  }

  playBuff() { this.play(AudioAssets.BUFF); }
  playStealth() { this.play(AudioAssets.STEALTH); }
  playSummon() { this.play(AudioAssets.SUMMON); }
  playMagicHit() { this.play(AudioAssets.MAGIC_HIT); }
  playBow() { this.play(AudioAssets.BOW); }
  playCoins() { this.play(AudioAssets.COINS); }
  playQuestAccept() { this.play(AudioAssets.QUEST_ACCEPT); }
  playQuestComplete() { this.play(AudioAssets.QUEST_COMPLETE); }
  playUIClick() { this.play(AudioAssets.CLICK); }
  playUIHover() { this.play(AudioAssets.CLICK_HOVER); }
  playUIOpen() { this.play(AudioAssets.CLICK_OPEN); }
  playUIClose() { this.play(AudioAssets.CLICK_CLOSE); }

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
