export type ItemSlot = "weapon" | "armor" | "shield" | "helmet" | "ring" | "consumable";
export type ItemRarity = "common" | "uncommon" | "rare";

export interface ItemDef {
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
  requiredClass?: string[];
  consumeEffect?: {
    healHp?: number;
    healMana?: number;
  };
  stackable?: boolean;
  aoWeaponId?: number;
  aoShieldId?: number;
  aoHelmetId?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  // ── Weapons: Warrior ──
  iron_sword: {
    id: "iron_sword",
    name: "Iron Sword",
    slot: "weapon",
    rarity: "common",
    stats: { str: 5 },
    goldValue: 20,
    requiredClass: ["warrior", "paladin"],
    aoWeaponId: 14, // Espada Corta
  },
  steel_sword: {
    id: "steel_sword",
    name: "Steel Sword",
    slot: "weapon",
    rarity: "uncommon",
    stats: { str: 10 },
    goldValue: 60,
    requiredClass: ["warrior", "paladin"],
    aoWeaponId: 21, // Espada Larga
  },
  flame_blade: {
    id: "flame_blade",
    name: "Flame Blade",
    slot: "weapon",
    rarity: "rare",
    stats: { str: 15, int: 3 },
    goldValue: 150,
    requiredClass: ["warrior"],
    aoWeaponId: 22, // Espada Vikinga
  },

  // ── Weapons: Wizard ──
  magic_staff: {
    id: "magic_staff",
    name: "Magic Staff",
    slot: "weapon",
    rarity: "common",
    stats: { int: 6 },
    goldValue: 25,
    requiredClass: ["wizard", "druid"],
    aoWeaponId: 6, // Vara de Mago
  },
  arcane_staff: {
    id: "arcane_staff",
    name: "Arcane Staff",
    slot: "weapon",
    rarity: "uncommon",
    stats: { int: 12, mana: 20 },
    goldValue: 80,
    requiredClass: ["wizard"],
    aoWeaponId: 8, // Vara de Fresno
  },
  staff_of_storms: {
    id: "staff_of_storms",
    name: "Staff of Storms",
    slot: "weapon",
    rarity: "rare",
    stats: { int: 18, mana: 30 },
    goldValue: 180,
    requiredClass: ["wizard"],
    aoWeaponId: 10, // Báculo Engarzado
  },

  // ── Weapons: Archer ──
  hunting_bow: {
    id: "hunting_bow",
    name: "Hunting Bow",
    slot: "weapon",
    rarity: "common",
    stats: { agi: 5 },
    goldValue: 20,
    requiredClass: ["archer"],
    aoWeaponId: 41, // Arco Simple
  },
  longbow: {
    id: "longbow",
    name: "Longbow",
    slot: "weapon",
    rarity: "uncommon",
    stats: { agi: 10 },
    goldValue: 65,
    requiredClass: ["archer"],
    aoWeaponId: 7, // Arco Compuesto
  },
  elven_bow: {
    id: "elven_bow",
    name: "Elven Bow",
    slot: "weapon",
    rarity: "rare",
    stats: { agi: 16 },
    goldValue: 160,
    requiredClass: ["archer"],
    aoWeaponId: 45, // Arco Compuesto Reforzado
  },

  // ── Weapons: Assassin ──
  twin_daggers: {
    id: "twin_daggers",
    name: "Twin Daggers",
    slot: "weapon",
    rarity: "common",
    stats: { agi: 4, str: 2 },
    goldValue: 22,
    requiredClass: ["assassin"],
    aoWeaponId: 12, // Daga
  },
  shadow_daggers: {
    id: "shadow_daggers",
    name: "Shadow Daggers",
    slot: "weapon",
    rarity: "uncommon",
    stats: { agi: 9, str: 4 },
    goldValue: 70,
    requiredClass: ["assassin"],
    aoWeaponId: 35, // Daga +2
  },
  venom_blades: {
    id: "venom_blades",
    name: "Venom Blades",
    slot: "weapon",
    rarity: "rare",
    stats: { agi: 14, str: 6 },
    goldValue: 170,
    requiredClass: ["assassin"],
    aoWeaponId: 36, // Daga +3
  },

  // ── Weapons: Paladin ──
  holy_mace: {
    id: "holy_mace",
    name: "Holy Mace",
    slot: "weapon",
    rarity: "common",
    stats: { str: 4, int: 3 },
    goldValue: 25,
    requiredClass: ["paladin"],
    aoWeaponId: 4, // Garrote / Mace
  },
  blessed_hammer: {
    id: "blessed_hammer",
    name: "Blessed Hammer",
    slot: "weapon",
    rarity: "uncommon",
    stats: { str: 8, int: 6 },
    goldValue: 75,
    requiredClass: ["paladin"],
    aoWeaponId: 28, // Martillo de Guerra
  },

  // ── Weapons: Druid ──
  nature_staff: {
    id: "nature_staff",
    name: "Nature Staff",
    slot: "weapon",
    rarity: "common",
    stats: { int: 5, hp: 10 },
    goldValue: 22,
    requiredClass: ["druid"],
    aoWeaponId: 9, // Bastón Nudoso
  },
  elder_staff: {
    id: "elder_staff",
    name: "Elder Staff",
    slot: "weapon",
    rarity: "uncommon",
    stats: { int: 10, hp: 20 },
    goldValue: 70,
    requiredClass: ["druid"],
    aoWeaponId: 10, // Báculo Engarzado
  },

  // ── Armor ──
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
    stats: { armor: 6, hp: 20 },
    goldValue: 50,
    requiredClass: ["warrior", "paladin"],
  },
  plate_armor: {
    id: "plate_armor",
    name: "Plate Armor",
    slot: "armor",
    rarity: "rare",
    stats: { armor: 10, hp: 30, str: 3 },
    goldValue: 140,
    requiredClass: ["warrior", "paladin"],
  },
  mage_robes: {
    id: "mage_robes",
    name: "Mage Robes",
    slot: "armor",
    rarity: "common",
    stats: { int: 3, mana: 15 },
    goldValue: 18,
    requiredClass: ["wizard", "druid"],
  },
  shadow_cloak: {
    id: "shadow_cloak",
    name: "Shadow Cloak",
    slot: "armor",
    rarity: "uncommon",
    stats: { agi: 5, hp: 10 },
    goldValue: 45,
    requiredClass: ["assassin", "archer"],
  },

  // ── Shields ──
  wooden_shield: {
    id: "wooden_shield",
    name: "Wooden Shield",
    slot: "shield",
    rarity: "common",
    stats: { armor: 2, hp: 5 },
    goldValue: 10,
    requiredClass: ["warrior", "paladin"],
    aoShieldId: 3, // Escudo de Tortuga (basic)
  },
  iron_shield: {
    id: "iron_shield",
    name: "Iron Shield",
    slot: "shield",
    rarity: "uncommon",
    stats: { armor: 5, hp: 15 },
    goldValue: 40,
    requiredClass: ["warrior", "paladin"],
    aoShieldId: 4, // Escudo de Hierro
  },

  // ── Helmets ──
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
    requiredClass: ["wizard", "druid"],
    aoHelmetId: 4, // Sombrero de Mago
  },
  crown_of_thorns: {
    id: "crown_of_thorns",
    name: "Crown of Thorns",
    slot: "helmet",
    rarity: "rare",
    stats: { str: 5, int: 5, hp: 15 },
    goldValue: 120,
    aoHelmetId: 5, // Laureles (crown-like)
  },

  // ── Rings ──
  ring_of_strength: {
    id: "ring_of_strength",
    name: "Ring of Strength",
    slot: "ring",
    rarity: "uncommon",
    stats: { str: 4 },
    goldValue: 35,
  },
  ring_of_agility: {
    id: "ring_of_agility",
    name: "Ring of Agility",
    slot: "ring",
    rarity: "uncommon",
    stats: { agi: 4 },
    goldValue: 35,
  },
  ring_of_intellect: {
    id: "ring_of_intellect",
    name: "Ring of Intellect",
    slot: "ring",
    rarity: "uncommon",
    stats: { int: 4 },
    goldValue: 35,
  },
  ring_of_vitality: {
    id: "ring_of_vitality",
    name: "Ring of Vitality",
    slot: "ring",
    rarity: "uncommon",
    stats: { hp: 25 },
    goldValue: 40,
  },

  // ── Consumables ──
  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    slot: "consumable",
    rarity: "common",
    stats: {},
    goldValue: 8,
    consumeEffect: { healHp: 50 },
    stackable: true,
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
  },
  great_health_potion: {
    id: "great_health_potion",
    name: "Great Health Potion",
    slot: "consumable",
    rarity: "uncommon",
    stats: {},
    goldValue: 20,
    consumeEffect: { healHp: 100 },
    stackable: true,
  },
  great_mana_potion: {
    id: "great_mana_potion",
    name: "Great Mana Potion",
    slot: "consumable",
    rarity: "uncommon",
    stats: {},
    goldValue: 20,
    consumeEffect: { healMana: 80 },
    stackable: true,
  },
};

export const EQUIPMENT_SLOTS = ["weapon", "armor", "shield", "helmet", "ring"] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
