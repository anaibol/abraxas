import { PlayerSprite } from "../entities/PlayerSprite";
import type { CameraController } from "../systems/CameraController";
import type { GameScene } from "../scenes/GameScene";
import type { EntityState } from "@abraxas/shared";

export class SpriteManager {
    private sprites = new Map<string, PlayerSprite>();
    
    constructor(
        private scene: GameScene,
        private cameraController: CameraController,
        private getCurrentRoomState: () => any, 
        private getSessionId: () => string
    ) {}

    addPlayer(player: EntityState, sessionId: string) {
        if (this.sprites.has(sessionId)) return;

        const isLocal = sessionId === this.getSessionId();
        const sprite = new PlayerSprite(
            this.scene,
            sessionId,
            player.tileX,
            player.tileY,
            player.classType ?? "warrior",
            player.name,
            isLocal
        );

        this.sprites.set(sessionId, sprite);

        if (isLocal) {
            this.cameraController.follow(sprite);
        }
    }

    removePlayer(sessionId: string) {
        const sprite = this.sprites.get(sessionId);
        if (sprite) {
            sprite.destroy();
            this.sprites.delete(sessionId);
        }
    }

    addNpc(npc: EntityState, sessionId: string) {
        if (this.sprites.has(sessionId)) return;
        
        const sprite = new PlayerSprite(
            this.scene,
            sessionId,
            npc.tileX,
            npc.tileY,
            (npc.type as any) ?? "orc", // Treat type as classType for visual resolution
            npc.type?.toUpperCase() ?? "NPC", // Name
            false
        );
        
        this.sprites.set(sessionId, sprite);
    }

    removeNpc(sessionId: string) {
        this.removePlayer(sessionId);
    }

    getSprite(sessionId: string): PlayerSprite | undefined {
        return this.sprites.get(sessionId);
    }
    
    getAllSprites(): Map<string, PlayerSprite> {
        return this.sprites;
    }

    update(time: number, delta: number) {
        const state = this.getCurrentRoomState();
        if (!state) return;

        for (const [sessionId, sprite] of this.sprites) {
            let entity = state.players.get(sessionId) || state.npcs.get(sessionId);
            
            if (entity) {
                const e = entity as EntityState;
                if (sprite.isLocal) {
                    sprite.reconcileServer(e.tileX, e.tileY);
                } else {
                    sprite.setTilePosition(e.tileX, e.tileY);
                }
                
                sprite.setFacing(e.facing ?? 2); 
                sprite.updateHpMana(e.hp, e.maxHp);
                
                if (e.classType) { // It's a player
                    sprite.updateEquipment(
                        e.equipWeapon ?? "",
                        e.equipShield ?? "",
                        e.equipHelmet ?? ""
                    );
                }
        
                if (!e.alive) {
                    sprite.container.setAlpha(0.3);
                } else if (e.stealthed && !sprite.isLocal) {
                    sprite.container.setAlpha(0.15);
                } else if (e.stealthed && sprite.isLocal) {
                    sprite.container.setAlpha(0.5);
                }
            }
            sprite.update(delta);
        }
    }

    flashSprite(sessionId: string, color: number) {
        const sprite = this.sprites.get(sessionId);
        if (sprite) {
            sprite.container.setAlpha(0.5);
            this.scene.time.delayedCall(80, () => {
                sprite.container.setAlpha(1);
            });
        }
    }
}
