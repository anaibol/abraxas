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
  aoWeaponId?: number;
  aoShieldId?: number;
  aoHelmetId?: number;
};

export const ITEMS: Record<string, Item> = {
  // ── Weapons: Warrior ──
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


  // ── Weapons: Wizard ──
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



  // ── Weapons: Ranger ──
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


  // ── Weapons: Rogue ──
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


  // ── Weapons: Cleric ──
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


  // ── Weapons: MAGE (spare) ──




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
    requiredClass: ["WARRIOR", "CLERIC"],
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


  // ── Shields ──



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
    requiredClass: ["MAGE"],
    aoHelmetId: 4,
  },


  // ── Rings ──





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


};
