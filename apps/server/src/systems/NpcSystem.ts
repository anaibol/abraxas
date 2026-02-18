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
  NpcState
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
    private spatial: SpatialLookup
  ) {}

  spawnNpcs(count: number, map: TileMap) {
    const types = Object.keys(NPC_STATS);

    for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        this.spawnNpc(type, map);
    }
  }

  private spawnNpc(type: string, map: TileMap) {
    const npc = new Npc();
    npc.sessionId = crypto.randomUUID();
    if (type === "orc" || type === "skeleton" || type === "goblin" || type === "wolf") {
      npc.type = type;
    }

    // Find valid spawn location
    let attempts = 0;
    while (attempts < 100) {
        const tx = Math.floor(Math.random() * map.width);
        const ty = Math.floor(Math.random() * map.height);
        if (map.collision[ty]?.[tx] === 0) {
            npc.tileX = tx;
            npc.tileY = ty;
            break;
        }
        attempts++;
    }

    if (attempts >= 100) {
        logger.error({ intent: "spawn_npc", result: "failed", message: "Could not find valid spawn location", type });
        return;
    }

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
    logger.info({
        intent: "spawn_npc",
        type: type,
        x: npc.tileX,
        y: npc.tileY
    });
  }

  tick(
    dt: number,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tickCount: number,
    roomId: string,
    broadcast: BroadcastFn
  ) {
    // Handle respawns
    for (let i = this.respawns.length - 1; i >= 0; i--) {
        const respawn = this.respawns[i];
        if (now - respawn.deadAt > NPC_RESPAWN_TIME_MS) {
            this.spawnNpc(respawn.type, map);
            this.respawns.splice(i, 1);
        }
    }

    // AI Logic
    this.state.npcs.forEach((npc) => {
        if (!npc.alive) return;

        switch (npc.state) {
            case NpcState.IDLE:
                this.updateIdle(npc, now);
                break;
            case NpcState.CHASE:
                this.updateChase(npc, map, now, occupiedCheck, tickCount, roomId);
                break;
            case NpcState.ATTACK:
                this.updateAttack(npc, dt, now, broadcast, tickCount, roomId);
                break;
            default:
                npc.state = NpcState.IDLE;
                break;
        }
    });

    // Handle dead NPCs removal
    this.state.npcs.forEach((npc) => {
        if (!npc.alive && !this.respawns.some(r => r.type === npc.type && Date.now() - r.deadAt < 100)) {
             // Logic handled via handleDeath now
        }
    });
  }


  private updateIdle(npc: Npc, now: number) {
      // Look for targets
      const players = this.spatial.findEntitiesInRadius(npc.tileX, npc.tileY, AGGRO_RANGE);
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
      // TODO: Random wander?
  }

  private updateChase(
      npc: Npc, 
      map: TileMap, 
      now: number, 
      occupiedCheck: (x: number, y: number, excludeId: string) => boolean, 
      tickCount: number, 
      roomId: string
  ) {
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

      if (moveDir) {
          this.movementSystem.tryMove(npc, moveDir, map, now, occupiedCheck, tickCount, roomId);
      }
  }

  private updateAttack(
      npc: Npc, 
      dt: number,
      now: number,
      broadcast: BroadcastFn,
      tickCount: number, 
      roomId: string,
      findEntityAtTile: (x: number, y: number) => Entity | undefined
  ) {
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

      // Attack
      this.combatSystem.tryAttack(
            npc,
            now,
            broadcast,
            tickCount,
            roomId,
            undefined, // targetId not needed for melee logic usually, uses tile
            undefined,
            undefined
      );
  }

  handleDeath(npc: Npc) {
      this.respawns.push({ type: npc.type, deadAt: Date.now() });
      this.state.npcs.delete(npc.sessionId);
      this.spatial.removeFromGrid(npc);
  }
}
