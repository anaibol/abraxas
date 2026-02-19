import type { NpcStats, NpcType } from "../types";

export const NPC_APPEARANCE: Record<string, { bodyId: number; headId: number }> = {
  orc: { bodyId: 30, headId: 0 },
  skeleton: { bodyId: 35, headId: 0 },
  merchant: { bodyId: 5, headId: 0 },
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
};
