import { ClientMessageType, type ClientMessages, ServerMessageType, ITEMS } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import type { RoomContext } from "./RoomContext";
import { HandlerUtils } from "./HandlerUtils";

/** Tile distance within which a player must be to attempt taming. */
const TAME_RANGE = 2;
/** Base success probability for a taming attempt. */
const TAME_SUCCESS_CHANCE = 0.5;

/** Item awarded when a particular NPC type is successfully tamed. */
const TAME_REWARDS: Record<string, string> = {
  horse: "brown_horse",
};

export class TamingHandlers {
  static handleTame(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.Tame],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    // Find the target NPC
    const targetNpc = ctx.state.npcs.get(data.targetSessionId);
    if (!targetNpc || !targetNpc.alive) {
      HandlerUtils.sendError(client, "game.tame_invalid_target");
      return;
    }

    // Only wild animals that have a taming reward can be tamed
    const rewardItemId = TAME_REWARDS[targetNpc.type];
    if (!rewardItemId) {
      HandlerUtils.sendError(client, "game.tame_not_tameable");
      return;
    }

    // Proximity check
    const dx = Math.abs(player.tileX - targetNpc.tileX);
    const dy = Math.abs(player.tileY - targetNpc.tileY);
    if (dx > TAME_RANGE || dy > TAME_RANGE) {
      HandlerUtils.sendError(client, "game.tame_too_far");
      return;
    }

    // Check the player has a lasso
    const hasLasso = player.inventory.some((s) => s.itemId === "lasso");
    if (!hasLasso) {
      HandlerUtils.sendError(client, "game.tame_no_lasso");
      return;
    }

    // Consume one lasso regardless of success
    ctx.systems.inventory.removeItem(player, "lasso", 1);

    // 50% chance of success
    if (Math.random() < TAME_SUCCESS_CHANCE) {
      // Remove the NPC from the world
      ctx.state.npcs.delete(data.targetSessionId);

      // Give the player the tamed animal item
      const added = ctx.systems.inventory.addItem(player, rewardItemId, 1);

      if (added) {
        client.send(ServerMessageType.Notification, {
          message: "game.tame_success",
          templateData: { item: ITEMS[rewardItemId]?.name ?? rewardItemId },
        });
      } else {
        // Inventory full — drop the item at the player's feet
        ctx.systems.drops.spawnItemDrop(
          ctx.state.drops,
          player.tileX,
          player.tileY,
          rewardItemId,
          1,
        );
        client.send(ServerMessageType.Notification, {
          message: "game.tame_success_dropped",
          templateData: { item: ITEMS[rewardItemId]?.name ?? rewardItemId },
        });
      }
    } else {
      // Taming failed; lasso was consumed
      client.send(ServerMessageType.Notification, { message: "game.tame_failed" });
    }
  }
}
