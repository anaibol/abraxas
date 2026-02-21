import {
  BASIC_ITEMS_BY_CLASS,
  CLASS_STATS,
  type EquipmentSlot,
  ITEMS,
  type ItemRarity,
  LEVEL_UP_STATS,
  MAX_INVENTORY_SLOTS,
  type StatBonuses,
  type StatType,
} from "@abraxas/shared";
import { InventoryItem, ItemAffixSchema } from "../schema/InventoryItem";
import type { Player } from "../schema/Player";
import type { BuffSystem } from "./BuffSystem";

/** The subset of Player property keys that hold equipment item IDs. */
type EquipSlotKey =
  | "equipWeapon"
  | "equipArmor"
  | "equipShield"
  | "equipHelmet"
  | "equipRing"
  | "equipMount";

const EQUIP_SLOT_MAP: Partial<Record<EquipmentSlot, EquipSlotKey>> = {
  weapon: "equipWeapon",
  armor: "equipArmor",
  shield: "equipShield",
  helmet: "equipHelmet",
  ring: "equipRing",
  mount: "equipMount",
};

export class InventorySystem {
  constructor(private buffSystem?: BuffSystem) {}

  private findItem(player: Player, itemId: string): InventoryItem | undefined {
    for (const item of player.inventory) {
      if (item.itemId === itemId) return item;
    }
    return undefined;
  }

  addItem(
    player: Player,
    itemId: string,
    quantity: number = 1,
    instanceData?: {
      rarity: ItemRarity;
      nameOverride?: string;
      affixes: { type: string; stat: StatType; value: number }[];
    },
    onError?: (msg: string) => void,
  ): boolean {
    const def = ITEMS[itemId];
    if (!def) {
      onError?.("Invalid item");
      return false;
    }

    // For stackable items, try to stack first
    if (def.stackable) {
      const existing = this.findItem(player, itemId);
      if (existing) {
        existing.quantity += quantity;
        return true;
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

        if (instanceData) {
          item.rarity = instanceData.rarity;
          item.nameOverride = instanceData.nameOverride ?? "";
          instanceData.affixes.forEach((a) => {
            const s = new ItemAffixSchema();
            s.affixType = a.type;
            s.stat = a.stat;
            s.value = a.value;
            item.affixes.push(s);
          });
        }

        player.inventory.push(item);
        return true;
      }
    }

    onError?.("game.inventory_full");
    return false;
  }

  removeItem(player: Player, itemId: string, quantity: number = 1, slotIndex?: number): boolean {
    const item = player.inventory.find((i) =>
      i.itemId === itemId && (slotIndex === undefined || i.slotIndex === slotIndex),
    );
    if (!item) return false;
    if (item.quantity > quantity) {
      item.quantity -= quantity;
    } else {
      const idx = player.inventory.indexOf(item);
      player.inventory.splice(idx, 1);
    }
    return true;
  }

  equipItem(player: Player, itemId: string, slotIndex?: number, onError?: (msg: string) => void): boolean {
    // Bug #41: Find exact item instance by slotIndex if provided, otherwise fallback to first matching itemId
    const item = slotIndex !== undefined
      ? player.inventory.find((i) => i.itemId === itemId && i.slotIndex === slotIndex)
      : player.inventory.find((i) => i.itemId === itemId);
    if (!item) {
      onError?.("game.item_not_found");
      return false;
    }

    const def = ITEMS[item.itemId];
    if (!def) {
      onError?.("Invalid item");
      return false;
    }
    if (def.slot === "consumable" || def.slot === "material") {
      onError?.("game.cannot_equip_consumable");
      return false;
    }

    // Check class restriction
    if (def.requiredClass && !def.requiredClass.includes(player.classType)) {
      onError?.("game.restricted_to");
      return false;
    }

    const slotKey = EQUIP_SLOT_MAP[def.slot];
    if (!slotKey) {
      onError?.("game.invalid_equip_slot");
      return false;
    }

    const currentEquip = player[slotKey];
    if (currentEquip) {
      // Swapping: Remove item to equip, then unequip current into the vacated slot.
      const itemToEquip = item;
      const unequipped = currentEquip;

      // Bug #40: Prevent splice-then-push race by just swapping the array element directly at idx
      const idx = player.inventory.indexOf(itemToEquip);
      if (idx !== -1) {
        unequipped.slotIndex = itemToEquip.slotIndex;
        player.inventory[idx] = unequipped;
      }

      // 4. Set new item as equipment
      (player as Pick<Player, EquipSlotKey>)[slotKey] = itemToEquip;
    } else {
      // Simple equip: Remove from inventory, set as equipment.
      const idx = player.inventory.indexOf(item);
      player.inventory.splice(idx, 1);
      (player as Pick<Player, EquipSlotKey>)[slotKey] = item;
    }

    this.recalcStats(player);
    return true;
  }

  unequipItem(player: Player, slot: EquipmentSlot, onError?: (msg: string) => void): boolean {
    const slotKey = EQUIP_SLOT_MAP[slot];
    if (!slotKey) return false;

    const item = player[slotKey];
    if (!item) return false;

    // Find empty slot for unequipped item
    const usedSlots = new Set(player.inventory.map((i) => i.slotIndex));
    let freeIdx = -1;
    for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
      if (!usedSlots.has(i)) {
        freeIdx = i;
        break;
      }
    }

    if (freeIdx === -1) {
      onError?.("game.inventory_full");
      return false;
    }

    item.slotIndex = freeIdx;
    player.inventory.push(item);

    (player as Pick<Player, EquipSlotKey>)[slotKey] = undefined;
    this.recalcStats(player);
    return true;
  }

  useItem(player: Player, itemId: string, onError?: (msg: string) => void): boolean {
    const item = player.inventory.find((i) => i.itemId === itemId);
    if (!item) {
      onError?.("game.item_not_found");
      return false;
    }

    const def = ITEMS[item.itemId];
    if (!def || !def.consumeEffect) {
      onError?.("game.item_not_usable");
      return false;
    }

    const fx = def.consumeEffect;

    if (fx.healHp) player.hp = Math.min(player.maxHp, player.hp + fx.healHp);
    if (fx.healMana) player.mana = Math.min(player.maxMana, player.mana + fx.healMana);

    // Antidote — remove active DoT / debuff effects
    if (fx.cureDebuff && this.buffSystem) {
      this.buffSystem.clearDebuffs(player.sessionId);
    }

    // Elixir — temporary stat buff
    if (fx.buffStat && fx.buffAmount && fx.buffDurationMs && this.buffSystem) {
      this.buffSystem.applyTempBuff(player, fx.buffStat, fx.buffAmount, fx.buffDurationMs);
    }

    if (item.quantity > 1) {
      item.quantity--;
    } else {
      const idx = player.inventory.indexOf(item);
      player.inventory.splice(idx, 1);
    }
    return true;
  }

  private getEquipmentBonuses(player: Player): StatBonuses {
    const bonuses: StatBonuses = {
      str: 0,
      agi: 0,
      int: 0,
      hp: 0,
      mana: 0,
      armor: 0,
    };

    for (const slotKey of Object.values(EQUIP_SLOT_MAP)) {
      const item = (player as Pick<Player, EquipSlotKey>)[slotKey];
      if (!item) continue;
      const def = ITEMS[item.itemId];
      if (!def) continue;

      bonuses.str += def.stats.str;
      bonuses.agi += def.stats.agi;
      bonuses.int += def.stats.int;
      bonuses.hp += def.stats.hp;
      bonuses.mana += def.stats.mana;
      bonuses.armor += def.stats.armor;

      // Affix bonuses
      for (const affix of item.affixes) {
        if (affix.stat === "str") bonuses.str += affix.value;
        else if (affix.stat === "agi") bonuses.agi += affix.value;
        else if (affix.stat === "int") bonuses.int += affix.value;
        else if (affix.stat === "hp") bonuses.hp += affix.value;
        else if (affix.stat === "mana") bonuses.mana += affix.value;
        else if (affix.stat === "armor") bonuses.armor += affix.value;
      }
    }

    return bonuses;
  }

  recalcStats(player: Player, now: number = Date.now()): void {
    const base = CLASS_STATS[player.classType];
    if (!base) return;

    const lvl = Math.max(0, player.level - 1);
    const levelBonus = LEVEL_UP_STATS[player.classType] ?? LEVEL_UP_STATS.WARRIOR;
    const equip = this.getEquipmentBonuses(player);

    player.str = base.str + equip.str + lvl * levelBonus.str;
    player.agi = base.agi + equip.agi + lvl * levelBonus.agi;
    player.intStat = base.int + equip.int + lvl * levelBonus.int;
    player.armor = base.armor + equip.armor;
    player.maxHp = base.hp + equip.hp + lvl * levelBonus.hp;
    player.maxMana = base.mana + equip.mana + lvl * levelBonus.mana;

    if (this.buffSystem) {
      player.str += this.buffSystem.getBuffBonus(player.sessionId, "str", now);
      player.agi += this.buffSystem.getBuffBonus(player.sessionId, "agi", now);
      player.intStat += this.buffSystem.getBuffBonus(player.sessionId, "int", now);
      player.armor += this.buffSystem.getBuffBonus(player.sessionId, "armor", now);
      player.maxHp += this.buffSystem.getBuffBonus(player.sessionId, "hp", now);
      player.maxMana += this.buffSystem.getBuffBonus(player.sessionId, "mana", now);
    }

    player.hp = Math.min(player.hp, player.maxHp);
    player.mana = Math.min(player.mana, player.maxMana);

    // Apply speed bonus from equipped mount
    const mount = player.equipMount;
    const mountDef = mount ? ITEMS[mount.itemId] : undefined;
    player.speedOverride = mountDef?.stats.speedBonus ?? 0;

    // Keep public equip ID fields in sync so all clients see correct visuals.
    this.syncPublicEquipIds(player);
  }

  /** Mirrors the @view() InventoryItem slots into the public string ID fields. */
  syncPublicEquipIds(player: Player): void {
    player.equipWeaponId = player.equipWeapon?.itemId ?? "";
    player.equipArmorId = player.equipArmor?.itemId ?? "";
    player.equipShieldId = player.equipShield?.itemId ?? "";
    player.equipHelmetId = player.equipHelmet?.itemId ?? "";
    player.equipRingId = player.equipRing?.itemId ?? "";
    player.equipMountId = player.equipMount?.itemId ?? "";
  }

  dropAllItems(player: Player): InventoryItem[] {
    const dropped: InventoryItem[] = [];
    const basicItems = BASIC_ITEMS_BY_CLASS[player.classType];

    // Equipment is prioritised — an equipped basic item counts as the "kept"
    // copy so any duplicate in the bag still drops.
    const basicKept = new Set<string>();

    for (const slotKey of Object.values(EQUIP_SLOT_MAP)) {
      const item = (player as Pick<Player, EquipSlotKey>)[slotKey];
      if (!item) continue;

      if (basicItems.has(item.itemId)) {
        basicKept.add(item.itemId);
      } else {
        dropped.push(item);
        (player as Pick<Player, EquipSlotKey>)[slotKey] = undefined;
      }
    }

    // Keep one non-stackable or the full stack of a stackable basic item,
    // as long as it isn't already covered by an equipped slot above.
    const toRestore: InventoryItem[] = [];

    player.inventory.forEach((item) => {
      if (!item?.itemId) return;
      if (basicItems.has(item.itemId) && !basicKept.has(item.itemId)) {
        basicKept.add(item.itemId);
        // Basic items are usually not randomized/affixed, but we keep the object anyway
        toRestore.push(item);
      } else {
        dropped.push(item);
      }
    });

    player.inventory.clear();
    toRestore.forEach((item, idx) => {
      item.slotIndex = idx;
      player.inventory.push(item);
    });

    this.recalcStats(player);
    return dropped;
  }
}
