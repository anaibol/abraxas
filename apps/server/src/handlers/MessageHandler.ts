import { Client } from "@colyseus/core";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { MovementSystem } from "../systems/MovementSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { DropSystem } from "../systems/DropSystem";
import { SocialSystem } from "../systems/SocialSystem";
import { FriendsSystem } from "../systems/FriendsSystem";
import {
  TileMap,
  Direction,
  ITEMS,
  MERCHANT_INVENTORY,
  QUESTS,
  ServerMessages,
  ServerMessageType,
  ClientMessageType,
  ClientMessages,
  MathUtils,
} from "@abraxas/shared";
import { QuestSystem } from "../systems/QuestSystem";
import { logger } from "../logger";
import { ChatService } from "../services/ChatService";
import { LevelService } from "../services/LevelService";

type BroadcastCallback = <T extends ServerMessageType>(
  type: T,
  message?: ServerMessages[T],
  options?: { except?: Client },
) => void;

/** Dependency container for MessageHandler to reduce constructor bloat. */
export interface RoomContext {
  state: GameState;
  map: TileMap;
  roomId: string;
  systems: {
    movement: MovementSystem;
    combat: CombatSystem;
    inventory: InventorySystem;
    drops: DropSystem;
    social: SocialSystem;
    friends: FriendsSystem;
    quests: QuestSystem;
  };
  services: {
    chat: ChatService;
    level: LevelService;
  };
  broadcast: BroadcastCallback;
  isTileOccupied: (x: number, y: number, excludeId: string) => boolean;
  findClientByName: (name: string) => Client | undefined;
}

export class MessageHandler {
  constructor(private ctx: RoomContext) {}

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Returns the player if they exist and are alive, otherwise `null`. */
  private getActivePlayer(client: Client): Player | null {
    const player = this.ctx.state.players.get(client.sessionId);
    return player?.alive ? player : null;
  }

  /** Sends a typed error message to the client. */
  private sendError(client: Client, message: string): void {
    client.send(ServerMessageType.Error, { message });
  }

  /** Sends quest update notifications for a set of updated quest states. */
  sendQuestUpdates(
    client: Client,
    updatedQuests: Awaited<ReturnType<QuestSystem["updateProgress"]>>,
  ): void {
    for (const quest of updatedQuests) {
      client.send(ServerMessageType.QuestUpdate, { quest });
      if (quest.status === "COMPLETED") {
        client.send(ServerMessageType.Notification, {
          message: `Quest Completed: ${QUESTS[quest.questId].title}`,
        });
      }
    }
  }

  // ── Message Handlers ─────────────────────────────────────────────────────

  handleMove(client: Client, direction: Direction): void {
    const player = this.getActivePlayer(client);
    if (!player) return;
    if (player.stunned) return;

    const result = this.ctx.systems.movement.tryMove(
      player,
      direction,
      this.ctx.map,
      Date.now(),
      this.ctx.state.tick,
      this.ctx.roomId,
    );

    if (result.success && result.warp) {
      client.send(ServerMessageType.Warp, {
        targetMap: result.warp.targetMap,
        targetX: result.warp.targetX,
        targetY: result.warp.targetY,
      });
    }
  }

  handleAttack(
    client: Client,
    data: ClientMessages[ClientMessageType.Attack],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    this.ctx.systems.combat.tryAttack(
      player,
      data.targetTileX ?? player.tileX,
      data.targetTileY ?? player.tileY,
      this.ctx.broadcast,
      Date.now(),
      (type, payload) => client.send(type, payload),
    );
  }

  handleCast(
    client: Client,
    data: ClientMessages[ClientMessageType.Cast],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    this.ctx.systems.combat.tryCast(
      player,
      data.spellId,
      data.targetTileX ?? player.tileX,
      data.targetTileY ?? player.tileY,
      this.ctx.broadcast,
      Date.now(),
      (type, payload) => client.send(type, payload),
    );
  }

  handlePickup(
    client: Client,
    data: ClientMessages[ClientMessageType.Pickup],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    const drop = this.ctx.state.drops.get(data.dropId);
    if (
      drop &&
      this.ctx.systems.drops.tryPickup(
        player,
        data.dropId,
        this.ctx.state.drops,
        this.ctx.roomId,
        this.ctx.state.tick,
        (msg) => this.sendError(client, msg),
      )
    ) {
      if (drop.itemType === "gold") {
        this.ctx.broadcast(ServerMessageType.Notification, {
          message: `${player.name} picked up ${drop.goldAmount} gold`,
        });
      } else {
        const itemName = ITEMS[drop.itemId]?.name ?? drop.itemId;
        this.ctx.broadcast(ServerMessageType.Notification, {
          message: `${player.name} picked up ${itemName}`,
        });
        this.ctx.systems.quests
          .updateProgress(player.dbId, "collect", drop.itemId, drop.quantity)
          .then((updatedQuests) =>
            this.sendQuestUpdates(client, updatedQuests),
          );
      }
    }
  }

  handleEquip(
    client: Client,
    data: ClientMessages[ClientMessageType.Equip],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;
    this.ctx.systems.inventory.equipItem(player, data.itemId, (msg) =>
      this.sendError(client, msg),
    );
  }

  handleUnequip(
    client: Client,
    data: ClientMessages[ClientMessageType.Unequip],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;
    this.ctx.systems.inventory.unequipItem(player, data.slot, (msg) =>
      this.sendError(client, msg),
    );
  }

  handleUseItem(
    client: Client,
    data: ClientMessages[ClientMessageType.UseItem],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;
    if (
      this.ctx.systems.inventory.useItem(player, data.itemId, (msg) =>
        this.sendError(client, msg),
      )
    ) {
      this.ctx.broadcast(ServerMessageType.ItemUsed, {
        sessionId: client.sessionId,
        itemId: data.itemId,
      });
    }
  }

  handleDropItem(
    client: Client,
    data: ClientMessages[ClientMessageType.DropItem],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;
    const slot = player.inventory.find((s) => s.itemId === data.itemId);
    const qty = data.quantity ?? slot?.quantity ?? 1;
    if (this.ctx.systems.inventory.removeItem(player, data.itemId, qty)) {
      this.ctx.systems.drops.spawnItemDrop(this.ctx.state.drops, player.tileX, player.tileY, data.itemId, qty);
    }
  }

  handleInteract(
    client: Client,
    data: ClientMessages[ClientMessageType.Interact],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    const npc = this.ctx.state.npcs.get(data.npcId);
    if (!npc) return;

    const dist =
      Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileY - npc.tileY);
    if (dist > 3) {
      this.sendError(client, "Too far to interact");
      return;
    }

    this.ctx.systems.quests
      .updateProgress(player.dbId, "talk", npc.type, 1)
      .then((updatedQuests) => this.sendQuestUpdates(client, updatedQuests));

    if (npc.type === "merchant") {
      const inventory = MERCHANT_INVENTORY.general_store ?? [];
      client.send(ServerMessageType.OpenShop, { npcId: data.npcId, inventory });
      return;
    }

    const availableQuests = this.ctx.systems.quests.getAvailableQuests(player.dbId, npc.type);
    if (availableQuests.length > 0) {
      const questId = availableQuests[0];
      const questDef = QUESTS[questId];
      client.send(ServerMessageType.OpenDialogue, {
        npcId: data.npcId,
        text: `${questDef.description}\n\nDo you accept this quest?`,
        options: [
          { text: "Accept Quest", action: "quest_accept", data: { questId } },
          { text: "Maybe later", action: "close" },
        ],
      });
      return;
    }

    for (const state of this.ctx.systems.quests.getCharQuestStates(player.dbId)) {
      if (state.status !== "COMPLETED") continue;
      const questDef = QUESTS[state.questId];
      if (questDef?.npcId === npc.type) {
        client.send(ServerMessageType.OpenDialogue, {
          npcId: data.npcId,
          text: `Great job on ${questDef.title}! Here is your reward.`,
          options: [
            {
              text: "Complete Quest",
              action: "quest_complete",
              data: { questId: state.questId },
            },
          ],
        });
        return;
      }
    }

    client.send(ServerMessageType.OpenDialogue, {
      npcId: data.npcId,
      text: "Hello there, traveler!",
      options: [{ text: "Goodbye", action: "close" }],
    });
  }

  handleQuestAccept(
    client: Client,
    data: ClientMessages[ClientMessageType.QuestAccept],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    this.ctx.systems.quests
      .acceptQuest(player.dbId, data.questId)
      .then((state) => {
        if (state) {
          client.send(ServerMessageType.QuestUpdate, { quest: state });
          client.send(ServerMessageType.Notification, {
            message: `Quest Accepted: ${QUESTS[data.questId]?.title ?? data.questId}`,
          });
        }
      })
      .catch((err) => {
        logger.error({ message: `Failed to accept quest ${data.questId} for ${player.name}`, error: String(err) });
        this.sendError(client, "Failed to accept quest");
      });
  }

  handleQuestComplete(
    client: Client,
    data: ClientMessages[ClientMessageType.QuestComplete],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    // Require player to be near the quest's NPC to turn in
    const questDef = QUESTS[data.questId];
    if (questDef) {
      const isNearNpc = Array.from(this.ctx.state.npcs.values()).some(
        (n) =>
          n.type === questDef.npcId &&
          n.alive &&
          MathUtils.manhattanDist(
            { x: player.tileX, y: player.tileY },
            { x: n.tileX, y: n.tileY },
          ) <= 3,
      );
      if (!isNearNpc) {
        this.sendError(client, "You must be near the quest NPC to complete this quest");
        return;
      }
    }

    this.ctx.systems.quests
      .completeQuest(player.dbId, data.questId)
      .then((questDef) => {
        if (questDef) {
          this.ctx.services.level.gainXp(player, questDef.rewards.exp);
          player.gold += questDef.rewards.gold;

          if (questDef.rewards.items) {
            for (const item of questDef.rewards.items) {
              this.ctx.systems.inventory.addItem(player, item.itemId, item.quantity);
            }
          }

          client.send(ServerMessageType.QuestUpdate, {
            quest: this.ctx.systems.quests.getQuestState(player.dbId, data.questId)!,
          });
          client.send(ServerMessageType.Notification, {
            message: `Quest Completed: ${questDef.title} (+${questDef.rewards.exp} XP, +${questDef.rewards.gold} Gold)`,
          });
        }
      })
      .catch((err) => {
        logger.error({ message: `Failed to complete quest ${data.questId} for ${player.name}`, error: String(err) });
        this.sendError(client, "Failed to complete quest");
      });
  }

  private isNearMerchant(player: Player): boolean {
    return Array.from(this.ctx.state.npcs.values()).some(
      (n) =>
        n.type === "merchant" &&
        n.alive &&
        MathUtils.manhattanDist(
          { x: player.tileX, y: player.tileY },
          { x: n.tileX, y: n.tileY },
        ) <= 3,
    );
  }

  handleBuyItem(
    client: Client,
    data: ClientMessages[ClientMessageType.BuyItem],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    if (!this.isNearMerchant(player)) {
      this.sendError(client, "You are too far from a merchant");
      return;
    }

    // Validate item is actually sold by this merchant
    const merchantStock = MERCHANT_INVENTORY.general_store ?? [];
    if (!merchantStock.includes(data.itemId)) {
      this.sendError(client, "That item is not available here");
      return;
    }

    const itemDef = ITEMS[data.itemId];
    if (!itemDef) return;

    const quantity = Math.max(1, data.quantity ?? 1);

    // Prevent bulk buying non-stackable items
    if (!itemDef.stackable && quantity > 1) {
      this.sendError(client, "You can only buy one of that item at a time");
      return;
    }

    const totalCost = itemDef.goldValue * quantity;
    if (player.gold < totalCost) {
      this.sendError(client, "Not enough gold");
      return;
    }

    if (
      this.ctx.systems.inventory.addItem(player, data.itemId, quantity, (msg) =>
        this.sendError(client, msg),
      )
    ) {
      player.gold -= totalCost;
      client.send(ServerMessageType.Notification, {
        message: `Bought ${quantity}x ${itemDef.name}`,
      });
    }
  }

  handleSellItem(
    client: Client,
    data: ClientMessages[ClientMessageType.SellItem],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    if (!this.isNearMerchant(player)) {
      this.sendError(client, "You are too far from a merchant");
      return;
    }

    const itemDef = ITEMS[data.itemId];
    if (!itemDef) return;

    // Cap quantity to what the player actually has in inventory
    const slot = player.inventory.find((s) => s.itemId === data.itemId);
    if (!slot) {
      this.sendError(client, "Item not found in inventory");
      return;
    }
    const quantity = Math.min(data.quantity ?? 1, slot.quantity);
    if (quantity <= 0) return;

    const sellValue = Math.floor(itemDef.goldValue * 0.5) * quantity;

    if (this.ctx.systems.inventory.removeItem(player, data.itemId, quantity)) {
      player.gold += sellValue;
      client.send(ServerMessageType.Notification, {
        message: `Sold ${quantity}x ${itemDef.name} for ${sellValue} gold`,
      });
    } else {
      this.sendError(client, "Item not found in inventory");
    }
  }

  handleChat(
    client: Client,
    data: ClientMessages[ClientMessageType.Chat],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    this.ctx.services.chat.handleChat(player, data.message);
  }

  handleFriendRequest(
    client: Client,
    data: ClientMessages[ClientMessageType.FriendRequest],
  ): void {
    this.ctx.systems.friends.handleFriendRequest(client, data.targetName);
  }

  handleFriendAccept(
    client: Client,
    data: ClientMessages[ClientMessageType.FriendAccept],
  ): void {
    this.ctx.systems.friends.handleFriendAccept(client, data.requesterId);
  }

  handlePartyInvite(
    client: Client,
    data: ClientMessages[ClientMessageType.PartyInvite],
  ): void {
    this.ctx.systems.social.handleInvite(client, data.targetSessionId);
  }

  handlePartyAccept(
    client: Client,
    data: ClientMessages[ClientMessageType.PartyAccept],
  ): void {
    this.ctx.systems.social.handleAcceptInvite(client, data.partyId);
  }

  handlePartyLeave(client: Client): void {
    this.ctx.systems.social.handleLeaveParty(client);
  }

  handlePartyKick(
    client: Client,
    data: ClientMessages[ClientMessageType.PartyKick],
  ): void {
    this.ctx.systems.social.handleKickPlayer(client, data.targetSessionId);
  }

  handleAudio(client: Client, data: ArrayBuffer): void {
    const player = this.getActivePlayer(client);
    if (player) {
      this.ctx.broadcast(
        ServerMessageType.Audio,
        {
          sessionId: client.sessionId,
          data: data,
        },
        { except: client },
      );
    }
  }
}
