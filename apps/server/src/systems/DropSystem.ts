import { DROP_EXPIRY_MS, DropType, ItemRarity, StatType } from "@abraxas/shared";
import type { MapSchema } from "@colyseus/schema";
import { Drop } from "../schema/Drop";
import { InventoryItem, ItemAffixSchema } from "../schema/InventoryItem";
import type { Player } from "../schema/Player";
import type { InventorySystem } from "./InventorySystem";

export class DropSystem {
  constructor(private inventorySystem: InventorySystem) {}

  public createDrop(drops: MapSchema<Drop>, tileX: number, tileY: number, itemType: string, id?: string): Drop {
    const dropId = id || crypto.randomUUID();
    const drop = new Drop();
    drop.id = dropId;
    drop.itemType = itemType;
    drop.tileX = tileX;
    drop.tileY = tileY;
    drop.spawnedAt = Date.now();
    drops.set(dropId, drop);
    return drop;
  }

  spawnItemDrop(
    drops: MapSchema<Drop>,
    tileX: number,
    tileY: number,
    itemId: string,
    quantity: number,
    instanceData?: { rarity: ItemRarity; nameOverride?: string; affixes: { type: string; stat: StatType; value: number }[] }
  ): Drop {
    const drop = this.createDrop(drops, tileX, tileY, DropType.ITEM);
    drop.itemId = itemId;
    drop.quantity = quantity;
    
    if (instanceData) {
        drop.rarity = instanceData.rarity;
        drop.nameOverride = instanceData.nameOverride ?? "";
        instanceData.affixes.forEach(a => {
            const s = new ItemAffixSchema();
            s.type = a.type;
            s.stat = a.stat;
            s.value = a.value;
            drop.affixes.push(s);
        });
    }
    
    return drop;
  }

  spawnGoldDrop(drops: MapSchema<Drop>, tileX: number, tileY: number, goldAmount: number): Drop {
    const drop = this.createDrop(drops, tileX, tileY, DropType.GOLD);
    drop.goldAmount = goldAmount;
    return drop;
  }

  tryPickup(
    player: Player,
    dropId: string,
    drops: MapSchema<Drop>,
    roomId: string,
    tick: number,
    onError?: (message: string) => void,
  ): boolean {
    const drop = drops.get(dropId);
    if (!drop) return false;

    if (drop.tileX !== player.tileX || drop.tileY !== player.tileY) {
      onError?.("You must be standing on the item to pick it up");
      return false;
    }

    // Handle gold drops
    if (drop.itemType === DropType.GOLD) {
      player.gold += drop.goldAmount;
      drops.delete(dropId);
      return true;
    }

    // Handle item drops
    if (drop.itemType === DropType.ITEM && drop.itemId) {
      const data = {
          rarity: drop.rarity as ItemRarity,
          nameOverride: drop.nameOverride,
          affixes: Array.from(drop.affixes).map((a: ItemAffixSchema) => ({
            type: a.type,
            stat: a.stat as StatType,
            value: a.value
          }))
      };
      if (!this.inventorySystem.addItem(player, drop.itemId, drop.quantity, data)) {
        onError?.("Inventory full");
        return false; // Inventory full
      }
      drops.delete(dropId);
      return true;
    }

    return false;
  }

  /** Remove expired drops (older than 60s) */
  expireDrops(drops: MapSchema<Drop>, now: number): void {
    const expired = [...drops.entries()]
      .filter(([, d]) => d.spawnedAt > 0 && now - d.spawnedAt > DROP_EXPIRY_MS)
      .map(([id]) => id);
    for (const id of expired) drops.delete(id);
  }
}
