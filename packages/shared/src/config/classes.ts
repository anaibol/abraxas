import type { ClassStats } from "../types";

export const CLASS_APPEARANCE: Record<string, { bodyId: number; headId: number }> = {
  WARRIOR: { bodyId: 40, headId: 1 },
  MAGE: { bodyId: 22, headId: 3 },
  RANGER: { bodyId: 60, headId: 2 },
  ROGUE: { bodyId: 45, headId: 4 },
  CLERIC: { bodyId: 50, headId: 5 },
};

export const CLASS_STATS: Record<string, ClassStats> = {
  WARRIOR: {
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
  MAGE: {
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
  RANGER: {
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
  ROGUE: {
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
  CLERIC: {
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
};

export const LEVEL_UP_STATS: Record<string, { str: number; agi: number; int: number }> = {
  WARRIOR: { str: 3, agi: 1, int: 0 },
  MAGE:    { str: 0, agi: 1, int: 3 },
  RANGER:  { str: 1, agi: 3, int: 0 },
  ROGUE:   { str: 1, agi: 3, int: 0 },
  CLERIC:  { str: 1, agi: 0, int: 3 },
};

export const EXP_TABLE = [
  0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700,
  3250, 3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450,
];

// Item 24: Starting gear from ArenaRoom context
export const STARTING_EQUIPMENT: Record<string, { gold: number; items: string[] }> = {
  WARRIOR: { gold: 50, items: ["iron_sword", "wooden_shield", "health_potion"] },
  MAGE:    { gold: 20, items: ["iron_dagger", "mana_potion", "mana_potion"] },
  RANGER:  { gold: 30, items: ["iron_dagger", "health_potion"] },
  ROGUE:   { gold: 40, items: ["iron_dagger", "health_potion"] },
  CLERIC:  { gold: 30, items: ["iron_dagger", "health_potion"] },
};
