import type { Ability } from "../types";
import { VIEWPORT_TILES_X } from "./constants";

/** Range that covers the entire visible viewport (half the canonical width). */
const FULL_VIEWPORT_RANGE = Math.floor(VIEWPORT_TILES_X / 2);

export const ABILITIES: Record<string, Ability> = {
  // ── WARRIOR ──────────────────────────────────────────────────────────────

  /** Q — Self-buff: +STR for burst window */
  war_cry: {
    id: "war_cry",key: "",
    requiredLevel: 1,
    durationMs: 8000,
    buffStat: "str",
    buffAmount: 10,
    fxId: 16,
  },

  /** W — Melee stun: close-range bash that interrupts */
  shield_bash: {
    id: "shield_bash",key: "",
    requiredLevel: 3,
    durationMs: 2000,
    fxId: 17,
  },

  /** E — AoE spin attack: damages all enemies adjacent to caster */
  whirlwind: {
    id: "whirlwind",key: "",
    requiredLevel: 6,
    aoeRadius: 1,
    fxId: 14,
  },

  /** R — AoE debuff: warcry that lowers enemy armor + STR in a wide radius */
  battle_shout: {
    id: "battle_shout",key: "",
    requiredLevel: 10,
    durationMs: 6000,
    aoeRadius: 3,
    buffStat: "armor",
    buffAmount: 12,
    fxId: 16,
  },

  // ── MAGE ─────────────────────────────────────────────────────────────────

  /** Q — Ranged single-target: fast projectile, full screen range */
  fireball: {
    id: "fireball",key: "",
    requiredLevel: 1,
    fxId: 3,
  },

  /** W — Ranged single-target: deals damage and applies an AGI slow */
  ice_bolt: {
    id: "ice_bolt",key: "",
    requiredLevel: 3,
    fxId: 22,
    buffStat: "agi",
    buffAmount: -6,
    durationMs: 3000,
  },

  /** E — AoE lightning at target tile */
  thunderstorm: {
    id: "thunderstorm",key: "",
    requiredLevel: 6,
    aoeRadius: 2,
    fxId: 14,
  },

  /** R — Self-buff: temporary magic-armor shell */
  mana_shield: {
    id: "mana_shield",key: "",
    requiredLevel: 10,
    durationMs: 6000,
    buffStat: "armor",
    buffAmount: 15,
    fxId: 18,
  },

  /** T — AoE stun burst around the caster: short duration but wide radius */
  frost_nova: {
    id: "frost_nova",key: "",
    requiredLevel: 15,
    durationMs: 2000,
    aoeRadius: 3,
    fxId: 22,
  },

  /** Y — Heavy single-target nuke: long cast, huge damage */
  arcane_surge: {
    id: "arcane_surge",key: "",
    requiredLevel: 20,
    fxId: 3,
  },

  // ── RANGER ───────────────────────────────────────────────────────────────

  /** Q — AoE volley: hits all enemies in a small radius at range */
  multi_shot: {
    id: "multi_shot",key: "",
    requiredLevel: 1,
    aoeRadius: 2,
    fxId: 14,
  },

  /** W — DoT: poisons a single enemy over several seconds */
  poison_arrow: {
    id: "poison_arrow",key: "",
    requiredLevel: 3,
    dotDamage: 5,
    dotIntervalMs: 1000,
    dotDurationMs: 5000,
    fxId: 19,
  },

  /** E — Self-buff: temporarily massively boosts AGI (dodge + speed) */
  evasion: {
    id: "evasion",key: "",
    requiredLevel: 6,
    durationMs: 5000,
    buffStat: "agi",
    buffAmount: 15,
    fxId: 18,
  },

  /** R — Precision shot: full viewport range, high damage, long cooldown */
  aimed_shot: {
    id: "aimed_shot",key: "",
    requiredLevel: 10,
    fxId: 3,
  },

  /** T — Debuff: marks target, reducing their armor so all attacks deal more */
  mark_target: {
    id: "mark_target",key: "",
    requiredLevel: 15,
    durationMs: 8000,
    buffStat: "armor",
    buffAmount: 10,
    fxId: 19,
  },

  // ── ROGUE ─────────────────────────────────────────────────────────────────

  /** Q — Melee nuke: massive burst from stealth */
  backstab: {
    id: "backstab",key: "",
    requiredLevel: 1,
    fxId: 2,
  },

  /** W — Vanish: disappear from enemy detection for a duration */
  stealth: {
    id: "stealth",key: "",
    requiredLevel: 3,
    durationMs: 6000,
    fxId: 10,
  },

  /** E — DoT: coats the weapon with venom for sustained damage */
  envenom: {
    id: "envenom",key: "",
    requiredLevel: 6,
    dotDamage: 6,
    dotIntervalMs: 1000,
    dotDurationMs: 6000,
    fxId: 19,
  },

  /** R — AoE stun: throws a smoke bomb stunning nearby enemies */
  smoke_bomb: {
    id: "smoke_bomb",key: "",
    requiredLevel: 10,
    aoeRadius: 2,
    durationMs: 1500,
    buffStat: "stun",
    fxId: 10,
  },

  /** T — Leech strike: saps life force from the target into the caster */
  hemorrhage: {
    id: "hemorrhage",key: "",
    requiredLevel: 15,
    leechRatio: 0.5,
    fxId: 2,
  },

  // ── CLERIC ────────────────────────────────────────────────────────────────

  /** Q — Melee holy strike: smites a single foe */
  holy_strike: {
    id: "holy_strike",key: "",
    requiredLevel: 1,
    fxId: 23,
  },

  /** W — Self-heal: restores a chunk of HP */
  heal: {
    id: "heal",key: "",
    requiredLevel: 3,
    fxId: 1,
  },

  /** E — Invulnerability bubble: brief window of immunity */
  divine_shield: {
    id: "divine_shield",key: "",
    requiredLevel: 6,
    durationMs: 4000,
    buffStat: "invulnerable",
    buffAmount: 1,
    fxId: 34,
  },

  /** R — AoE heal: pulse of holy light restores HP for all nearby allies */
  holy_nova: {
    id: "holy_nova",key: "",
    requiredLevel: 10,
    aoeRadius: 3,
    fxId: 1,
  },

  /** T — Curse: debuffs an enemy INT + armor, increasing all damage they take */
  curse: {
    id: "curse",key: "",
    requiredLevel: 15,
    durationMs: 10000,
    buffStat: "int",
    buffAmount: 15,
    fxId: 10,
  },

  /** Y — Ranged smite: holy bolt that damages undead and unholy targets */
  smite: {
    id: "smite",key: "",
    requiredLevel: 20,
    fxId: 23,
  },

  // ── PALADIN ───────────────────────────────────────────────────────────────

  /** Q — Melee holy slam: consecrated strike that deals divine damage */
  judgment: {
    id: "judgment",key: "",
    requiredLevel: 1,
    fxId: 23,
  },

  /** W — Lay on Hands: channel divine energy to restore a large chunk of HP */
  lay_on_hands: {
    id: "lay_on_hands",key: "",
    requiredLevel: 3,
    fxId: 1,
  },

  /** E — Consecration: radiate holy fire, damaging all enemies around the caster */
  consecration: {
    id: "consecration",key: "",
    requiredLevel: 6,
    aoeRadius: 2,
    fxId: 34,
  },

  /** R — Aura of Protection: surround yourself in divine plate, massively boosting armor */
  aura_of_protection: {
    id: "aura_of_protection",key: "",
    requiredLevel: 10,
    durationMs: 8000,
    buffStat: "armor",
    buffAmount: 18,
    fxId: 18,
  },

  /** T — Holy Bolt: launch a bolt of divine light at a distant enemy */
  holy_bolt: {
    id: "holy_bolt",key: "",
    requiredLevel: 15,
    fxId: 23,
  },

  // ── NPC ABILITIES ─────────────────────────────────────────────────────────

  /** Spider: DoT bite */
  poison_bite: {
    id: "poison_bite",
    rangeTiles: 1,
    manaCost: 0,
    baseDamage: 5,
    scalingStat: "agi",
    scalingRatio: 0.2,
    // Cooldown must exceed dotDurationMs (5000ms) so the DoT expires before
    // it can be reapplied, preventing effectively permanent poison.
    cooldownMs: 8000,
    windupMs: 100,
    effect: "dot",
    damageSchool: "physical",
    key: "",
    dotDamage: 3,
    dotIntervalMs: 1000,
    dotDurationMs: 5000,
    fxId: 19,
  },

  /** Spider: stuns target in web */
  web_shot: {
    id: "web_shot",
    rangeTiles: 4,
    manaCost: 0,
    baseDamage: 0,
    scalingStat: "agi",
    scalingRatio: 0,
    cooldownMs: 6000,
    windupMs: 150,
    effect: "stun",
    damageSchool: "physical",
    key: "",
    durationMs: 2500,
    fxId: 19,
  },

  /** Ghost: close-range life drain */
  soul_drain: {
    id: "soul_drain",
    rangeTiles: 1,
    manaCost: 0,
    baseDamage: 10,
    scalingStat: "int",
    scalingRatio: 0.5,
    cooldownMs: 3000,
    windupMs: 200,
    effect: "leech",
    damageSchool: "magical",
    key: "",
    leechRatio: 0.6,
    fxId: 22,
  },

  /** Lich/Boss: long-range dark magic bolt */
  shadow_bolt: {
    id: "shadow_bolt",
    rangeTiles: FULL_VIEWPORT_RANGE,
    manaCost: 0,
    baseDamage: 40,
    scalingStat: "int",
    scalingRatio: 1.0,
    cooldownMs: 2000,
    windupMs: 300,
    effect: "damage",
    damageSchool: "magical",
    key: "",
    fxId: 3,
  },

  /** Ghost/Lich: AoE debuff that weakens all nearby enemies' armor */
  banshee_wail: {
    id: "banshee_wail",
    rangeTiles: 0,
    manaCost: 0,
    baseDamage: 0,
    scalingStat: "int",
    scalingRatio: 0,
    cooldownMs: 8000,
    windupMs: 400,
    effect: "debuff",
    damageSchool: "magical",
    key: "",
    durationMs: 6000,
    // Radius 3 instead of 4 — still a wide area effect but less oppressive
    // when multiple ghosts or the lich are active simultaneously.
    aoeRadius: 3,
    buffStat: "armor",
    buffAmount: 8,
    fxId: 16,
  },

  /** Orc/Boss: self-buff that spikes STR for a berserker window */
  enrage: {
    id: "enrage",
    rangeTiles: 0,
    manaCost: 0,
    baseDamage: 0,
    scalingStat: "str",
    scalingRatio: 0,
    cooldownMs: 20000,
    windupMs: 200,
    effect: "buff",
    damageSchool: "physical",
    key: "",
    durationMs: 6000,
    buffStat: "str",
    buffAmount: 20,
    fxId: 16,
  },

  /** Goblin shaman: small fire splash around the caster */
  fire_breath: {
    id: "fire_breath",
    rangeTiles: 0,
    manaCost: 0,
    baseDamage: 30,
    scalingStat: "int",
    scalingRatio: 0.6,
    cooldownMs: 5000,
    windupMs: 350,
    effect: "aoe",
    damageSchool: "magical",
    key: "",
    // Radius 2 keeps the blast tight — appropriate for a low-tier goblin ability.
    // (Was 3, which made the AoE unreasonably large for a 30 EXP enemy.)
    aoeRadius: 2,
    fxId: 3,
  },

  /** Lich: AoE frost that slows (reduces AGI) all nearby enemies */
  frost_breath: {
    id: "frost_breath",
    rangeTiles: 0,
    manaCost: 0,
    baseDamage: 10,
    scalingStat: "int",
    scalingRatio: 0.2,
    cooldownMs: 6000,
    windupMs: 300,
    effect: "debuff",
    damageSchool: "magical",
    key: "",
    durationMs: 4000,
    aoeRadius: 3,
    buffStat: "agi",
    buffAmount: 10,
    fxId: 22,
  },

  /** Zombie: slow-ticking disease DoT with long duration */
  disease_bite: {
    id: "disease_bite",
    rangeTiles: 1,
    manaCost: 0,
    baseDamage: 8,
    scalingStat: "int",
    scalingRatio: 0.3,
    // Cooldown exceeds dotDurationMs (10000ms) so the disease always expires
    // before it can be reapplied, preventing a permanent diseased state.
    cooldownMs: 13000,
    windupMs: 250,
    effect: "dot",
    damageSchool: "physical",
    key: "",
    dotDamage: 4,
    dotIntervalMs: 2000,
    dotDurationMs: 10000,
    fxId: 19,
  },

  /** Troll: emergency self-heal when critically low on HP */
  troll_regen: {
    id: "troll_regen",
    rangeTiles: 0,
    manaCost: 0,
    baseDamage: 80,
    scalingStat: "str",
    scalingRatio: 0.5,
    cooldownMs: 20000,
    windupMs: 600,
    effect: "heal",
    damageSchool: "magical",
    key: "",
    fxId: 1,
  },

  /** Lich: summons skeleton minions */
  summon_skeleton: {
    id: "summon_skeleton",
    rangeTiles: 0,
    manaCost: 0,
    baseDamage: 0,
    scalingStat: "int",
    scalingRatio: 0,
    cooldownMs: 10000,
    windupMs: 500,
    effect: "summon",
    damageSchool: "magical",
    key: "",
    fxId: 16,
  },
};

/** @deprecated Use `ABILITIES` instead. */
export const SPELLS = ABILITIES;
