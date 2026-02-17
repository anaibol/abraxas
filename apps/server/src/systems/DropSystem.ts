import type { MapSchema } from "@colyseus/schema";
import type { Player } from "../schema/Player";
import { Drop } from "../schema/Drop";
import { InventorySystem } from "./InventorySystem";
import { ITEMS } from "@ao5/shared";
import { logger } from "../logger";

let dropCounter = 0;
const DROP_EXPIRY_MS = 60000;

export class DropSystem {
  private inventorySystem?: InventorySystem;

  setInventorySystem(inv: InventorySystem) {
    this.inventorySystem = inv;
  }

  spawnDrop(
    drops: MapSchema<Drop>,
    tileX: number,
    tileY: number,
    itemType: string,
    roomId: string,
    tick: number
  ): Drop {
    const id = `drop_${++dropCounter}`;
    const drop = new Drop();
    drop.id = id;
    drop.itemType = itemType;
    drop.tileX = tileX;
    drop.tileY = tileY;
    drop.spawnedAt = Date.now();
    drops.set(id, drop);
    return drop;
  }

  spawnItemDrop(
    drops: MapSchema<Drop>,
    tileX: number,
    tileY: number,
    itemId: string,
    quantity: number,
    roomId: string,
    tick: number
  ): Drop {
    const id = `drop_${++dropCounter}`;
    const drop = new Drop();
    drop.id = id;
    drop.itemType = "item";
    drop.itemId = itemId;
    drop.quantity = quantity;
    drop.tileX = tileX;
    drop.tileY = tileY;
    drop.spawnedAt = Date.now();
    drops.set(id, drop);
    return drop;
  }

  spawnGoldDrop(
    drops: MapSchema<Drop>,
    tileX: number,
    tileY: number,
    goldAmount: number,
    roomId: string,
    tick: number
  ): Drop {
    const id = `drop_${++dropCounter}`;
    const drop = new Drop();
    drop.id = id;
    drop.itemType = "gold";
    drop.goldAmount = goldAmount;
    drop.tileX = tileX;
    drop.tileY = tileY;
    drop.spawnedAt = Date.now();
    drops.set(id, drop);
    return drop;
  }

  tryPickup(
    player: Player,
    dropId: string,
    drops: MapSchema<Drop>,
    roomId: string,
    tick: number
  ): boolean {
    const drop = drops.get(dropId);
    if (!drop) return false;

    if (drop.tileX !== player.tileX || drop.tileY !== player.tileY) {
      return false;
    }

    // Handle gold drops
    if (drop.itemType === "gold") {
      player.gold += drop.goldAmount;
      drops.delete(dropId);
      return true;
    }

    // Handle item drops
    if (drop.itemType === "item" && drop.itemId && this.inventorySystem) {
      if (!this.inventorySystem.addItem(player, drop.itemId, drop.quantity)) {
        return false; // Inventory full
      }
      drops.delete(dropId);
      return true;
    }

    // Legacy loot_bag — just remove
    drops.delete(dropId);
    return true;
  }

  /** Remove expired drops (older than 60s) */
  expireDrops(drops: MapSchema<Drop>, now: number) {
    const toDelete: string[] = [];
    for (const [id, drop] of drops) {
      if (drop.spawnedAt > 0 && now - drop.spawnedAt > DROP_EXPIRY_MS) {
        toDelete.push(id);
      }
    }
    for (const id of toDelete) {
      drops.delete(id);
    }
  }
}
