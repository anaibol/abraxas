import type { MapSchema } from "@colyseus/schema";
import type { Player } from "../schema/Player";
import { Drop } from "../schema/Drop";
import { InventorySystem } from "./InventorySystem";
import { DROP_EXPIRY_MS } from "@abraxas/shared";

export class DropSystem {
  private inventorySystem?: InventorySystem;

  setInventorySystem(inv: InventorySystem): void {
    this.inventorySystem = inv;
  }

  private createDrop(
    drops: MapSchema<Drop>,
    tileX: number,
    tileY: number,
    itemType: string,
  ): Drop {
    const id = crypto.randomUUID();
    const drop = new Drop();
    drop.id = id;
    drop.itemType = itemType;
    drop.tileX = Math.floor(tileX);
    drop.tileY = Math.floor(tileY);
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
  ): Drop {
    const drop = this.createDrop(drops, tileX, tileY, "item");
    drop.itemId = itemId;
    drop.quantity = quantity;
    return drop;
  }

  spawnGoldDrop(
    drops: MapSchema<Drop>,
    tileX: number,
    tileY: number,
    goldAmount: number,
  ): Drop {
    const drop = this.createDrop(drops, tileX, tileY, "gold");
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

    if (Math.floor(drop.tileX) !== player.tileX || Math.floor(drop.tileY) !== player.tileY) {
      onError?.("You must be standing on the item to pick it up");
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
