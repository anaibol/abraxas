/** Starting equipment per class — full PvP loadout */
export const STARTING_EQUIPMENT: Record<string, { items: string[]; gold: number }> = {
  warrior: {
    items: [
      "flame_blade", "plate_armor", "iron_shield", "crown_of_thorns", "ring_of_strength",
      "great_health_potion", "great_health_potion", "great_health_potion",
      "great_mana_potion", "great_mana_potion", "great_mana_potion",
    ],
    gold: 100,
  },
  wizard: {
    items: [
      "staff_of_storms", "mage_robes", "wizard_hat", "ring_of_intellect",
      "great_health_potion", "great_health_potion", "great_health_potion",
      "great_mana_potion", "great_mana_potion", "great_mana_potion",
    ],
    gold: 100,
  },
  archer: {
    items: [
      "elven_bow", "shadow_cloak", "iron_helmet", "ring_of_agility",
      "great_health_potion", "great_health_potion", "great_health_potion",
      "great_mana_potion", "great_mana_potion", "great_mana_potion",
    ],
    gold: 100,
  },
  assassin: {
    items: [
      "venom_blades", "shadow_cloak", "iron_helmet", "ring_of_agility",
      "great_health_potion", "great_health_potion", "great_health_potion",
      "great_mana_potion", "great_mana_potion", "great_mana_potion",
    ],
    gold: 100,
  },
  paladin: {
    items: [
      "blessed_hammer", "plate_armor", "iron_shield", "crown_of_thorns", "ring_of_vitality",
      "great_health_potion", "great_health_potion", "great_health_potion",
      "great_mana_potion", "great_mana_potion", "great_mana_potion",
    ],
    gold: 100,
  },
  druid: {
    items: [
      "elder_staff", "mage_robes", "wizard_hat", "ring_of_intellect",
      "great_health_potion", "great_health_potion", "great_health_potion",
      "great_mana_potion", "great_mana_potion", "great_mana_potion",
    ],
    gold: 100,
  },
};

export const KILL_GOLD_BONUS = 25;
export const RESPAWN_TIME_MS = 5000;
