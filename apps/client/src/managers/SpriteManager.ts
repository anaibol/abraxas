import { PlayerSprite } from "../entities/PlayerSprite";
import type { CameraController } from "../systems/CameraController";
import type { GameScene } from "../scenes/GameScene";
import type { PlayerEntityState, NpcEntityState } from "@abraxas/shared";

export class SpriteManager {
  private sprites = new Map<string, PlayerSprite>();

  constructor(
    private scene: GameScene,
    private cameraController: CameraController,
    private getCurrentRoomState: () => any,
    private getSessionId: () => string,
  ) {}

  addPlayer(player: PlayerEntityState, sessionId: string) {
    if (this.sprites.has(sessionId)) return;
    const isLocal = sessionId === this.getSessionId();
    const sprite = this.createSprite({
      sessionId,
      tileX: player.tileX,
      tileY: player.tileY,
      typeOrClass: player.classType,
      name: player.name,
      isLocal,
    });
    this.sprites.set(sessionId, sprite);
    if (isLocal) this.cameraController.follow(sprite);
  }

  removePlayer(sessionId: string) {
    const sprite = this.sprites.get(sessionId);
    if (sprite) {
      sprite.destroy();
      this.sprites.delete(sessionId);
    }
  }

  addNpc(npc: NpcEntityState, sessionId: string) {
    if (this.sprites.has(sessionId)) return;
    const sprite = this.createSprite({
      sessionId,
      tileX: npc.tileX,
      tileY: npc.tileY,
      typeOrClass: npc.type,
      name: npc.name,
      isLocal: false,
    });
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
      const player = state.players.get(sessionId) as
        | PlayerEntityState
        | undefined;
      const npc = state.npcs.get(sessionId) as NpcEntityState | undefined;
      const entity = player || npc;

      if (entity) {
        if (sprite.isLocal) {
          sprite.reconcileServer(entity.tileX, entity.tileY);
        } else {
          sprite.setTilePosition(entity.tileX, entity.tileY);
        }

        sprite.setFacing(entity.facing);
        sprite.updateHpMana(entity.hp, entity.maxHp);

        if (player) {
          // It's a player
          sprite.updateEquipment(
            player.equipWeapon,
            player.equipShield,
            player.equipHelmet,
          );
        }

        if (!entity.alive) {
          this.setAlpha(sessionId, 0.3);
        } else if (entity.stealthed && !sprite.isLocal) {
          this.setAlpha(sessionId, 0.15);
        } else if (entity.stealthed && sprite.isLocal) {
          this.setAlpha(sessionId, 0.5);
        }
      }
      sprite.update(delta);
    }
  }

  flashSprite(sessionId: string) {
    this.pulseAlpha(sessionId, 0.5, 80);
  }

  pulseAlpha(sessionId: string, toAlpha: number, durationMs: number) {
    const sprite = this.sprites.get(sessionId);
    if (!sprite) return;
    const prev = sprite.container.alpha;
    sprite.container.setAlpha(toAlpha);
    this.scene.time.delayedCall(durationMs, () => {
      if (sprite && sprite.container) sprite.container.setAlpha(prev);
    });
  }

  setAlpha(sessionId: string, alpha: number) {
    const sprite = this.sprites.get(sessionId);
    if (!sprite) return;
    sprite.container.setAlpha(alpha);
  }

  setSpeaking(sessionId: string, speaking: boolean, durationMs?: number) {
    const sprite = this.sprites.get(sessionId);
    if (!sprite) return;
    sprite.showSpeakingIndicator(speaking);
    if (speaking && durationMs) {
      this.scene.time.delayedCall(durationMs, () =>
        sprite.showSpeakingIndicator(false),
      );
    }
  }

  private createSprite(opts: {
    sessionId: string;
    tileX: number;
    tileY: number;
    typeOrClass: string;
    name: string;
    isLocal: boolean;
  }) {
    return new PlayerSprite(
      this.scene,
      opts.sessionId,
      opts.tileX,
      opts.tileY,
      opts.typeOrClass,
      opts.name,
      opts.isLocal,
    );
  }
}
