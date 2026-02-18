import type { ClassStats, SpellDef } from "./types";

export const CLASS_APPEARANCE: Record<string, { bodyId: number; headId: number }> = {
  warrior:  { bodyId: 40, headId: 1 },
  wizard:   { bodyId: 22, headId: 3 },
  archer:   { bodyId: 60, headId: 2 },
  assassin: { bodyId: 45, headId: 4 },
  paladin:  { bodyId: 50, headId: 5 },
  druid:    { bodyId: 55, headId: 6 },
};

export const NPC_APPEARANCE: Record<string, { bodyId: number; headId: number }> = {
  orc:      { bodyId: 30, headId: 0 }, // Using 0 for headId if body includes head or just to separate
  skeleton: { bodyId: 35, headId: 0 },
  goblin:   { bodyId: 45, headId: 0 }, // Reusing assassin body for now if no specific goblin
  wolf:     { bodyId: 65, headId: 0 },
  merchant: { bodyId: 5, headId: 0 }, 
  spider:   { bodyId: 10, headId: 0 },
  ghost:    { bodyId: 15, headId: 0 },
  lich:     { bodyId: 70, headId: 0 },
};

export const MERCHANT_INVENTORY: Record<string, string[]> = {
  general_store: ["health_potion", "mana_potion", "iron_dagger", "wooden_shield", "leather_armor"],
  blacksmith: ["iron_sword", "steel_sword", "chainmail", "iron_helmet", "iron_shield"],
};

export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;
export const TILE_SIZE = 32;
export const GCD_MS = 120;
export const BUFFER_WINDOW_MS = 200;
export const PATCH_RATE = 20;

export const MAX_INVENTORY_SLOTS = 24;
export const PLAYER_RESPAWN_TIME_MS = 5000;
export const NPC_RESPAWN_TIME_MS = 10000;
export const DROP_EXPIRY_MS = 60000;
export const AGGRO_RANGE = 8;

export const CLASS_STATS: Record<string, ClassStats> = {
  warrior: {
    hp: 180,
    mana: 40,
    str: 25,
    agi: 12,
    int: 6,
    speedTilesPerSecond: 7,
    meleeRange: 1,
    meleeCooldownMs: 450,
    meleeWindupMs: 120,
    spells: ["war_cry", "shield_bash"],
  },
  wizard: {
    hp: 80,
    mana: 150,
    str: 6,
    agi: 10,
    int: 28,
    speedTilesPerSecond: 7,
    meleeRange: 1,
    meleeCooldownMs: 650,
    meleeWindupMs: 120,
    spells: ["fireball", "ice_bolt", "thunderstorm", "mana_shield"],
  },
  archer: {
    hp: 100,
    mana: 80,
    str: 10,
    agi: 26,
    int: 10,
    speedTilesPerSecond: 7,
    meleeRange: 5,
    meleeCooldownMs: 500,
    meleeWindupMs: 100,
    spells: ["multi_shot", "poison_arrow", "evasion"],
  },
  assassin: {
    hp: 95,
    mana: 60,
    str: 14,
    agi: 24,
    int: 8,
    speedTilesPerSecond: 8,
    meleeRange: 1,
    meleeCooldownMs: 350,
    meleeWindupMs: 80,
    spells: ["backstab", "stealth", "envenom"],
  },
  paladin: {
    hp: 160,
    mana: 100,
    str: 20,
    agi: 10,
    int: 16,
    speedTilesPerSecond: 6,
    meleeRange: 1,
    meleeCooldownMs: 500,
    meleeWindupMs: 140,
    spells: ["holy_strike", "heal", "divine_shield"],
  },
  druid: {
    hp: 110,
    mana: 130,
    str: 10,
    agi: 14,
    int: 24,
    speedTilesPerSecond: 7,
    meleeRange: 1,
    meleeCooldownMs: 550,
    meleeWindupMs: 120,
    spells: ["entangle", "rejuvenation", "lightning_bolt", "shapeshift"],
  },
};

export const NPC_STATS: Record<string, ClassStats> = {
  orc: {
    hp: 120,
    str: 18,
    agi: 10,
    int: 5,
    speedTilesPerSecond: 5,
    meleeRange: 1,
    meleeCooldownMs: 800,
    meleeWindupMs: 200,
    spells: [],
  },
  skeleton: {
    hp: 60,
    str: 12,
    agi: 15,
    int: 5,
    speedTilesPerSecond: 6,
    meleeRange: 1,
    meleeCooldownMs: 600,
    meleeWindupMs: 150,
    spells: [],
  },
  goblin: {
    hp: 40,
    str: 8,
    agi: 18,
    int: 5,
    speedTilesPerSecond: 7,
    meleeRange: 1,
    meleeCooldownMs: 500,
    meleeWindupMs: 100,
    spells: [],
  },
  wolf: {
    hp: 80,
    str: 15,
    agi: 20,
    int: 5,
    speedTilesPerSecond: 8,
    meleeRange: 1,
    meleeCooldownMs: 600,
    meleeWindupMs: 120,
    spells: [],
    expReward: 60,
  },
  merchant: {
    hp: 1000,
    str: 10,
    agi: 10,
    int: 10,
    speedTilesPerSecond: 0, // Stationary
    meleeRange: 0,
    meleeCooldownMs: 0,
    meleeWindupMs: 0,
    spells: [],
  },
  spider: {
    hp: 50,
    str: 10,
    agi: 25,
    int: 5,
    speedTilesPerSecond: 8,
    meleeRange: 1,
    meleeCooldownMs: 400,
    meleeWindupMs: 80,
    spells: ["poison_bite"],
  },
  ghost: {
    hp: 70,
    str: 5,
    agi: 10,
    int: 20,
    speedTilesPerSecond: 4,
    meleeRange: 1,
    meleeCooldownMs: 1000,
    meleeWindupMs: 200,
    spells: ["soul_drain"],
  },
  lich: {
    hp: 1500,
    str: 10,
    agi: 10,
    int: 50,
    speedTilesPerSecond: 4,
    meleeRange: 6,
    meleeCooldownMs: 1500,
    meleeWindupMs: 500,
    spells: ["shadow_bolt", "summon_skeleton"],
  },
};

export const EXP_TABLE = [
    0,      // Level 1
    100,    // Level 2
    250,    // Level 3
    450,    // Level 4
    700,    // Level 5
    1000,   // Level 6
    1350,   // Level 7
    1750,   // Level 8
    2200,   // Level 9
    2700,   // Level 10
    3250,   // Level 11
    3850,   // Level 12
    4500,   // Level 13
    5200,   // Level 14
    5950,   // Level 15
    6750,   // Level 16
    7600,   // Level 17
    8500,   // Level 18
    9450,   // Level 19
    10450,  // Level 20
];

export interface DropTableEntry {
    itemId: string;
    chance: number; // 0-1
    min: number;
    max: number;
}

export const NPC_DROPS: Record<string, DropTableEntry[]> = {
    orc: [
        { itemId: "great_health_potion", chance: 0.1, min: 1, max: 2 },
        { itemId: "great_mana_potion", chance: 0.1, min: 1, max: 2 },
        { itemId: "iron_sword", chance: 0.08, min: 1, max: 1 },
        { itemId: "steel_sword", chance: 0.01, min: 1, max: 1 },
        { itemId: "chainmail", chance: 0.03, min: 1, max: 1 },
        { itemId: "iron_helmet", chance: 0.05, min: 1, max: 1 },
        { itemId: "wooden_shield", chance: 0.05, min: 1, max: 1 },
        { itemId: "gold", chance: 0.6, min: 15, max: 40 },
    ],
    skeleton: [
        { itemId: "health_potion", chance: 0.2, min: 1, max: 2 },
        { itemId: "bronze_axe", chance: 0.05, min: 1, max: 1 },
        { itemId: "iron_shield", chance: 0.04, min: 1, max: 1 },
        { itemId: "ring_of_strength", chance: 0.02, min: 1, max: 1 },
        { itemId: "gold", chance: 0.4, min: 8, max: 20 },
    ],
    goblin: [
        { itemId: "health_potion", chance: 0.2, min: 1, max: 1 },
        { itemId: "mana_potion", chance: 0.1, min: 1, max: 1 },
        { itemId: "iron_dagger", chance: 0.06, min: 1, max: 1 },
        { itemId: "leather_armor", chance: 0.04, min: 1, max: 1 },
        { itemId: "ring_of_agility", chance: 0.01, min: 1, max: 1 },
        { itemId: "gold", chance: 0.5, min: 5, max: 15 },
    ],
    wolf: [
        { itemId: "health_potion", chance: 0.05, min: 1, max: 1 },
        { itemId: "gold", chance: 0.4, min: 5, max: 15 },
    ],
    spider: [
        { itemId: "mana_potion", chance: 0.1, min: 1, max: 1 },
        { itemId: "gold", chance: 0.3, min: 10, max: 25 },
    ],
    ghost: [
        { itemId: "ring_of_intelligence", chance: 0.05, min: 1, max: 1 },
        { itemId: "mana_potion", chance: 0.15, min: 1, max: 2 },
        { itemId: "gold", chance: 0.2, min: 20, max: 50 },
    ],
    lich: [
        { itemId: "steel_sword", chance: 0.5, min: 1, max: 1 },
        { itemId: "chainmail", chance: 0.4, min: 1, max: 1 },
        { itemId: "ring_of_intelligence", chance: 0.2, min: 1, max: 1 },
        { itemId: "health_potion", chance: 1.0, min: 5, max: 10 },
        { itemId: "mana_potion", chance: 1.0, min: 5, max: 10 },
        { itemId: "gold", chance: 1.0, min: 500, max: 1500 },
    ],
};


export const SPELLS: Record<string, SpellDef> = {
  // ── Warrior ──
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
    key: "Q",
    durationMs: 8000,
    buffStat: "str",
    buffAmount: 10,
    fxId: 16,
  },
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
    key: "W",
    durationMs: 2000,
    fxId: 17,
  },

  // ── Wizard ──
  fireball: {
    id: "fireball",
    rangeTiles: 6,
    manaCost: 25,
    baseDamage: 30,
    scalingStat: "int",
    scalingRatio: 0.8,
    cooldownMs: 450,
    windupMs: 140,
    effect: "damage",
    key: "Q",
    fxId: 3,
  },
  ice_bolt: {
    id: "ice_bolt",
    rangeTiles: 5,
    manaCost: 20,
    baseDamage: 20,
    scalingStat: "int",
    scalingRatio: 0.6,
    cooldownMs: 600,
    windupMs: 120,
    effect: "damage",
    key: "W",
    fxId: 22,
  },
  thunderstorm: {
    id: "thunderstorm",
    rangeTiles: 5,
    manaCost: 45,
    baseDamage: 25,
    scalingStat: "int",
    scalingRatio: 0.7,
    cooldownMs: 3000,
    windupMs: 200,
    effect: "aoe",
    key: "E",
    aoeRadius: 2,
    fxId: 14,
  },
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
    key: "R",
    durationMs: 6000,
    buffStat: "armor",
    buffAmount: 15,
    fxId: 18,
  },

  // ── Archer ──
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
    key: "Q",
    aoeRadius: 2,
    fxId: 14,
  },
  poison_arrow: {
    id: "poison_arrow",
    rangeTiles: 6,
    manaCost: 20,
    baseDamage: 10,
    scalingStat: "agi",
    scalingRatio: 0.4,
    cooldownMs: 4000,
    windupMs: 100,
    effect: "dot",
    key: "W",
    dotDamage: 5,
    dotIntervalMs: 1000,
    dotDurationMs: 5000,
    fxId: 19,
  },
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
    key: "E",
    durationMs: 5000,
    buffStat: "agi",
    buffAmount: 15,
    fxId: 18,
  },

  // ── Assassin ──
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
    key: "Q",
    fxId: 2,
  },
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
    key: "W",
    durationMs: 6000,
    fxId: 10,
  },
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
    key: "E",
    dotDamage: 6,
    dotIntervalMs: 1000,
    dotDurationMs: 6000,
    fxId: 19,
  },

  // ── Paladin ──
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
    key: "Q",
    fxId: 23,
  },
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
    key: "W",
    fxId: 1,
  },
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
    key: "E",
    durationMs: 4000,
    buffStat: "invulnerable",
    buffAmount: 1,
    fxId: 34,
  },

  // ── Druid ──
  entangle: {
    id: "entangle",
    rangeTiles: 4,
    manaCost: 25,
    baseDamage: 10,
    scalingStat: "int",
    scalingRatio: 0.3,
    cooldownMs: 6000,
    windupMs: 140,
    effect: "stun",
    key: "Q",
    durationMs: 2500,
    fxId: 20,
  },
  rejuvenation: {
    id: "rejuvenation",
    rangeTiles: 0,
    manaCost: 25,
    baseDamage: 8,
    scalingStat: "int",
    scalingRatio: 0.5,
    cooldownMs: 5000,
    windupMs: 100,
    effect: "heal",
    key: "W",
    durationMs: 6000,
    fxId: 1,
  },
  lightning_bolt: {
    id: "lightning_bolt",
    rangeTiles: 5,
    manaCost: 30,
    baseDamage: 28,
    scalingStat: "int",
    scalingRatio: 0.75,
    cooldownMs: 1500,
    windupMs: 120,
    effect: "damage",
    key: "E",
    fxId: 14,
  },
  shapeshift: {
    id: "shapeshift",
    rangeTiles: 0,
    manaCost: 35,
    baseDamage: 0,
    scalingStat: "int",
    scalingRatio: 0,
    cooldownMs: 18000,
    windupMs: 120,
    effect: "buff",
    key: "R",
    durationMs: 10000,
    buffStat: "str",
    buffAmount: 12,
    fxId: 16,
  },
  // ── NPC Spells ──
  poison_bite: {
    id: "poison_bite",
    rangeTiles: 1,
    manaCost: 0,
    baseDamage: 5,
    scalingStat: "agi",
    scalingRatio: 0.2,
    cooldownMs: 2000,
    windupMs: 100,
    effect: "dot",
    key: "",
    dotDamage: 3,
    dotIntervalMs: 1000,
    dotDurationMs: 5000,
    fxId: 19,
  },
  soul_drain: {
    id: "soul_drain",
    rangeTiles: 1,
    manaCost: 0,
    baseDamage: 10,
    scalingStat: "int",
    scalingRatio: 0.5,
    cooldownMs: 3000,
    windupMs: 200,
    effect: "damage",
    key: "",
    fxId: 22,
  },
  shadow_bolt: {
    id: "shadow_bolt",
    rangeTiles: 6,
    manaCost: 0,
    baseDamage: 40,
    scalingStat: "int",
    scalingRatio: 1.0,
    cooldownMs: 2000,
    windupMs: 300,
    effect: "damage",
    key: "",
    fxId: 3, // Fireball fx for now
  },
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
    key: "",
    fxId: 16, // Warp fx
  },
};
