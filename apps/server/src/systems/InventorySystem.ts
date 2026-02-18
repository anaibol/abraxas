import {
  ITEMS,
  CLASS_STATS,
  type EquipmentSlot,
  type ItemDef,
  MAX_INVENTORY_SLOTS,
  StatBonuses,
} from "@abraxas/shared";
import type { Player } from "../schema/Player";
import { InventoryItem } from "../schema/InventoryItem";
import { logger } from "../logger";

export const EQUIP_SLOT_MAP: Record<EquipmentSlot, keyof Player> = {
  weapon: "equipWeapon",
  armor: "equipArmor",
  shield: "equipShield",
  helmet: "equipHelmet",
  ring: "equipRing",
};

/** Set or clear a single equipment slot on a player. */
export function setEquipSlot(
  player: Player,
  slotKey: keyof Player,
  value: string,
): void {
  if (slotKey === "equipWeapon") player.equipWeapon = value;
  else if (slotKey === "equipArmor") player.equipArmor = value;
  else if (slotKey === "equipShield") player.equipShield = value;
  else if (slotKey === "equipHelmet") player.equipHelmet = value;
  else if (slotKey === "equipRing") player.equipRing = value;
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
    return false; // Inventory full
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

    // Unequip current item in that slot first
    const currentEquipped = player[slotKey];
    if (typeof currentEquipped === "string" && currentEquipped) {
      if (!this.addItem(player, currentEquipped, 1, onError)) {
        return false; // Inventory full, can't unequip current
      }
    }

    // Remove from inventory and equip
    this.removeItem(player, itemId);
    setEquipSlot(player, slotKey, itemId);

    // Apply stat bonuses
    this.recalcStats(player);
    return true;
  }

  unequipItem(
    player: Player,
    slot: EquipmentSlot,
    onError?: (msg: string) => void,
  ): boolean {
    const slotKey = EQUIP_SLOT_MAP[slot];
    if (!slotKey) return false;

    const itemId = player[slotKey];
    if (typeof itemId !== "string" || !itemId) return false;

    // Try to add to inventory
    if (!this.addItem(player, itemId, 1, onError)) return false; // Inventory full

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

    // Apply consume effect
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
      const itemId = player[slotKey];
      if (typeof itemId !== "string" || !itemId) continue;
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

  /** Recalculate player stats from base class + equipment */
  recalcStats(player: Player): void {
    const base = CLASS_STATS[player.classType];
    if (!base) return;

    const equip = this.getEquipmentBonuses(player);
    player.str = base.str + equip.str;
    player.agi = base.agi + equip.agi;
    player.intStat = base.int + equip.int;
    player.maxHp = base.hp + equip.hp;
    player.maxMana = (base.mana || 0) + equip.mana;
    // Clamp current HP/mana to new max
    player.hp = Math.min(player.hp, player.maxHp);
    player.mana = Math.min(player.mana, player.maxMana);
  }

  /** Drop all items and equipment on death — returns list of {itemId, quantity} */
  dropAllItems(player: Player): { itemId: string; quantity: number }[] {
    const dropped: { itemId: string; quantity: number }[] = [];

    // Drop equipment
    for (const slotKey of Object.values(EQUIP_SLOT_MAP)) {
      const itemId = player[slotKey];
      if (typeof itemId === "string" && itemId) {
        dropped.push({ itemId, quantity: 1 });
        setEquipSlot(player, slotKey, "");
      }
    }

    // Drop inventory
    for (const item of player.inventory) {
      dropped.push({ itemId: item.itemId, quantity: item.quantity });
    }
    player.inventory.clear();

    // Recalc stats with no equipment
    this.recalcStats(player);
    return dropped;
  }
}
