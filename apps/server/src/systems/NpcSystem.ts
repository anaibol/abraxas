import {
  NPC_STATS,
  NPC_TYPES,
  SPELLS,
  TileMap,
  Direction,
  NpcType,
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
import { BuffSystem } from "./BuffSystem";
import { logger } from "../logger";
import { SpatialLookup, Entity } from "../utils/SpatialLookup";
import { findSafeSpawn } from "../utils/spawnUtils";

/** Scan for targets every N ticks (~500 ms at 20 TPS). */
const IDLE_SCAN_INTERVAL = 10;

/** Flee when HP falls below this fraction of max HP. */
const FLEE_HP_THRESHOLD = 0.25;

/** Drop aggro when distance exceeds this multiple of AGGRO_RANGE. */
const LEASH_MULTIPLIER = 1.5;

/** Number of random steps taken during a PATROL wander. */
const PATROL_STEPS = 4;

type RespawnEntry = {
  type: NpcType;
  deadAt: number;
  spawnX: number;
  spawnY: number;
};

export class NpcSystem {
  private respawns: RespawnEntry[] = [];

  constructor(
    private state: GameState,
    private movementSystem: MovementSystem,
    private combatSystem: CombatSystem,
    private spatial: SpatialLookup,
    private buffSystem: BuffSystem,
  ) {}

  spawnNpcs(count: number, map: TileMap): void {
    const types = NPC_TYPES.filter((t) => !NPC_STATS[t].passive);

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      this.spawnNpc(type, map);
    }

    const mapHasMerchant = map.npcs?.some((n) => n.type === "merchant");
    if (!mapHasMerchant && map.spawns.length > 0) {
      this.spawnNpcAt("merchant", map, map.spawns[0].x + 2, map.spawns[0].y);
    }
  }

  public spawnNpcAt(type: NpcType, map: TileMap, x: number, y: number): void {
    const npc = new Npc();
    npc.sessionId = crypto.randomUUID();
    npc.type = type;
    npc.tileX = x;
    npc.tileY = y;
    npc.spawnX = x;
    npc.spawnY = y;

    const stats = NPC_STATS[type];
    npc.hp = stats.hp;
    npc.maxHp = stats.hp;
    npc.str = stats.str;
    npc.agi = stats.agi;
    npc.intStat = stats.int;
    npc.armor = stats.armor;
    npc.alive = true;
    npc.state = NpcState.IDLE;
    npc.targetId = "";
    npc.patrolStepsLeft = 0;

    this.state.npcs.set(npc.sessionId, npc);
    this.spatial.addToGrid(npc);
  }

  private spawnNpc(type: NpcType, map: TileMap): void {
    // Pick a random walkable tile then spiral to avoid any occupied cell
    for (let attempt = 0; attempt < 20; attempt++) {
      const rx = Math.floor(Math.random() * map.width);
      const ry = Math.floor(Math.random() * map.height);
      if (map.collision[ry]?.[rx] !== 0) continue;

      const safe = findSafeSpawn(rx, ry, map, this.spatial);
      if (safe) {
        this.spawnNpcAt(type, map, safe.x, safe.y);
        return;
      }
    }

    logger.error({ intent: "spawn_npc", result: "failed", type });
  }

  tick(
    _dt: number,
    map: TileMap,
    now: number,
    tickCount: number,
    roomId: string,
    broadcast: BroadcastFn,
  ): void {
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const r = this.respawns[i];
      if (now - r.deadAt >= NPC_RESPAWN_TIME_MS) {
        const safe = findSafeSpawn(r.spawnX, r.spawnY, map, this.spatial);
        if (safe) {
          this.spawnNpcAt(r.type, map, safe.x, safe.y);
        } else {
          this.spawnNpc(r.type, map);
        }
        this.respawns.splice(i, 1);
      }
    }

    this.state.npcs.forEach((npc) => {
      if (!npc.alive) return;

      switch (npc.state) {
        case NpcState.IDLE:
          this.updateIdle(npc, tickCount);
          break;
        case NpcState.PATROL:
          this.updatePatrol(npc, map, now, tickCount, roomId);
          break;
        case NpcState.CHASE:
          this.updateChase(npc, map, now, tickCount, roomId);
          break;
        case NpcState.ATTACK:
          this.updateAttack(npc, now, broadcast);
          break;
        case NpcState.FLEE:
          this.updateFlee(npc, map, now, tickCount, roomId);
          break;
        case NpcState.RETURN:
          this.updateReturn(npc, map, now, tickCount, roomId);
          break;
        default:
          npc.state = NpcState.IDLE;
      }
    });
  }

  private updateIdle(npc: Npc, tickCount: number): void {
    const stats = NPC_STATS[npc.type];
    if (stats.passive) return;
    if (tickCount % IDLE_SCAN_INTERVAL !== 0) return;

    const entities = this.spatial.findEntitiesInRadius(npc.tileX, npc.tileY, AGGRO_RANGE);
    let nearest: Entity | null = null;
    let minDist = Infinity;

    for (const entity of entities) {
      if (entity instanceof Player && entity.isAttackable()) {
        const dist = MathUtils.manhattanDist(npc.getPosition(), entity.getPosition());
        if (dist < minDist) {
          minDist = dist;
          nearest = entity;
        }
      }
    }

    if (nearest) {
      npc.targetId = nearest.sessionId;
      npc.state = NpcState.CHASE;
      return;
    }

    if (Math.random() < 0.15) {
      npc.patrolStepsLeft = PATROL_STEPS;
      npc.state = NpcState.PATROL;
    }
  }

  private updatePatrol(npc: Npc, map: TileMap, now: number, tickCount: number, roomId: string): void {
    if (tickCount % IDLE_SCAN_INTERVAL === 0) {
      const entities = this.spatial.findEntitiesInRadius(npc.tileX, npc.tileY, AGGRO_RANGE);
      for (const entity of entities) {
        if (entity instanceof Player && entity.isAttackable()) {
          npc.targetId = entity.sessionId;
          npc.state = NpcState.CHASE;
          return;
        }
      }
    }

    if (npc.patrolStepsLeft <= 0) {
      npc.state = NpcState.IDLE;
      return;
    }

    const dir = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT][Math.floor(Math.random() * 4)];
    this.movementSystem.tryMove(npc, dir, map, now, tickCount, roomId);
    npc.patrolStepsLeft--;
  }

  private updateChase(npc: Npc, map: TileMap, now: number, tickCount: number, roomId: string): void {
    const target = this.spatial.findEntityBySessionId(npc.targetId);
    if (!target || !target.isAttackable()) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    const stats = NPC_STATS[npc.type];
    if (stats.fleesWhenLow && npc.hp / npc.maxHp < FLEE_HP_THRESHOLD) {
      npc.state = NpcState.FLEE;
      return;
    }

    const dist = MathUtils.manhattanDist(npc.getPosition(), target.getPosition());
    if (dist > AGGRO_RANGE * LEASH_MULTIPLIER) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    if (dist <= stats.meleeRange) {
      if (stats.meleeRange > 1 && dist < Math.max(2, stats.meleeRange / 2)) {
        const awayDir = this.getAwayDirection(npc, target);
        this.movementSystem.tryMove(npc, awayDir, map, now, tickCount, roomId);
      }
      npc.state = NpcState.ATTACK;
      return;
    }

    this.moveTowards(npc, target.tileX, target.tileY, map, now, tickCount, roomId);
  }

  private updateAttack(npc: Npc, now: number, broadcast: BroadcastFn): void {
    const target = this.spatial.findEntityBySessionId(npc.targetId);
    if (!target || !target.isAttackable()) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    const stats = NPC_STATS[npc.type];
    if (stats.fleesWhenLow && npc.hp / npc.maxHp < FLEE_HP_THRESHOLD) {
      npc.state = NpcState.FLEE;
      return;
    }

    const dist = MathUtils.manhattanDist(npc.getPosition(), target.getPosition());
    if (dist > stats.meleeRange) {
      npc.state = NpcState.CHASE;
      return;
    }

    npc.facing = MathUtils.getDirection(npc.getPosition(), target.getPosition());
    if (stats.spells.length > 0 && this.tryUseSpell(npc, now, broadcast)) return;

    this.combatSystem.tryAttack(npc, target.tileX, target.tileY, broadcast, now);
  }

  private updateFlee(npc: Npc, map: TileMap, now: number, tickCount: number, roomId: string): void {
    const threat = this.spatial.findEntityBySessionId(npc.targetId);
    if (!threat || !threat.alive) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    const dist = MathUtils.manhattanDist(npc.getPosition(), threat.getPosition());
    if (dist > AGGRO_RANGE) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    const awayDir = this.getAwayDirection(npc, threat);
    this.movementSystem.tryMove(npc, awayDir, map, now, tickCount, roomId);
  }

  private updateReturn(npc: Npc, map: TileMap, now: number, tickCount: number, roomId: string): void {
    const dist = Math.abs(npc.spawnX - npc.tileX) + Math.abs(npc.spawnY - npc.tileY);
    if (dist === 0) {
      npc.hp = npc.maxHp;
      npc.state = NpcState.IDLE;
      return;
    }
    npc.hp = Math.min(npc.maxHp, npc.hp + Math.ceil(npc.maxHp * 0.02));
    this.moveTowards(npc, npc.spawnX, npc.spawnY, map, now, tickCount, roomId);
  }

  private moveTowards(npc: Npc, tx: number, ty: number, map: TileMap, now: number, tickCount: number, roomId: string): void {
    const dx = tx - npc.tileX;
    const dy = ty - npc.tileY;
    const primaryDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? Direction.RIGHT : Direction.LEFT) : (dy > 0 ? Direction.DOWN : Direction.UP);
    const result = this.movementSystem.tryMove(npc, primaryDir, map, now, tickCount, roomId);
    if (!result.success) {
      const altDir = (primaryDir === Direction.LEFT || primaryDir === Direction.RIGHT) ? (dy > 0 ? Direction.DOWN : Direction.UP) : (dx > 0 ? Direction.RIGHT : Direction.LEFT);
      this.movementSystem.tryMove(npc, altDir, map, now, tickCount, roomId);
    }
  }

  private getAwayDirection(npc: Npc, target: Entity): Direction {
    const dx = npc.tileX - target.tileX;
    const dy = npc.tileY - target.tileY;
    return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? Direction.RIGHT : Direction.LEFT) : (dy > 0 ? Direction.DOWN : Direction.UP);
  }

  private tryUseSpell(npc: Npc, now: number, broadcast: BroadcastFn): boolean {
    const stats = NPC_STATS[npc.type];
    if (!stats?.spells.length) return false;
    const target = this.spatial.findEntityBySessionId(npc.targetId);
    if (!target || !target.alive) return false;

    if (npc.hp / npc.maxHp < 0.3) {
      const healId = stats.spells.find((id) => SPELLS[id]?.effect === "heal");
      if (healId) return this.combatSystem.tryCast(npc, healId, npc.tileX, npc.tileY, broadcast, now);
    }

    const spellId = stats.spells[Math.floor(Math.random() * stats.spells.length)];
    return this.combatSystem.tryCast(npc, spellId, target.tileX, target.tileY, broadcast, now);
  }

  handleDeath(npc: Npc): void {
    this.buffSystem.removePlayer(npc.sessionId);
    this.respawns.push({ type: npc.type, deadAt: Date.now(), spawnX: npc.spawnX, spawnY: npc.spawnY });
    this.state.npcs.delete(npc.sessionId);
    this.spatial.removeFromGrid(npc);
  }
}
