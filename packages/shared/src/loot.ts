import type { ClassType } from "./types";

/**
 * Basic items each class always keeps on death — one non-stackable copy,
 * or the full stack for stackable consumables.
 *
 * Weapon choices are the lowest common-rarity item for each class.
 * All classes keep basic healing/mana consumables.
 */
export const BASIC_ITEMS_BY_CLASS: Record<ClassType, string[]> = {
  WARRIOR: ["iron_sword", "tunic", "health_potion", "mana_potion"],
  MAGE: ["magic_staff", "mage_robes", "health_potion", "mana_potion"],
  RANGER: ["short_bow", "tunic", "health_potion", "mana_potion"],
  ROGUE: ["dagger", "tunic", "health_potion", "mana_potion"],
  CLERIC: ["holy_mace", "tunic", "health_potion", "mana_potion"],
};

/** Starting equipment per class — full PvP loadout */
export const STARTING_EQUIPMENT: Record<
  string,
  { items: string[]; gold: number }
> = {
  WARRIOR: {
    items: [
      "flame_blade",
      "plate_armor",
      "iron_shield",
      "crown_of_thorns",
      "ring_of_strength",
      "great_health_potion",
      "great_health_potion",
      "great_health_potion",
      "great_mana_potion",
      "great_mana_potion",
      "great_mana_potion",
    ],
    gold: 100,
  },
  MAGE: {
    items: [
      "staff_of_storms",
      "mage_robes",
      "wizard_hat",
      "ring_of_intellect",
      "great_health_potion",
      "great_health_potion",
      "great_health_potion",
      "great_mana_potion",
      "great_mana_potion",
      "great_mana_potion",
    ],
    gold: 100,
  },
  RANGER: {
    items: [
      "elven_bow",
      "shadow_cloak",
      "iron_helmet",
      "ring_of_agility",
      "great_health_potion",
      "great_health_potion",
      "great_health_potion",
      "great_mana_potion",
      "great_mana_potion",
      "great_mana_potion",
    ],
    gold: 100,
  },
  ROGUE: {
    items: [
      "venom_blades",
      "shadow_cloak",
      "iron_helmet",
      "ring_of_agility",
      "great_health_potion",
      "great_health_potion",
      "great_health_potion",
      "great_mana_potion",
      "great_mana_potion",
      "great_mana_potion",
    ],
    gold: 100,
  },
  CLERIC: {
    items: [
      "blessed_hammer",
      "plate_armor",
      "iron_shield",
      "crown_of_thorns",
      "ring_of_vitality",
      "great_health_potion",
      "great_health_potion",
      "great_health_potion",
      "great_mana_potion",
      "great_mana_potion",
      "great_mana_potion",
    ],
    gold: 100,
  },
};

// KILL_GOLD_BONUS moved to config/constants.ts
