import { type ClassType, ItemRarity, StatType } from "./types";

export type ItemSlot =
  | "weapon"
  | "armor"
  | "shield"
  | "helmet"
  | "ring"
  | "mount"
  | "consumable"
  | "material";

export type Item = {
  id: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  stats: {
    str: number;
    agi: number;
    int: number;
    hp: number;
    mana: number;
    armor: number;
    speedBonus?: number;
  };
  goldValue: number;
  requiredClass?: ClassType[];
  consumeEffect?: {
    healHp?: number;
    healMana?: number;
    /** Removes active DoT / debuff effects. */
    cureDebuff?: boolean;
    /** Grants a temporary in-combat stat buff. */
    buffStat?: StatType;
    buffAmount?: number;
    buffDurationMs?: number;
  };
  stackable?: boolean;
  aoWeaponId?: number;
  aoShieldId?: number;
  aoHelmetId?: number;
  mountNpcType?: string;
  /** Crafting material — can be used in recipes, sold for gold. */
  isMaterial?: boolean;
};

/** Zero-baseline so every item is always fully hydrated. */
const Z = { str: 0, agi: 0, int: 0, hp: 0, mana: 0, armor: 0 } as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const w = (
  id: string,
  name: string,
  rarity: ItemRarity,
  stats: Item["stats"],
  gold: number,
  requiredClass?: ClassType[],
  aoWeaponId?: number,
): Item => ({
  id,
  name,
  slot: "weapon",
  rarity,
  stats,
  goldValue: gold,
  requiredClass,
  aoWeaponId,
});

const a = (
  id: string,
  name: string,
  rarity: ItemRarity,
  stats: Item["stats"],
  gold: number,
  requiredClass?: ClassType[],
): Item => ({ id, name, slot: "armor", rarity, stats, goldValue: gold, requiredClass });

const s = (
  id: string,
  name: string,
  rarity: ItemRarity,
  stats: Item["stats"],
  gold: number,
  requiredClass?: ClassType[],
  aoShieldId?: number,
): Item => ({
  id,
  name,
  slot: "shield",
  rarity,
  stats,
  goldValue: gold,
  requiredClass,
  aoShieldId,
});

const h = (
  id: string,
  name: string,
  rarity: ItemRarity,
  stats: Item["stats"],
  gold: number,
  requiredClass?: ClassType[],
  aoHelmetId?: number,
): Item => ({
  id,
  name,
  slot: "helmet",
  rarity,
  stats,
  goldValue: gold,
  requiredClass,
  aoHelmetId,
});

const r = (
  id: string,
  name: string,
  rarity: ItemRarity,
  stats: Item["stats"],
  gold: number,
  requiredClass?: ClassType[],
): Item => ({ id, name, slot: "ring", rarity, stats, goldValue: gold, requiredClass });

const c = (
  id: string,
  name: string,
  rarity: ItemRarity,
  gold: number,
  consumeEffect: Item["consumeEffect"],
): Item => ({
  id,
  name,
  slot: "consumable",
  rarity,
  stats: { ...Z },
  goldValue: gold,
  consumeEffect,
  stackable: true,
});

const mat = (id: string, name: string, rarity: ItemRarity, gold: number): Item => ({
  id,
  name,
  slot: "material",
  rarity,
  stats: { ...Z },
  goldValue: gold,
  stackable: true,
  isMaterial: true,
});

// ─────────────────────────────────────────────────────────────────────────────

export const ITEMS: Record<string, Item> = {
  // ══════════════════════════════════════════════════════════════════════════
  // WEAPONS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Generic / any-class ───────────────────────────────────────────────────
  club: w("club", "items.club.name", ItemRarity.COMMON, { ...Z, str: 2 }, 5, undefined, 1),
  dagger: w("dagger", "items.dagger.name", ItemRarity.COMMON, { ...Z, agi: 2 }, 8, undefined, 2),
  bronze_axe: w(
    "bronze_axe",
    "items.bronze_axe.name",
    ItemRarity.COMMON,
    { ...Z, str: 6 },
    18,
    undefined,
    3,
  ),
  iron_dagger: w(
    "iron_dagger",
    "items.iron_dagger.name",
    ItemRarity.COMMON,
    { ...Z, agi: 5 },
    15,
    undefined,
    12,
  ),

  // ── Warrior ───────────────────────────────────────────────────────────────
  iron_sword: w(
    "iron_sword",
    "items.iron_sword.name",
    ItemRarity.COMMON,
    { ...Z, str: 5 },
    20,
    ["WARRIOR", "CLERIC", "PALADIN"],
    14,
  ),
  steel_sword: w(
    "steel_sword",
    "items.steel_sword.name",
    ItemRarity.UNCOMMON,
    { ...Z, str: 10 },
    60,
    ["WARRIOR", "CLERIC", "PALADIN"],
    21,
  ),
  battle_axe: w(
    "battle_axe",
    "items.battle_axe.name",
    ItemRarity.UNCOMMON,
    { ...Z, str: 12, agi: 2 },
    70,
    ["WARRIOR"],
    3,
  ),
  flame_blade: w(
    "flame_blade",
    "items.flame_blade.name",
    ItemRarity.RARE,
    { ...Z, str: 18, int: 5 },
    250,
    ["WARRIOR"],
    30,
  ),
  great_axe: w(
    "great_axe",
    "items.great_axe.name",
    ItemRarity.RARE,
    { ...Z, str: 22, hp: 20 },
    280,
    ["WARRIOR"],
    3,
  ),
  berserker_blade: w(
    "berserker_blade",
    "items.berserker_blade.name",
    ItemRarity.EPIC,
    { ...Z, str: 30, agi: 6 },
    600,
    ["WARRIOR"],
    30,
  ),
  titan_axe: w(
    "titan_axe",
    "items.titan_axe.name",
    ItemRarity.LEGENDARY,
    { ...Z, str: 40, hp: 60 },
    2000,
    ["WARRIOR"],
    3,
  ),
  bone_sword: w(
    "bone_sword",
    "items.bone_sword.name",
    ItemRarity.UNCOMMON,
    { ...Z, str: 12, agi: 3 },
    95,
    ["WARRIOR", "PALADIN", "ROGUE"],
    21,
  ),

  // ── Paladin ───────────────────────────────────────────────────────────────
  war_hammer: w(
    "war_hammer",
    "items.war_hammer.name",
    ItemRarity.COMMON,
    { ...Z, str: 6, int: 2 },
    22,
    ["PALADIN", "CLERIC"],
    15,
  ),
  crusader_sword: w(
    "crusader_sword",
    "items.crusader_sword.name",
    ItemRarity.UNCOMMON,
    { ...Z, str: 12, int: 6 },
    90,
    ["PALADIN"],
    14,
  ),
  divine_blade: w(
    "divine_blade",
    "items.divine_blade.name",
    ItemRarity.RARE,
    { ...Z, str: 20, int: 12 },
    320,
    ["PALADIN"],
    21,
  ),
  holy_avenger: w(
    "holy_avenger",
    "items.holy_avenger.name",
    ItemRarity.EPIC,
    { ...Z, str: 28, int: 18, hp: 30 },
    750,
    ["PALADIN"],
    30,
  ),

  // ── Cleric ────────────────────────────────────────────────────────────────
  holy_mace: w(
    "holy_mace",
    "items.holy_mace.name",
    ItemRarity.COMMON,
    { ...Z, str: 4, int: 3 },
    25,
    ["CLERIC", "PALADIN"],
    4,
  ),
  healing_rod: w(
    "healing_rod",
    "items.healing_rod.name",
    ItemRarity.COMMON,
    { ...Z, int: 5, hp: 10 },
    28,
    ["CLERIC"],
    6,
  ),
  blessed_hammer: w(
    "blessed_hammer",
    "items.blessed_hammer.name",
    ItemRarity.UNCOMMON,
    { ...Z, str: 8, int: 8 },
    90,
    ["CLERIC", "PALADIN"],
    15,
  ),
  bishop_staff: w(
    "bishop_staff",
    "items.bishop_staff.name",
    ItemRarity.RARE,
    { ...Z, int: 16, hp: 30, str: 6 },
    260,
    ["CLERIC"],
    20,
  ),
  scepter_of_faith: w(
    "scepter_of_faith",
    "items.scepter_of_faith.name",
    ItemRarity.EPIC,
    { ...Z, int: 24, hp: 50, mana: 30 },
    650,
    ["CLERIC"],
    6,
  ),
  divine_scepter: w(
    "divine_scepter",
    "items.divine_scepter.name",
    ItemRarity.LEGENDARY,
    { ...Z, int: 36, hp: 80, mana: 60 },
    1800,
    ["CLERIC"],
    6,
  ),
  elder_staff: w(
    "elder_staff",
    "items.elder_staff.name",
    ItemRarity.UNCOMMON,
    { ...Z, int: 10, hp: 20 },
    75,
    ["CLERIC", "MAGE"],
    20,
  ),

  // ── Mage ──────────────────────────────────────────────────────────────────
  magic_staff: w(
    "magic_staff",
    "items.magic_staff.name",
    ItemRarity.COMMON,
    { ...Z, int: 6 },
    25,
    ["MAGE"],
    6,
  ),
  crystal_wand: w(
    "crystal_wand",
    "items.crystal_wand.name",
    ItemRarity.COMMON,
    { ...Z, int: 7, mana: 10 },
    30,
    ["MAGE"],
    6,
  ),
  arcane_staff: w(
    "arcane_staff",
    "items.arcane_staff.name",
    ItemRarity.UNCOMMON,
    { ...Z, int: 12, mana: 20 },
    80,
    ["MAGE"],
    18,
  ),
  staff_of_ice: w(
    "staff_of_ice",
    "items.staff_of_ice.name",
    ItemRarity.UNCOMMON,
    { ...Z, int: 14, mana: 25 },
    100,
    ["MAGE"],
    18,
  ),
  void_orb: w(
    "void_orb",
    "items.void_orb.name",
    ItemRarity.RARE,
    { ...Z, int: 20, mana: 40 },
    280,
    ["MAGE"],
    34,
  ),
  staff_of_storms: w(
    "staff_of_storms",
    "items.staff_of_storms.name",
    ItemRarity.RARE,
    { ...Z, int: 22, mana: 50 },
    300,
    ["MAGE"],
    34,
  ),
  arcane_tome: w(
    "arcane_tome",
    "items.arcane_tome.name",
    ItemRarity.EPIC,
    { ...Z, int: 32, mana: 80 },
    700,
    ["MAGE"],
    18,
  ),

  // ── Ranger ────────────────────────────────────────────────────────────────
  short_bow: w(
    "short_bow",
    "items.short_bow.name",
    ItemRarity.COMMON,
    { ...Z, agi: 4 },
    12,
    ["RANGER"],
    41,
  ),
  hunting_bow: w(
    "hunting_bow",
    "items.hunting_bow.name",
    ItemRarity.COMMON,
    { ...Z, agi: 5 },
    20,
    ["RANGER"],
    41,
  ),
  composite_bow: w(
    "composite_bow",
    "items.composite_bow.name",
    ItemRarity.UNCOMMON,
    { ...Z, agi: 8, str: 2 },
    55,
    ["RANGER"],
    28,
  ),
  longbow: w(
    "longbow",
    "items.longbow.name",
    ItemRarity.UNCOMMON,
    { ...Z, agi: 10 },
    65,
    ["RANGER"],
    7,
  ),
  war_bow: w(
    "war_bow",
    "items.war_bow.name",
    ItemRarity.RARE,
    { ...Z, agi: 16, str: 5 },
    240,
    ["RANGER"],
    28,
  ),
  elven_bow: w(
    "elven_bow",
    "items.elven_bow.name",
    ItemRarity.RARE,
    { ...Z, agi: 18, str: 4 },
    280,
    ["RANGER"],
    28,
  ),
  crossbow: w(
    "crossbow",
    "items.crossbow.name",
    ItemRarity.UNCOMMON,
    { ...Z, agi: 9, str: 4 },
    75,
    ["RANGER"],
    41,
  ),
  siege_crossbow: w(
    "siege_crossbow",
    "items.siege_crossbow.name",
    ItemRarity.EPIC,
    { ...Z, agi: 26, str: 8 },
    620,
    ["RANGER"],
    41,
  ),

  // ── Rogue ─────────────────────────────────────────────────────────────────
  dagger_dual: w(
    "dagger_dual",
    "items.dagger_dual.name",
    ItemRarity.COMMON,
    { ...Z, agi: 3 },
    15,
    ["ROGUE"],
    13,
  ),
  twin_daggers: w(
    "twin_daggers",
    "items.twin_daggers.name",
    ItemRarity.COMMON,
    { ...Z, agi: 4, str: 2 },
    22,
    ["ROGUE"],
    12,
  ),
  sap: w("sap", "items.sap.name", ItemRarity.COMMON, { ...Z, agi: 3, str: 3 }, 14, ["ROGUE"], 1),
  poisoned_shiv: w(
    "poisoned_shiv",
    "items.poisoned_shiv.name",
    ItemRarity.UNCOMMON,
    { ...Z, agi: 7, str: 3 },
    65,
    ["ROGUE"],
    13,
  ),
  shadow_daggers: w(
    "shadow_daggers",
    "items.shadow_daggers.name",
    ItemRarity.UNCOMMON,
    { ...Z, agi: 9, str: 4 },
    70,
    ["ROGUE"],
    35,
  ),
  skull_dagger: w(
    "skull_dagger",
    "items.skull_dagger.name",
    ItemRarity.RARE,
    { ...Z, agi: 15, str: 8 },
    265,
    ["ROGUE"],
    35,
  ),
  venom_blades: w(
    "venom_blades",
    "items.venom_blades.name",
    ItemRarity.RARE,
    { ...Z, agi: 15, str: 6 },
    260,
    ["ROGUE"],
    11,
  ),
  void_knife: w(
    "void_knife",
    "items.void_knife.name",
    ItemRarity.EPIC,
    { ...Z, agi: 24, str: 10 },
    640,
    ["ROGUE"],
    35,
  ),

  // ── Necromancer ───────────────────────────────────────────────────────────
  bone_wand: w(
    "bone_wand",
    "items.bone_wand.name",
    ItemRarity.COMMON,
    { ...Z, int: 5, hp: 5 },
    20,
    ["NECROMANCER"],
    6,
  ),
  death_scepter: w(
    "death_scepter",
    "items.death_scepter.name",
    ItemRarity.UNCOMMON,
    { ...Z, int: 12, hp: 15 },
    85,
    ["NECROMANCER"],
    6,
  ),
  void_staff: w(
    "void_staff",
    "items.void_staff.name",
    ItemRarity.RARE,
    { ...Z, int: 20, hp: 30 },
    270,
    ["NECROMANCER"],
    34,
  ),
  soul_reaper: w(
    "soul_reaper",
    "items.soul_reaper.name",
    ItemRarity.EPIC,
    { ...Z, int: 32, hp: 50, mana: 40 },
    750,
    ["NECROMANCER"],
    34,
  ),

  // ── Druid ─────────────────────────────────────────────────────────────────
  wooden_club: w(
    "wooden_club",
    "items.wooden_club.name",
    ItemRarity.COMMON,
    { ...Z, str: 3, int: 2 },
    12,
    ["DRUID"],
    1,
  ),
  gnarled_staff: w(
    "gnarled_staff",
    "items.gnarled_staff.name",
    ItemRarity.COMMON,
    { ...Z, int: 5, hp: 8 },
    22,
    ["DRUID"],
    20,
  ),
  nature_wand: w(
    "nature_wand",
    "items.nature_wand.name",
    ItemRarity.UNCOMMON,
    { ...Z, int: 12, mana: 20 },
    80,
    ["DRUID"],
    6,
  ),
  staff_of_the_wild: w(
    "staff_of_the_wild",
    "items.staff_of_the_wild.name",
    ItemRarity.RARE,
    { ...Z, int: 22, mana: 40, hp: 25 },
    290,
    ["DRUID"],
    20,
  ),
  moon_staff: w(
    "moon_staff",
    "items.moon_staff.name",
    ItemRarity.EPIC,
    { ...Z, int: 34, mana: 60, hp: 40 },
    760,
    ["DRUID"],
    20,
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // ARMOR
  // ══════════════════════════════════════════════════════════════════════════

  tunic: a("tunic", "items.tunic.name", ItemRarity.COMMON, { ...Z, armor: 1 }, 3),
  leather_armor: a(
    "leather_armor",
    "items.leather_armor.name",
    ItemRarity.COMMON,
    { ...Z, armor: 3, hp: 10 },
    15,
  ),
  studded_armor: a(
    "studded_armor",
    "items.studded_armor.name",
    ItemRarity.UNCOMMON,
    { ...Z, armor: 6, hp: 20 },
    42,
    ["WARRIOR", "PALADIN", "CLERIC", "ROGUE"],
  ),
  scale_armor: a(
    "scale_armor",
    "items.scale_armor.name",
    ItemRarity.UNCOMMON,
    { ...Z, armor: 7, hp: 25 },
    55,
    ["WARRIOR", "PALADIN"],
  ),
  chainmail: a(
    "chainmail",
    "items.chainmail.name",
    ItemRarity.UNCOMMON,
    { ...Z, armor: 8, hp: 30 },
    50,
    ["WARRIOR", "CLERIC", "PALADIN"],
  ),
  battle_plate: a(
    "battle_plate",
    "items.battle_plate.name",
    ItemRarity.RARE,
    { ...Z, armor: 12, hp: 50, str: 4 },
    190,
    ["WARRIOR", "PALADIN"],
  ),
  plate_armor: a(
    "plate_armor",
    "items.plate_armor.name",
    ItemRarity.RARE,
    { ...Z, armor: 15, hp: 60, str: 5 },
    200,
    ["WARRIOR", "PALADIN"],
  ),
  knight_plate: a(
    "knight_plate",
    "items.knight_plate.name",
    ItemRarity.EPIC,
    { ...Z, armor: 22, hp: 90, str: 8 },
    550,
    ["WARRIOR", "PALADIN"],
  ),
  elven_cloak: a(
    "elven_cloak",
    "items.elven_cloak.name",
    ItemRarity.UNCOMMON,
    { ...Z, agi: 6, armor: 4, hp: 15 },
    65,
    ["RANGER", "ROGUE"],
  ),
  shadow_cloak: a(
    "shadow_cloak",
    "items.shadow_cloak.name",
    ItemRarity.UNCOMMON,
    { ...Z, agi: 5, armor: 4 },
    60,
    ["ROGUE", "RANGER"],
  ),
  shadow_shroud: a(
    "shadow_shroud",
    "items.shadow_shroud.name",
    ItemRarity.RARE,
    { ...Z, agi: 10, armor: 6, hp: 20 },
    220,
    ["ROGUE", "RANGER"],
  ),
  mage_robes: a(
    "mage_robes",
    "items.mage_robes.name",
    ItemRarity.COMMON,
    { ...Z, int: 3, mana: 15 },
    18,
    ["MAGE"],
  ),
  silk_robes: a(
    "silk_robes",
    "items.silk_robes.name",
    ItemRarity.UNCOMMON,
    { ...Z, int: 6, mana: 30 },
    55,
    ["MAGE", "NECROMANCER", "DRUID"],
  ),
  arcane_robes: a(
    "arcane_robes",
    "items.arcane_robes.name",
    ItemRarity.RARE,
    { ...Z, int: 12, mana: 55, armor: 3 },
    210,
    ["MAGE"],
  ),
  druid_robes: a(
    "druid_robes",
    "items.druid_robes.name",
    ItemRarity.UNCOMMON,
    { ...Z, int: 6, hp: 20, mana: 20 },
    60,
    ["DRUID"],
  ),
  necro_shroud: a(
    "necro_shroud",
    "items.necro_shroud.name",
    ItemRarity.UNCOMMON,
    { ...Z, int: 7, hp: 25, armor: 2 },
    65,
    ["NECROMANCER"],
  ),
  vampire_cape: a(
    "vampire_cape",
    "items.vampire_cape.name",
    ItemRarity.RARE,
    { ...Z, armor: 6, agi: 10, str: 5, hp: 40 },
    350,
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // SHIELDS
  // ══════════════════════════════════════════════════════════════════════════

  wooden_shield: s(
    "wooden_shield",
    "items.wooden_shield.name",
    ItemRarity.COMMON,
    { ...Z, armor: 2 },
    10,
    undefined,
    1,
  ),
  buckler: s(
    "buckler",
    "items.buckler.name",
    ItemRarity.COMMON,
    { ...Z, armor: 2, agi: 2 },
    12,
    ["WARRIOR", "PALADIN", "ROGUE"],
    1,
  ),
  iron_shield: s(
    "iron_shield",
    "items.iron_shield.name",
    ItemRarity.UNCOMMON,
    { ...Z, armor: 5, hp: 15 },
    35,
    undefined,
    2,
  ),
  knight_shield: s(
    "knight_shield",
    "items.knight_shield.name",
    ItemRarity.RARE,
    { ...Z, armor: 9, hp: 30 },
    180,
    ["WARRIOR", "PALADIN"],
    2,
  ),
  tower_shield: s(
    "tower_shield",
    "items.tower_shield.name",
    ItemRarity.EPIC,
    { ...Z, armor: 14, hp: 50 },
    480,
    ["WARRIOR", "PALADIN"],
    2,
  ),
  mage_ward: s(
    "mage_ward",
    "items.mage_ward.name",
    ItemRarity.RARE,
    { ...Z, armor: 4, mana: 40, int: 6 },
    210,
    ["MAGE", "CLERIC"],
    1,
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // HELMETS
  // ══════════════════════════════════════════════════════════════════════════

  leather_cap: h(
    "leather_cap",
    "items.leather_cap.name",
    ItemRarity.COMMON,
    { ...Z, armor: 1, hp: 5 },
    5,
  ),
  iron_helmet: h(
    "iron_helmet",
    "items.iron_helmet.name",
    ItemRarity.COMMON,
    { ...Z, armor: 2, hp: 8 },
    12,
    undefined,
    1,
  ),
  chainmail_hood: h(
    "chainmail_hood",
    "items.chainmail_hood.name",
    ItemRarity.UNCOMMON,
    { ...Z, armor: 4, hp: 15 },
    40,
    ["WARRIOR", "PALADIN", "CLERIC"],
    1,
  ),
  plate_helm: h(
    "plate_helm",
    "items.plate_helm.name",
    ItemRarity.RARE,
    { ...Z, armor: 8, hp: 30 },
    175,
    ["WARRIOR", "PALADIN"],
    1,
  ),
  wizard_hat: h(
    "wizard_hat",
    "items.wizard_hat.name",
    ItemRarity.COMMON,
    { ...Z, int: 3, mana: 10 },
    14,
    ["MAGE"],
    4,
  ),
  arcane_circlet: h(
    "arcane_circlet",
    "items.arcane_circlet.name",
    ItemRarity.UNCOMMON,
    { ...Z, int: 7, mana: 25 },
    55,
    ["MAGE", "CLERIC", "DRUID", "NECROMANCER"],
    4,
  ),
  ranger_hood: h(
    "ranger_hood",
    "items.ranger_hood.name",
    ItemRarity.UNCOMMON,
    { ...Z, agi: 5, armor: 2 },
    45,
    ["RANGER", "ROGUE"],
    4,
  ),
  wolf_mask: h(
    "wolf_mask",
    "items.wolf_mask.name",
    ItemRarity.RARE,
    { ...Z, agi: 8, str: 4, armor: 3 },
    185,
    ["RANGER", "ROGUE", "WARRIOR"],
    4,
  ),
  bone_crown: h(
    "bone_crown",
    "items.bone_crown.name",
    ItemRarity.RARE,
    { ...Z, int: 10, hp: 20 },
    190,
    ["NECROMANCER"],
    7,
  ),
  light_crown: h(
    "light_crown",
    "items.light_crown.name",
    ItemRarity.RARE,
    { ...Z, int: 8, hp: 20, str: 5 },
    200,
    ["PALADIN", "CLERIC"],
    7,
  ),
  crown_of_thorns: h(
    "crown_of_thorns",
    "items.crown_of_thorns.name",
    ItemRarity.RARE,
    { ...Z, int: 8, mana: 30, str: 5 },
    220,
    undefined,
    7,
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // RINGS / AMULETS
  // ══════════════════════════════════════════════════════════════════════════

  ring_of_strength: r(
    "ring_of_strength",
    "items.ring_of_strength.name",
    ItemRarity.UNCOMMON,
    { ...Z, str: 5 },
    100,
  ),
  ring_of_agility: r(
    "ring_of_agility",
    "items.ring_of_agility.name",
    ItemRarity.UNCOMMON,
    { ...Z, agi: 5 },
    100,
  ),
  ring_of_intellect: r(
    "ring_of_intellect",
    "items.ring_of_intellect.name",
    ItemRarity.UNCOMMON,
    { ...Z, int: 5 },
    100,
  ),
  ring_of_vitality: r(
    "ring_of_vitality",
    "items.ring_of_vitality.name",
    ItemRarity.UNCOMMON,
    { ...Z, hp: 50 },
    120,
  ),
  ring_of_power: r(
    "ring_of_power",
    "items.ring_of_power.name",
    ItemRarity.RARE,
    { ...Z, str: 8, agi: 4 },
    220,
  ),
  ring_of_shadows: r(
    "ring_of_shadows",
    "items.ring_of_shadows.name",
    ItemRarity.RARE,
    { ...Z, agi: 10, hp: 20 },
    240,
    ["ROGUE", "RANGER"],
  ),
  ring_of_healing: r(
    "ring_of_healing",
    "items.ring_of_healing.name",
    ItemRarity.RARE,
    { ...Z, int: 8, hp: 40 },
    230,
    ["CLERIC", "DRUID"],
  ),
  ring_of_fortune: r(
    "ring_of_fortune",
    "items.ring_of_fortune.name",
    ItemRarity.EPIC,
    { ...Z, str: 6, agi: 6, int: 6 },
    600,
  ),
  blood_amulet: r(
    "blood_amulet",
    "items.blood_amulet.name",
    ItemRarity.RARE,
    { ...Z, hp: 80, str: 8 },
    400,
  ),
  amulet_of_life: r(
    "amulet_of_life",
    "items.amulet_of_life.name",
    ItemRarity.UNCOMMON,
    { ...Z, hp: 60 },
    160,
  ),
  amulet_of_mana: r(
    "amulet_of_mana",
    "items.amulet_of_mana.name",
    ItemRarity.UNCOMMON,
    { ...Z, mana: 60 },
    160,
    ["MAGE", "CLERIC", "DRUID", "NECROMANCER"],
  ),
  amulet_of_speed: r(
    "amulet_of_speed",
    "items.amulet_of_speed.name",
    ItemRarity.RARE,
    { ...Z, agi: 12, hp: 20 },
    260,
  ),
  cursed_ring: r(
    "cursed_ring",
    "items.cursed_ring.name",
    ItemRarity.EPIC,
    { ...Z, str: 20, agi: 10, int: 10, hp: -40 },
    450,
  ),

  // ══════════════════════════════════════════════════════════════════════════
  // CONSUMABLES — Healing
  // ══════════════════════════════════════════════════════════════════════════

  health_potion: c("health_potion", "items.health_potion.name", ItemRarity.COMMON, 8, {
    healHp: 50,
  }),
  mana_potion: c("mana_potion", "items.mana_potion.name", ItemRarity.COMMON, 8, { healMana: 40 }),
  great_health_potion: c(
    "great_health_potion",
    "items.great_health_potion.name",
    ItemRarity.UNCOMMON,
    25,
    { healHp: 150 },
  ),
  great_mana_potion: c(
    "great_mana_potion",
    "items.great_mana_potion.name",
    ItemRarity.UNCOMMON,
    25,
    { healMana: 120 },
  ),
  elixir_of_life: c("elixir_of_life", "items.elixir_of_life.name", ItemRarity.RARE, 80, {
    healHp: 400,
  }),
  full_restore: c("full_restore", "items.full_restore.name", ItemRarity.EPIC, 200, {
    healHp: 9999,
    healMana: 9999,
  }),

  // ── Antidotes / Utility ───────────────────────────────────────────────────
  antidote: c("antidote", "items.antidote.name", ItemRarity.COMMON, 12, { cureDebuff: true }),
  greater_antidote: c("greater_antidote", "items.greater_antidote.name", ItemRarity.UNCOMMON, 35, {
    cureDebuff: true,
    healHp: 30,
  }),

  // ── Elixirs (temp stat buffs) ─────────────────────────────────────────────
  elixir_of_strength: c(
    "elixir_of_strength",
    "items.elixir_of_strength.name",
    ItemRarity.UNCOMMON,
    45,
    { buffStat: StatType.STR, buffAmount: 10, buffDurationMs: 60_000 },
  ),
  elixir_of_agility: c(
    "elixir_of_agility",
    "items.elixir_of_agility.name",
    ItemRarity.UNCOMMON,
    45,
    { buffStat: StatType.AGI, buffAmount: 10, buffDurationMs: 60_000 },
  ),
  elixir_of_intellect: c(
    "elixir_of_intellect",
    "items.elixir_of_intellect.name",
    ItemRarity.UNCOMMON,
    45,
    { buffStat: StatType.INT, buffAmount: 10, buffDurationMs: 60_000 },
  ),
  elixir_of_fortitude: c(
    "elixir_of_fortitude",
    "items.elixir_of_fortitude.name",
    ItemRarity.RARE,
    90,
    { buffStat: StatType.HP, buffAmount: 100, buffDurationMs: 120_000 },
  ),

  // ── Scrolls / Special ─────────────────────────────────────────────────────
  scroll_of_fireball: c(
    "scroll_of_fireball",
    "items.scroll_of_fireball.name",
    ItemRarity.UNCOMMON,
    50,
    {},
  ),
  scroll_of_healing: c(
    "scroll_of_healing",
    "items.scroll_of_healing.name",
    ItemRarity.UNCOMMON,
    50,
    { healHp: 200 },
  ),
  smoke_bomb_item: c("smoke_bomb_item", "items.smoke_bomb_item.name", ItemRarity.UNCOMMON, 35, {}),

  // ── Taming ────────────────────────────────────────────────────────────────
  lasso: {
    id: "lasso",
    name: "items.lasso.name",
    slot: "consumable",
    rarity: ItemRarity.COMMON,
    stats: { ...Z },
    goldValue: 15,
    stackable: true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MOUNTS
  // ══════════════════════════════════════════════════════════════════════════

  brown_horse: {
    id: "brown_horse",
    name: "items.brown_horse.name",
    slot: "mount",
    rarity: ItemRarity.UNCOMMON,
    stats: { ...Z, speedBonus: 4 },
    goldValue: 250,
    mountNpcType: "horse",
  },
  bear_mount: {
    id: "bear_mount",
    name: "items.bear_mount.name",
    slot: "mount",
    rarity: ItemRarity.UNCOMMON,
    stats: { ...Z, speedBonus: 3 },
    goldValue: 400,
    mountNpcType: "bear",
  },
  elephant_mount: {
    id: "elephant_mount",
    name: "items.elephant_mount.name",
    slot: "mount",
    rarity: ItemRarity.RARE,
    stats: { ...Z, speedBonus: 3 },
    goldValue: 1200,
    mountNpcType: "elephant",
  },
  dragon_mount: {
    id: "dragon_mount",
    name: "items.dragon_mount.name",
    slot: "mount",
    rarity: ItemRarity.LEGENDARY,
    stats: { ...Z, speedBonus: 6 },
    goldValue: 5000,
    mountNpcType: "dragon",
  },
  wolf_mount: {
    id: "wolf_mount",
    name: "items.wolf_mount.name",
    slot: "mount",
    rarity: ItemRarity.UNCOMMON,
    stats: { ...Z, speedBonus: 4 },
    goldValue: 350,
    mountNpcType: "wolf",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CRAFTING MATERIALS
  // ══════════════════════════════════════════════════════════════════════════

  // Raw mob drops
  wolf_pelt: mat("wolf_pelt", "items.wolf_pelt.name", ItemRarity.COMMON, 4),
  bat_wing: mat("bat_wing", "items.bat_wing.name", ItemRarity.COMMON, 3),
  orc_tusk: mat("orc_tusk", "items.orc_tusk.name", ItemRarity.COMMON, 5),
  spider_silk: mat("spider_silk", "items.spider_silk.name", ItemRarity.COMMON, 6),
  troll_hide: mat("troll_hide", "items.troll_hide.name", ItemRarity.UNCOMMON, 15),
  bone_fragment: mat("bone_fragment", "items.bone_fragment.name", ItemRarity.COMMON, 2),
  ghost_essence: mat("ghost_essence", "items.ghost_essence.name", ItemRarity.UNCOMMON, 20),
  dragon_scale: mat("dragon_scale", "items.dragon_scale.name", ItemRarity.RARE, 80),
  void_crystal: mat("void_crystal", "items.void_crystal.name", ItemRarity.RARE, 70),
  dark_gem: mat("dark_gem", "items.dark_gem.name", ItemRarity.EPIC, 200),

  // Raw minerals / crafting base
  iron_ore: mat("iron_ore", "items.iron_ore.name", ItemRarity.COMMON, 5),
  coal: mat("coal", "items.coal.name", ItemRarity.COMMON, 3),
  moonstone: mat("moonstone", "items.moonstone.name", ItemRarity.UNCOMMON, 25),
  enchant_dust: mat("enchant_dust", "items.enchant_dust.name", ItemRarity.UNCOMMON, 18),
  blank_scroll: mat("blank_scroll", "items.blank_scroll.name", ItemRarity.COMMON, 8),

  // Fun/collectible items
  lucky_coin: mat("lucky_coin", "items.lucky_coin.name", ItemRarity.UNCOMMON, 50),
  strange_gem: mat("strange_gem", "items.strange_gem.name", ItemRarity.RARE, 120),
  treasure_map: mat("treasure_map", "items.treasure_map.name", ItemRarity.RARE, 300),
  shiny_bead: mat("shiny_bead", "items.shiny_bead.name", ItemRarity.COMMON, 10),
  ancient_coin: mat("ancient_coin", "items.ancient_coin.name", ItemRarity.EPIC, 500),
};

// ─── Per-item emoji lookup ──────────────────────────────────────────────────
/** Unique emoji for every item, keyed by item id. */
export const ITEM_EMOJIS: Record<string, string> = {
  // Weapons — Generic
  club: "🏏",
  dagger: "🗡️",
  bronze_axe: "🪓",
  iron_dagger: "🔪",

  // Weapons — Warrior
  iron_sword: "⚔️",
  steel_sword: "🗡️",
  battle_axe: "🪓",
  flame_blade: "🔥",
  great_axe: "⛏️",
  berserker_blade: "⚔️",
  titan_axe: "🪓",
  bone_sword: "🦴",

  // Weapons — Paladin
  war_hammer: "🔨",
  crusader_sword: "✝️",
  divine_blade: "✨",
  holy_avenger: "⚡",

  // Weapons — Cleric
  holy_mace: "🔨",
  healing_rod: "🪄",
  blessed_hammer: "⚒️",
  bishop_staff: "🏥",
  scepter_of_faith: "👑",
  divine_scepter: "🌟",
  elder_staff: "🪄",

  // Weapons — Mage
  magic_staff: "🪄",
  crystal_wand: "💎",
  arcane_staff: "🔮",
  staff_of_ice: "❄️",
  void_orb: "🌀",
  staff_of_storms: "⛈️",
  arcane_tome: "📖",

  // Weapons — Ranger
  short_bow: "🏹",
  hunting_bow: "🎯",
  composite_bow: "🏹",
  longbow: "🏹",
  war_bow: "🏹",
  elven_bow: "🧝",
  crossbow: "🏹",
  siege_crossbow: "💥",

  // Weapons — Rogue
  dagger_dual: "🗡️",
  twin_daggers: "⚔️",
  sap: "🥊",
  poisoned_shiv: "🧪",
  shadow_daggers: "🌑",
  skull_dagger: "💀",
  venom_blades: "🐍",
  void_knife: "🌀",

  // Weapons — Necromancer
  bone_wand: "🦴",
  death_scepter: "☠️",
  void_staff: "🌑",
  soul_reaper: "👻",

  // Weapons — Druid
  wooden_club: "🌿",
  gnarled_staff: "🌳",
  nature_wand: "🍃",
  staff_of_the_wild: "🌲",
  moon_staff: "🌙",

  // Armor
  tunic: "👕",
  leather_armor: "🦺",
  studded_armor: "🛡️",
  scale_armor: "🐉",
  chainmail: "⛓️",
  battle_plate: "🪖",
  plate_armor: "🛡️",
  knight_plate: "🏰",
  elven_cloak: "🧣",
  shadow_cloak: "🌑",
  shadow_shroud: "👤",
  mage_robes: "🧙",
  silk_robes: "👘",
  arcane_robes: "🔮",
  druid_robes: "🌿",
  necro_shroud: "☠️",
  vampire_cape: "🧛",

  // Shields
  wooden_shield: "🪵",
  buckler: "🛡️",
  iron_shield: "🛡️",
  knight_shield: "⚜️",
  tower_shield: "🏰",
  mage_ward: "🔮",

  // Helmets
  leather_cap: "🧢",
  iron_helmet: "⛑️",
  chainmail_hood: "🪖",
  plate_helm: "🪖",
  wizard_hat: "🧙",
  arcane_circlet: "👑",
  ranger_hood: "🏹",
  wolf_mask: "🐺",
  bone_crown: "💀",
  light_crown: "✨",
  crown_of_thorns: "🌹",

  // Rings / Amulets
  ring_of_strength: "💪",
  ring_of_agility: "🏃",
  ring_of_intellect: "🧠",
  ring_of_vitality: "❤️",
  ring_of_power: "💍",
  ring_of_shadows: "🌑",
  ring_of_healing: "💚",
  ring_of_fortune: "🍀",
  blood_amulet: "🩸",
  amulet_of_life: "❤️",
  amulet_of_mana: "💧",
  amulet_of_speed: "⚡",
  cursed_ring: "💀",

  // Consumables — Potions
  health_potion: "❤️",
  mana_potion: "💙",
  great_health_potion: "❤️‍🔥",
  great_mana_potion: "💎",
  elixir_of_life: "🧬",
  full_restore: "💖",

  // Consumables — Antidotes
  antidote: "🧴",
  greater_antidote: "💊",

  // Consumables — Elixirs
  elixir_of_strength: "💪",
  elixir_of_agility: "🏃",
  elixir_of_intellect: "🧠",
  elixir_of_fortitude: "🛡️",

  // Consumables — Scrolls
  scroll_of_fireball: "🔥",
  scroll_of_healing: "📜",
  smoke_bomb_item: "💨",

  // Taming
  lasso: "🪢",

  // Mounts
  brown_horse: "🐴",
  bear_mount: "🐻",
  elephant_mount: "🐘",
  dragon_mount: "🐲",
  wolf_mount: "🐺",

  // Crafting Materials — Mob drops
  wolf_pelt: "🐾",
  bat_wing: "🦇",
  orc_tusk: "🦷",
  spider_silk: "🕸️",
  troll_hide: "👹",
  bone_fragment: "🦴",
  ghost_essence: "👻",
  dragon_scale: "🐉",
  void_crystal: "🔮",
  dark_gem: "💎",

  // Crafting Materials — Minerals
  iron_ore: "⛏️",
  coal: "�ite",
  moonstone: "🌙",
  enchant_dust: "✨",
  blank_scroll: "📃",

  // Crafting Materials — Collectibles
  lucky_coin: "🪙",
  strange_gem: "💠",
  treasure_map: "🗺️",
  shiny_bead: "📿",
  ancient_coin: "🏛️",
};

/** Slot-based fallback emoji when an item ID has no specific mapping. */
const SLOT_EMOJI: Record<string, string> = {
  weapon: "⚔️",
  armor: "🛡️",
  shield: "🛡️",
  helmet: "⛑️",
  ring: "💍",
  mount: "🐎",
  consumable: "🧪",
  material: "🔩",
};

/** Returns the emoji for a given item id, falling back to slot-based or generic. */
export function getItemEmoji(itemId: string): string {
  if (ITEM_EMOJIS[itemId]) return ITEM_EMOJIS[itemId];
  const item = ITEMS[itemId];
  if (item) return SLOT_EMOJI[item.slot] ?? "✨";
  return "✨";
}
