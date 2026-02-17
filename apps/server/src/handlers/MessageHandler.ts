import { Client } from "@colyseus/core";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { Npc } from "../schema/Npc";
import { MovementSystem } from "../systems/MovementSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { DropSystem } from "../systems/DropSystem";
import type { TileMap, Direction, EquipmentSlot } from "@abraxas/shared";
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
        private findEntityAtTile: (x: number, y: number) => Entity | undefined,
        private isTileOccupied: (x: number, y: number, excludeId: string) => boolean
    ) {}

    handleMove(client: Client, direction: Direction) {
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

    handleAttack(client: Client, targetTileX?: number, targetTileY?: number) {
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
            this.findEntityAtTile,
            (type, data) => client.send(type, data ?? {}),
        );
    }

    handleCast(client: Client, data: { spellId: string; targetTileX: number; targetTileY: number }) {
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
            this.findEntityAtTile,
            (type, data) => client.send(type, data ?? {}),
        );
    }

    handlePickup(client: Client, dropId: string) {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
    
        this.drops.tryPickup(
            player,
            dropId,
            this.state.drops,
            this.roomId,
            this.state.tick
        );
    }

    handleEquip(client: Client, itemId: string) {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        this.inventorySystem.equipItem(player, itemId);
    }
    
    handleUnequip(client: Client, slot: EquipmentSlot) {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        this.inventorySystem.unequipItem(player, slot);
    }
    
    handleUseItem(client: Client, itemId: string) {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.alive) return;
        if (this.inventorySystem.useItem(player, itemId)) {
            this.broadcast("item_used", {
                sessionId: client.sessionId,
                itemId,
            });
        }
    }
    
    handleDropItem(client: Client, itemId: string) {
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

    handleChat(client: Client, message: string) {
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
