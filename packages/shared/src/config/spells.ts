import { type Ability, DamageSchool, StatType } from "../types";
import { VIEWPORT_TILES_X } from "./constants";

/** Range that covers the entire visible viewport (half the canonical width). */
const FULL_VIEWPORT_RANGE = Math.floor(VIEWPORT_TILES_X / 2);

const _ABILITIES: Record<string, Partial<Ability>> = {
  // ── WARRIOR ──────────────────────────────────────────────────────────────

  /** Q — Self-buff: +STR for burst window */
  war_cry: {
    id: "war_cry",
    key: "",
    requiredLevel: 1,
    manaCost: 15,
    cooldownMs: 20000,
    durationMs: 8000,
    buffStat: StatType.STR,
    buffAmount: 10,
    fxId: 16,
    rangeTiles: 0,
    effect: "buff",
  },

  /** W — Melee stun: close-range bash that interrupts */
  shield_bash: {
    id: "shield_bash",
    key: "",
    requiredLevel: 3,
    manaCost: 20,
    baseDamage: 15,
    scalingStat: StatType.STR,
    scalingRatio: 0.5,
    cooldownMs: 8000,
    durationMs: 2000,
    effect: "stun",
    damageSchool: DamageSchool.PHYSICAL,
    rangeTiles: 1,
    fxId: 17,
  },

  /** E — AoE spin attack: damages all enemies adjacent to caster */
  whirlwind: {
    id: "whirlwind",
    key: "",
    requiredLevel: 6,
    manaCost: 30,
    baseDamage: 25,
    scalingStat: StatType.STR,
    scalingRatio: 0.8,
    cooldownMs: 6000,
    rangeTiles: 0,
    aoeRadius: 1,
    effect: "damage",
    damageSchool: DamageSchool.PHYSICAL,
    fxId: 14,
  },

  /** R — AoE debuff: warcry that lowers enemy armor in a wide radius */
  battle_shout: {
    id: "battle_shout",
    key: "",
    requiredLevel: 10,
    manaCost: 25,
    cooldownMs: 15000,
    durationMs: 6000,
    rangeTiles: 0,
    aoeRadius: 3,
    effect: "debuff",
    buffStat: StatType.ARMOR,
    buffAmount: 12,
    fxId: 16,
  },

  /** Shield Wall: Massively boosts armor for 10 seconds */
  shield_wall: {
    id: "shield_wall",
    key: "",
    requiredLevel: 22,
    fxId: 18,
    rageCost: 40,
    cooldownMs: 60000,
    durationMs: 10000,
    buffStat: StatType.ARMOR,
    buffAmount: 40,
    effect: "buff",
  },
  /** T — Earthquake: Shakes the earth around the warrior, stunning nearby enemies */
  earthquake: {
    id: "earthquake",
    key: "",
    requiredLevel: 15,
    fxId: 17,
    manaCost: 40,
    baseDamage: 30,
    scalingStat: StatType.STR,
    scalingRatio: 1.0,
    cooldownMs: 12000,
    windupMs: 600,
    effect: StatType.STUN,
    damageSchool: DamageSchool.PHYSICAL,
    aoeRadius: 3,
    durationMs: 2500,
  },
  /** T — Leap: Jumps to a target tile, dealing damage and stunning nearby enemies */
  leap: {
    id: "leap",
    key: "",
    requiredLevel: 18,
    fxId: 17,
    rageCost: 20,
    baseDamage: 20,
    scalingStat: StatType.STR,
    scalingRatio: 0.8,
    cooldownMs: 15000,
    windupMs: 300,
    effect: "teleport",
    damageSchool: DamageSchool.PHYSICAL,
    rangeTiles: 5,
    aoeRadius: 2,
  },
  /** Y — Execute: Deals massive damage to targets below 20% HP */
  execute: {
    id: "execute",
    key: "",
    requiredLevel: 25,
    fxId: 2,
    rageCost: 30,
    baseDamage: 100,
    scalingStat: StatType.STR,
    scalingRatio: 2.5,
    cooldownMs: 10000,
    windupMs: 400,
    effect: "damage",
    damageSchool: DamageSchool.PHYSICAL,
    rangeTiles: 1,
    executeThreshold: 0.2,
    executeMultiplier: 3.0,
  },
  /** Cleave (Passive-ish Active): Hits 2 additional nearby targets */
  cleave: {
    id: "cleave",
    key: "",
    requiredLevel: 4,
    fxId: 14,
    rageCost: 15,
    baseDamage: 25,
    scalingStat: StatType.STR,
    scalingRatio: 0.7,
    cooldownMs: 4000,
    aoeRadius: 2,
    effect: "damage",
    damageSchool: DamageSchool.PHYSICAL,
    rangeTiles: 1,
  },
  /** Berserker Rage: Instantly gain 30 Rage */
  berserker_rage: {
    id: "berserker_rage",
    key: "",
    requiredLevel: 12,
    fxId: 16,
    manaCost: 0,
    cooldownMs: 30000,
    effect: "buff",
    buffStat: StatType.RAGE,
    buffAmount: 30,
    durationMs: 0,
  },

  // ── MAGE ─────────────────────────────────────────────────────────────────

  /** Q — Ranged single-target: fast projectile, full screen range */
  fireball: {
    id: "fireball",
    key: "",
    requiredLevel: 1,
    fxId: 3,
    manaCost: 15,
    baseDamage: 30,
    scalingStat: StatType.INT,
    scalingRatio: 1.0,
    cooldownMs: 2000,
    windupMs: 300,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    rangeTiles: FULL_VIEWPORT_RANGE,
  },

  /** W — Ranged single-target: deals damage and applies an AGI slow */
  ice_bolt: {
    id: "ice_bolt",
    key: "",
    requiredLevel: 3,
    fxId: 22,
    manaCost: 20,
    baseDamage: 20,
    scalingStat: StatType.INT,
    scalingRatio: 0.8,
    cooldownMs: 4000,
    windupMs: 300,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    rangeTiles: FULL_VIEWPORT_RANGE,
    buffStat: StatType.AGI,
    buffAmount: -6,
    durationMs: 3000,
  },

  /** E — AoE lightning at target tile */
  thunderstorm: {
    id: "thunderstorm",
    key: "",
    requiredLevel: 6,
    manaCost: 35,
    baseDamage: 35,
    scalingStat: StatType.INT,
    scalingRatio: 1.0,
    cooldownMs: 6000,
    rangeTiles: FULL_VIEWPORT_RANGE,
    aoeRadius: 2,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 14,
  },

  /** F - Utility: Breaks stealth on all enemies in an area around the caster */
  detect_invisibility: {
    id: "detect_invisibility",
    key: "",
    requiredLevel: 8,
    manaCost: 20,
    cooldownMs: 15000,
    aoeRadius: 4,
    effect: "reveal",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 18,
  },

  /** R — Self-buff: temporary magic-armor shell */
  mana_shield: {
    id: "mana_shield",
    key: "",
    requiredLevel: 10,
    manaCost: 30,
    cooldownMs: 20000,
    durationMs: 6000,
    rangeTiles: 0,
    effect: "buff",
    buffStat: StatType.ARMOR,
    buffAmount: 15,
    fxId: 18,
  },

  /** T — AoE stun burst around the caster: short duration but wide radius */
  frost_nova: {
    id: "frost_nova",
    key: "",
    requiredLevel: 15,
    manaCost: 40,
    baseDamage: 15,
    scalingStat: StatType.INT,
    scalingRatio: 0.5,
    cooldownMs: 12000,
    durationMs: 2000,
    rangeTiles: 0,
    aoeRadius: 3,
    effect: "stun",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 22,
  },

  /** P — Necromancy: Summons hostile skeletons at the target area */
  summon_skeleton: {
    id: "summon_skeleton",
    key: "",
    requiredLevel: 18,
    manaCost: 50,
    cooldownMs: 60000,
    windupMs: 800,
    rangeTiles: FULL_VIEWPORT_RANGE,
    effect: "summon",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 10,
  },

  /** Y — Heavy single-target nuke: long cast, huge damage */
  arcane_surge: {
    id: "arcane_surge",
    key: "",
    requiredLevel: 20,
    manaCost: 50,
    baseDamage: 60,
    scalingStat: StatType.INT,
    scalingRatio: 1.5,
    cooldownMs: 10000,
    windupMs: 600,
    rangeTiles: FULL_VIEWPORT_RANGE,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 3,
  },

  /** R — Meteor Strike: Massive AoE fire nuke with long windup */
  meteor_strike: {
    id: "meteor_strike",
    key: "",
    requiredLevel: 25,
    fxId: 3,
    manaCost: 60,
    baseDamage: 80,
    scalingStat: StatType.INT,
    scalingRatio: 1.5,
    cooldownMs: 15000,
    windupMs: 800,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    aoeRadius: 4,
  },

  /** F — Chain Lightning: Instant, wide-reaching electrical discharge */
  chain_lightning: {
    id: "chain_lightning",
    key: "",
    requiredLevel: 30,
    fxId: 14,
    manaCost: 45,
    baseDamage: 50,
    scalingStat: StatType.INT,
    scalingRatio: 1.2,
    cooldownMs: 8000,
    windupMs: 200,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    aoeRadius: 3,
  },
  /** Q — Blink: Teleports the caster forward */
  blink: {
    id: "blink",
    key: "",
    requiredLevel: 4,
    fxId: 10,
    manaCost: 25,
    cooldownMs: 12000,
    windupMs: 100,
    effect: "teleport",
    rangeTiles: 6,
  },
  /** W — Elemental Infusion: Next 3 spells deal 20% more damage */
  elemental_infusion: {
    id: "elemental_infusion",
    key: "",
    requiredLevel: 12,
    fxId: 18,
    manaCost: 30,
    cooldownMs: 25000,
    durationMs: 10000,
    buffStat: StatType.INT,
    buffAmount: 15,
    effect: "buff",
  },
  /** E — Spell Echo: Next spell casts twice (special logic needed) */
  spell_echo: {
    id: "spell_echo",
    key: "",
    requiredLevel: 22,
    fxId: 18,
    manaCost: 40,
    cooldownMs: 45000,
    durationMs: 8000,
    effect: "buff",
  },
  /** Mana Spring: Summons a stationary crystal that restores mana to nearby allies */
  mana_spring: {
    id: "mana_spring",
    key: "",
    requiredLevel: 14,
    fxId: 1,
    manaCost: 40,
    cooldownMs: 90000,
    durationMs: 20000,
    effect: "summon",
    summonType: "mana_spring",
    rangeTiles: 2,
  },
  /** Polymorph: Transforms the target into a sheep, stunning them and slowly healing them */
  polymorph: {
    id: "polymorph",
    key: "",
    requiredLevel: 24,
    fxId: 10,
    manaCost: 45,
    cooldownMs: 30000,
    durationMs: 6000,
    effect: "debuff",
    buffStat: StatType.STUN,
    appearanceOverride: { bodyId: 82, headId: 0 },
    rangeTiles: 5,
  },

  // ── RANGER ───────────────────────────────────────────────────────────────

  /** Q — AoE volley: hits all enemies in a small radius at range */
  multi_shot: {
    id: "multi_shot",
    key: "",
    requiredLevel: 1,
    manaCost: 25,
    baseDamage: 20,
    scalingStat: StatType.AGI,
    scalingRatio: 0.8,
    cooldownMs: 5000,
    rangeTiles: FULL_VIEWPORT_RANGE,
    aoeRadius: 2,
    effect: "damage",
    damageSchool: DamageSchool.PHYSICAL,
    fxId: 14,
  },

  /** W — DoT: poisons a single enemy over several seconds */
  poison_arrow: {
    id: "poison_arrow",
    key: "",
    requiredLevel: 3,
    manaCost: 15,
    baseDamage: 10,
    scalingStat: StatType.AGI,
    scalingRatio: 0.4,
    cooldownMs: 8000,
    dotDamage: 5,
    dotIntervalMs: 1000,
    dotDurationMs: 5000,
    fxId: 19,
  },

  /** E — Self-buff: temporarily massively boosts AGI (dodge + speed) */
  evasion: {
    id: "evasion",
    key: "",
    requiredLevel: 6,
    manaCost: 30,
    rangeTiles: 0,
    cooldownMs: 20000,
    durationMs: 5000,
    buffStat: StatType.AGI,
    buffAmount: 15,
    fxId: 18,
  },

  /** R — Precision shot: full viewport range, high damage, long cooldown */
  aimed_shot: {
    id: "aimed_shot",
    key: "",
    requiredLevel: 10,
    manaCost: 40,
    baseDamage: 50,
    scalingStat: StatType.AGI,
    scalingRatio: 1.5,
    cooldownMs: 10000,
    windupMs: 500,
    rangeTiles: FULL_VIEWPORT_RANGE,
    effect: "damage",
    damageSchool: DamageSchool.PHYSICAL,
    fxId: 3,
  },

  /** T — Debuff: marks target, reducing their armor so all attacks deal more */
  mark_target: {
    id: "mark_target",
    key: "",
    requiredLevel: 15,
    manaCost: 20,
    cooldownMs: 15000,
    durationMs: 8000,
    rangeTiles: FULL_VIEWPORT_RANGE,
    effect: "debuff",
    buffStat: StatType.ARMOR,
    buffAmount: 10,
    fxId: 19,
  },

  /** Y — Entangling Roots: AoE stun (Root) + minor DoT based in nature */
  entangling_roots: {
    id: "entangling_roots",
    key: "",
    requiredLevel: 20,
    fxId: 19,
    manaCost: 35,
    baseDamage: 10,
    scalingStat: StatType.AGI,
    scalingRatio: 0.4,
    cooldownMs: 12000,
    windupMs: 400,
    effect: StatType.STUN,
    damageSchool: DamageSchool.MAGICAL,
    durationMs: 3000,
    aoeRadius: 2,
    dotDamage: 5,
    dotIntervalMs: 1000,
    dotDurationMs: 4000,
  },
  /** Pet Bond: Boosts AGI for buff duration */
  pet_bond: {
    id: "pet_bond",
    key: "",
    requiredLevel: 22,
    fxId: 15,
    manaCost: 30,
    cooldownMs: 60000,
    durationMs: 30000,
    rangeTiles: 0,
    effect: "buff",
    buffStat: StatType.AGI,
    buffAmount: 10,
  },
  /** Explosive Trap: Places a trap that explodes when an enemy steps on it (Summon logic) */
  explosive_trap: {
    id: "explosive_trap",
    key: "",
    requiredLevel: 24,
    fxId: 3,
    manaCost: 35,
    cooldownMs: 20000,
    effect: "summon",
    summonType: "explosive_trap",
    rangeTiles: 1,
  },
  /** Eagle Eye: Massively increases attack range for a duration */
  eagle_eye: {
    id: "eagle_eye",
    key: "",
    requiredLevel: 26,
    fxId: 18,
    focusCost: 30,
    cooldownMs: 45000,
    durationMs: 12000,
    buffStat: StatType.AGI,
    buffAmount: 10,
    effect: "buff",
  },
  /** Barrage: Rapid-fire volley of arrows in a large cone/AoE */
  barrage: {
    id: "barrage",
    key: "",
    requiredLevel: 30,
    fxId: 14,
    focusCost: 50,
    baseDamage: 40,
    scalingStat: StatType.AGI,
    scalingRatio: 1.2,
    cooldownMs: 15000,
    aoeRadius: 4,
    effect: "damage",
    damageSchool: DamageSchool.PHYSICAL,
  },

  // ── ROGUE ─────────────────────────────────────────────────────────────────

  /** Q — Melee nuke: massive burst from stealth */
  backstab: {
    id: "backstab",
    key: "",
    requiredLevel: 1,
    manaCost: 20,
    baseDamage: 40,
    scalingStat: StatType.AGI,
    scalingRatio: 1.2,
    cooldownMs: 6000,
    fxId: 2,
  },

  /** W — Vanish: disappear from enemy detection for a duration */
  stealth: {
    id: "stealth",
    key: "",
    requiredLevel: 3,
    manaCost: 35,
    cooldownMs: 20000,
    durationMs: 6000,
    fxId: 10,
  },

  /** E — DoT: coats the weapon with venom for sustained damage */
  envenom: {
    id: "envenom",
    key: "",
    requiredLevel: 6,
    manaCost: 20,
    baseDamage: 15,
    scalingStat: StatType.AGI,
    scalingRatio: 0.5,
    cooldownMs: 10000,
    dotDamage: 6,
    dotIntervalMs: 1000,
    dotDurationMs: 6000,
    fxId: 19,
  },

  /** R — AoE stun: throws a smoke bomb stunning nearby enemies */
  smoke_bomb: {
    id: "smoke_bomb",
    key: "",
    requiredLevel: 10,
    manaCost: 30,
    cooldownMs: 12000,
    aoeRadius: 2,
    durationMs: 1500,
    buffStat: StatType.STUN,
    fxId: 10,
  },

  /** T — Leech strike: saps life force from the target into the caster */
  hemorrhage: {
    id: "hemorrhage",
    key: "",
    requiredLevel: 15,
    manaCost: 25,
    baseDamage: 25,
    scalingStat: StatType.AGI,
    scalingRatio: 1.0,
    cooldownMs: 8000,
    leechRatio: 0.5,
    fxId: 2,
  },

  /** Y — Acid Splash: Ranged AoE DoT that reduces armor */
  acid_splash: {
    id: "acid_splash",
    key: "",
    requiredLevel: 20,
    fxId: 19,
    manaCost: 35,
    baseDamage: 25,
    scalingStat: StatType.AGI,
    scalingRatio: 0.8,
    cooldownMs: 10000,
    windupMs: 350,
    effect: "dot",
    damageSchool: DamageSchool.MAGICAL,
    rangeTiles: FULL_VIEWPORT_RANGE,
    aoeRadius: 2,
    dotDamage: 8,
    dotIntervalMs: 1500,
    dotDurationMs: 6000,
  },
  /** Shadowstep: Teleports the rogue behind the target */
  shadowstep: {
    id: "shadowstep",
    key: "",
    requiredLevel: 22,
    fxId: 10,
    energyCost: 30,
    cooldownMs: 15000,
    effect: "teleport",
    rangeTiles: 6,
  },
  /** Pickpocket: Stein gold from an NPC target */
  pickpocket: {
    id: "pickpocket",
    key: "",
    requiredLevel: 24,
    fxId: 2,
    energyCost: 20,
    cooldownMs: 10000,
    effect: "pickpocket",
    rangeTiles: 1,
  },
  /** Caltrops: Drops an area of spikes that slows and deals minor damage */
  caltrops: {
    id: "caltrops",
    key: "",
    requiredLevel: 26,
    fxId: 14,
    energyCost: 40,
    baseDamage: 5,
    cooldownMs: 20000,
    durationMs: 8000,
    aoeRadius: 2,
    effect: "damage",
    buffStat: StatType.AGI,
    buffAmount: -10,
  },
  /** Fan of Knives: AoE burst damage around the rogue */
  fan_of_knives: {
    id: "fan_of_knives",
    key: "",
    requiredLevel: 30,
    fxId: 14,
    energyCost: 50,
    baseDamage: 30,
    scalingStat: StatType.AGI,
    scalingRatio: 1.0,
    cooldownMs: 8000,
    aoeRadius: 3,
    effect: "damage",
  },

  // ── CLERIC ────────────────────────────────────────────────────────────────

  /** Q — Melee holy strike: smites a single foe */
  holy_strike: {
    id: "holy_strike",
    key: "",
    requiredLevel: 1,
    manaCost: 10,
    baseDamage: 20,
    scalingStat: StatType.INT,
    scalingRatio: 0.6,
    cooldownMs: 3000,
    rangeTiles: 1,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 23,
  },

  /** W — Self-heal: restores a chunk of HP */
  heal: {
    id: "heal",
    key: "",
    requiredLevel: 3,
    manaCost: 25,
    baseDamage: 30,
    scalingStat: StatType.INT,
    scalingRatio: 1.0,
    cooldownMs: 4000,
    rangeTiles: 0,
    effect: "heal",
    fxId: 1,
  },

  /** E — Invulnerability bubble: brief window of immunity */
  divine_shield: {
    id: "divine_shield",
    key: "",
    requiredLevel: 6,
    manaCost: 50,
    cooldownMs: 30000,
    durationMs: 4000,
    buffStat: StatType.INVULNERABLE,
    buffAmount: 1,
    fxId: 34,
  },

  /** R — AoE heal: pulse of holy light restores HP for all nearby allies */
  holy_nova: {
    id: "holy_nova",
    key: "",
    requiredLevel: 10,
    manaCost: 40,
    baseDamage: 20,
    scalingStat: StatType.INT,
    scalingRatio: 0.8,
    cooldownMs: 8000,
    rangeTiles: 0,
    aoeRadius: 3,
    effect: "aoe_heal",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 1,
  },

  /** F — Utility: Instantly removes Paralysis/Stun from an ally */
  cleanse_paralysis: {
    id: "cleanse_paralysis",
    key: "",
    requiredLevel: 12,
    manaCost: 25,
    cooldownMs: 8000,
    rangeTiles: FULL_VIEWPORT_RANGE,
    effect: "cleanse",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 1,
  },

  /** T — Curse: debuffs an enemy INT, increasing all magic damage they take */
  curse: {
    id: "curse",
    key: "",
    requiredLevel: 15,
    manaCost: 20,
    cooldownMs: 15000,
    durationMs: 10000,
    rangeTiles: FULL_VIEWPORT_RANGE,
    effect: "debuff",
    buffStat: StatType.INT,
    buffAmount: 15,
    fxId: 10,
  },

  /** Y — Ranged smite: holy bolt that damages undead and unholy targets */
  smite: {
    id: "smite",
    key: "",
    requiredLevel: 20,
    manaCost: 30,
    baseDamage: 45,
    scalingStat: StatType.INT,
    scalingRatio: 1.2,
    cooldownMs: 6000,
    rangeTiles: FULL_VIEWPORT_RANGE,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 23,
  },

  /** U — Cleansing Rain: Massive AoE water-based healing shower */
  cleansing_rain: {
    id: "cleansing_rain",
    key: "",
    requiredLevel: 25,
    fxId: 1,
    manaCost: 55,
    baseDamage: 50, // Serves as the base heal amount
    scalingStat: StatType.INT,
    scalingRatio: 1.2,
    cooldownMs: 15000,
    windupMs: 500,
    effect: "aoe_heal",
    damageSchool: DamageSchool.MAGICAL,
    aoeRadius: 4,
  },

  // ── PALADIN ───────────────────────────────────────────────────────────────

  /** Q — Melee holy slam: consecrated strike that deals divine damage */
  judgment: {
    id: "judgment",
    key: "",
    requiredLevel: 1,
    manaCost: 15,
    baseDamage: 25,
    scalingStat: StatType.STR,
    scalingRatio: 0.8,
    cooldownMs: 4000,
    rangeTiles: 1,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 23,
  },

  /** W — Lay on Hands: channel divine energy to restore a large chunk of HP */
  lay_on_hands: {
    id: "lay_on_hands",
    key: "",
    requiredLevel: 3,
    manaCost: 60,
    baseDamage: 80,
    rangeTiles: 0,
    effect: "heal",
    scalingStat: StatType.INT,
    scalingRatio: 1.0,
    cooldownMs: 30000,
    fxId: 1,
  },

  /** E — Consecration: radiate holy fire, damaging all enemies around the caster */
  consecration: {
    id: "consecration",
    key: "",
    requiredLevel: 6,
    manaCost: 30,
    baseDamage: 20,
    scalingStat: StatType.STR,
    scalingRatio: 0.6,
    cooldownMs: 8000,
    rangeTiles: 0,
    aoeRadius: 2,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 34,
  },

  /** R — Aura of Protection: surround yourself in divine plate, massively boosting armor */
  aura_of_protection: {
    id: "aura_of_protection",
    key: "",
    requiredLevel: 10,
    manaCost: 40,
    cooldownMs: 25000,
    durationMs: 8000,
    rangeTiles: 0,
    effect: "buff",
    buffStat: StatType.ARMOR,
    buffAmount: 18,
    fxId: 18,
  },

  /** T — Holy Bolt: launch a bolt of divine light at a distant enemy */
  holy_bolt: {
    id: "holy_bolt",
    key: "",
    requiredLevel: 15,
    manaCost: 25,
    baseDamage: 35,
    scalingStat: StatType.INT,
    scalingRatio: 1.0,
    cooldownMs: 5000,
    rangeTiles: FULL_VIEWPORT_RANGE,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    fxId: 23,
  },

  // ── NPC ABILITIES ─────────────────────────────────────────────────────────

  /** Spider: DoT bite */
  poison_bite: {
    id: "poison_bite",
    rangeTiles: 1,
    manaCost: 0,
    baseDamage: 5,
    scalingStat: StatType.AGI,
    scalingRatio: 0.2,
    // Cooldown must exceed dotDurationMs (5000ms) so the DoT expires before
    // it can be reapplied, preventing effectively permanent poison.
    cooldownMs: 8000,
    windupMs: 100,
    effect: "dot",
    damageSchool: DamageSchool.PHYSICAL,
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
    scalingStat: StatType.AGI,
    scalingRatio: 0,
    cooldownMs: 6000,
    windupMs: 150,
    effect: StatType.STUN,
    damageSchool: DamageSchool.PHYSICAL,
    key: "",
    durationMs: 2500,
    fxId: 19,
  },

  /** Necromancer/Ghost: close-range life drain */
  soul_drain: {
    id: "soul_drain",
    rangeTiles: 1,
    manaCost: 25,
    baseDamage: 10,
    scalingStat: StatType.INT,
    scalingRatio: 0.8,
    cooldownMs: 8000,
    windupMs: 200,
    effect: "leech",
    damageSchool: DamageSchool.MAGICAL,
    key: "",
    leechRatio: 0.6,
    fxId: 22,
  },

  /** Necromancer/Lich/Boss: long-range dark magic bolt */
  shadow_bolt: {
    id: "shadow_bolt",
    rangeTiles: FULL_VIEWPORT_RANGE,
    manaCost: 15,
    baseDamage: 30,
    scalingStat: StatType.INT,
    scalingRatio: 1.0,
    cooldownMs: 2000,
    windupMs: 300,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    key: "",
    fxId: 3,
  },

  /** Necromancer/Ghost/Lich: AoE debuff that weakens all nearby enemies' armor */
  banshee_wail: {
    id: "banshee_wail",
    rangeTiles: 0,
    manaCost: 30,
    baseDamage: 0,
    scalingStat: StatType.INT,
    scalingRatio: 0,
    cooldownMs: 15000,
    windupMs: 600,
    effect: "debuff",
    damageSchool: DamageSchool.MAGICAL,
    key: "",
    durationMs: 8000,
    aoeRadius: 4,
    buffStat: StatType.ARMOR,
    buffAmount: 12,
    fxId: 16,
  },

  /** Orc/Boss: self-buff that spikes STR for a berserker window */
  enrage: {
    id: "enrage",
    rangeTiles: 0,
    manaCost: 0,
    baseDamage: 0,
    scalingStat: StatType.STR,
    scalingRatio: 0,
    cooldownMs: 20000,
    windupMs: 200,
    effect: "buff",
    damageSchool: DamageSchool.PHYSICAL,
    key: "",
    durationMs: 6000,
    buffStat: StatType.STR,
    buffAmount: 20,
    fxId: 16,
  },

  /** Goblin shaman: small fire splash around the caster */
  fire_breath: {
    id: "fire_breath",
    rangeTiles: 0,
    manaCost: 0,
    baseDamage: 30,
    scalingStat: StatType.INT,
    scalingRatio: 0.6,
    cooldownMs: 5000,
    windupMs: 350,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
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
    scalingStat: StatType.INT,
    scalingRatio: 0.2,
    cooldownMs: 6000,
    windupMs: 300,
    effect: "debuff",
    damageSchool: DamageSchool.MAGICAL,
    key: "",
    durationMs: 4000,
    aoeRadius: 3,
    buffStat: StatType.AGI,
    buffAmount: 10,
    fxId: 22,
  },

  /** Zombie: slow-ticking disease DoT with long duration */
  disease_bite: {
    id: "disease_bite",
    rangeTiles: 1,
    manaCost: 0,
    baseDamage: 8,
    scalingStat: StatType.INT,
    scalingRatio: 0.3,
    // Cooldown exceeds dotDurationMs (10000ms) so the disease always expires
    // before it can be reapplied, preventing a permanent diseased state.
    cooldownMs: 13000,
    windupMs: 250,
    effect: "dot",
    damageSchool: DamageSchool.PHYSICAL,
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
    scalingStat: StatType.STR,
    scalingRatio: 0.5,
    cooldownMs: 20000,
    windupMs: 600,
    effect: "heal",
    damageSchool: DamageSchool.MAGICAL,
    key: "",
    fxId: 1,
  },
  /** Druid: Spirit of the Bear — massive Armor buff and appearance change */
  bear_form: {
    id: "bear_form",
    rangeTiles: 0,
    manaCost: 40,
    cooldownMs: 30000,
    durationMs: 15000,
    effect: "buff",
    buffStat: StatType.ARMOR,
    buffAmount: 30,
    appearanceOverride: { bodyId: 75, headId: 0 },
    fxId: 15,
  },
  /** Druid: Spirit of the Cat — SPD/AGI buff and appearance change */
  cat_form: {
    id: "cat_form",
    rangeTiles: 0,
    manaCost: 30,
    cooldownMs: 30000,
    durationMs: 20000,
    effect: "buff",
    buffStat: StatType.AGI,
    buffAmount: 15,
    appearanceOverride: { bodyId: 65, headId: 0 }, // Wolf/Cat-like body
    fxId: 15,
  },
  /** Druid: Spirit of the Tree — INT/Mana buff and appearance change */
  tree_form: {
    id: "tree_form",
    rangeTiles: 0,
    manaCost: 50,
    cooldownMs: 45000,
    durationMs: 20000,
    effect: "buff",
    buffStat: StatType.INT,
    buffAmount: 15,
    appearanceOverride: { bodyId: 50, headId: 0 }, // Gargoyle-like/Ancient body
    fxId: 15,
  },
  /** Druid: Mimic — Copy the appearance of any creature you see */
  mimic: {
    id: "mimic",
    rangeTiles: 6,
    manaCost: 20,
    cooldownMs: 60000,
    durationMs: 30000,
    effect: "mirror_shape",
    fxId: 10, // Same as blink/warp for visual flavor
  },
  /** Necromancer: Consume 5 souls to raise a Zombie (stronger than skeleton) */
  summon_zombie: {
    id: "summon_zombie",
    rangeTiles: 2,
    manaCost: 0,
    cooldownMs: 5000,
    effect: "summon",
    soulCost: 5,
    summonType: "zombie",
    fxId: 19, // Dark portal
  },
  /** Necromancer: Unleash souls for massive damage */
  soul_blast: {
    id: "soul_blast",
    rangeTiles: 6,
    manaCost: 0,
    cooldownMs: 2000,
    baseDamage: 20,
    scalingStat: StatType.INT,
    scalingRatio: 1.5,
    effect: "damage",
    damageSchool: DamageSchool.MAGICAL,
    soulCost: 1, // Consumes 1 per cast
    fxId: 18, // Purple burst
  },
};

export const ABILITIES: Record<string, Ability> = Object.fromEntries(
  Object.entries(_ABILITIES).map(([k, v]) => {
    const rawAbility: Ability = {
      key: "",
      requiredLevel: 1,
      rangeTiles: 1,
      manaCost: 0,
      baseDamage: 0,
      scalingStat: StatType.STR,
      scalingRatio: 0,
      cooldownMs: 1000,
      windupMs: 200,
      effect: "damage",
      aoeRadius: 0,
      leechRatio: 0,
      damageSchool: DamageSchool.PHYSICAL,
      fxId: 0,
      ...v,
      id: k,
    };
    return [k, rawAbility];
  }),
);
