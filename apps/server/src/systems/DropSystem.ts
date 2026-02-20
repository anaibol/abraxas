import type { MapSchema } from "@colyseus/schema";
import type { Player } from "../schema/Player";
import { Drop } from "../schema/Drop";
import { InventorySystem } from "./InventorySystem";
import { DROP_EXPIRY_MS } from "@abraxas/shared";

export class DropSystem {
  constructor(private inventorySystem: InventorySystem) {}

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

    if (drop.tileX !== player.tileX || drop.tileY !== player.tileY) {
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
    if (drop.itemType === "item" && drop.itemId) {
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
    const expired = [...drops.entries()]
      .filter(([, d]) => d.spawnedAt > 0 && now - d.spawnedAt > DROP_EXPIRY_MS)
      .map(([id]) => id);
    for (const id of expired) drops.delete(id);
  }
}
