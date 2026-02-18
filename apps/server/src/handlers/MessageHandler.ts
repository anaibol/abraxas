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
import { TileMap, Direction, EquipmentSlot, ITEMS, MERCHANT_INVENTORY, QUESTS } from "@abraxas/shared";
import { ServerMessages, QuestDef } from "@abraxas/shared";
import { QuestSystem } from "../systems/QuestSystem";

type Entity = Player | Npc;

type BroadcastCallback = <T extends keyof ServerMessages>(
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
                client.send("warp", {
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
            (type, data) => client.send(type, data ?? {}),
        );
    }

    handleCast(client: Client, data: { spellId: string; targetTileX: number; targetTileY: number }): void {
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
            (type, data) => client.send(type, data ?? {}),
        );
    }

    handlePickup(client: Client, dropId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
    
        this.drops.tryPickup(
            player,
            dropId,
            this.state.drops,
            this.roomId,
            this.state.tick,
            (msg) => client.send("error", { message: msg })
        );
    }

    handleEquip(client: Client, itemId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        this.inventorySystem.equipItem(player, itemId, (msg) => client.send("error", { message: msg }));
    }
    
    handleUnequip(client: Client, slot: EquipmentSlot): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        this.inventorySystem.unequipItem(player, slot, (msg) => client.send("error", { message: msg }));
    }
    
    handleUseItem(client: Client, itemId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        if (this.inventorySystem.useItem(player, itemId, (msg) => client.send("error", { message: msg }))) {
            this.broadcast("item_used", {
                sessionId: client.sessionId,
                itemId,
            });
        }
    }
    
    handleDropItem(client: Client, itemId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        if (this.inventorySystem.removeItem(player, itemId)) {
            this.drops.spawnItemDrop(
                this.state.drops,
                player.tileX,
                player.tileY,
                itemId,
                1,
                this.roomId,
                this.state.tick
            );
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
            client.send("error", { message: "Too far to interact" });
            return;
        }
        
        // Quest Progress: Talk
        this.quests.updateProgress(player.userId, player.dbId, "talk", npc.type, 1).then(updatedQuests => {
            for (const quest of updatedQuests) {
                client.send("quest_update", { quest });
                if (quest.status === "completed") {
                    client.send("notification", { message: `Quest Completed: ${QUESTS[quest.questId].title}` });
                }
            }
        });

        if (npc.type === "merchant") {
            const inventory = MERCHANT_INVENTORY.general_store || [];
            client.send("open_shop", { npcId, inventory });
            return;
        }

        // Check for quests
        const availableQuests = this.quests.getAvailableQuests(player.userId, npc.type);
        if (availableQuests.length > 0) {
            const questId = availableQuests[0];
            const questDef = QUESTS[questId];
            client.send("open_dialogue", {
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
                    client.send("open_dialogue", {
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
        client.send("open_dialogue", {
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
                client.send("quest_update", { quest: state });
                client.send("notification", { message: `Quest Accepted: ${QUESTS[questId].title}` });
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

                client.send("quest_update", { 
                    quest: this.quests.getQuestState(player.userId, questId)! 
                });
                client.send("notification", { message: `Quest Completed: ${questDef.title} (+${questDef.rewards.exp} XP, +${questDef.rewards.gold} Gold)` });
                
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
                    client.send("error", { message: "Too far from merchant" });
                    return;
                }
            }
        }

        const itemDef = ITEMS[data.itemId];
        if (!itemDef) return;

        const totalCost = itemDef.goldValue * (data.quantity || 1);
        if (player.gold < totalCost) {
            client.send("error", { message: "Not enough gold" });
            return;
        }

        if (this.inventorySystem.addItem(player, data.itemId, data.quantity || 1, (msg) => client.send("error", { message: msg }))) {
            player.gold -= totalCost;
            client.send("notification", { message: `Bought ${data.quantity || 1}x ${itemDef.name}` });
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
                    client.send("error", { message: "Too far from merchant" });
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
            client.send("notification", { message: `Sold ${data.quantity || 1}x ${itemDef.name} for ${sellValue} gold` });
        } else {
            client.send("error", { message: "Item not found in inventory" });
        }
    }

    handleChat(client: Client, message: string): void {
        const player = this.state.players.get(client.sessionId);
        if (player && message) {
            const text = message.trim().slice(0, 100);
            if (text.length > 0) {
                // Whisper support: /w name message
                if (text.startsWith("/w ") || text.startsWith("/whisper ")) {
                    const parts = text.split(" ");
                    if (parts.length < 3) {
                        client.send("error", { message: "Usage: /w <name> <message>" });
                        return;
                    }
                    const targetName = parts[1];
                    const msg = parts.slice(2).join(" ");
                    const targetClient = this.findClientByName(targetName);
                    
                    if (!targetClient) {
                        client.send("error", { message: `Player '${targetName}' not found or offline.` });
                        return;
                    }

                    const whisperData = {
                        senderId: player.sessionId,
                        senderName: `[To: ${targetName}]`,
                        message: msg,
                        channel: "whisper" as const
                    };

                    client.send("chat", whisperData);
                    targetClient.send("chat", {
                        ...whisperData,
                        senderName: `[From: ${player.name}]`
                    });
                    return;
                }

                // Party chat support
                if (text.startsWith("/p ") || text.startsWith("/party ")) {
                    if (!player.partyId) {
                        client.send("error", { message: "You are not in a party" });
                        return;
                    }
                    const msg = text.startsWith("/p ") ? text.slice(3) : text.slice(7);
                    this.social.broadcastToParty(player.partyId, "chat", {
                        senderId: player.sessionId,
                        senderName: player.name,
                        message: msg,
                        channel: "party" as const
                    });
                    return;
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


    handlePartyInvite(client: Client, targetSessionId: string): void {
        this.social.handleInvite(client, targetSessionId);
    }

    handlePartyAccept(client: Client, partyId: string): void {
        this.social.handleAcceptInvite(client, partyId);
    }

    handlePartyLeave(client: Client): void {
        this.social.handleLeaveParty(client);
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
