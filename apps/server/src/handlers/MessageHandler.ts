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
  EquipmentSlot,
  ITEMS,
  MERCHANT_INVENTORY,
  QUESTS,
  ServerMessages,
  QuestDef,
  ServerMessageType,
  ClientMessageType,
  ClientMessages,
  MathUtils,
} from "@abraxas/shared";
import { QuestSystem } from "../systems/QuestSystem";

type BroadcastCallback = <T extends ServerMessageType>(
  type: T,
  message?: ServerMessages[T],
  options?: { except?: Client },
) => void;

export class MessageHandler {
  constructor(
    private state: GameState,
    private map: TileMap,
    private roomId: string,
    private movement: MovementSystem,
    private combat: CombatSystem,
    private inventorySystem: InventorySystem,
    private drops: DropSystem,
    private social: SocialSystem,
    private friends: FriendsSystem,
    private broadcast: BroadcastCallback,
    private isTileOccupied: (
      x: number,
      y: number,
      excludeId: string,
    ) => boolean,
    private findClientByName: (name: string) => Client | undefined,
    private quests: QuestSystem,
    private gainXp: (player: Player, amount: number) => void,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Returns the player if they exist and are alive, otherwise `null`. */
  private getActivePlayer(client: Client): Player | null {
    const player = this.state.players.get(client.sessionId);
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

    if (
      this.movement.tryMove(
        player,
        direction,
        this.map,
        Date.now(),
        this.isTileOccupied,
        this.state.tick,
        this.roomId,
      )
    ) {
      const warp = this.map.warps?.find(
        (w) => w.x === player.tileX && w.y === player.tileY,
      );
      if (warp) {
        client.send(ServerMessageType.Warp, {
          targetMap: warp.targetMap,
          targetX: warp.targetX,
          targetY: warp.targetY,
        });
      }
    }
  }

  handleAttack(
    client: Client,
    data: ClientMessages[ClientMessageType.Attack],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    this.combat.tryAttack(
      player,
      data.targetTileX ?? player.tileX,
      data.targetTileY ?? player.tileY,
      this.broadcast,
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

    this.combat.tryCast(
      player,
      data.spellId,
      data.targetTileX ?? player.tileX,
      data.targetTileY ?? player.tileY,
      this.broadcast,
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

    const drop = this.state.drops.get(data.dropId);
    if (
      drop &&
      this.drops.tryPickup(
        player,
        data.dropId,
        this.state.drops,
        this.roomId,
        this.state.tick,
        (msg) => this.sendError(client, msg),
      )
    ) {
      if (drop.itemType === "gold") {
        this.broadcast(ServerMessageType.Notification, {
          message: `${player.name} picked up ${drop.goldAmount} gold`,
        });
      } else {
        this.broadcast(ServerMessageType.Notification, {
          message: `${player.name} picked up ${drop.itemId}`,
        });
        this.quests
          .updateProgress(
            player.userId,
            player.dbId,
            "collect",
            drop.itemId,
            drop.quantity,
          )
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
    this.inventorySystem.equipItem(player, data.itemId, (msg) =>
      this.sendError(client, msg),
    );
  }

  handleUnequip(
    client: Client,
    data: ClientMessages[ClientMessageType.Unequip],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;
    this.inventorySystem.unequipItem(player, data.slot, (msg) =>
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
      this.inventorySystem.useItem(player, data.itemId, (msg) =>
        this.sendError(client, msg),
      )
    ) {
      this.broadcast(ServerMessageType.ItemUsed, {
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
    if (this.inventorySystem.removeItem(player, data.itemId)) {
      this.drops.spawnItemDrop(
        this.state.drops,
        player.tileX,
        player.tileY,
        data.itemId,
        1,
      );
    }
  }

  handleInteract(
    client: Client,
    data: ClientMessages[ClientMessageType.Interact],
  ): void {
    const player = this.getActivePlayer(client);
    if (!player) return;

    const npc = this.state.npcs.get(data.npcId);
    if (!npc) return;

    const dist =
      Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileY - npc.tileY);
    if (dist > 3) {
      this.sendError(client, "Too far to interact");
      return;
    }

    this.quests
      .updateProgress(player.userId, player.dbId, "talk", npc.type, 1)
      .then((updatedQuests) => this.sendQuestUpdates(client, updatedQuests));

    if (npc.type === "merchant") {
      const inventory = MERCHANT_INVENTORY.general_store ?? [];
      // Bug Fix: Send inventory only if near. (Distance check already done above for all interactions)
      client.send(ServerMessageType.OpenShop, { npcId: data.npcId, inventory });
      return;
    }

    const availableQuests = this.quests.getAvailableQuests(
      player.userId,
      npc.type,
    );
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

    for (const state of this.quests.getPlayerQuestStates(player.userId)) {
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
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    this.quests
      .acceptQuest(player.userId, player.dbId, data.questId)
      .then((state) => {
        if (state) {
          client.send(ServerMessageType.QuestUpdate, { quest: state });
          client.send(ServerMessageType.Notification, {
            message: `Quest Accepted: ${QUESTS[data.questId].title}`,
          });
        }
      })
      .catch((err) => {
        console.error(
          `Failed to accept quest ${data.questId} for player ${player.name}:`,
          err,
        );
        this.sendError(client, "Failed to accept quest");
      });
  }

  handleQuestComplete(
    client: Client,
    data: ClientMessages[ClientMessageType.QuestComplete],
  ): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    this.quests
      .completeQuest(player.userId, player.dbId, data.questId)
      .then((questDef) => {
        if (questDef) {
          this.gainXp(player, questDef.rewards.exp);
          player.gold += questDef.rewards.gold;

          if (questDef.rewards.items) {
            for (const item of questDef.rewards.items) {
              this.inventorySystem.addItem(player, item.itemId, item.quantity);
            }
          }

          client.send(ServerMessageType.QuestUpdate, {
            quest: this.quests.getQuestState(player.userId, data.questId)!,
          });
          client.send(ServerMessageType.Notification, {
            message: `Quest Completed: ${questDef.title} (+${questDef.rewards.exp} XP, +${questDef.rewards.gold} Gold)`,
          });
        }
      })
      .catch((err) => {
        console.error(
          `Failed to complete quest ${data.questId} for player ${player.name}:`,
          err,
        );
        this.sendError(client, "Failed to complete quest");
      });
  }

  private isNearMerchant(player: Player): boolean {
    return Array.from(this.state.npcs.values()).some(
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

    const itemDef = ITEMS[data.itemId];
    if (!itemDef) return;

    const quantity = data.quantity ?? 1;
    const totalCost = itemDef.goldValue * quantity;
    if (player.gold < totalCost) {
      this.sendError(client, "Not enough gold");
      return;
    }

    if (
      this.inventorySystem.addItem(player, data.itemId, quantity, (msg) =>
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

    const quantity = data.quantity ?? 1;
    const sellValue = Math.floor(itemDef.goldValue * 0.5) * quantity;

    if (this.inventorySystem.removeItem(player, data.itemId, quantity)) {
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

    const chatMsg = data.message.trim().slice(0, 100);
    const safeText = chatMsg.replace(/[<>]/g, "").trim();
    if (safeText.length === 0) return;

    const safePlayerName = player.name.replace(/[\[\]]/g, "");

    if (safeText.startsWith("/w ") || safeText.startsWith("/whisper ")) {
      const parts = safeText.split(" ");
      if (parts.length < 3) {
        this.sendError(client, "Usage: /w <name> <message>");
        return;
      }
      const targetName = parts[1];
      const whisperMsg = parts.slice(2).join(" ");
      const targetClient = this.findClientByName(targetName);

      if (!targetClient) {
        this.sendError(client, `Player '${targetName}' not found or offline.`);
        return;
      }

      const whisperData: ServerMessages[ServerMessageType.Chat] = {
        senderId: player.sessionId,
        senderName: `[To: ${targetName}]`,
        message: whisperMsg,
        channel: "whisper" as const,
      };

      client.send(ServerMessageType.Chat, whisperData);
      targetClient.send(ServerMessageType.Chat, {
        ...whisperData,
        senderName: `[From: ${safePlayerName}]`,
      });
      return;
    }

    this.broadcast(ServerMessageType.Chat, {
      senderId: player.sessionId,
      senderName: safePlayerName,
      message: safeText,
      channel: "global",
    });
  }

  handleFriendRequest(
    client: Client,
    data: ClientMessages[ClientMessageType.FriendRequest],
  ): void {
    this.friends.handleFriendRequest(client, data.targetName);
  }

  handleFriendAccept(
    client: Client,
    data: ClientMessages[ClientMessageType.FriendAccept],
  ): void {
    this.friends.handleFriendAccept(client, data.requesterId);
  }

  handlePartyInvite(
    client: Client,
    data: ClientMessages[ClientMessageType.PartyInvite],
  ): void {
    this.social.handleInvite(client, data.targetSessionId);
  }

  handlePartyAccept(
    client: Client,
    data: ClientMessages[ClientMessageType.PartyAccept],
  ): void {
    this.social.handleAcceptInvite(client, data.partyId);
  }

  handlePartyLeave(client: Client): void {
    this.social.handleLeaveParty(client);
  }

  handlePartyKick(
    client: Client,
    data: ClientMessages[ClientMessageType.PartyKick],
  ): void {
    this.social.handleKickPlayer(client, data.targetSessionId);
  }

  handleAudio(client: Client, data: ArrayBuffer): void {
    const player = this.getActivePlayer(client);
    if (player) {
      this.broadcast(
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
