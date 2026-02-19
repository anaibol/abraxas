import type { TileMap, BroadcastFn } from "@abraxas/shared";
import { PLAYER_RESPAWN_TIME_MS, ServerMessageType } from "@abraxas/shared";
import type { Player } from "../schema/Player";

interface PendingRespawn {
  sessionId: string;
  respawnAt: number;
}

export class RespawnSystem {
  private pending: PendingRespawn[] = [];

  queueRespawn(sessionId: string, now: number): void {
    if (this.pending.some((p) => p.sessionId === sessionId)) return;
    this.pending.push({
      sessionId,
      respawnAt: now + PLAYER_RESPAWN_TIME_MS,
    });
  }

  removePlayer(sessionId: string): void {
    this.pending = this.pending.filter((p) => p.sessionId !== sessionId);
  }

  tick(
    now: number,
    getPlayer: (sessionId: string) => Player | undefined,
    map: TileMap,
    broadcast: BroadcastFn,
    onRespawn?: (player: Player) => void,
  ): void {
    const remaining: PendingRespawn[] = [];

    for (const entry of this.pending) {
      if (now < entry.respawnAt) {
        remaining.push(entry);
        continue;
      }

      const player = getPlayer(entry.sessionId);
      if (!player) continue;

      if (!map.spawns || map.spawns.length === 0) continue;
      const spawn = map.spawns[Math.floor(Math.random() * map.spawns.length)];

      player.tileX = spawn.x;
      player.tileY = spawn.y;
      player.hp = player.maxHp;
      player.mana = player.maxMana;
      player.alive = true;
      player.stealthed = false;
      player.stunned = false;

      onRespawn?.(player);

      broadcast(ServerMessageType.Respawn, {
        sessionId: player.sessionId,
        tileX: spawn.x,
        tileY: spawn.y,
      });
    }

    this.pending = remaining;
  }
}
