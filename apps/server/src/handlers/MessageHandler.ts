import { Client } from "@colyseus/core";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { Npc } from "../schema/Npc";
import { MovementSystem } from "../systems/MovementSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { DropSystem } from "../systems/DropSystem";
import { SocialSystem } from "../systems/SocialSystem";
import { FriendsSystem } from "../systems/FriendsSystem";
import { TileMap, Direction, EquipmentSlot, ITEMS, MERCHANT_INVENTORY, QUESTS, ServerMessages, QuestDef, ServerMessageType, ClientMessageType, ClientMessages } from "@abraxas/shared";
import { QuestSystem } from "../systems/QuestSystem";

type Entity = Player | Npc;

type BroadcastCallback = <T extends ServerMessageType>(
  type: T, 
  message?: ServerMessages[T], 
  options?: { except?: Client }
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
        private isTileOccupied: (x: number, y: number, excludeId: string) => boolean,
        private findClientByName: (name: string) => Client | undefined,
        private quests: QuestSystem,
        private gainXp: (player: Player, amount: number) => void
    ) {}

    handleMove(client: Client, direction: Direction): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        if (player.stunned) return;

        if (this.movement.tryMove(
            player,
            direction,
            this.map,
            Date.now(),
            this.isTileOccupied,
            this.state.tick,
            this.roomId
        )) {
            // Check for warps
            const warp = this.map.warps?.find(w => w.x === player.tileX && w.y === player.tileY);
            if (warp) {
                client.send(ServerMessageType.Warp, {
                    targetMap: warp.targetMap,
                    targetX: warp.targetX,
                    targetY: warp.targetY
                });
            }
        }
    }

    handleAttack(client: Client, targetTileX?: number, targetTileY?: number): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
    
        this.combat.tryAttack(
            player,
            Date.now(),
            this.broadcast,
            this.state.tick,
            this.roomId,
            targetTileX,
            targetTileY,
            (type, data) => {
                if (type === "error") {
                    client.send(ServerMessageType.Error, data ?? {});
                } else if (type === "attack_hit") {
                    const { target, dodged } = data;
                    this.broadcast(ServerMessageType.AttackHit, {
                        sessionId: player.sessionId,
                        targetSessionId: target?.sessionId,
                        dodged
                    });
    
                    if (target && !dodged && data.damage) {
                        this.broadcast(ServerMessageType.Damage, {
                            targetSessionId: target.sessionId,
                            amount: data.damage,
                            hpAfter: target.hp,
                            type: "physical"
                        });
                    }
                }
            },
        );
    }

    handleCast(client: Client, data: ClientMessages[ClientMessageType.Cast]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
    
        this.combat.tryCast(
            player,
            data.spellId,
            data.targetTileX,
            data.targetTileY,
            Date.now(),
            this.broadcast,
            this.state.tick,
            this.roomId,
            (type, payload) => {
                if (type === "error") {
                    client.send(ServerMessageType.Error, payload ?? {});
                } else if (type === "cast_start") {
                    this.broadcast(ServerMessageType.CastStart, payload);
                } else if (type === "cast_hit") {
                    this.broadcast(ServerMessageType.CastHit, payload);
                    if (payload.damage) {
                        this.broadcast(ServerMessageType.Damage, {
                            targetSessionId: payload.targetSessionId,
                            amount: payload.damage,
                            hpAfter: payload.hpAfter,
                            type: "magic"
                        });
                    }
                    if (payload.heal) {
                        this.broadcast(ServerMessageType.Heal, {
                            sessionId: payload.targetSessionId, // or healer?
                            amount: payload.heal,
                            hpAfter: payload.hpAfter
                        });
                    }
                }
            },
        );
    }

    handlePickup(client: Client, dropId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
    
        const drop = this.state.drops.get(dropId);
        if (drop && this.drops.pickup(player, dropId, (msg) => client.send(ServerMessageType.Error, { message: msg }))) {
            if (drop.type === "gold") {
                this.broadcast(ServerMessageType.Notification, { message: `${player.name} picked up ${drop.amount} gold` });
            } else {
                this.broadcast(ServerMessageType.Notification, { message: `${player.name} picked up ${drop.itemId}` });
                
                // Quest Progress: Collect
                this.quests.updateProgress(player.userId, player.dbId, "collect", drop.itemId, drop.amount).then(updatedQuests => {
                    for (const quest of updatedQuests) {
                        client.send(ServerMessageType.QuestUpdate, { quest });
                        if (quest.status === "completed") {
                            client.send(ServerMessageType.Notification, { message: `Quest Completed: ${QUESTS[quest.questId].title}` });
                        }
                    }
                });
            }
        }
    }

    handleEquip(client: Client, itemId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        this.inventorySystem.equipItem(player, itemId, (msg) => client.send(ServerMessageType.Error, { message: msg }));
    }
    
    handleUnequip(client: Client, slot: EquipmentSlot): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        this.inventorySystem.unequipItem(player, slot, (msg) => client.send(ServerMessageType.Error, { message: msg }));
    }
    
    handleUseItem(client: Client, itemId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        if (this.inventorySystem.useItem(player, itemId, (msg) => client.send(ServerMessageType.Error, { message: msg }))) {
            this.broadcast(ServerMessageType.ItemUsed, {
                sessionId: client.sessionId,
                itemId,
            });
        }
    }
    
    handleDropItem(client: Client, itemId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        if (this.inventorySystem.removeItem(player, itemId)) {
            this.drops.spawnDrop(player.tileX, player.tileY, "item", { itemId, amount: 1 });
        }
    }

    handleInteract(client: Client, npcId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

        const npc = this.state.npcs.get(npcId);
        if (!npc) return;

        // Proximity check
        const dist = Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileY - npc.tileY);
        if (dist > 3) {
            client.send(ServerMessageType.Error, { message: "Too far to interact" });
            return;
        }
        
        // Quest Progress: Talk
        this.quests.updateProgress(player.userId, player.dbId, "talk", npc.type, 1).then(updatedQuests => {
            for (const quest of updatedQuests) {
                client.send(ServerMessageType.QuestUpdate, { quest });
                if (quest.status === "completed") {
                    client.send(ServerMessageType.Notification, { message: `Quest Completed: ${QUESTS[quest.questId].title}` });
                }
            }
        });

        if (npc.type === "merchant") {
            const inventory = MERCHANT_INVENTORY.general_store || [];
            client.send(ServerMessageType.OpenShop, { npcId, inventory });
            return;
        }

        // Check for quests
        const availableQuests = this.quests.getAvailableQuests(player.userId, npc.type);
        if (availableQuests.length > 0) {
            const questId = availableQuests[0];
            const questDef = QUESTS[questId];
            client.send(ServerMessageType.OpenDialogue, {
                npcId,
                text: `${questDef.description}\n\nDo you accept this quest?`,
                options: [
                    { text: "Accept Quest", action: "quest_accept", data: { questId } },
                    { text: "Maybe later", action: "close" }
                ]
            });
            return;
        }

        // Check for completed quests to turn in
        for (const questId of Object.keys(QUESTS)) {
            const state = this.quests.getQuestState(player.userId, questId);
            if (state && state.status === "completed") {
                const questDef = QUESTS[questId];
                if (questDef.npcId === npc.type) {
                    client.send(ServerMessageType.OpenDialogue, {
                        npcId,
                        text: `Great job on ${questDef.title}! Here is your reward.`,
                        options: [
                            { text: "Complete Quest", action: "quest_complete", data: { questId } }
                        ]
                    });
                    return;
                }
            }
        }

        // Default talk
        client.send(ServerMessageType.OpenDialogue, {
            npcId,
            text: "Hello there, traveler!",
            options: [{ text: "Goodbye", action: "close" }]
        });
    }

    handleQuestAccept(client: Client, questId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        this.quests.acceptQuest(player.userId, player.dbId, questId).then(state => {
            if (state) {
                client.send(ServerMessageType.QuestUpdate, { quest: state });
                client.send(ServerMessageType.Notification, { message: `Quest Accepted: ${QUESTS[questId].title}` });
            }
        });
    }

    handleQuestComplete(client: Client, questId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        this.quests.completeQuest(player.userId, player.dbId, questId).then(questDef => {
            if (questDef) {
                // Grant rewards
                this.gainXp(player, questDef.rewards.exp);
                player.gold += questDef.rewards.gold;
                
                if (questDef.rewards.items) {
                    for (const item of questDef.rewards.items) {
                        this.inventorySystem.addItem(player, item.itemId, item.quantity);
                    }
                }

                client.send(ServerMessageType.QuestUpdate, { 
                    quest: this.quests.getQuestState(player.userId, questId)! 
                });
                client.send(ServerMessageType.Notification, { message: `Quest Completed: ${questDef.title} (+${questDef.rewards.exp} XP, +${questDef.rewards.gold} Gold)` });
                
                // Trigger any level up logic if needed (usually handled in tick/reward handlers, 
                // but xp was added directly here. handleNpcKillRewards does it better, maybe refactor later)
            }
        });
    }

    handleBuyItem(client: Client, data: { itemId: string; quantity: number; npcId?: string }): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

        // Proximity check if npcId provided
        if (data.npcId) {
            const npc = this.state.npcs.get(data.npcId);
            if (npc) {
                const dist = Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileY - npc.tileY);
                if (dist > 5) {
                    client.send(ServerMessageType.Error, { message: "Too far from merchant" });
                    return;
                }
            }
        }

        const itemDef = ITEMS[data.itemId];
        if (!itemDef) return;

        const totalCost = itemDef.goldValue * (data.quantity || 1);
        if (player.gold < totalCost) {
            client.send(ServerMessageType.Error, { message: "Not enough gold" });
            return;
        }

        if (this.inventorySystem.addItem(player, data.itemId, data.quantity || 1, (msg) => client.send(ServerMessageType.Error, { message: msg }))) {
            player.gold -= totalCost;
            client.send(ServerMessageType.Notification, { message: `Bought ${data.quantity || 1}x ${itemDef.name}` });
        }
    }

    handleSellItem(client: Client, data: { itemId: string; quantity: number; npcId?: string }): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

        // Proximity check if npcId provided
        if (data.npcId) {
            const npc = this.state.npcs.get(data.npcId);
            if (npc) {
                const dist = Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileY - npc.tileY);
                if (dist > 5) {
                    client.send(ServerMessageType.Error, { message: "Too far from merchant" });
                    return;
                }
            }
        }

        const itemDef = ITEMS[data.itemId];
        if (!itemDef) return;

        // Base sell value is 50% of buy value
        const sellValue = Math.floor(itemDef.goldValue * 0.5) * (data.quantity || 1);
        
        if (this.inventorySystem.removeItem(player, data.itemId, data.quantity || 1)) {
            player.gold += sellValue;
            client.send(ServerMessageType.Notification, { message: `Sold ${data.quantity || 1}x ${itemDef.name} for ${sellValue} gold` });
        } else {
            client.send(ServerMessageType.Error, { message: "Item not found in inventory" });
        }
    }

    handleChat(client: Client, message: string): void {
        if (message.startsWith("/party ") || message.startsWith("/p ")) {
            const prefix = message.startsWith("/p ") ? "/p " : "/party ";
            const partyMsg = message.replace(prefix, "");
            const player = this.state.players.get(client.sessionId);
            if (player && partyMsg) {
                if (!player.partyId) {
                    client.send(ServerMessageType.Error, { message: "You are not in a party" });
                    return;
                }
                this.social.broadcastToParty(player.partyId, ServerMessageType.Chat, {
                    senderId: player.sessionId,
                    senderName: player.name,
                    message: partyMsg,
                    channel: "party" as const
                });
            }
            return;
        }

        const player = this.state.players.get(client.sessionId);
        if (player && message) {
            const text = message.trim().slice(0, 100);
            if (text.length > 0) {
                // Whisper support: /w name message
                if (text.startsWith("/w ") || text.startsWith("/whisper ")) {
                    const parts = text.split(" ");
                    if (parts.length < 3) {
                        client.send(ServerMessageType.Error, { message: "Usage: /w <name> <message>" });
                        return;
                    }
                    const targetName = parts[1];
                    const msg = parts.slice(2).join(" ");
                    const targetClient = this.findClientByName(targetName);
                    
                    if (!targetClient) {
                        client.send(ServerMessageType.Error, { message: `Player '${targetName}' not found or offline.` });
                        return;
                    }

                    const whisperData: ServerMessages[ServerMessageType.Chat] = {
                        senderId: player.sessionId,
                        senderName: `[To: ${targetName}]`,
                        message: msg,
                        channel: "whisper" as const
                    };

                    client.send(ServerMessageType.Chat, whisperData);
                    targetClient.send(ServerMessageType.Chat, {
                        ...whisperData,
                        senderName: `[From: ${player.name}]`
                    });
                    return;
                }
                }

                // Global chat
                this.broadcast("chat", {
                    senderId: player.sessionId,
                    senderName: player.name,
                    message: text,
                    channel: "global" as const
                });
            }
        }
    }

    handleFriendRequest(client: Client, targetName: string): void {
        this.friends.handleFriendRequest(client, targetName);
    }

    handleFriendAccept(client: Client, requesterId: string): void {
        this.friends.handleFriendAccept(client, requesterId);
    }


    handlePartyKick(client: Client, targetSessionId: string): void {
        this.social.handleKickPlayer(client, targetSessionId);
    }

    private broadcastToParty(partyId: string, type: string, message: any): void {
        const party = this.state.parties.get(partyId);
        if (!party) return;
        party.memberIds.forEach(sid => {
            const p = this.state.players.get(sid);
            if (p) {
                // We need to send directly to clients. MessageHandler doesn't have clients list.
                // But it has broadcast. Using broadcast with a selector? Colyseus broadcast doesn't support complex selectors in one go easily if we only have sessionId.
                // However, we can use client.send if we find the client.
                // Wait, MessageHandler should probably have a way to find clients or the search should happen in room.
                // For simplified chat, we'll let SocialSystem handle specialized broadcasts.
            }
        });
        // Let's make SocialSystem handle party chat broadcast too.
        this.social.broadcastToParty(partyId, type, message);
    }
}
