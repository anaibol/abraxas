import {
  type ClientMessages,
  type ClientMessageType,
  MathUtils,
  MERCHANT_INVENTORY,
  QUESTS,
  ServerMessageType,
} from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { logger } from "../logger";
import type { Npc } from "../schema/Npc";
import type { Player } from "../schema/Player";
import { EconomyHandlers } from "./EconomyHandlers";
import { HandlerUtils } from "./HandlerUtils";
import type { RoomContext } from "./RoomContext";

export class InteractionHandlers {
  static handleInteract(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.Interact],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    const npc = ctx.state.npcs.get(data.npcId);
    if (!npc) return;

    if (!HandlerUtils.assertInRange(client, player, npc, 3, "game.too_far")) return;

    ctx.systems.quests
      .updateProgress(player.dbId, "talk", npc.npcType, 1)
      .then((updatedQuests) => HandlerUtils.sendQuestUpdates(client, updatedQuests));

    if (npc.npcType === "merchant") {
      InteractionHandlers.openShop(ctx, client, npc);
    } else if (npc.npcType === "banker") {
      EconomyHandlers.openBank(ctx, client);
    } else {
      InteractionHandlers.openDialogue(ctx, client, player, npc);
    }
  }

  static openShop(_ctx: RoomContext, client: Client, npc: Npc) {
    const inventory = MERCHANT_INVENTORY.general_store ?? [];
    client.send(ServerMessageType.OpenShop, { npcId: npc.sessionId, inventory });
  }

  static openDialogue(ctx: RoomContext, client: Client, player: Player, npc: Npc) {
    const dialogue = ctx.systems.quests.getDialogueOptions(player.dbId, npc.sessionId, npc.npcType);
    client.send(ServerMessageType.OpenDialogue, { npcId: npc.sessionId, ...dialogue });
  }

  static handleQuestAccept(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.QuestAccept],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    ctx.systems.quests
      .acceptQuest(player.dbId, data.questId)
      .then((state) => {
        if (state) {
          client.send(ServerMessageType.QuestUpdate, { quest: state });
          client.send(ServerMessageType.Notification, {
            message: "quest.accepted",
            templateData: {
              title: QUESTS[data.questId]?.title ?? data.questId,
            },
          });
        }
      })
      .catch((err) => {
        logger.error({
          message: `Failed to accept quest ${data.questId} for ${player.name}`,
          error: String(err),
        });
        HandlerUtils.sendError(client, "game.quest_failed_accept");
      });
  }

  static handleQuestComplete(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.QuestComplete],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    const questDef = QUESTS[data.questId];
    if (questDef && !InteractionHandlers.isNearNpcType(ctx, player, questDef.npcId)) {
      HandlerUtils.sendHint(client, "game.quest_near_npc");
      return;
    }

    ctx.systems.quests
      .completeQuest(player.dbId, data.questId)
      .then((questDef) => {
        if (questDef) {
          ctx.services.level.gainXp(player, questDef.rewards.exp);
          player.gold += questDef.rewards.gold;

          if (questDef.rewards.items) {
            for (const item of questDef.rewards.items) {
              ctx.systems.inventory.addItem(player, item.itemId, item.quantity);
            }
          }

          const state = ctx.systems.quests.getQuestState(player.dbId, data.questId);
          if (state) {
            client.send(ServerMessageType.QuestUpdate, { quest: state });
          }

          client.send(ServerMessageType.Notification, {
            message: "quest.completed",
            templateData: {
              title: questDef.title,
              exp: questDef.rewards.exp,
              gold: questDef.rewards.gold,
            },
          });
        }
      })
      .catch((err) => {
        logger.error({
          message: `Failed to complete quest ${data.questId} for ${player.name}`,
          error: String(err),
        });
        HandlerUtils.sendError(client, "game.quest_failed_complete");
      });
  }

  /** Returns true if the player is within `range` Manhattan tiles of any living NPC with the given type. */
  static isNearNpcType(ctx: RoomContext, player: Player, npcType: string, range = 3): boolean {
    return [...ctx.state.npcs.values()].some(
      (n) =>
        n.npcType === npcType &&
        n.alive &&
        MathUtils.manhattanDist({ x: player.tileX, y: player.tileY }, { x: n.tileX, y: n.tileY }) <=
          range,
    );
  }
}
