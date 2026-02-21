import {
  ABILITIES,
  type ClassStats,
  DIRECTION_DELTA,
  Direction,
  MathUtils,
  NPC_STATS,
  NPC_TYPES,
  NpcState,
  type NpcType,
  type TileMap,
} from "@abraxas/shared";
import { logger } from "../logger";
import type { GameState } from "../schema/GameState";
import { Npc } from "../schema/Npc";
import type { Entity, SpatialLookup } from "../utils/SpatialLookup";
import { findSafeSpawn } from "../utils/spawnUtils";

// ── Types ──────────────────────────────────────────────────────────────

export type RespawnEntry = {
  npcType: NpcType;
  deadAt: number;
  spawnX: number;
  spawnY: number;
};

// ── NpcSpawner ─────────────────────────────────────────────────────────

export class NpcSpawner {
  /** Queue of dead NPCs waiting to respawn. */
  respawns: RespawnEntry[] = [];

  constructor(
    private state: GameState,
    private spatial: SpatialLookup,
  ) {}

  /** Bulk-spawn random hostile NPCs from NPC_TYPES, plus a merchant if the map lacks one. */
  spawnNpcs(count: number, map: TileMap): void {
    const types = NPC_TYPES.filter((t) => !NPC_STATS[t].passive && !NPC_STATS[t].rareSpawn);

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      this.spawnNpc(type, map);
    }

    const mapHasMerchant = map.npcs?.some((n) => n.type === "merchant");
    if (!mapHasMerchant && map.spawns.length > 0) {
      // Bug #38: Use findSafeSpawn instead of hardcoded offset that could land on a wall
      const merchantSpot = findSafeSpawn(map.spawns[0].x + 2, map.spawns[0].y, map, this.spatial)
        ?? findSafeSpawn(map.spawns[0].x, map.spawns[0].y, map, this.spatial);
      if (merchantSpot) {
        this.spawnNpcAt("merchant" as NpcType, map, merchantSpot.x, merchantSpot.y);
      }
    }
  }

  /** Spawn a specific NPC at an exact tile position. */
  spawnNpcAt(
    type: NpcType,
    map: TileMap,
    tileX: number,
    tileY: number,
    ownerId?: string,
    forcedLevel?: number,
    persistenceData?: { isUnique: boolean; uniqueId?: string; dbId?: string },
  ): Npc {
    const npc = new Npc();
    npc.sessionId = crypto.randomUUID();
    npc.npcType = type;
    npc.tileX = tileX;
    npc.tileY = tileY;
    npc.spawnX = tileX;
    npc.spawnY = tileY;

    if (persistenceData) {
      npc.isUnique = persistenceData.isUnique;
      npc.uniqueId = persistenceData.uniqueId;
      npc.dbId = persistenceData.dbId;
    }

    if (forcedLevel !== undefined) {
      npc.level = forcedLevel;
    } else {
      npc.level = this.calculateSpawnLevel(type, map);
    }

    this.recalcNpcStats(npc);

    npc.alive = true;
    npc.state = NpcState.IDLE;
    npc.targetId = "";
    npc.patrolStepsLeft = 0;
    if (ownerId) {
      npc.ownerId = ownerId;
      npc.state = NpcState.FOLLOW;
    }

    this.state.npcs.set(npc.sessionId, npc);
    this.spatial.addToGrid(npc);
    return npc;
  }

  /**
   * Shared NPC stat scaling formula — called from spawnNpcAt and levelUp.
   * @param resetHp When true (default for new spawns), set HP to maxHp. When false
   *                (level-up mid-combat), scale HP proportionally to the new max.
   */
  recalcNpcStats(npc: Npc, resetHp = true): void {
    const stats = NPC_STATS[npc.npcType];
    if (!stats) return;
    const scale = 1 + (npc.level - 1) * 0.1;
    const prevMax = npc.maxHp || 1;
    npc.maxHp = Math.ceil(stats.hp * scale);
    if (resetHp) {
      npc.hp = npc.maxHp;
    } else {
      npc.hp = Math.min(npc.maxHp, Math.ceil((npc.hp / prevMax) * npc.maxHp));
    }
    npc.str = Math.ceil(stats.str * scale);
    npc.agi = Math.ceil(stats.agi * scale);
    npc.intStat = Math.ceil(stats.int * scale);
    npc.armor = Math.ceil(stats.armor * scale);
  }

  /** Determine the spawn level for an NPC type based on its stat definition. */
  calculateSpawnLevel(npcType: NpcType, _map: TileMap): number {
    const stats = NPC_STATS[npcType];
    if (stats.minLevel !== undefined && stats.maxLevel !== undefined) {
      return Math.floor(Math.random() * (stats.maxLevel - stats.minLevel + 1)) + stats.minLevel;
    } else if (stats.minLevel !== undefined) {
      return stats.minLevel;
    }
    return 1;
  }

  /** Returns maxCompanions from stats if available, otherwise 1. */
  getSummonCap(entity: Entity): number {
    const stats = entity.getStats();
    if (stats && "maxCompanions" in stats) {
      return (stats as ClassStats).maxCompanions;
    }
    return 1;
  }

  /** Counts live minions owned by the given sessionId. */
  countLiveMinions(ownerSessionId: string): number {
    let count = 0;
    for (const n of this.state.npcs.values()) {
      if (n.ownerId === ownerSessionId && n.alive) count++;
    }
    return count;
  }

  /** Spawn a single NPC at a random walkable tile. */
  spawnNpc(type: NpcType, map: TileMap, ownerId?: string): Npc | undefined {
    for (let attempt = 0; attempt < 20; attempt++) {
      const rx = Math.floor(Math.random() * map.width);
      const ry = Math.floor(Math.random() * map.height);
      if (map.collision[ry]?.[rx] !== 0) continue;
      // Bug #37: Don't spawn hostile NPCs inside safe zones
      if (!ownerId && MathUtils.isInSafeZone(rx, ry, map.safeZones)) continue;

      const safe = findSafeSpawn(rx, ry, map, this.spatial);
      if (safe) {
        return this.spawnNpcAt(type, map, safe.x, safe.y, ownerId);
      }
    }

    logger.error({ intent: "spawn_npc", result: "failed", npcType: type });
    return undefined;
  }

  /** Spawn a summoned NPC (from an ability cast by a player or NPC). */
  spawnSummon(caster: Entity, abilityId: string, x: number, y: number, currentMap: TileMap): void {
    const ability = ABILITIES[abilityId];
    if (!ability) return;

    let typeToSummon: NpcType = "skeleton";
    if (abilityId === "summon_skeleton") typeToSummon = "skeleton";
    else if (abilityId === "summon_zombie") typeToSummon = "zombie";
    else if (caster.isNpc()) {
      const npcStats = NPC_STATS[caster.npcType];
      if (npcStats?.summonType) typeToSummon = npcStats.summonType;
    }

    const cap = this.getSummonCap(caster);
    if (this.countLiveMinions(caster.sessionId) >= cap) {
      return;
    }

    const safe = findSafeSpawn(x, y, currentMap, this.spatial);
    const casterLevel = caster.level;

    if (safe) {
      this.spawnNpcAt(typeToSummon, currentMap, safe.x, safe.y, caster.sessionId, casterLevel);
    } else {
      const fallback = findSafeSpawn(caster.tileX, caster.tileY, currentMap, this.spatial);
      if (fallback) {
        this.spawnNpcAt(
          typeToSummon,
          currentMap,
          fallback.x,
          fallback.y,
          caster.sessionId,
          casterLevel,
        );
      }
    }
  }

  /**
   * Called after a successful NPC summon cast.
   * Spawns one minion of the type configured on the summoner's NpcStats.summonType,
   * adjacent to the summoner, up to the summon cap.
   */
  handleSummonCast(summoner: Npc, currentMap: TileMap): void {
    const stats = NPC_STATS[summoner.npcType];
    if (!stats.summonType) return;

    const owner = summoner.ownerId ? this.spatial.findEntityBySessionId(summoner.ownerId) : null;
    const cap = this.getSummonCap(owner ?? summoner);
    if (this.countLiveMinions(summoner.sessionId) >= cap) return;

    const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    for (const dir of dirs) {
      const { dx, dy } = DIRECTION_DELTA[dir];
      const tx = summoner.tileX + dx;
      const ty = summoner.tileY + dy;
      if (tx < 0 || ty < 0 || tx >= currentMap.width || ty >= currentMap.height) continue;
      if (currentMap.collision[ty]?.[tx] !== 0) continue;
      if (this.spatial.isTileOccupied(tx, ty)) continue;
      this.spawnNpcAt(stats.summonType, currentMap, tx, ty, summoner.sessionId);
      return;
    }
    this.spawnNpc(stats.summonType, currentMap, summoner.sessionId);
  }

  /** Process respawn queue — called each tick from NpcSystem. */
  processRespawns(map: TileMap, now: number, respawnTimeMs: number): void {
    this.respawns = this.respawns.filter((r) => {
      if (now - r.deadAt < respawnTimeMs) return true;
      const safe = findSafeSpawn(r.spawnX, r.spawnY, map, this.spatial);
      safe ? this.spawnNpcAt(r.npcType, map, safe.x, safe.y) : this.spawnNpc(r.npcType, map);
      return false;
    });
  }

  /** Queue an NPC for respawn after the standard delay. */
  queueRespawn(npcType: NpcType, spawnX: number, spawnY: number): void {
    this.respawns.push({
      npcType,
      deadAt: Date.now(),
      spawnX,
      spawnY,
    });
  }
}
