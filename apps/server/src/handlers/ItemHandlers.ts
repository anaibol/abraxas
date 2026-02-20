import {
  type ClientMessages,
  type ClientMessageType,
  ITEMS,
  ServerMessageType,
} from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { spiralSearch } from "../utils/spawnUtils";
import { HandlerUtils } from "./HandlerUtils";
import type { RoomContext } from "./RoomContext";

export class ItemHandlers {
  static handlePickup(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.Pickup],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    const drop = ctx.state.drops.get(data.dropId);
    if (
      drop &&
      ctx.systems.drops.tryPickup(
        player,
        data.dropId,
        ctx.state.drops,
        ctx.roomId,
        ctx.state.tick,
        (msg) => HandlerUtils.sendError(client, msg),
      )
    ) {
      if (drop.itemType === "gold") {
        ctx.broadcast(ServerMessageType.Notification, {
          message: "game.gold_picked_up",
          templateData: { name: player.name, amount: drop.goldAmount },
        });
      } else {
        const itemName = ITEMS[drop.itemId]?.name ?? drop.itemId;
        ctx.broadcast(ServerMessageType.Notification, {
          message: "game.item_picked_up",
          templateData: { name: player.name, item: itemName },
        });
        ctx.systems.quests
          .updateProgress(player.dbId, "collect", drop.itemId, drop.quantity)
          .then((updatedQuests) => HandlerUtils.sendQuestUpdates(client, updatedQuests));
      }
    }
  }

  static handleEquip(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.Equip],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;
    ctx.systems.inventory.equipItem(player, data.itemId, (msg) =>
      HandlerUtils.sendError(client, msg),
    );
  }

  static handleUnequip(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.Unequip],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;
    ctx.systems.inventory.unequipItem(player, data.slot, (msg) =>
      HandlerUtils.sendError(client, msg),
    );
  }

  static handleUseItem(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.UseItem],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;
    
    if (
      ctx.systems.inventory.useItem(player, data.itemId, (msg) =>
        HandlerUtils.sendError(client, msg),
      )
    ) {
      ctx.broadcast(ServerMessageType.ItemUsed, {
        sessionId: client.sessionId,
        itemId: data.itemId,
      });
    }
  }

  static handleDropItem(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.DropItem],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    const item = player.inventory.find((s) => s.itemId === data.itemId);
    if (!item) return;

    const qty = data.quantity ?? item.quantity ?? 1;
    const itemId = item.itemId;

    // Capture instance data for the drop
    const instanceData = {
        rarity: item.rarity,
        nameOverride: item.nameOverride,
        affixes: item.affixes.map(a => ({ type: a.affixType, stat: a.stat, value: a.value }))
    };

    if (ctx.systems.inventory.removeItem(player, data.itemId, qty)) {
      const tile = spiralSearch(player.tileX, player.tileY, 20, (x, y) => {
        if (x < 0 || x >= ctx.map.width || y < 0 || y >= ctx.map.height) return false;
        if (ctx.map.collision[y]?.[x] === 1) return false;
        for (const drop of ctx.state.drops.values()) {
          if (drop.tileX === x && drop.tileY === y) return false;
        }
        return true;
      }) ?? { x: player.tileX, y: player.tileY };

      ctx.systems.drops.spawnItemDrop(ctx.state.drops, tile.x, tile.y, itemId, qty, instanceData as any);
    }
  }
}
