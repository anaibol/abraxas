import {
  ITEMS,
  CLASS_STATS,
  LEVEL_UP_STATS,
  type EquipmentSlot,
  MAX_INVENTORY_SLOTS,
  StatBonuses,
} from "@abraxas/shared";
import type { Player } from "../schema/Player";
import { InventoryItem } from "../schema/InventoryItem";
import { logger } from "../logger";

/** The subset of Player property keys that hold equipment item IDs. */
type EquipSlotKey =
  | "equipWeapon"
  | "equipArmor"
  | "equipShield"
  | "equipHelmet"
  | "equipRing";

export const EQUIP_SLOT_MAP: Record<EquipmentSlot, EquipSlotKey> = {
  weapon: "equipWeapon",
  armor: "equipArmor",
  shield: "equipShield",
  helmet: "equipHelmet",
  ring: "equipRing",
};

/** Set a single equipment slot on a player. */
export function setEquipSlot(
  player: Player,
  slotKey: EquipSlotKey,
  value: string,
): void {
  player[slotKey] = value;
}

/** Get the item ID in a single equipment slot (empty string = nothing equipped). */
export function getEquipSlot(player: Player, slotKey: EquipSlotKey): string {
  return player[slotKey];
}

export class InventorySystem {
  addItem(
    player: Player,
    itemId: string,
    quantity: number = 1,
    onError?: (msg: string) => void,
  ): boolean {
    const def = ITEMS[itemId];
    if (!def) {
      onError?.("Invalid item");
      return false;
    }

    // For stackable items, try to stack first
    if (def.stackable) {
      for (const item of player.inventory) {
        if (item.itemId === itemId) {
          item.quantity += quantity;
          return true;
        }
      }
    }

    // Find empty slot
    const usedSlots = new Set<number>();
    for (const item of player.inventory) {
      usedSlots.add(item.slotIndex);
    }

    for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
      if (!usedSlots.has(i)) {
        const item = new InventoryItem();
        item.itemId = itemId;
        item.quantity = quantity;
        item.slotIndex = i;
        player.inventory.push(item);
        return true;
      }
    }

    onError?.("Inventory full");
    return false;
  }

  removeItem(player: Player, itemId: string, quantity: number = 1): boolean {
    for (let i = 0; i < player.inventory.length; i++) {
      const item = player.inventory[i];
      if (item && item.itemId === itemId) {
        if (item.quantity > quantity) {
          item.quantity -= quantity;
        } else {
          player.inventory.splice(i, 1);
        }
        return true;
      }
    }
    return false;
  }

  findItem(player: Player, itemId: string): InventoryItem | undefined {
    for (const item of player.inventory) {
      if (item.itemId === itemId) return item;
    }
    return undefined;
  }

  equipItem(
    player: Player,
    itemId: string,
    onError?: (msg: string) => void,
  ): boolean {
    const def = ITEMS[itemId];
    if (!def) {
      onError?.("Invalid item");
      return false;
    }
    if (def.slot === "consumable") {
      onError?.("Cannot equip consumable");
      return false;
    }

    // Check class restriction
    if (def.requiredClass && !def.requiredClass.includes(player.classType)) {
      onError?.(`Restricted to ${def.requiredClass.join(", ")}`);
      return false;
    }

    // Check item is in inventory
    if (!this.findItem(player, itemId)) {
      onError?.("Item not found");
      return false;
    }

    const slotKey = EQUIP_SLOT_MAP[def.slot];
    if (!slotKey) {
      onError?.("Invalid equipment slot");
      return false;
    }

    // After the consumable check above, def.slot is narrowed to EquipmentSlot
    const currentItem = getEquipSlot(player, slotKey);
    if (currentItem) {
      if (player.inventory.length >= MAX_INVENTORY_SLOTS) {
        onError?.("Inventory full - cannot unequip current item");
        return false;
      }
      this.unequipItem(player, def.slot);
    }

    if (this.removeItem(player, itemId)) {
      setEquipSlot(player, slotKey, itemId);
      this.recalcStats(player);
      return true;
    }
    return false;
  }

  unequipItem(
    player: Player,
    slot: EquipmentSlot,
    onError?: (msg: string) => void,
  ): boolean {
    const slotKey = EQUIP_SLOT_MAP[slot];
    if (!slotKey) return false;

    const itemId = getEquipSlot(player, slotKey);
    if (!itemId) return false;

    if (!this.addItem(player, itemId, 1, onError)) return false;

    setEquipSlot(player, slotKey, "");
    this.recalcStats(player);
    return true;
  }

  useItem(
    player: Player,
    itemId: string,
    onError?: (msg: string) => void,
  ): boolean {
    const def = ITEMS[itemId];
    if (!def || !def.consumeEffect) {
      onError?.("Item not usable");
      return false;
    }
    if (!this.findItem(player, itemId)) {
      onError?.("Item not found");
      return false;
    }

    if (def.consumeEffect.healHp) {
      player.hp = Math.min(player.maxHp, player.hp + def.consumeEffect.healHp);
    }
    if (def.consumeEffect.healMana) {
      player.mana = Math.min(
        player.maxMana,
        player.mana + def.consumeEffect.healMana,
      );
    }

    this.removeItem(player, itemId);
    return true;
  }

  getEquipmentBonuses(player: Player): StatBonuses {
    const bonuses: StatBonuses = {
      str: 0,
      agi: 0,
      int: 0,
      hp: 0,
      mana: 0,
      armor: 0,
    };

    for (const slotKey of Object.values(EQUIP_SLOT_MAP)) {
      const itemId = getEquipSlot(player, slotKey);
      if (!itemId) continue;
      const def = ITEMS[itemId];
      if (!def) continue;

      bonuses.str += def.stats.str ?? 0;
      bonuses.agi += def.stats.agi ?? 0;
      bonuses.int += def.stats.int ?? 0;
      bonuses.hp += def.stats.hp ?? 0;
      bonuses.mana += def.stats.mana ?? 0;
      bonuses.armor += def.stats.armor ?? 0;
    }

    return bonuses;
  }

  recalcStats(player: Player): void {
    const base = CLASS_STATS[player.classType];
    if (!base) return;

    const lvl = Math.max(0, player.level - 1);
    const levelBonus = LEVEL_UP_STATS[player.classType] ?? LEVEL_UP_STATS.WARRIOR;
    const equip = this.getEquipmentBonuses(player);

    player.str = base.str + equip.str + lvl * levelBonus.str;
    player.agi = base.agi + equip.agi + lvl * levelBonus.agi;
    player.intStat = base.int + equip.int + lvl * levelBonus.int;
    player.maxHp = base.hp + equip.hp + lvl * levelBonus.hp;
    player.maxMana = base.mana + equip.mana + lvl * levelBonus.mp;
    player.hp = Math.min(player.hp, player.maxHp);
    player.mana = Math.min(player.mana, player.maxMana);
  }

  dropAllItems(player: Player): { itemId: string; quantity: number }[] {
    const dropped: { itemId: string; quantity: number }[] = [];

    player.inventory.forEach((item) => {
      if (item?.itemId) {
        dropped.push({ itemId: item.itemId, quantity: item.quantity });
      }
    });
    player.inventory.clear();

    for (const slotKey of Object.values(EQUIP_SLOT_MAP)) {
      const itemId = getEquipSlot(player, slotKey);
      if (itemId) {
        dropped.push({ itemId, quantity: 1 });
        setEquipSlot(player, slotKey, "");
      }
    }

    this.recalcStats(player);
    return dropped;
  }
}
