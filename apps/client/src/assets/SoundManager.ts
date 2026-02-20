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
  // UI – tuned for medieval tactile feel
  [AudioAssets.CLICK]: 0.35,        [AudioAssets.CLICK_HOVER]: 0.15,
  [AudioAssets.CLICK_OPEN]: 0.35,   [AudioAssets.CLICK_CLOSE]: 0.35,
  [AudioAssets.NOTIFICATION]: 0.45, [AudioAssets.LEVEL_UP]: 0.55,
  [AudioAssets.QUEST_ACCEPT]: 0.5,  [AudioAssets.QUEST_COMPLETE]: 0.65,
  [AudioAssets.COINS]: 0.7,
  [AudioAssets.MOUNT]: 0.5,         [AudioAssets.BUFF]: 0.6,     [AudioAssets.STEALTH]: 0.6,
  [AudioAssets.SUMMON]: 0.6,        [AudioAssets.MAGIC_HIT]: 0.5,[AudioAssets.BOW]: 0.5,
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

function npcAudio(type?: string): { attack: string; atkVol: number; death: string; dthVol: number } {
  if (!type) return { attack: AudioAssets.NPC_GRUNT, atkVol: 0.4, death: AudioAssets.NPC_HURT, dthVol: 0.5 };
  for (const [keywords, attack, atkVol, death, dthVol] of NPC_AUDIO) {
    if (keywords.some(k => type.includes(k))) return { attack, atkVol, death, dthVol };
  }
  return { attack: AudioAssets.NPC_GRUNT, atkVol: 0.4, death: AudioAssets.NPC_HURT, dthVol: 0.5 };
}

// ─────────────────────────────────────────────────────────────────────────────

export type PlayOpts = Phaser.Types.Sound.SoundConfig & { sourceX?: number; sourceY?: number };

export class SoundManager {
  private music: Phaser.Sound.BaseSound | null = null;
  private unsubscribe: (() => void) | null = null;
  private currentAmbiance: Phaser.Sound.BaseSound | null = null;
  // Throttle: per-key timestamp + last-played guard
  private readonly SFX_COOLDOWN_MS = 80;
  private lastPlayTime = new Map<string, number>();
  private lastKey: string | null = null;
  private lastKeyAt = 0;

  constructor(private scene: Phaser.Scene) {
    this.unsubscribe = gameSettings.subscribe(s => {
      this.applyMusicVolume(s.musicVolume);
      this.applyAmbianceVolume(s.ambianceVolume);
    });
  }

  private applyMusicVolume(vol: number) {
    if (!this.music) return;
    if (this.music instanceof Phaser.Sound.WebAudioSound ||
        this.music instanceof Phaser.Sound.HTML5AudioSound) {
      this.music.setVolume(BASE_MUSIC_VOL * vol);
    }
  }

  /** Item 79: Sync live ambiance volume when setting changes. */
  private applyAmbianceVolume(vol: number) {
    if (!this.currentAmbiance) return;
    if (this.currentAmbiance instanceof Phaser.Sound.WebAudioSound ||
        this.currentAmbiance instanceof Phaser.Sound.HTML5AudioSound) {
      this.currentAmbiance.setVolume(vol * 0.6);
    }
  }

  private calculateSpatial(opts?: PlayOpts): { pan: number; volume: number } {
    if (opts?.sourceX === undefined || opts?.sourceY === undefined) {
      return { pan: 0, volume: 1 };
    }
    const camera = this.scene.cameras.main;
    const cx = camera.midPoint.x;
    const cy = camera.midPoint.y;
    const dx = opts.sourceX - cx;
    const dy = opts.sourceY - cy;

    // Pan: scale horizontal distance relative to half the camera width.
    // At edges of screen, pan will be ~±0.8 to ±1.0.
    const maxPanDist = camera.width * 0.5;
    const pan = Phaser.Math.Clamp(dx / maxPanDist, -1, 1);

    // Attenuate volume based on distance.
    const dist = Math.sqrt(dx * dx + dy * dy);
    // At ~1200px (approx 3/4 screen width on some setups, or just outside), volume becomes 0.
    const maxDist = 1200;
    const volume = Phaser.Math.Clamp(1 - dist / maxDist, 0, 1);

    return { pan, volume };
  }

  private play(key: string, opts?: PlayOpts) {
    if (!this.scene.cache.audio.has(key)) return; // preload guard
    const now = Date.now();
    if (now - (this.lastPlayTime.get(key) ?? 0) < this.SFX_COOLDOWN_MS) return; // throttle
    if (this.lastKey === key && now - this.lastKeyAt < 100) return; // no-repeat
    this.lastPlayTime.set(key, now);
    this.lastKey = key;
    this.lastKeyAt = now;
    try {
      const spatial = this.calculateSpatial(opts);
      const baseOptVol = opts?.volume ?? 1;
      const baseSfxVol = BASE_SFX[key] ?? 0.5;
      const s = gameSettings.get();

      // Item 79: UI sounds use uiVolume instead of sfxVolume
      const isUISfx = [
        AudioAssets.CLICK, AudioAssets.CLICK_HOVER,
        AudioAssets.CLICK_OPEN, AudioAssets.CLICK_CLOSE,
        AudioAssets.NOTIFICATION,
      ].includes(key as typeof AudioAssets.CLICK);
      const categoryVol = isUISfx ? s.uiVolume : s.sfxVolume;

      const vol = baseSfxVol * categoryVol * spatial.volume * baseOptVol;
      const rate = (opts?.rate ?? 1) * (0.92 + Math.random() * 0.16); // ±8% pitch

      const playConfig: Phaser.Types.Sound.SoundConfig = { ...opts, volume: vol, rate, pan: spatial.pan };
      this.scene.sound.play(key, playConfig);
    } catch { /* noop */ }
  }

  /** Resolve a SfxEntry table and play. Falls back to `fallback` if no entry. */
  private fromTable(table: Partial<Record<string, SfxEntry>>, id: string, fallback?: () => void, opts?: PlayOpts) {
    const entry = table[id];
    entry ? this.play(pickSfx(entry), opts) : fallback?.();
  }

  // ── Public playback API ───────────────────────────────────────────────────────

  playSpellSfx(abilityId: string, opts?: PlayOpts)       { this.fromTable(SPELL_SFX, abilityId, () => this.playSpell(opts), opts); }
  playSpellImpactSfx(abilityId: string, opts?: PlayOpts) { this.fromTable(SPELL_IMPACT_SFX, abilityId, undefined, opts); }

  /** Distance-attenuated play — volume drops linearly beyond `MAX_AUDIBLE_TILES`. */
  playAttenuated(key: string, distanceTiles: number) {
    if (distanceTiles >= MAX_AUDIBLE_TILES) return;
    this.play(key, { volume: 1 - distanceTiles / MAX_AUDIBLE_TILES });
  }



  playStep(opts?: PlayOpts) {
    const STEPS = [AudioAssets.STEP_1, AudioAssets.STEP_2, AudioAssets.STEP_3, AudioAssets.STEP_4, AudioAssets.STEP_5];
    this.play(STEPS[Math.floor(Math.random() * STEPS.length)], opts);
  }

  playAttack(weaponId?: string, opts?: PlayOpts) {
    if (weaponId?.match(/bow|crossbow/))     return this.play(AudioAssets.BOW, opts);
    if (weaponId?.match(/staff|wand/))       return this.play(AudioAssets.SPELL, opts);
    if (weaponId?.match(/dagger|knife/))     return this.play(pickSfx([AudioAssets.ATTACK_1, AudioAssets.ATTACK_3]), opts);
    this.play(pickSfx([AudioAssets.ATTACK_1, AudioAssets.ATTACK_2, AudioAssets.ATTACK_3]), opts);
  }

  playSpell(opts?: PlayOpts)  { this.play(AudioAssets.SPELL, opts); }
  playHit(opts?: PlayOpts)    { this.play(pickSfx([AudioAssets.HIT_1, AudioAssets.HIT_2, AudioAssets.HIT_3]), opts); }
  playDeath(opts?: PlayOpts)  { this.play(AudioAssets.DEATH, opts); }
  playHeal(opts?: PlayOpts)   { this.play(AudioAssets.HEAL, opts); }
  playLevelUp(opts?: PlayOpts){ this.play(AudioAssets.LEVEL_UP, opts); }
  playNotification(opts?: PlayOpts) { this.play(AudioAssets.NOTIFICATION, opts); }
  playMount(opts?: PlayOpts)  { this.play(AudioAssets.MOUNT, opts); }
  playBuff(opts?: PlayOpts)   { this.play(AudioAssets.BUFF, opts); }
  playStealth(opts?: PlayOpts){ this.play(AudioAssets.STEALTH, opts); }
  playSummon(opts?: PlayOpts) { this.play(AudioAssets.SUMMON, opts); }
  playMagicHit(opts?: PlayOpts){ this.play(AudioAssets.MAGIC_HIT, opts); }
  playBow(opts?: PlayOpts)   { this.play(AudioAssets.BOW, opts); }
  playCoins(opts?: PlayOpts) { this.play(AudioAssets.COINS, opts); }
  playQuestAccept(opts?: PlayOpts)   { this.play(AudioAssets.QUEST_ACCEPT, opts); }
  playQuestComplete(opts?: PlayOpts) { this.play(AudioAssets.QUEST_COMPLETE, opts); }
  playUIClick(opts?: PlayOpts)  { this.play(AudioAssets.CLICK, opts); }
  playUIHover(opts?: PlayOpts)  { this.play(AudioAssets.CLICK_HOVER, opts); }
  playUIOpen(opts?: PlayOpts)   { this.play(AudioAssets.CLICK_OPEN, opts); }
  playUIClose(opts?: PlayOpts)  { this.play(AudioAssets.CLICK_CLOSE, opts); }

  playNpcAttack(type: string | undefined, opts?: PlayOpts) {
    const { attack, atkVol } = npcAudio(type);
    this.play(attack, { ...opts, volume: atkVol });
  }
  playNpcDeath(type: string | undefined, opts?: PlayOpts) {
    const { death, dthVol } = npcAudio(type);
    this.play(death, { ...opts, volume: dthVol });
  }
  playNpcLevelUp(opts?: PlayOpts) { this.play(AudioAssets.NPC_LEVEL_UP, { ...opts, volume: 0.5 }); }

  startAmbiance(key: typeof AudioAssets.AMBIANCE_WIND | typeof AudioAssets.AMBIANCE_CRICKETS) {
    if (this.currentAmbiance?.key === key) return;
    this.stopAmbiance();
    // Item 79: use ambianceVolume setting
    const targetVol = gameSettings.get().ambianceVolume * 0.6;
    this.currentAmbiance = this.scene.sound.add(key, { loop: true, volume: 0 });
    this.currentAmbiance.play();
    this.scene.tweens.add({ targets: this.currentAmbiance, volume: targetVol, duration: 2000 });
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
