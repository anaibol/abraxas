import type { Ability } from "../types";
import { VIEWPORT_TILES_X } from "./constants";

/** Range that covers the entire visible viewport (half the canonical width). */
const FULL_VIEWPORT_RANGE = Math.floor(VIEWPORT_TILES_X / 2);

export const ABILITIES: Record<string, Ability> = {
  // ── WARRIOR ──────────────────────────────────────────────────────────────

  /** Q — Self-buff: +STR for burst window */
  war_cry: {
    id: "war_cry",
    rangeTiles: 0,
    manaCost: 15,
    baseDamage: 0,
    scalingStat: "str",
    scalingRatio: 0,
    cooldownMs: 12000,
    windupMs: 100,
    effect: "buff",
    damageSchool: "physical",
    key: "Q",
    durationMs: 8000,
    buffStat: "str",
    buffAmount: 10,
    fxId: 16,
  },

  /** W — Melee stun: close-range bash that interrupts */
  shield_bash: {
    id: "shield_bash",
    rangeTiles: 1,
    manaCost: 20,
    baseDamage: 15,
    scalingStat: "str",
    scalingRatio: 0.6,
    cooldownMs: 6000,
    windupMs: 140,
    effect: "stun",
    damageSchool: "physical",
    key: "W",
    durationMs: 2000,
    fxId: 17,
  },

  /** E — AoE spin attack: damages all enemies adjacent to caster */
  whirlwind: {
    id: "whirlwind",
    rangeTiles: 0,
    manaCost: 30,
    baseDamage: 20,
    scalingStat: "str",
    scalingRatio: 0.7,
    cooldownMs: 7000,
    windupMs: 200,
    effect: "aoe",
    damageSchool: "physical",
    key: "E",
    aoeRadius: 1,
    fxId: 14,
  },

  /** R — AoE debuff: warcry that lowers enemy armor + STR in a wide radius */
  battle_shout: {
    id: "battle_shout",
    rangeTiles: 0,
    manaCost: 25,
    baseDamage: 0,
    scalingStat: "str",
    scalingRatio: 0,
    cooldownMs: 18000,
    windupMs: 160,
    effect: "debuff",
    damageSchool: "physical",
    key: "R",
    durationMs: 6000,
    aoeRadius: 3,
    buffStat: "armor",
    buffAmount: 12,
    fxId: 16,
  },

  // ── MAGE ─────────────────────────────────────────────────────────────────

  /** Q — Ranged single-target: fast projectile, full screen range */
  fireball: {
    id: "fireball",
    rangeTiles: FULL_VIEWPORT_RANGE,
    manaCost: 25,
    baseDamage: 30,
    scalingStat: "int",
    scalingRatio: 0.8,
    cooldownMs: 450,
    windupMs: 140,
    effect: "damage",
    damageSchool: "magical",
    key: "Q",
    fxId: 3,
  },

  /** W — Ranged single-target: deals damage and applies an AGI slow */
  ice_bolt: {
    id: "ice_bolt",
    rangeTiles: 8,
    manaCost: 20,
    baseDamage: 20,
    scalingStat: "int",
    scalingRatio: 0.6,
    cooldownMs: 600,
    windupMs: 120,
    effect: "damage",
    damageSchool: "magical",
    key: "W",
    fxId: 22,
    buffStat: "agi",
    buffAmount: -6,
    durationMs: 3000,
  },

  /** E — AoE lightning at target tile */
  thunderstorm: {
    id: "thunderstorm",
    rangeTiles: 8,
    manaCost: 45,
    baseDamage: 25,
    scalingStat: "int",
    scalingRatio: 0.7,
    cooldownMs: 3000,
    windupMs: 200,
    effect: "aoe",
    damageSchool: "magical",
    key: "E",
    aoeRadius: 2,
    fxId: 14,
  },

  /** R — Self-buff: temporary magic-armor shell */
  mana_shield: {
    id: "mana_shield",
    rangeTiles: 0,
    manaCost: 30,
    baseDamage: 0,
    scalingStat: "int",
    scalingRatio: 0,
    cooldownMs: 15000,
    windupMs: 80,
    effect: "buff",
    damageSchool: "magical",
    key: "R",
    durationMs: 6000,
    buffStat: "armor",
    buffAmount: 15,
    fxId: 18,
  },

  /** T — AoE stun burst around the caster: short duration but wide radius */
  frost_nova: {
    id: "frost_nova",
    rangeTiles: 0,
    manaCost: 40,
    baseDamage: 0,
    scalingStat: "int",
    scalingRatio: 0,
    cooldownMs: 10000,
    windupMs: 180,
    effect: "stun",
    damageSchool: "magical",
    key: "T",
    durationMs: 2000,
    aoeRadius: 3,
    fxId: 22,
  },

  /** Y — Heavy single-target nuke: long cast, huge damage */
  arcane_surge: {
    id: "arcane_surge",
    rangeTiles: FULL_VIEWPORT_RANGE,
    manaCost: 60,
    baseDamage: 70,
    scalingStat: "int",
    scalingRatio: 1.5,
    cooldownMs: 12000,
    windupMs: 500,
    effect: "damage",
    damageSchool: "magical",
    key: "Y",
    fxId: 3,
  },

  // ── RANGER ───────────────────────────────────────────────────────────────

  /** Q — AoE volley: hits all enemies in a small radius at range */
  multi_shot: {
    id: "multi_shot",
    rangeTiles: 5,
    manaCost: 25,
    baseDamage: 18,
    scalingStat: "agi",
    scalingRatio: 0.5,
    cooldownMs: 2000,
    windupMs: 120,
    effect: "aoe",
    damageSchool: "physical",
    key: "Q",
    aoeRadius: 2,
    fxId: 14,
  },

  /** W — DoT: poisons a single enemy over several seconds */
  poison_arrow: {
    id: "poison_arrow",
    rangeTiles: 8,
    manaCost: 20,
    baseDamage: 10,
    scalingStat: "agi",
    scalingRatio: 0.4,
    cooldownMs: 4000,
    windupMs: 100,
    effect: "dot",
    damageSchool: "physical",
    key: "W",
    dotDamage: 5,
    dotIntervalMs: 1000,
    dotDurationMs: 5000,
    fxId: 19,
  },

  /** E — Self-buff: temporarily massively boosts AGI (dodge + speed) */
  evasion: {
    id: "evasion",
    rangeTiles: 0,
    manaCost: 20,
    baseDamage: 0,
    scalingStat: "agi",
    scalingRatio: 0,
    cooldownMs: 10000,
    windupMs: 60,
    effect: "buff",
    damageSchool: "physical",
    key: "E",
    durationMs: 5000,
    buffStat: "agi",
    buffAmount: 15,
    fxId: 18,
  },

  /** R — Precision shot: full viewport range, high damage, long cooldown */
  aimed_shot: {
    id: "aimed_shot",
    rangeTiles: FULL_VIEWPORT_RANGE,
    manaCost: 35,
    baseDamage: 45,
    scalingStat: "agi",
    scalingRatio: 1.2,
    cooldownMs: 8000,
    windupMs: 400,
    effect: "damage",
    damageSchool: "physical",
    key: "R",
    fxId: 3,
  },

  /** T — Debuff: marks target, reducing their armor so all attacks deal more */
  mark_target: {
    id: "mark_target",
    rangeTiles: 8,
    manaCost: 15,
    baseDamage: 0,
    scalingStat: "agi",
    scalingRatio: 0,
    cooldownMs: 5000,
    windupMs: 80,
    effect: "debuff",
    damageSchool: "physical",
    key: "T",
    durationMs: 8000,
    buffStat: "armor",
    buffAmount: 10,
    fxId: 19,
  },

  // ── ROGUE ─────────────────────────────────────────────────────────────────

  /** Q — Melee nuke: massive burst from stealth */
  backstab: {
    id: "backstab",
    rangeTiles: 1,
    manaCost: 25,
    baseDamage: 40,
    scalingStat: "agi",
    scalingRatio: 1.0,
    cooldownMs: 3000,
    windupMs: 80,
    effect: "damage",
    damageSchool: "physical",
    key: "Q",
    fxId: 2,
  },

  /** W — Vanish: disappear from enemy detection for a duration */
  stealth: {
    id: "stealth",
    rangeTiles: 0,
    manaCost: 30,
    baseDamage: 0,
    scalingStat: "agi",
    scalingRatio: 0,
    cooldownMs: 15000,
    windupMs: 60,
    effect: "stealth",
    damageSchool: "physical",
    key: "W",
    durationMs: 6000,
    fxId: 10,
  },

  /** E — DoT: coats the weapon with venom for sustained damage */
  envenom: {
    id: "envenom",
    rangeTiles: 1,
    manaCost: 20,
    baseDamage: 8,
    scalingStat: "agi",
    scalingRatio: 0.3,
    cooldownMs: 5000,
    windupMs: 80,
    effect: "dot",
    damageSchool: "physical",
    key: "E",
    dotDamage: 6,
    dotIntervalMs: 1000,
    dotDurationMs: 6000,
    fxId: 19,
  },

  /** R — AoE stun: throws a smoke bomb stunning nearby enemies */
  smoke_bomb: {
    id: "smoke_bomb",
    rangeTiles: 0,
    manaCost: 35,
    baseDamage: 0,
    scalingStat: "agi",
    scalingRatio: 0,
    cooldownMs: 12000,
    windupMs: 100,
    effect: "aoe",
    damageSchool: "physical",
    key: "R",
    aoeRadius: 2,
    durationMs: 1500,
    buffStat: "stun",
    fxId: 10,
  },

  /** T — Leech strike: saps life force from the target into the caster */
  hemorrhage: {
    id: "hemorrhage",
    rangeTiles: 1,
    manaCost: 25,
    baseDamage: 20,
    scalingStat: "agi",
    scalingRatio: 0.6,
    cooldownMs: 6000,
    windupMs: 120,
    effect: "leech",
    damageSchool: "physical",
    key: "T",
    leechRatio: 0.5,
    fxId: 2,
  },

  // ── CLERIC ────────────────────────────────────────────────────────────────

  /** Q — Melee holy strike: smites a single foe */
  holy_strike: {
    id: "holy_strike",
    rangeTiles: 1,
    manaCost: 20,
    baseDamage: 25,
    scalingStat: "str",
    scalingRatio: 0.7,
    cooldownMs: 2000,
    windupMs: 140,
    effect: "damage",
    damageSchool: "physical",
    key: "Q",
    fxId: 23,
  },

  /** W — Self-heal: restores a chunk of HP */
  heal: {
    id: "heal",
    rangeTiles: 0,
    manaCost: 30,
    baseDamage: 40,
    scalingStat: "int",
    scalingRatio: 0.8,
    cooldownMs: 4000,
    windupMs: 160,
    effect: "heal",
    damageSchool: "magical",
    key: "W",
    fxId: 1,
  },

  /** E — Invulnerability bubble: brief window of immunity */
  divine_shield: {
    id: "divine_shield",
    rangeTiles: 0,
    manaCost: 40,
    baseDamage: 0,
    scalingStat: "int",
    scalingRatio: 0,
    cooldownMs: 20000,
    windupMs: 100,
    effect: "buff",
    damageSchool: "magical",
    key: "E",
    durationMs: 4000,
    buffStat: "invulnerable",
    buffAmount: 1,
    fxId: 34,
  },

  /** R — AoE heal: pulse of holy light restores HP for all nearby allies */
  holy_nova: {
    id: "holy_nova",
    rangeTiles: 0,
    manaCost: 50,
    baseDamage: 30,
    scalingStat: "int",
    scalingRatio: 0.9,
    cooldownMs: 8000,
    windupMs: 300,
    effect: "aoe_heal",
    damageSchool: "magical",
    key: "R",
    aoeRadius: 3,
    fxId: 1,
  },

  /** T — Curse: debuffs an enemy INT + armor, increasing all damage they take */
  curse: {
    id: "curse",
    rangeTiles: 6,
    manaCost: 25,
    baseDamage: 0,
    scalingStat: "int",
    scalingRatio: 0,
    cooldownMs: 8000,
    windupMs: 200,
    effect: "debuff",
    damageSchool: "magical",
    key: "T",
    durationMs: 10000,
    buffStat: "int",
    buffAmount: 15,
    fxId: 10,
  },

  /** Y — Ranged smite: holy bolt that damages undead and unholy targets */
  smite: {
    id: "smite",
    rangeTiles: 6,
    manaCost: 30,
    baseDamage: 35,
    scalingStat: "int",
    scalingRatio: 0.9,
    cooldownMs: 5000,
    windupMs: 200,
    effect: "damage",
    damageSchool: "magical",
    key: "Y",
    fxId: 23,
  },

  // ── PALADIN ───────────────────────────────────────────────────────────────

  /** Q — Melee holy slam: consecrated strike that deals divine damage */
  judgment: {
    id: "judgment",
    rangeTiles: 1,
    manaCost: 20,
    baseDamage: 28,
    scalingStat: "str",
    scalingRatio: 0.75,
    cooldownMs: 2500,
    windupMs: 130,
    effect: "damage",
    damageSchool: "physical",
    key: "Q",
    fxId: 23,
  },

  /** W — Lay on Hands: channel divine energy to restore a large chunk of HP */
  lay_on_hands: {
    id: "lay_on_hands",
    rangeTiles: 0,
    manaCost: 35,
    baseDamage: 50,
    scalingStat: "int",
    scalingRatio: 0.9,
    cooldownMs: 6000,
    windupMs: 200,
    effect: "heal",
    damageSchool: "magical",
    key: "W",
    fxId: 1,
  },

  /** E — Consecration: radiate holy fire, damaging all enemies around the caster */
  consecration: {
    id: "consecration",
    rangeTiles: 0,
    manaCost: 30,
    baseDamage: 22,
    scalingStat: "str",
    scalingRatio: 0.6,
    cooldownMs: 7000,
    windupMs: 250,
    effect: "aoe",
    damageSchool: "physical",
    key: "E",
    aoeRadius: 2,
    fxId: 34,
  },

  /** R — Aura of Protection: surround yourself in divine plate, massively boosting armor */
  aura_of_protection: {
    id: "aura_of_protection",
    rangeTiles: 0,
    manaCost: 25,
    baseDamage: 0,
    scalingStat: "str",
    scalingRatio: 0,
    cooldownMs: 16000,
    windupMs: 100,
    effect: "buff",
    damageSchool: "physical",
    key: "R",
    durationMs: 8000,
    buffStat: "armor",
    buffAmount: 18,
    fxId: 18,
  },

  /** T — Holy Bolt: launch a bolt of divine light at a distant enemy */
  holy_bolt: {
    id: "holy_bolt",
    rangeTiles: 6,
    manaCost: 28,
    baseDamage: 32,
    scalingStat: "int",
    scalingRatio: 0.85,
    cooldownMs: 5000,
    windupMs: 220,
    effect: "damage",
    damageSchool: "magical",
    key: "T",
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

  /** Lich/Ghost: AoE debuff that weakens all nearby enemies' INT + armor */
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
    aoeRadius: 4,
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

  /** Dragon/Goblin shaman: wide AoE fire damage around the caster */
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
    aoeRadius: 3,
    fxId: 3,
  },

  /** Ice/Undead: AoE debuff that slows (reduces AGI) all nearby enemies */
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
