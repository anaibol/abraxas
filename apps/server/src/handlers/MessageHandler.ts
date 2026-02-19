import {
	type ClientMessages,
	ClientMessageType,
	DIRECTION_DELTA,
	ITEMS,
	MathUtils,
	MERCHANT_INVENTORY,
	QUESTS,
	type PlayerQuestState,
	type ServerMessages,
	ServerMessageType,
	type TileMap,
	type TradeState,
	VOICE_RANGE,
} from "@abraxas/shared";
import { spiralSearch } from "../utils/spawnUtils";
import type { Client } from "@colyseus/core";
import { logger } from "../logger";
import type { GameState } from "../schema/GameState";
import type { Player } from "../schema/Player";
import type { Npc } from "../schema/Npc";
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
import type { BankSystem } from "../systems/BankSystem";

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
		bank: BankSystem;
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
	 * This allows for a clean, declarative setup in the Room class.
	 */
	registerHandlers(
		register: <T extends ClientMessageType>(
			type: T,
			handler: (client: Client, message: ClientMessages[T]) => void,
		) => void,
	) {
		register(ClientMessageType.Move, this.handleMove.bind(this));
		register(ClientMessageType.Attack, this.handleAttack.bind(this));
		register(ClientMessageType.Cast, this.handleCast.bind(this));
		register(ClientMessageType.Pickup, this.handlePickup.bind(this));
		register(ClientMessageType.DropItem, this.handleDropItem.bind(this));
		register(ClientMessageType.Equip, this.handleEquip.bind(this));
		register(ClientMessageType.Unequip, this.handleUnequip.bind(this));
		register(ClientMessageType.UseItem, this.handleUseItem.bind(this));
		register(ClientMessageType.Chat, this.handleChat.bind(this));
		register(ClientMessageType.Interact, this.handleInteract.bind(this));
		register(ClientMessageType.BuyItem, this.handleBuyItem.bind(this));
		register(ClientMessageType.SellItem, this.handleSellItem.bind(this));
		register(ClientMessageType.PartyInvite, this.handlePartyInvite.bind(this));
		register(ClientMessageType.PartyAccept, this.handlePartyAccept.bind(this));
		register(ClientMessageType.PartyLeave, this.handlePartyLeave.bind(this));
		register(ClientMessageType.PartyKick, this.handlePartyKick.bind(this));
		register(ClientMessageType.FriendRequest, this.handleFriendRequest.bind(this));
		register(ClientMessageType.FriendAccept, this.handleFriendAccept.bind(this));
		register(ClientMessageType.QuestAccept, this.handleQuestAccept.bind(this));
		register(ClientMessageType.QuestComplete, this.handleQuestComplete.bind(this));
		register(ClientMessageType.Audio, this.handleAudio.bind(this));

		// Trading
		register(ClientMessageType.TradeRequest, this.handleTradeRequest.bind(this));
		register(ClientMessageType.TradeAccept, this.handleTradeAccept.bind(this));
		register(ClientMessageType.TradeOfferUpdate, this.handleTradeOfferUpdate.bind(this));
		register(ClientMessageType.TradeConfirm, this.handleTradeConfirm.bind(this));
		register(ClientMessageType.TradeCancel, this.handleTradeCancel.bind(this));

		// Bank
		register(ClientMessageType.BankDeposit, this.handleBankDeposit.bind(this));
		register(ClientMessageType.BankWithdraw, this.handleBankWithdraw.bind(this));
		register(ClientMessageType.BankClose, this.handleBankClose.bind(this));

		register(ClientMessageType.Meditate, this.handleMeditate.bind(this));
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

	/** Sends a silent hint to the client (console-only, no toast). */
	private sendHint(client: Client, message: string): void {
		client.send(ServerMessageType.Error, { message, silent: true });
	}

	/** Resolves the target tile from explicit coords or falls back to the tile in front of the player. */
	private resolveTarget(
		player: Player,
		data: { targetTileX?: number; targetTileY?: number },
	): { targetX: number; targetY: number } {
		if (data.targetTileX !== undefined && data.targetTileY !== undefined) {
			return { targetX: data.targetTileX, targetY: data.targetTileY };
		}
		const delta = DIRECTION_DELTA[player.facing];
		return { targetX: player.tileX + delta.dx, targetY: player.tileY + delta.dy };
	}

	/**
	 * Returns true if `a` is within `range` tiles of `b` (Manhattan distance).
	 * Sends an error to the client and returns false if not.
	 */
	private assertInRange(
		client: Client,
		a: { tileX: number; tileY: number },
		b: { tileX: number; tileY: number },
		range: number,
		errorKey: string,
	): boolean {
		const dist = MathUtils.manhattanDist(
			{ x: a.tileX, y: a.tileY },
			{ x: b.tileX, y: b.tileY },
		);
		if (dist > range) {
			this.sendHint(client, errorKey);
			return false;
		}
		return true;
	}

	/** Sends quest update notifications for a set of updated quest states. */
	sendQuestUpdates(client: Client, updatedQuests: PlayerQuestState[]): void {
		for (const quest of updatedQuests) {
			client.send(ServerMessageType.QuestUpdate, { quest });
			if (quest.status === "COMPLETED") {
				client.send(ServerMessageType.Notification, {
					message: "quest.completed",
					templateData: {
						title: QUESTS[quest.questId].title,
						exp: QUESTS[quest.questId].rewards.exp,
						gold: QUESTS[quest.questId].rewards.gold,
					},
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

		if (result.success) {
			if (player.meditating) {
				player.meditating = false;
			}
			if (result.warp) {
				client.send(ServerMessageType.Warp, {
					targetMap: result.warp.targetMap,
					targetX: result.warp.targetX,
					targetY: result.warp.targetY,
				});
			}
		}
	}

	handleMeditate(client: Client): void {
		const player = this.getActivePlayer(client);
		if (!player) return;
		if (player.stunned) return;
		player.meditating = !player.meditating;
	}

	handleAttack(
		client: Client,
		data: ClientMessages[ClientMessageType.Attack],
	): void {
		const player = this.getActivePlayer(client);
		if (!player) return;
		const { targetX, targetY } = this.resolveTarget(player, data);
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
		const { targetX, targetY } = this.resolveTarget(player, data);
		this.ctx.systems.combat.tryCast(
			player,
			data.abilityId,
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
					message: "game.gold_picked_up",
					templateData: { name: player.name, amount: drop.goldAmount },
				});
			} else {
				const itemName = ITEMS[drop.itemId]?.name ?? drop.itemId;
				this.ctx.broadcast(ServerMessageType.Notification, {
					message: "game.item_picked_up",
					templateData: { name: player.name, item: itemName },
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
			// Find the nearest tile that isn't already occupied by another drop
			const tile =
				spiralSearch(player.tileX, player.tileY, 20, (x, y) => {
					if (
						x < 0 ||
						x >= this.ctx.map.width ||
						y < 0 ||
						y >= this.ctx.map.height
					)
						return false;
					if (this.ctx.map.collision[y]?.[x] === 1) return false;
					for (const drop of this.ctx.state.drops.values()) {
						if (drop.tileX === x && drop.tileY === y) return false;
					}
					return true;
				}) ?? { x: player.tileX, y: player.tileY };

			this.ctx.systems.drops.spawnItemDrop(
				this.ctx.state.drops,
				tile.x,
				tile.y,
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

		if (!this.assertInRange(client, player, npc, 3, "game.too_far")) return;

		this.ctx.systems.quests
			.updateProgress(player.dbId, "talk", npc.type, 1)
			.then((updatedQuests) => this.sendQuestUpdates(client, updatedQuests));

		if (npc.type === "merchant") {
			this.openShop(client, npc);
		} else if (npc.type === "banker") {
			this.openBank(client);
		} else {
			this.openDialogue(client, player, npc);
		}
	}

	private openShop(client: Client, npc: Npc) {
		const inventory = MERCHANT_INVENTORY.general_store ?? [];
		client.send(ServerMessageType.OpenShop, { npcId: npc.sessionId, inventory });
	}

	private openDialogue(client: Client, player: Player, npc: Npc) {
		const dialogue = this.ctx.systems.quests.getDialogueOptions(
			player.dbId,
			npc.sessionId,
			npc.type,
		);
		client.send(ServerMessageType.OpenDialogue, { npcId: npc.sessionId, ...dialogue });
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
				this.sendError(client, "game.quest_failed_accept");
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
		if (questDef && !this.isNearNpcType(player, questDef.npcId)) {
			this.sendHint(client, "game.quest_near_npc");
			return;
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

					const state = this.ctx.systems.quests.getQuestState(
						player.dbId,
						data.questId,
					);
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
				this.sendError(client, "game.quest_failed_complete");
			});
	}

	/** Returns true if the player is within `range` Manhattan tiles of any living NPC with the given type. */
	private isNearNpcType(
		player: Player,
		npcType: string,
		range = 3,
	): boolean {
		return Array.from(this.ctx.state.npcs.values()).some(
			(n) =>
				n.type === npcType &&
				n.alive &&
				MathUtils.manhattanDist(
					{ x: player.tileX, y: player.tileY },
					{ x: n.tileX, y: n.tileY },
				) <= range,
		);
	}

	handleBuyItem(
		client: Client,
		data: ClientMessages[ClientMessageType.BuyItem],
	): void {
		const player = this.getActivePlayer(client);
		if (!player) return;

		if (!this.isNearNpcType(player, "merchant")) {
			this.sendHint(client, "game.too_far_merchant");
			return;
		}

		// Validate item is actually sold by this merchant
		const merchantStock = MERCHANT_INVENTORY.general_store ?? [];
		if (!merchantStock.includes(data.itemId)) {
			this.sendError(client, "game.not_available");
			return;
		}

		const itemDef = ITEMS[data.itemId];
		if (!itemDef) return;

		const quantity = Math.max(1, data.quantity ?? 1);

		// Prevent bulk buying non-stackable items
		if (!itemDef.stackable && quantity > 1) {
			this.sendError(client, "game.only_buy_one");
			return;
		}

		const totalCost = itemDef.goldValue * quantity;
		if (player.gold < totalCost) {
			this.sendError(client, "game.not_enough_gold");
			return;
		}

		if (
			this.ctx.systems.inventory.addItem(player, data.itemId, quantity, (msg) =>
				this.sendError(client, msg),
			)
		) {
			player.gold -= totalCost;
			client.send(ServerMessageType.Notification, {
				message: "game.bought_item",
				templateData: { quantity, item: itemDef.name },
			});
		}
	}

	handleSellItem(
		client: Client,
		data: ClientMessages[ClientMessageType.SellItem],
	): void {
		const player = this.getActivePlayer(client);
		if (!player) return;

		if (!this.isNearNpcType(player, "merchant")) {
			this.sendHint(client, "game.too_far_merchant");
			return;
		}

		const itemDef = ITEMS[data.itemId];
		if (!itemDef) return;

		// Cap quantity to what the player actually has in inventory
		const slot = player.inventory.find((s) => s.itemId === data.itemId);
		if (!slot) {
			this.sendError(client, "game.item_not_found");
			return;
		}
		const quantity = Math.min(data.quantity ?? 1, slot.quantity);
		if (quantity <= 0) return;

		const sellValue = Math.floor(itemDef.goldValue * 0.5) * quantity;

		if (this.ctx.systems.inventory.removeItem(player, data.itemId, quantity)) {
			player.gold += sellValue;
			client.send(ServerMessageType.Notification, {
				message: "game.sold_item",
				templateData: { quantity, item: itemDef.name, gold: sellValue },
			});
		} else {
			this.sendError(client, "game.item_not_found");
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
		const speaker = this.getActivePlayer(client);
		if (!speaker) return;

		for (const [sessionId, player] of this.ctx.state.players) {
			if (sessionId === client.sessionId) continue;
			if (MathUtils.dist(speaker.getPosition(), player.getPosition()) > VOICE_RANGE) continue;

			const target = this.ctx.findClientBySessionId(sessionId);
			target?.send(ServerMessageType.Audio, { sessionId: client.sessionId, data });
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

		if (!this.assertInRange(client, player, target, 3, "game.too_far_trade")) return;

		this.ctx.systems.trade.handleRequest(player, target, (sid, type, msg) => {
			this.ctx.findClientBySessionId(sid)?.send(type, msg);
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
			const rClient = this.ctx.findClientBySessionId(requester.sessionId);
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
			this.sendError(client, "game.trade_failed_accept");
		}
	}

	private sendToParticipants(
		trade: TradeState,
		type: ServerMessageType,
		data: unknown,
	) {
		this.ctx.findClientBySessionId(trade.alice.sessionId)?.send(type, data);
		this.ctx.findClientBySessionId(trade.bob.sessionId)?.send(type, data);
	}

	handleTradeOfferUpdate(
		client: Client,
		data: ClientMessages[ClientMessageType.TradeOfferUpdate],
	): void {
		const player = this.getActivePlayer(client);
		if (!player) return;

		const trade = this.ctx.systems.trade.updateOffer(client.sessionId, data);
		if (trade) {
			this.sendToParticipants(trade, ServerMessageType.TradeStateUpdate, trade);
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
								reason: "game.trade_failed_validation",
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
				reason: "game.trade_cancelled_by_player",
			});
		}
	}

	// ── Bank Handlers ────────────────────────────────────────────────────────

	private async openBank(client: Client) {
		const player = this.getActivePlayer(client);
		if (!player) return;

		const items = await this.ctx.systems.bank.openBank(player);
		client.send(ServerMessageType.BankOpened, {});
		client.send(ServerMessageType.BankSync, { items });
	}

	private handleBankDeposit(
		client: Client,
		data: ClientMessages[ClientMessageType.BankDeposit],
	) {
		const player = this.getActivePlayer(client);
		if (!player) return;

		if (
			this.ctx.systems.bank.deposit(
				player,
				data.itemId,
				data.quantity,
				data.slotIndex,
				(msg: string) => this.sendError(client, msg),
			)
		) {
			this.syncBank(client, player);
		}
	}

	private handleBankWithdraw(
		client: Client,
		data: ClientMessages[ClientMessageType.BankWithdraw],
	) {
		const player = this.getActivePlayer(client);
		if (!player) return;

		if (
			this.ctx.systems.bank.withdraw(
				player,
				data.itemId,
				data.quantity,
				data.bankSlotIndex,
				(msg: string) => this.sendError(client, msg),
			)
		) {
			this.syncBank(client, player);
		}
	}

	private handleBankClose(client: Client) {
		const player = this.getActivePlayer(client);
		if (!player) return;

		this.ctx.systems.bank.closeBank(player);
	}

	private async syncBank(client: Client, player: Player) {
		const items = await this.ctx.systems.bank.openBank(player);
		client.send(ServerMessageType.BankSync, { items });
	}
}
