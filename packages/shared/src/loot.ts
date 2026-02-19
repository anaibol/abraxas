import type { ClassType } from "./types";

/** Consumables every class always keeps on death (full stack preserved). */
const BASIC_CONSUMABLES = ["great_health_potion", "great_mana_potion"] as const;

/**
 * Basic items each class always keeps on death.
 * Aligned with STARTING_EQUIPMENT so players always respawn with their core gear.
 * Non-stackable items keep 1 copy; stackable consumables keep the full stack.
 * Stored as Sets so `.has()` calls at death time are O(1) with no allocation.
 */
export const BASIC_ITEMS_BY_CLASS: Record<ClassType, ReadonlySet<string>> = {
  WARRIOR: new Set(["flame_blade", "plate_armor", "iron_shield", "crown_of_thorns", "ring_of_strength", ...BASIC_CONSUMABLES]),
  MAGE:    new Set(["staff_of_storms", "mage_robes", "wizard_hat", "ring_of_intellect", ...BASIC_CONSUMABLES]),
  RANGER:  new Set(["elven_bow", "shadow_cloak", "iron_helmet", "ring_of_agility", ...BASIC_CONSUMABLES]),
  ROGUE:   new Set(["venom_blades", "shadow_cloak", "iron_helmet", "ring_of_agility", ...BASIC_CONSUMABLES]),
  CLERIC:  new Set(["blessed_hammer", "plate_armor", "iron_shield", "crown_of_thorns", "ring_of_vitality", ...BASIC_CONSUMABLES]),
  PALADIN: new Set(["blessed_hammer", "plate_armor", "iron_shield", "crown_of_thorns", "ring_of_strength", ...BASIC_CONSUMABLES]),
};

/** Potions every class starts with (3× HP + 3× mana). */
const STARTING_POTIONS = [
  "great_health_potion", "great_health_potion", "great_health_potion",
  "great_mana_potion",   "great_mana_potion",   "great_mana_potion",
] as const;

/** Starting equipment per class — full PvP loadout */
export const STARTING_EQUIPMENT: Record<ClassType, { items: string[]; gold: number }> = {
  WARRIOR: { items: ["flame_blade", "plate_armor", "iron_shield", "crown_of_thorns", "ring_of_strength", ...STARTING_POTIONS], gold: 100 },
  MAGE:    { items: ["staff_of_storms", "mage_robes", "wizard_hat", "ring_of_intellect", ...STARTING_POTIONS], gold: 100 },
  RANGER:  { items: ["elven_bow", "shadow_cloak", "iron_helmet", "ring_of_agility", ...STARTING_POTIONS], gold: 100 },
  ROGUE:   { items: ["venom_blades", "shadow_cloak", "iron_helmet", "ring_of_agility", ...STARTING_POTIONS], gold: 100 },
  CLERIC:  { items: ["blessed_hammer", "plate_armor", "iron_shield", "crown_of_thorns", "ring_of_vitality", ...STARTING_POTIONS], gold: 100 },
  PALADIN: { items: ["blessed_hammer", "plate_armor", "iron_shield", "crown_of_thorns", "ring_of_strength", ...STARTING_POTIONS], gold: 100 },
};

// KILL_GOLD_BONUS moved to config/constants.ts
