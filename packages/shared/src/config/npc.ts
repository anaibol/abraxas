import type { NpcStats, NpcType } from "../types";

export const NPC_APPEARANCE: Record<string, { bodyId: number; headId: number }> = {
  orc: { bodyId: 30, headId: 0 },
  skeleton: { bodyId: 35, headId: 0 },
  goblin: { bodyId: 45, headId: 0 },
  wolf: { bodyId: 65, headId: 0 },
  merchant: { bodyId: 5, headId: 0 },
  spider: { bodyId: 10, headId: 0 },
  ghost: { bodyId: 15, headId: 0 },
  lich: { bodyId: 70, headId: 0 },
};

export const NPC_STATS: Record<NpcType, NpcStats> = {
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
    expReward: 80,
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
    expReward: 40,
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
    expReward: 20,
    fleesWhenLow: true,
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
    fleesWhenLow: true,
  },
  merchant: {
    hp: 1000,
    str: 10,
    agi: 10,
    int: 10,
    speedTilesPerSecond: 0,
    meleeRange: 0,
    meleeCooldownMs: 0,
    meleeWindupMs: 0,
    spells: [],
    passive: true,
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
    expReward: 35,
    fleesWhenLow: true,
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
    expReward: 55,
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
    expReward: 500,
  },
};

export const NPC_TYPES = Object.keys(NPC_STATS) as NpcType[];

export interface DropTableEntry {
  itemId: string;
  chance: number;
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
    { itemId: "ring_of_intellect", chance: 0.05, min: 1, max: 1 },
    { itemId: "mana_potion", chance: 0.15, min: 1, max: 2 },
    { itemId: "gold", chance: 0.2, min: 20, max: 50 },
  ],
  lich: [
    { itemId: "steel_sword", chance: 0.5, min: 1, max: 1 },
    { itemId: "chainmail", chance: 0.4, min: 1, max: 1 },
    { itemId: "ring_of_intellect", chance: 0.2, min: 1, max: 1 },
    { itemId: "health_potion", chance: 1.0, min: 5, max: 10 },
    { itemId: "mana_potion", chance: 1.0, min: 5, max: 10 },
    { itemId: "gold", chance: 1.0, min: 500, max: 1500 },
  ],
};
