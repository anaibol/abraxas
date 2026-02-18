import { Client } from "@colyseus/core";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { Npc } from "../schema/Npc";
import { MovementSystem } from "../systems/MovementSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { DropSystem } from "../systems/DropSystem";
import { TileMap, Direction, EquipmentSlot, ITEMS } from "@abraxas/shared";
import { ServerMessages } from "@abraxas/shared";

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
        private broadcast: BroadcastCallback,
        private isTileOccupied: (x: number, y: number, excludeId: string) => boolean
    ) {}

    handleMove(client: Client, direction: Direction): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        if (player.stunned) return;

        this.movement.tryMove(
            player,
            direction,
            this.map,
            Date.now(),
            this.isTileOccupied,
            this.state.tick,
            this.roomId
        );
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
        if (!npc || npc.type !== "merchant") return;

        // Check proximity
        const dist = Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileY - npc.tileY);
        if (dist > 3) {
            client.send("error", { message: "Too far from merchant" });
            return;
        }

        // Logic for which inventory to open (for now just one general)
        const inventory = ["health_potion", "mana_potion", "iron_dagger", "wooden_shield", "leather_armor"];
        client.send("open_shop", { npcId, inventory });
    }

    handleBuyItem(client: Client, data: { itemId: string; quantity: number }): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

        const itemDef = ITEMS[data.itemId];
        if (!itemDef) return;

        const totalCost = itemDef.goldValue * (data.quantity || 1);
        if (player.gold < totalCost) {
            client.send("error", { message: "Not enough gold" });
            return;
        }

        player.gold -= totalCost;
        this.inventorySystem.addItem(player, data.itemId, data.quantity || 1);
        client.send("notification", { message: `Bought ${data.quantity || 1}x ${itemDef.name}` });
    }

    handleSellItem(client: Client, data: { itemId: string; quantity: number }): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;

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
                this.broadcast("chat", {
                    senderId: player.sessionId,
                    senderName: player.name,
                    message: text,
                });
            }
        }
    }
}
