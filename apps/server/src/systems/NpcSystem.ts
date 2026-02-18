import {
  ClassStats,
  NPC_STATS,
  TileMap,
  Direction,
  NpcType,
  ServerMessages,
  BroadcastFn,
  NPC_RESPAWN_TIME_MS,
  AGGRO_RANGE,
  MathUtils,
  NpcState,
} from "@abraxas/shared";
import { Npc } from "../schema/Npc";
import { Player } from "../schema/Player";
import { GameState } from "../schema/GameState";
import { MovementSystem } from "./MovementSystem";
import { CombatSystem } from "./CombatSystem";
import { logger } from "../logger";
import { EntityUtils, Entity } from "../utils/EntityUtils";

import { SpatialLookup } from "../utils/SpatialLookup";

export class NpcSystem {
  private respawns: { type: string; deadAt: number }[] = [];

  constructor(
    private state: GameState,
    private movementSystem: MovementSystem,
    private combatSystem: CombatSystem,
    private spatial: SpatialLookup,
  ) {}

  spawnNpcs(count: number, map: TileMap): void {
    const types = Object.keys(NPC_STATS).filter((t) => t !== "merchant");

    // Spawn regular NPCs
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      this.spawnNpc(type, map);
    }

    // Spawn a Merchant near the first player spawn
    if (map.spawns.length > 0) {
      this.spawnNpcAt("merchant", map, map.spawns[0].x + 2, map.spawns[0].y);
    }
  }

  public spawnNpcAt(type: string, map: TileMap, x: number, y: number): void {
    const npc = new Npc();
    npc.sessionId = crypto.randomUUID();
    npc.type = type as NpcType;
    npc.tileX = x;
    npc.tileY = y;

    const stats = NPC_STATS[type];
    npc.hp = stats.hp;
    npc.maxHp = stats.hp;
    npc.mana = stats.mana || 0;
    npc.str = stats.str;
    npc.agi = stats.agi;
    npc.intStat = stats.int;
    npc.alive = true;
    npc.state = NpcState.IDLE;
    npc.targetId = "";

    this.state.npcs.set(npc.sessionId, npc);
    this.spatial.addToGrid(npc);
  }

  private spawnNpc(type: string, map: TileMap): void {
    // Find a valid random spawn location
    let tx = 0,
      ty = 0;
    let attempts = 0;
    while (attempts < 100) {
      tx = Math.floor(Math.random() * map.width);
      ty = Math.floor(Math.random() * map.height);
      if (map.collision[ty]?.[tx] === 0) break;
      attempts++;
    }

    if (attempts >= 100) {
      logger.error({
        intent: "spawn_npc",
        result: "failed",
        message: "Could not find valid spawn location",
        type,
      });
      return;
    }

    this.spawnNpcAt(type, map, tx, ty);
    logger.info({ intent: "spawn_npc", type, x: tx, y: ty });
  }

  tick(
    dt: number,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tickCount: number,
    roomId: string,
    broadcast: BroadcastFn,
  ): void {
    // Handle respawns
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const respawn = this.respawns[i];
      if (now - respawn.deadAt > NPC_RESPAWN_TIME_MS) {
        this.spawnNpc(respawn.type, map);
        this.respawns.splice(i, 1);
      }
    }

    // AI Logic & Dead NPCs cleanup
    this.state.npcs.forEach((npc) => {
      if (!npc.alive) return;

      switch (npc.state) {
        case NpcState.IDLE:
          this.updateIdle(npc);
          break;
        case NpcState.CHASE:
          this.updateChase(npc, map, now, occupiedCheck, tickCount, roomId);
          break;
        case NpcState.ATTACK:
          this.updateAttack(npc, now, broadcast);
          break;
        default:
          npc.state = NpcState.IDLE;
          break;
      }
    });
  }

  private updateIdle(npc: Npc): void {
    if (npc.type === "merchant") return; // Merchants don't aggro

    // Look for targets
    const players = this.spatial.findEntitiesInRadius(
      npc.tileX,
      npc.tileY,
      AGGRO_RANGE,
    );
    let nearest: Entity | null = null;
    let minDist = Infinity;
    const npcPos = EntityUtils.getPosition(npc);

    for (const entity of players) {
      if (entity.alive && entity.alive && !entity.stealthed) {
        const dist = MathUtils.dist(npcPos, EntityUtils.getPosition(entity));
        if (dist < minDist) {
          minDist = dist;
          nearest = entity;
        }
      }
    }

    if (nearest) {
      npc.targetId = nearest.sessionId;
      npc.state = NpcState.CHASE;
    }
  }

  private updateChase(
    npc: Npc,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tickCount: number,
    roomId: string,
  ): void {
    const target = this.spatial.findEntityBySessionId(npc.targetId);

    // Target lost or dead
    if (!target || !target.alive || (target.alive && target.stealthed)) {
      npc.targetId = "";
      npc.state = NpcState.IDLE;
      return;
    }

    const npcPos = EntityUtils.getPosition(npc);
    const targetPos = EntityUtils.getPosition(target);
    const dist = MathUtils.manhattanDist(npcPos, targetPos);
    const stats = NPC_STATS[npc.type];

    // If in attack range, switch to attack
    if (dist <= stats.meleeRange) {
      // If it's a ranged NPC and target is too close, try to kite (move away)
      if (stats.meleeRange > 1 && dist < Math.max(2, stats.meleeRange / 2)) {
        const awayDir = this.getAwayDirection(npc, target);
        if (awayDir != null) {
          this.movementSystem.tryMove(
            npc,
            awayDir,
            map,
            now,
            occupiedCheck,
            tickCount,
            roomId,
          );
        }
        npc.state = NpcState.ATTACK; // Still attack while kiting if possible
        return;
      }
      npc.state = NpcState.ATTACK;
      return;
    }

    // Assume loose aggro radius if too far
    if (dist > AGGRO_RANGE * 1.5) {
      npc.targetId = "";
      npc.state = NpcState.IDLE;
      return;
    }

    // Move towards target
    const dx = target.tileX - npc.tileX;
    const dy = target.tileY - npc.tileY;

    // Prefer axis with larger distance
    let moveDir: Direction | null = null;
    if (Math.abs(dx) > Math.abs(dy)) {
      // Try X first
      if (dx > 0) moveDir = Direction.RIGHT;
      else if (dx < 0) moveDir = Direction.LEFT;
    } else {
      if (dy > 0) moveDir = Direction.DOWN;
      else if (dy < 0) moveDir = Direction.UP;
    }

    if (moveDir != null) {
      const success = this.movementSystem.tryMove(
        npc,
        moveDir,
        map,
        now,
        occupiedCheck,
        tickCount,
        roomId,
      );

      // Basic Obstacle Avoidance: if stuck, try a perpendicular direction
      if (!success) {
        const alternativeDir =
          moveDir === Direction.LEFT || moveDir === Direction.RIGHT
            ? dy > 0
              ? Direction.DOWN
              : Direction.UP
            : dx > 0
              ? Direction.RIGHT
              : Direction.LEFT;
        this.movementSystem.tryMove(
          npc,
          alternativeDir,
          map,
          now,
          occupiedCheck,
          tickCount,
          roomId,
        );
      }
    }
  }

  private getAwayDirection(npc: Npc, target: Entity): Direction | null {
    const dx = npc.tileX - target.tileX;
    const dy = npc.tileY - target.tileY;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      return dy > 0 ? Direction.DOWN : Direction.UP;
    }
  }

  private tryUseSpell(npc: Npc, now: number, broadcast: BroadcastFn): boolean {
    const stats = NPC_STATS[npc.type];
    if (!stats || !stats.spells.length) return false;

    const spellId =
      stats.spells[Math.floor(Math.random() * stats.spells.length)];

    const target = this.spatial.findEntityBySessionId(npc.targetId);
    if (!target || !target.alive) return false;

    return this.combatSystem.tryCast(
      npc,
      spellId,
      target.tileX,
      target.tileY,
      now,
      broadcast,
    );
  }

  private updateAttack(npc: Npc, now: number, broadcast: BroadcastFn): void {
    const target = this.spatial.findEntityBySessionId(npc.targetId);
    if (!target || !target.alive) {
      npc.state = NpcState.IDLE;
      return;
    }

    const npcPos = EntityUtils.getPosition(npc);
    const targetPos = EntityUtils.getPosition(target);
    const dist = MathUtils.manhattanDist(npcPos, targetPos);
    const stats = NPC_STATS[npc.type];

    if (dist > stats.meleeRange) {
      npc.state = NpcState.CHASE;
      return;
    }

    // Face target
    npc.facing = MathUtils.getDirection(npcPos, targetPos);

    // Try spells first
    if (stats.spells && stats.spells.length > 0) {
      if (this.tryUseSpell(npc, now, broadcast)) {
        return;
      }
    }

    // Default melee attack
    this.combatSystem.tryAttack(
      npc,
      now,
      broadcast,
      target.tileX,
      target.tileY,
    );
  }

  handleDeath(npc: Npc): void {
    this.respawns.push({ type: npc.type, deadAt: Date.now() });
    this.state.npcs.delete(npc.sessionId);
    this.spatial.removeFromGrid(npc);
  }
}
