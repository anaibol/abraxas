import {
	type ClientMessages,
	ClientMessageType,
	DIRECTION_DELTA,
	ITEMS,
	MathUtils,
	MERCHANT_INVENTORY,
	QUESTS,
	type ServerMessages,
	ServerMessageType,
	type TileMap,
	type TradeState,
} from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { logger } from "../logger";
import type { GameState } from "../schema/GameState";
import type { Player } from "../schema/Player";
import type { ChatService } from "../services/ChatService";
import type { LevelService } from "../services/LevelService";
import type { CombatSystem } from "../systems/CombatSystem";
import type { DropSystem } from "../systems/DropSystem";
import type { FriendsSystem } from "../systems/FriendsSystem";
import type { InventorySystem } from "../systems/InventorySystem";
import type { MovementSystem } from "../systems/MovementSystem";
import type { QuestSystem } from "../systems/QuestSystem";
import type { SocialSystem } from "../systems/SocialSystem";
import type { TradeSystem } from "../systems/TradeSystem";

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
		trade: TradeSystem;
	};
	services: {
		chat: ChatService;
		level: LevelService;
	};
	broadcast: BroadcastCallback;
	isTileOccupied: (x: number, y: number, excludeId: string) => boolean;
	findClientByName: (name: string) => Client | undefined;
	findClientBySessionId: (sessionId: string) => Client | undefined;
}

export class MessageHandler {
	constructor(private ctx: RoomContext) {}

	/**
   * Registers all message handlers with the room.
  /**
   * Registers all message handlers with the room.
   * This allows for a clean, declarative setup in the Room class.
   */
	registerHandlers(
		register: <T extends ClientMessageType>(
			type: T,
			handler: (client: Client, message: ClientMessages[T]) => void,
		) => void,
	) {
		register(ClientMessageType.Move, (c, d) => this.handleMove(c, d));
		register(ClientMessageType.Attack, (c, d) => this.handleAttack(c, d));
		register(ClientMessageType.Cast, (c, d) => this.handleCast(c, d));
		register(ClientMessageType.Pickup, (c, d) => this.handlePickup(c, d));
		register(ClientMessageType.DropItem, (c, d) => this.handleDropItem(c, d));
		register(ClientMessageType.Equip, (c, d) => this.handleEquip(c, d));
		register(ClientMessageType.Unequip, (c, d) => this.handleUnequip(c, d));
		register(ClientMessageType.UseItem, (c, d) => this.handleUseItem(c, d));
		register(ClientMessageType.Chat, (c, d) => this.handleChat(c, d));
		register(ClientMessageType.Interact, (c, d) => this.handleInteract(c, d));
		register(ClientMessageType.BuyItem, (c, d) => this.handleBuyItem(c, d));
		register(ClientMessageType.SellItem, (c, d) => this.handleSellItem(c, d));
		register(ClientMessageType.PartyInvite, (c, d) =>
			this.handlePartyInvite(c, d),
		);
		register(ClientMessageType.PartyAccept, (c, d) =>
			this.handlePartyAccept(c, d),
		);
		register(ClientMessageType.PartyLeave, (c) => this.handlePartyLeave(c));
		register(ClientMessageType.PartyKick, (c, d) => this.handlePartyKick(c, d));
		register(ClientMessageType.FriendRequest, (c, d) =>
			this.handleFriendRequest(c, d),
		);
		register(ClientMessageType.FriendAccept, (c, d) =>
			this.handleFriendAccept(c, d),
		);
		register(ClientMessageType.QuestAccept, (c, d) =>
			this.handleQuestAccept(c, d),
		);
		register(ClientMessageType.QuestComplete, (c, d) =>
			this.handleQuestComplete(c, d),
		);
		register(ClientMessageType.Audio, (c, d) => this.handleAudio(c, d));

		// Trading
		register(ClientMessageType.TradeRequest, (c, d) =>
			this.handleTradeRequest(c, d),
		);
		register(ClientMessageType.TradeAccept, (c, d) =>
			this.handleTradeAccept(c, d),
		);
		register(ClientMessageType.TradeOfferUpdate, (c, d) =>
			this.handleTradeOfferUpdate(c, d),
		);
		register(ClientMessageType.TradeConfirm, (c) => this.handleTradeConfirm(c));
		register(ClientMessageType.TradeCancel, (c) => this.handleTradeCancel(c));
	}

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

	handleMove(
		client: Client,
		data: ClientMessages[ClientMessageType.Move],
	): void {
		const player = this.getActivePlayer(client);
		if (!player) return;
		if (player.stunned) return;

		const result = this.ctx.systems.movement.tryMove(
			player,
			data.direction,
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

		let targetX = data.targetTileX;
		let targetY = data.targetTileY;

		if (targetX === undefined || targetY === undefined) {
			const delta = DIRECTION_DELTA[player.facing];
			targetX = player.tileX + delta.dx;
			targetY = player.tileY + delta.dy;
		}

		this.ctx.systems.combat.tryAttack(
			player,
			targetX,
			targetY,
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

		let targetX = data.targetTileX;
		let targetY = data.targetTileY;

		if (targetX === undefined || targetY === undefined) {
			const delta = DIRECTION_DELTA[player.facing];
			targetX = player.tileX + delta.dx;
			targetY = player.tileY + delta.dy;
		}

		this.ctx.systems.combat.tryCast(
			player,
			data.spellId,
			targetX,
			targetY,
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
			this.ctx.systems.drops.spawnItemDrop(
				this.ctx.state.drops,
				player.tileX,
				player.tileY,
				data.itemId,
				qty,
			);
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

		const availableQuests = this.ctx.systems.quests.getAvailableQuests(
			player.dbId,
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

		for (const state of this.ctx.systems.quests.getCharQuestStates(
			player.dbId,
		)) {
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
				logger.error({
					message: `Failed to accept quest ${data.questId} for ${player.name}`,
					error: String(err),
				});
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
				this.sendError(
					client,
					"You must be near the quest NPC to complete this quest",
				);
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
							this.ctx.systems.inventory.addItem(
								player,
								item.itemId,
								item.quantity,
							);
						}
					}

					client.send(ServerMessageType.QuestUpdate, {
						// biome-ignore lint/style/noNonNullAssertion: quest exists because QuestAccept only fires for accepted quests
						quest: this.ctx.systems.quests.getQuestState(
							player.dbId,
							data.questId,
						)!,
					});
					client.send(ServerMessageType.Notification, {
						message: `Quest Completed: ${questDef.title} (+${questDef.rewards.exp} XP, +${questDef.rewards.gold} Gold)`,
					});
				}
			})
			.catch((err) => {
				logger.error({
					message: `Failed to complete quest ${data.questId} for ${player.name}`,
					error: String(err),
				});
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

	// ── Trading ─────────────────────────────────────────────────────────────

	handleTradeRequest(
		client: Client,
		data: ClientMessages[ClientMessageType.TradeRequest],
	): void {
		const player = this.getActivePlayer(client);
		const target = this.ctx.state.players.get(data.targetSessionId);
		if (!player || !target || !target.alive) return;

		const dist =
			Math.abs(player.tileX - target.tileX) +
			Math.abs(player.tileY - target.tileY);
		if (dist > 3) {
			this.sendError(client, "Target too far to trade");
			return;
		}

		this.ctx.systems.trade.handleRequest(player, target, (sid, type, msg) => {
			const found = this.findClient(sid);
			found?.send(type, msg);
		});
	}

	handleTradeAccept(
		client: Client,
		data: ClientMessages[ClientMessageType.TradeAccept],
	): void {
		const player = this.getActivePlayer(client);
		const requester = this.ctx.state.players.get(data.requesterSessionId);
		if (!player || !requester || !requester.alive) return;

		const trade = this.ctx.systems.trade.handleAccept(requester, player);
		if (trade) {
			const rClient = this.findClient(requester.sessionId);
			rClient?.send(ServerMessageType.TradeStarted, {
				targetSessionId: player.sessionId,
				targetName: player.name,
			});
			client.send(ServerMessageType.TradeStarted, {
				targetSessionId: requester.sessionId,
				targetName: requester.name,
			});

			this.sendToParticipants(trade, ServerMessageType.TradeStateUpdate, trade);
		} else {
			this.sendError(
				client,
				"Failed to accept trade. Participant might be busy.",
			);
		}
	}

	private sendToParticipants(
		trade: TradeState,
		type: ServerMessageType,
		data: unknown,
	) {
		const a = this.findClient(trade.alice.sessionId);
		const b = this.findClient(trade.bob.sessionId);
		a?.send(type, data);
		b?.send(type, data);
	}

	handleTradeOfferUpdate(
		client: Client,
		data: ClientMessages[ClientMessageType.TradeOfferUpdate],
	): void {
		const player = this.getActivePlayer(client);
		if (!player) return;

		const trade = this.ctx.systems.trade.updateOffer(client.sessionId, data);
		if (trade) {
			this.ctx.broadcast(ServerMessageType.TradeStateUpdate, trade);
		}
	}

	handleTradeConfirm(client: Client): void {
		const player = this.getActivePlayer(client);
		if (!player) return;

		const trade = this.ctx.systems.trade.confirm(client.sessionId);
		if (trade) {
			this.sendToParticipants(trade, ServerMessageType.TradeStateUpdate, trade);

			if (this.ctx.systems.trade.canComplete(trade)) {
				this.ctx.systems.trade
					.executeTrade(trade, this.ctx.state.players)
					.then((success) => {
						if (success) {
							this.sendToParticipants(
								trade,
								ServerMessageType.TradeCompleted,
								{},
							);
						} else {
							this.sendToParticipants(trade, ServerMessageType.TradeCancelled, {
								reason:
									"Trade validation failed (inventory full or items missing)",
							});
						}
					});
			}
		}
	}

	handleTradeCancel(client: Client): void {
		const trade = this.ctx.systems.trade.cancel(client.sessionId);
		if (trade) {
			this.sendToParticipants(trade, ServerMessageType.TradeCancelled, {
				reason: "Trade cancelled",
			});
		}
	}

	private findClient(sessionId: string): Client | undefined {
		return this.ctx.findClientBySessionId(sessionId);
	}
}
