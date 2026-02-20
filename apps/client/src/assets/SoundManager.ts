import { AudioAssets } from "@abraxas/shared";
import Phaser from "phaser";
import { gameSettings } from "../settings/gameSettings";

const BASE_MUSIC_VOL = 0.15;
const MAX_AUDIBLE_TILES = 18;

/** Base volume per audio key; sfxVolume setting multiplies this at play time. */
const BASE_SFX: Partial<Record<string, number>> = {
  [AudioAssets.STEP_1]: 0.4,   [AudioAssets.STEP_2]: 0.4,   [AudioAssets.STEP_3]: 0.4,
  [AudioAssets.STEP_4]: 0.4,   [AudioAssets.STEP_5]: 0.4,
  [AudioAssets.ATTACK_1]: 0.5, [AudioAssets.ATTACK_2]: 0.5, [AudioAssets.ATTACK_3]: 0.5,
  [AudioAssets.SPELL]: 0.5,    [AudioAssets.HIT_1]: 0.5,    [AudioAssets.HIT_2]: 0.5,
  [AudioAssets.HIT_3]: 0.5,    [AudioAssets.DEATH]: 0.6,    [AudioAssets.HEAL]: 0.5,
  [AudioAssets.CLICK]: 0.4,    [AudioAssets.CLICK_HOVER]: 0.2,
  [AudioAssets.CLICK_OPEN]: 0.4, [AudioAssets.CLICK_CLOSE]: 0.4,
  [AudioAssets.LEVEL_UP]: 0.6, [AudioAssets.NOTIFICATION]: 0.7,
  [AudioAssets.MOUNT]: 0.5,    [AudioAssets.BUFF]: 0.6,     [AudioAssets.STEALTH]: 0.6,
  [AudioAssets.SUMMON]: 0.6,   [AudioAssets.MAGIC_HIT]: 0.5,[AudioAssets.BOW]: 0.5,
  [AudioAssets.COINS]: 0.7,    [AudioAssets.QUEST_ACCEPT]: 0.6, [AudioAssets.QUEST_COMPLETE]: 0.6,
};

/** A value is either a single asset key or a random-pick array. */
type SfxEntry = string | string[];

/** Resolve a SfxEntry to a single key (random pick for arrays). */
const pickSfx = (entry: SfxEntry): string =>
  Array.isArray(entry) ? entry[Math.floor(Math.random() * entry.length)] : entry;

// ── Per-ability SFX tables ────────────────────────────────────────────────────
/** Plays on cast_start. */
const SPELL_SFX: Partial<Record<string, SfxEntry>> = {
  // Mage
  fireball: AudioAssets.SPELL,           fire_breath: AudioAssets.SPELL,
  meteor_strike: AudioAssets.SPELL,      ice_bolt: AudioAssets.MAGIC_HIT,
  frost_nova: AudioAssets.MAGIC_HIT,     frost_breath: AudioAssets.MAGIC_HIT,
  thunderstorm: AudioAssets.BUFF,         chain_lightning: AudioAssets.BUFF,
  arcane_surge: AudioAssets.STEALTH,     spell_echo: AudioAssets.STEALTH,
  blink: AudioAssets.STEALTH,            elemental_infusion: AudioAssets.STEALTH,
  mana_spring: AudioAssets.HEAL,         mana_shield: AudioAssets.SUMMON,
  polymorph: AudioAssets.MAGIC_HIT,
  // Warrior
  war_cry: AudioAssets.NPC_ROAR,        battle_shout: AudioAssets.NPC_ROAR,
  whirlwind: [AudioAssets.ATTACK_1, AudioAssets.ATTACK_2, AudioAssets.ATTACK_3],
  shield_bash: [AudioAssets.HIT_1, AudioAssets.HIT_2],
  cleave: [AudioAssets.ATTACK_2, AudioAssets.ATTACK_3],
  execute: AudioAssets.HIT_3,           leap: AudioAssets.NPC_ROAR,
  berserker_rage: AudioAssets.NPC_ROAR, shield_wall: AudioAssets.HIT_2,
  // Paladin
  judgment: AudioAssets.BUFF,           consecration: AudioAssets.BUFF,
  holy_bolt: AudioAssets.SPELL,         lay_on_hands: AudioAssets.HEAL,
  aura_of_protection: AudioAssets.SUMMON,
  // Cleric
  holy_strike: [AudioAssets.HIT_1, AudioAssets.HIT_2],
  holy_nova: AudioAssets.BUFF,          smite: AudioAssets.SPELL,
  divine_shield: AudioAssets.SUMMON,    heal: AudioAssets.HEAL,
  // Ranger
  multi_shot: [AudioAssets.BOW, AudioAssets.BOW, AudioAssets.ATTACK_1],
  poison_arrow: AudioAssets.BOW,        aimed_shot: AudioAssets.BOW,
  eagle_eye: AudioAssets.STEALTH,       barrage: AudioAssets.BOW,
  // Rogue
  backstab: [AudioAssets.ATTACK_3, AudioAssets.ATTACK_1],
  envenom: AudioAssets.ATTACK_1,        smoke_bomb: AudioAssets.MAGIC_HIT,
  hemorrhage: [AudioAssets.ATTACK_2, AudioAssets.ATTACK_3],
  shadowstep: AudioAssets.STEALTH,      pickpocket: AudioAssets.COINS,
  fan_of_knives: [AudioAssets.ATTACK_3, AudioAssets.ATTACK_1, AudioAssets.ATTACK_2],
  // Necromancer
  shadow_bolt: AudioAssets.SUMMON,     soul_drain: AudioAssets.SUMMON,
  banshee_wail: AudioAssets.NPC_SCREAM, summon_skeleton: AudioAssets.NPC_RATTLE,
  summon_zombie: AudioAssets.NPC_GRUNT,
  // Druid
  cleansing_rain: AudioAssets.HEAL,    entangling_roots: AudioAssets.MAGIC_HIT,
  acid_splash: AudioAssets.SPELL,
};

/** Plays on cast_hit (impact, not cast). */
export const SPELL_IMPACT_SFX: Partial<Record<string, SfxEntry>> = {
  fireball: AudioAssets.SPELL,          meteor_strike: AudioAssets.SPELL,
  fire_breath: AudioAssets.SPELL,       ice_bolt: AudioAssets.MAGIC_HIT,
  frost_nova: AudioAssets.MAGIC_HIT,    thunderstorm: [AudioAssets.BUFF, AudioAssets.MAGIC_HIT],
  chain_lightning: AudioAssets.MAGIC_HIT, shadow_bolt: AudioAssets.MAGIC_HIT,
  banshee_wail: AudioAssets.NPC_SCREAM, execute: AudioAssets.HIT_3,
  whirlwind: [AudioAssets.HIT_1, AudioAssets.HIT_2],
  holy_nova: AudioAssets.BUFF,          consecration: AudioAssets.BUFF,
  earthquake: [AudioAssets.HIT_1, AudioAssets.HIT_3],
  acid_splash: AudioAssets.MAGIC_HIT,
};

/** Abilities that always shake the camera on impact. */
export const HEAVY_HIT_ABILITIES = new Set([
  "meteor_strike", "earthquake", "leap", "whirlwind", "execute", "barrage",
  "chain_lightning", "banshee_wail", "holy_nova", "thunderstorm",
  "consecration", "war_cry", "berserker_rage",
]);

// ── NPC audio routing table ───────────────────────────────────────────────────
// Each entry: [keywords[], attackKey, attackVol, deathKey, deathVol]
const NPC_AUDIO: Array<[string[], string, number, string, number]> = [
  [["skeleton", "undead", "zombie"], AudioAssets.NPC_RATTLE, 0.4, AudioAssets.NPC_RATTLE, 0.6],
  [["banshee", "wraith"],            AudioAssets.NPC_SCREAM, 0.45, AudioAssets.NPC_SCREAM, 0.7],
  [["dragon","troll","bear","orc","ogre","golem"], AudioAssets.NPC_ROAR, 0.5, AudioAssets.NPC_SCREAM, 0.6],
  [["mage","wizard","witch","necromancer"],        AudioAssets.SPELL,    0.45, AudioAssets.NPC_HURT, 0.5],
  [["archer","ranger","hunter"],     AudioAssets.BOW,        0.4, AudioAssets.NPC_HURT, 0.5],
  [["rogue","bandit","thief"],       AudioAssets.ATTACK_1,   0.4, AudioAssets.NPC_HURT, 0.5],
];

function npcAudio(type: string): { attack: string; atkVol: number; death: string; dthVol: number } {
  for (const [keywords, attack, atkVol, death, dthVol] of NPC_AUDIO) {
    if (keywords.some(k => type.includes(k))) return { attack, atkVol, death, dthVol };
  }
  return { attack: AudioAssets.NPC_GRUNT, atkVol: 0.4, death: AudioAssets.NPC_HURT, dthVol: 0.5 };
}

// ─────────────────────────────────────────────────────────────────────────────

export class SoundManager {
  private music: Phaser.Sound.BaseSound | null = null;
  private unsubscribe: (() => void) | null = null;
  private currentAmbiance: Phaser.Sound.BaseSound | null = null;
  private ambianceVolume = 0.3;

  // Throttle: per-key timestamp + last-played guard
  private readonly SFX_COOLDOWN_MS = 80;
  private lastPlayTime = new Map<string, number>();
  private lastKey: string | null = null;
  private lastKeyAt = 0;

  constructor(private scene: Phaser.Scene) {
    this.unsubscribe = gameSettings.subscribe(s => this.applyMusicVolume(s.musicVolume));
  }

  private applyMusicVolume(vol: number) {
    if (!this.music) return;
    if (this.music instanceof Phaser.Sound.WebAudioSound ||
        this.music instanceof Phaser.Sound.HTML5AudioSound) {
      this.music.setVolume(BASE_MUSIC_VOL * vol);
    }
  }

  private play(key: string, opts?: Phaser.Types.Sound.SoundConfig) {
    if (!this.scene.cache.audio.has(key)) return; // preload guard
    const now = Date.now();
    if (now - (this.lastPlayTime.get(key) ?? 0) < this.SFX_COOLDOWN_MS) return; // throttle
    if (this.lastKey === key && now - this.lastKeyAt < 100) return; // no-repeat
    this.lastPlayTime.set(key, now);
    this.lastKey = key;
    this.lastKeyAt = now;
    try {
      const vol = (BASE_SFX[key] ?? opts?.volume ?? 0.5) * gameSettings.get().sfxVolume;
      const rate = (opts?.rate ?? 1) * (0.92 + Math.random() * 0.16); // ±8% pitch
      this.scene.sound.play(key, { ...opts, volume: vol, rate });
    } catch { /* noop */ }
  }

  /** Resolve a SfxEntry table and play. Falls back to `fallback` if no entry. */
  private fromTable(table: Partial<Record<string, SfxEntry>>, id: string, fallback?: () => void) {
    const entry = table[id];
    entry ? this.play(pickSfx(entry)) : fallback?.();
  }

  // ── Public playback API ───────────────────────────────────────────────────────

  playSpellSfx(abilityId: string)       { this.fromTable(SPELL_SFX, abilityId, () => this.playSpell()); }
  playSpellImpactSfx(abilityId: string) { this.fromTable(SPELL_IMPACT_SFX, abilityId); }

  /** Distance-attenuated play — volume drops linearly beyond `MAX_AUDIBLE_TILES`. */
  playAttenuated(key: string, distanceTiles: number) {
    if (distanceTiles >= MAX_AUDIBLE_TILES) return;
    this.play(key, { volume: 1 - distanceTiles / MAX_AUDIBLE_TILES });
  }

  /** Scales all BASE_SFX values — use as a "master SFX" slider driver. */
  setMasterSfxVolume(v: number) {
    for (const k of Object.keys(BASE_SFX)) BASE_SFX[k] = (BASE_SFX[k] ?? 0.5) * v;
  }

  playStep() {
    const STEPS = [AudioAssets.STEP_1, AudioAssets.STEP_2, AudioAssets.STEP_3, AudioAssets.STEP_4, AudioAssets.STEP_5];
    this.play(STEPS[Math.floor(Math.random() * STEPS.length)]);
  }

  playAttack(weaponId?: string) {
    if (weaponId?.match(/bow|crossbow/))     return this.play(AudioAssets.BOW);
    if (weaponId?.match(/staff|wand/))       return this.play(AudioAssets.SPELL);
    if (weaponId?.match(/dagger|knife/))     return this.play(pickSfx([AudioAssets.ATTACK_1, AudioAssets.ATTACK_3]));
    this.play(pickSfx([AudioAssets.ATTACK_1, AudioAssets.ATTACK_2, AudioAssets.ATTACK_3]));
  }

  playSpell()  { this.play(AudioAssets.SPELL); }
  playHit()    { this.play(pickSfx([AudioAssets.HIT_1, AudioAssets.HIT_2, AudioAssets.HIT_3])); }
  playDeath()  { this.play(AudioAssets.DEATH); }
  playHeal()   { this.play(AudioAssets.HEAL); }
  playLevelUp(){ this.play(AudioAssets.LEVEL_UP); }
  playNotification() { this.play(AudioAssets.NOTIFICATION); }
  playMount()  { this.play(AudioAssets.MOUNT); }
  playBuff()   { this.play(AudioAssets.BUFF); }
  playStealth(){ this.play(AudioAssets.STEALTH); }
  playSummon() { this.play(AudioAssets.SUMMON); }
  playMagicHit(){ this.play(AudioAssets.MAGIC_HIT); }
  playBow()   { this.play(AudioAssets.BOW); }
  playCoins() { this.play(AudioAssets.COINS); }
  playQuestAccept()   { this.play(AudioAssets.QUEST_ACCEPT); }
  playQuestComplete() { this.play(AudioAssets.QUEST_COMPLETE); }
  playUIClick()  { this.play(AudioAssets.CLICK); }
  playUIHover()  { this.play(AudioAssets.CLICK_HOVER); }
  playUIOpen()   { this.play(AudioAssets.CLICK_OPEN); }
  playUIClose()  { this.play(AudioAssets.CLICK_CLOSE); }

  playNpcAttack(type: string) {
    const { attack, atkVol } = npcAudio(type);
    this.play(attack, { volume: atkVol });
  }
  playNpcDeath(type: string) {
    const { death, dthVol } = npcAudio(type);
    this.play(death, { volume: dthVol });
  }
  playNpcLevelUp() { this.play(AudioAssets.NPC_LEVEL_UP, { volume: 0.5 }); }

  startAmbiance(key: typeof AudioAssets.AMBIANCE_WIND | typeof AudioAssets.AMBIANCE_CRICKETS) {
    if (this.currentAmbiance?.key === key) return;
    this.stopAmbiance();
    this.currentAmbiance = this.scene.sound.add(key, { loop: true, volume: 0 });
    this.currentAmbiance.play();
    this.scene.tweens.add({ targets: this.currentAmbiance, volume: this.ambianceVolume, duration: 2000 });
  }

  stopAmbiance() {
    if (!this.currentAmbiance) return;
    const s = this.currentAmbiance;
    this.scene.tweens.add({ targets: s, volume: 0, duration: 2000, onComplete: () => { s.stop(); s.destroy(); } });
    this.currentAmbiance = null;
  }

  startMusic() {
    if (this.music) return;
    this.music = this.scene.sound.add(AudioAssets.MUSIC_ARENA, {
      loop: true, volume: BASE_MUSIC_VOL * gameSettings.get().musicVolume,
    });
    this.music.play();
  }

  stopMusic() {
    this.music?.stop();
    this.music?.destroy();
    this.music = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  toggleMute(): boolean {
    return this.scene.sound.mute = !this.scene.sound.mute;
  }

  get muted(): boolean { return this.scene.sound.mute; }
}
