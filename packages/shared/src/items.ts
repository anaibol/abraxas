import { ClassType, EquipmentSlot } from "./types";

export type ItemSlot =
  | "weapon"
  | "armor"
  | "shield"
  | "helmet"
  | "ring"
  | "consumable";
export type ItemRarity = "common" | "uncommon" | "rare";

export type Item = {
  id: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  stats: {
    str?: number;
    agi?: number;
    int?: number;
    hp?: number;
    mana?: number;
    armor?: number;
  };
  goldValue: number;
  requiredClass?: ClassType[];
  consumeEffect?: {
    healHp?: number;
    healMana?: number;
  };
  stackable?: boolean;
  keepOnDeath?: boolean;
  aoWeaponId?: number;
  aoShieldId?: number;
  aoHelmetId?: number;
};

export const ITEMS: Record<string, Item> = {
  // --- WEAPONS ---
  club: {
    id: "club",
    name: "Club",
    slot: "weapon",
    rarity: "common",
    stats: { str: 2 },
    goldValue: 5,
    aoWeaponId: 1,
  },
  dagger: {
    id: "dagger",
    name: "Dagger",
    slot: "weapon",
    rarity: "common",
    stats: { agi: 2 },
    goldValue: 8,
    aoWeaponId: 2,
  },
  iron_sword: {
    id: "iron_sword",
    name: "Iron Sword",
    slot: "weapon",
    rarity: "common",
    stats: { str: 5 },
    goldValue: 20,
    requiredClass: ["WARRIOR", "CLERIC"],
    aoWeaponId: 14,
  },
  steel_sword: {
    id: "steel_sword",
    name: "Steel Sword",
    slot: "weapon",
    rarity: "uncommon",
    stats: { str: 10 },
    goldValue: 60,
    requiredClass: ["WARRIOR", "CLERIC"],
    aoWeaponId: 21,
  },
  flame_blade: {
    id: "flame_blade",
    name: "Flame Blade",
    slot: "weapon",
    rarity: "rare",
    stats: { str: 18, int: 5 },
    goldValue: 250,
    requiredClass: ["WARRIOR"],
    aoWeaponId: 30,
  },
  magic_staff: {
    id: "magic_staff",
    name: "Magic Staff",
    slot: "weapon",
    rarity: "common",
    stats: { int: 6 },
    goldValue: 25,
    requiredClass: ["MAGE"],
    aoWeaponId: 6,
  },
  arcane_staff: {
    id: "arcane_staff",
    name: "Arcane Staff",
    slot: "weapon",
    rarity: "uncommon",
    stats: { int: 12, mana: 20 },
    goldValue: 80,
    requiredClass: ["MAGE"],
    aoWeaponId: 18,
  },
  staff_of_storms: {
    id: "staff_of_storms",
    name: "Staff of Storms",
    slot: "weapon",
    rarity: "rare",
    stats: { int: 22, mana: 50 },
    goldValue: 300,
    requiredClass: ["MAGE"],
    aoWeaponId: 34,
  },
  short_bow: {
    id: "short_bow",
    name: "Short Bow",
    slot: "weapon",
    rarity: "common",
    stats: { agi: 4 },
    goldValue: 12,
    requiredClass: ["RANGER"],
    aoWeaponId: 41,
  },
  hunting_bow: {
    id: "hunting_bow",
    name: "Hunting Bow",
    slot: "weapon",
    rarity: "common",
    stats: { agi: 5 },
    goldValue: 20,
    requiredClass: ["RANGER"],
    aoWeaponId: 41,
  },
  longbow: {
    id: "longbow",
    name: "Longbow",
    slot: "weapon",
    rarity: "uncommon",
    stats: { agi: 10 },
    goldValue: 65,
    requiredClass: ["RANGER"],
    aoWeaponId: 7,
  },
  elven_bow: {
    id: "elven_bow",
    name: "Elven Bow",
    slot: "weapon",
    rarity: "rare",
    stats: { agi: 18, str: 4 },
    goldValue: 280,
    requiredClass: ["RANGER"],
    aoWeaponId: 28,
  },
  dagger_dual: {
    id: "dagger_dual",
    name: "Dual Daggers",
    slot: "weapon",
    rarity: "common",
    stats: { agi: 3 },
    goldValue: 15,
    requiredClass: ["ROGUE"],
    aoWeaponId: 13,
  },
  twin_daggers: {
    id: "twin_daggers",
    name: "Twin Daggers",
    slot: "weapon",
    rarity: "common",
    stats: { agi: 4, str: 2 },
    goldValue: 22,
    requiredClass: ["ROGUE"],
    aoWeaponId: 12,
  },
  shadow_daggers: {
    id: "shadow_daggers",
    name: "Shadow Daggers",
    slot: "weapon",
    rarity: "uncommon",
    stats: { agi: 9, str: 4 },
    goldValue: 70,
    requiredClass: ["ROGUE"],
    aoWeaponId: 35,
  },
  venom_blades: {
    id: "venom_blades",
    name: "Venom Blades",
    slot: "weapon",
    rarity: "rare",
    stats: { agi: 15, str: 6 },
    goldValue: 260,
    requiredClass: ["ROGUE"],
    aoWeaponId: 11,
  },
  holy_mace: {
    id: "holy_mace",
    name: "Holy Mace",
    slot: "weapon",
    rarity: "common",
    stats: { str: 4, int: 3 },
    goldValue: 25,
    requiredClass: ["CLERIC"],
    aoWeaponId: 4,
  },
  blessed_hammer: {
    id: "blessed_hammer",
    name: "Blessed Hammer",
    slot: "weapon",
    rarity: "uncommon",
    stats: { str: 8, int: 8 },
    goldValue: 90,
    requiredClass: ["CLERIC"],
    aoWeaponId: 15,
  },
  elder_staff: {
    id: "elder_staff",
    name: "Elder Staff",
    slot: "weapon",
    rarity: "uncommon",
    stats: { int: 10, hp: 20 },
    goldValue: 75,
    requiredClass: ["CLERIC", "MAGE"],
    aoWeaponId: 20,
  },
  bronze_axe: {
    id: "bronze_axe",
    name: "Bronze Axe",
    slot: "weapon",
    rarity: "common",
    stats: { str: 6 },
    goldValue: 18,
    aoWeaponId: 3,
  },
  iron_dagger: {
    id: "iron_dagger",
    name: "Iron Dagger",
    slot: "weapon",
    rarity: "common",
    stats: { agi: 5 },
    goldValue: 15,
    aoWeaponId: 12,
  },

  // --- ARMOR ---
  tunic: {
    id: "tunic",
    name: "Tunic",
    slot: "armor",
    rarity: "common",
    stats: { armor: 1 },
    goldValue: 3,
  },
  leather_armor: {
    id: "leather_armor",
    name: "Leather Armor",
    slot: "armor",
    rarity: "common",
    stats: { armor: 3, hp: 10 },
    goldValue: 15,
  },
  chainmail: {
    id: "chainmail",
    name: "Chainmail",
    slot: "armor",
    rarity: "uncommon",
    stats: { armor: 8, hp: 30 },
    goldValue: 50,
    requiredClass: ["WARRIOR", "CLERIC"],
  },
  plate_armor: {
    id: "plate_armor",
    name: "Plate Armor",
    slot: "armor",
    rarity: "rare",
    stats: { armor: 15, hp: 60, str: 5 },
    goldValue: 200,
    requiredClass: ["WARRIOR"],
  },
  mage_robes: {
    id: "mage_robes",
    name: "Mage Robes",
    slot: "armor",
    rarity: "common",
    stats: { int: 3, mana: 15 },
    goldValue: 18,
    requiredClass: ["MAGE"],
  },
  shadow_cloak: {
    id: "shadow_cloak",
    name: "Shadow Cloak",
    slot: "armor",
    rarity: "uncommon",
    stats: { agi: 5, armor: 4 },
    goldValue: 60,
    requiredClass: ["ROGUE", "RANGER"],
  },

  // --- SHIELDS ---
  wooden_shield: {
    id: "wooden_shield",
    name: "Wooden Shield",
    slot: "shield",
    rarity: "common",
    stats: { armor: 2 },
    goldValue: 10,
    aoShieldId: 1,
  },
  iron_shield: {
    id: "iron_shield",
    name: "Iron Shield",
    slot: "shield",
    rarity: "uncommon",
    stats: { armor: 5, hp: 15 },
    goldValue: 35,
    aoShieldId: 2,
  },

  // --- HELMETS ---
  iron_helmet: {
    id: "iron_helmet",
    name: "Iron Helmet",
    slot: "helmet",
    rarity: "common",
    stats: { armor: 2, hp: 8 },
    goldValue: 12,
    aoHelmetId: 1,
  },
  wizard_hat: {
    id: "wizard_hat",
    name: "Wizard Hat",
    slot: "helmet",
    rarity: "common",
    stats: { int: 3, mana: 10 },
    goldValue: 14,
    requiredClass: ["MAGE"],
    aoHelmetId: 4,
  },
  crown_of_thorns: {
    id: "crown_of_thorns",
    name: "Crown of Thorns",
    slot: "helmet",
    rarity: "rare",
    stats: { int: 8, mana: 30, str: 5 },
    goldValue: 220,
    aoHelmetId: 7,
  },

  // --- ACCESSORIES ---
  ring_of_strength: {
    id: "ring_of_strength",
    name: "Ring of Strength",
    slot: "ring",
    rarity: "uncommon",
    stats: { str: 5 },
    goldValue: 100,
  },
  ring_of_agility: {
    id: "ring_of_agility",
    name: "Ring of Agility",
    slot: "ring",
    rarity: "uncommon",
    stats: { agi: 5 },
    goldValue: 100,
  },
  ring_of_intellect: {
    id: "ring_of_intellect",
    name: "Ring of Intellect",
    slot: "ring",
    rarity: "uncommon",
    stats: { int: 5 },
    goldValue: 100,
  },
  ring_of_vitality: {
    id: "ring_of_vitality",
    name: "Ring of Vitality",
    slot: "ring",
    rarity: "uncommon",
    stats: { hp: 50 },
    goldValue: 120,
  },

  // --- CONSUMABLES ---
  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    slot: "consumable",
    rarity: "common",
    stats: {},
    goldValue: 8,
    consumeEffect: { healHp: 50 },
    stackable: true,
    keepOnDeath: true,
  },
  mana_potion: {
    id: "mana_potion",
    name: "Mana Potion",
    slot: "consumable",
    rarity: "common",
    stats: {},
    goldValue: 8,
    consumeEffect: { healMana: 40 },
    stackable: true,
    keepOnDeath: true,
  },
  great_health_potion: {
    id: "great_health_potion",
    name: "Great Health Potion",
    slot: "consumable",
    rarity: "uncommon",
    stats: {},
    goldValue: 25,
    consumeEffect: { healHp: 150 },
    stackable: true,
  },
  great_mana_potion: {
    id: "great_mana_potion",
    name: "Great Mana Potion",
    slot: "consumable",
    rarity: "uncommon",
    stats: {},
    goldValue: 25,
    consumeEffect: { healMana: 120 },
    stackable: true,
  },
};
