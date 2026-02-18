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
    ClientMessages 
} from "@abraxas/shared";
import { QuestSystem } from "../systems/QuestSystem";

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

    handleAttack(client: Client, data: ClientMessages[ClientMessageType.Attack]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
    
        this.combat.tryAttack(
            player,
            Date.now(),
            this.broadcast,
            this.state.tick,
            this.roomId,
            data.targetTileX,
            data.targetTileY,
            (type, payload) => client.send(type, payload)
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
            (type, payload) => client.send(type, payload)
        );
    }

    handlePickup(client: Client, data: ClientMessages[ClientMessageType.Pickup]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
    
        const drop = this.state.drops.get(data.dropId);
        if (drop && this.drops.pickup(player, data.dropId, (msg) => client.send(ServerMessageType.Error, { message: msg }))) {
            if (drop.type === "gold") {
                this.broadcast(ServerMessageType.Notification, { message: `${player.name} picked up ${drop.amount} gold` });
            } else {
                this.broadcast(ServerMessageType.Notification, { message: `${player.name} picked up ${drop.itemId}` });
                
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

    handleEquip(client: Client, data: ClientMessages[ClientMessageType.Equip]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        this.inventorySystem.equipItem(player, data.itemId, (msg) => client.send(ServerMessageType.Error, { message: msg }));
    }
    
    handleUnequip(client: Client, data: ClientMessages[ClientMessageType.Unequip]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        this.inventorySystem.unequipItem(player, data.slot, (msg) => client.send(ServerMessageType.Error, { message: msg }));
    }
    
    handleUseItem(client: Client, data: ClientMessages[ClientMessageType.UseItem]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        if (this.inventorySystem.useItem(player, data.itemId, (msg) => client.send(ServerMessageType.Error, { message: msg }))) {
            this.broadcast(ServerMessageType.ItemUsed, {
                sessionId: client.sessionId,
                itemId: data.itemId,
            });
        }
    }
    
    handleDropItem(client: Client, data: ClientMessages[ClientMessageType.DropItem]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        if (this.inventorySystem.removeItem(player, data.itemId)) {
            this.drops.spawnDrop(player.tileX, player.tileY, "item", { itemId: data.itemId, amount: 1 });
        }
    }

    handleInteract(client: Client, data: ClientMessages[ClientMessageType.Interact]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

        const npc = this.state.npcs.get(data.npcId);
        if (!npc) return;

        const dist = Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileY - npc.tileY);
        if (dist > 3) {
            client.send(ServerMessageType.Error, { message: "Too far to interact" });
            return;
        }
        
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
            client.send(ServerMessageType.OpenShop, { npcId: data.npcId, inventory });
            return;
        }

        const availableQuests = this.quests.getAvailableQuests(player.userId, npc.type);
        if (availableQuests.length > 0) {
            const questId = availableQuests[0];
            const questDef = QUESTS[questId];
            client.send(ServerMessageType.OpenDialogue, {
                npcId: data.npcId,
                text: `${questDef.description}\n\nDo you accept this quest?`,
                options: [
                    { text: "Accept Quest", action: "quest_accept", data: { questId } },
                    { text: "Maybe later", action: "close" }
                ]
            });
            return;
        }

        for (const questId of Object.keys(QUESTS)) {
            const state = this.quests.getQuestState(player.userId, questId);
            if (state && state.status === "completed") {
                const questDef = QUESTS[questId];
                if (questDef.npcId === npc.type) {
                    client.send(ServerMessageType.OpenDialogue, {
                        npcId: data.npcId,
                        text: `Great job on ${questDef.title}! Here is your reward.`,
                        options: [
                            { text: "Complete Quest", action: "quest_complete", data: { questId } }
                        ]
                    });
                    return;
                }
            }
        }

        client.send(ServerMessageType.OpenDialogue, {
            npcId: data.npcId,
            text: "Hello there, traveler!",
            options: [{ text: "Goodbye", action: "close" }]
        });
    }

    handleQuestAccept(client: Client, data: ClientMessages[ClientMessageType.QuestAccept]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        this.quests.acceptQuest(player.userId, player.dbId, data.questId).then(state => {
            if (state) {
                client.send(ServerMessageType.QuestUpdate, { quest: state });
                client.send(ServerMessageType.Notification, { message: `Quest Accepted: ${QUESTS[data.questId].title}` });
            }
        });
    }

    handleQuestComplete(client: Client, data: ClientMessages[ClientMessageType.QuestComplete]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        this.quests.completeQuest(player.userId, player.dbId, data.questId).then(questDef => {
            if (questDef) {
                this.gainXp(player, questDef.rewards.exp);
                player.gold += questDef.rewards.gold;
                
                if (questDef.rewards.items) {
                    for (const item of questDef.rewards.items) {
                        this.inventorySystem.addItem(player, item.itemId, item.quantity);
                    }
                }

                client.send(ServerMessageType.QuestUpdate, { 
                    quest: this.quests.getQuestState(player.userId, data.questId)! 
                });
                client.send(ServerMessageType.Notification, { message: `Quest Completed: ${questDef.title} (+${questDef.rewards.exp} XP, +${questDef.rewards.gold} Gold)` });
            }
        });
    }

    handleBuyItem(client: Client, data: ClientMessages[ClientMessageType.BuyItem]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

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

    handleSellItem(client: Client, data: ClientMessages[ClientMessageType.SellItem]): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

        const itemDef = ITEMS[data.itemId];
        if (!itemDef) return;

        const sellValue = Math.floor(itemDef.goldValue * 0.5) * (data.quantity || 1);
        
        if (this.inventorySystem.removeItem(player, data.itemId, data.quantity || 1)) {
            player.gold += sellValue;
            client.send(ServerMessageType.Notification, { message: `Sold ${data.quantity || 1}x ${itemDef.name} for ${sellValue} gold` });
        } else {
            client.send(ServerMessageType.Error, { message: "Item not found in inventory" });
        }
    }

    handleChat(client: Client, data: ClientMessages[ClientMessageType.Chat]): void {
        const message = data.message;
        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        if (message.startsWith("/party ") || message.startsWith("/p ")) {
            const prefix = message.startsWith("/p ") ? "/p " : "/party ";
            const partyMsg = message.replace(prefix, "");
            if (partyMsg) {
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

        const text = message.trim().slice(0, 100);
        if (text.length > 0) {
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

            this.broadcast(ServerMessageType.Chat, {
                senderId: player.sessionId,
                senderName: player.name,
                message: text,
                channel: "global" as const
            });
        }
    }

    handleFriendRequest(client: Client, data: ClientMessages[ClientMessageType.FriendRequest]): void {
        this.friends.handleFriendRequest(client, data.targetName);
    }

    handleFriendAccept(client: Client, data: ClientMessages[ClientMessageType.FriendAccept]): void {
        this.friends.handleFriendAccept(client, data.requesterId);
    }

    handlePartyInvite(client: Client, data: ClientMessages[ClientMessageType.PartyInvite]): void {
        this.social.handleInvite(client, data.targetSessionId);
    }

    handlePartyAccept(client: Client, data: ClientMessages[ClientMessageType.PartyAccept]): void {
        this.social.handleAcceptInvite(client, data.partyId);
    }

    handlePartyLeave(client: Client): void {
        this.social.handleLeaveParty(client);
    }

    handlePartyKick(client: Client, data: ClientMessages[ClientMessageType.PartyKick]): void {
        this.social.handleKickPlayer(client, data.targetSessionId);
    }

    handlePing(client: Client): void {
        client.send(ServerMessageType.Pong, { serverTime: Date.now() });
    }
    
    handleAudio(client: Client, data: ArrayBuffer): void {
        const player = this.state.players.get(client.sessionId);
        if (player && player.alive) {
            this.broadcast(ServerMessageType.Audio, {
                sessionId: client.sessionId,
                data: data
            }, { except: client });
        }
    }
}
