import type { BroadcastFn, TileMap } from "@abraxas/shared";
import { PLAYER_RESPAWN_TIME_MS, ServerMessageType } from "@abraxas/shared";
import type { Player } from "../schema/Player";

interface PendingRespawn {
  sessionId: string;
  respawnAt: number;
}

type FindSpawnFn = (x: number, y: number) => { x: number; y: number } | null;

/**
 * Picks a free tile inside one of the map's safe zones.
 * Tiles are tried in random order; a tile is accepted only when findSpawn
 * returns the exact same coordinates (the spiral didn't escape the zone).
 * Returns null if every tile in the zone is occupied.
 */
function pickSafeZoneTile(
  map: TileMap,
  findSpawn: FindSpawnFn,
): { x: number; y: number } | null {
  if (!map.safeZones?.length) return null;
  const zone = map.safeZones[Math.floor(Math.random() * map.safeZones.length)];

  // Collect walkable tiles then Fisher-Yates shuffle in-place
  const tiles: { x: number; y: number }[] = [];
  for (let y = zone.y; y < zone.y + zone.h; y++)
    for (let x = zone.x; x < zone.x + zone.w; x++)
      if (map.collision[y]?.[x] !== 1) tiles.push({ x, y });

  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  for (const t of tiles) {
    const result = findSpawn(t.x, t.y);
    // Accept only when the tile itself is free (no spiral escape)
    if (result?.x === t.x && result?.y === t.y) return result;
  }
  return null;
}

export class RespawnSystem {
  private pending: PendingRespawn[] = [];

  queueRespawn(sessionId: string, now: number): void {
    if (this.pending.some((p) => p.sessionId === sessionId)) return;
    this.pending.push({ sessionId, respawnAt: now + PLAYER_RESPAWN_TIME_MS });
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
    findSpawn?: FindSpawnFn,
  ): void {
    const remaining: PendingRespawn[] = [];

    for (const entry of this.pending) {
      if (now < entry.respawnAt) { remaining.push(entry); continue; }

      const player = getPlayer(entry.sessionId);
      if (!player) continue;

      // 1. Try a safe zone tile (stays within zone bounds).
      // 2. Fall back to a regular spawn point only if the entire zone is full.
      const spawn =
        (findSpawn && pickSafeZoneTile(map, findSpawn)) ??
        (() => {
          if (!map.spawns?.length) return null;
          const c = map.spawns[Math.floor(Math.random() * map.spawns.length)];
          return findSpawn ? findSpawn(c.x, c.y) : c;
        })();

      if (!spawn) { remaining.push(entry); continue; }

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
