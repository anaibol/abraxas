import type { ClassStats } from "../types";

export const CLASS_APPEARANCE: Record<string, { bodyId: number; headId: number }> = {
  WARRIOR: { bodyId: 40, headId: 1 },
  MAGE: { bodyId: 22, headId: 3 },
  RANGER: { bodyId: 60, headId: 2 },
  ROGUE: { bodyId: 45, headId: 4 },
  CLERIC: { bodyId: 50, headId: 5 },
  PALADIN: { bodyId: 38, headId: 6 },
};

export const CLASS_STATS: Record<string, ClassStats> = {
  WARRIOR: {
    hp: 240,
    mana: 60,
    str: 25,
    agi: 12,
    int: 6,
    speedTilesPerSecond: 7,
    meleeRange: 1,
    meleeCooldownMs: 450,
    meleeWindupMs: 120,
    armor: 10,
    // Q: war_cry (self STR buff) | W: shield_bash (stun) | E: whirlwind (AoE dmg) | R: battle_shout (AoE debuff)
    spells: ["war_cry", "shield_bash", "whirlwind", "battle_shout"],
  },
  MAGE: {
    hp: 140,
    mana: 160,
    str: 6,
    agi: 10,
    int: 28,
    speedTilesPerSecond: 7,
    meleeRange: 1,
    meleeCooldownMs: 650,
    meleeWindupMs: 120,
    armor: 2,
    // Q: fireball | W: ice_bolt | E: thunderstorm (AoE) | R: mana_shield | T: frost_nova (AoE stun) | Y: arcane_surge (nuke)
    spells: ["fireball", "ice_bolt", "thunderstorm", "mana_shield", "frost_nova", "arcane_surge"],
  },
  RANGER: {
    hp: 160,
    mana: 90,
    str: 10,
    agi: 26,
    int: 10,
    speedTilesPerSecond: 7,
    meleeRange: 5,
    meleeCooldownMs: 500,
    meleeWindupMs: 100,
    armor: 5,
    // Q: multi_shot (AoE) | W: poison_arrow (DoT) | E: evasion (buff) | R: aimed_shot (nuke) | T: mark_target (debuff)
    spells: ["multi_shot", "poison_arrow", "evasion", "aimed_shot", "mark_target"],
  },
  ROGUE: {
    hp: 150,
    mana: 80,
    str: 14,
    agi: 24,
    int: 8,
    speedTilesPerSecond: 8,
    meleeRange: 1,
    meleeCooldownMs: 350,
    meleeWindupMs: 80,
    armor: 4,
    // Q: backstab (nuke) | W: stealth | E: envenom (DoT) | R: smoke_bomb (AoE stun) | T: hemorrhage (leech)
    spells: ["backstab", "stealth", "envenom", "smoke_bomb", "hemorrhage"],
  },
  CLERIC: {
    hp: 220,
    mana: 120,
    str: 20,
    agi: 10,
    int: 16,
    speedTilesPerSecond: 6,
    meleeRange: 1,
    meleeCooldownMs: 500,
    meleeWindupMs: 140,
    armor: 8,
    // Q: holy_strike (dmg) | W: heal (self heal) | E: divine_shield (invuln) | R: holy_nova (AoE heal) | T: curse (debuff) | Y: smite (ranged dmg)
    spells: ["holy_strike", "heal", "divine_shield", "holy_nova", "curse", "smite"],
  },
  PALADIN: {
    hp: 230,
    mana: 100,
    str: 22,
    agi: 10,
    int: 14,
    speedTilesPerSecond: 6,
    meleeRange: 1,
    meleeCooldownMs: 480,
    meleeWindupMs: 130,
    armor: 12,
    // Q: judgment (holy melee) | W: lay_on_hands (self heal) | E: consecration (AoE holy) | R: aura_of_protection (armor buff) | T: holy_bolt (ranged dmg)
    spells: ["judgment", "lay_on_hands", "consecration", "aura_of_protection", "holy_bolt"],
  },
};

export const LEVEL_UP_STATS: Record<string, { str: number; agi: number; int: number; hp: number; mp: number }> = {
  WARRIOR: { str: 3, agi: 1, int: 0, hp: 30, mp: 5 },
  MAGE:    { str: 0, agi: 1, int: 3, hp: 18, mp: 20 },
  RANGER:  { str: 1, agi: 3, int: 0, hp: 22, mp: 10 },
  ROGUE:   { str: 1, agi: 3, int: 0, hp: 22, mp: 8 },
  CLERIC:  { str: 1, agi: 0, int: 3, hp: 26, mp: 15 },
  PALADIN: { str: 2, agi: 0, int: 2, hp: 28, mp: 12 },
};

export const EXP_TABLE = [
  0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700,
  3250, 3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450,
];


