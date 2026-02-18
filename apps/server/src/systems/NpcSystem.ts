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
import { logger } from "../logger";
import { SpatialLookup, Entity } from "../utils/SpatialLookup";

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
  ) {}

  spawnNpcs(count: number, map: TileMap): void {
    // Only randomly spawn non-passive NPC types
    const types = NPC_TYPES.filter((t) => !NPC_STATS[t].passive);

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      this.spawnNpc(type, map);
    }

    // Spawn one Merchant near the first player spawn point
    if (map.spawns.length > 0) {
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
    npc.alive = true;
    npc.state = NpcState.IDLE;
    npc.targetId = "";
    npc.patrolStepsLeft = 0;

    this.state.npcs.set(npc.sessionId, npc);
    this.spatial.addToGrid(npc);
  }

  private spawnNpc(type: NpcType, map: TileMap): void {
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
    _dt: number,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tickCount: number,
    roomId: string,
    broadcast: BroadcastFn,
  ): void {
    // Handle NPC respawns
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const r = this.respawns[i];
      if (now - r.deadAt >= NPC_RESPAWN_TIME_MS) {
        // Prefer original spawn position; fall back to a random tile if occupied
        const spawnFree =
          map.collision[r.spawnY]?.[r.spawnX] === 0 &&
          !this.spatial.isTileOccupied(r.spawnX, r.spawnY);
        if (spawnFree) {
          this.spawnNpcAt(r.type, map, r.spawnX, r.spawnY);
        } else {
          this.spawnNpc(r.type, map);
        }
        this.respawns.splice(i, 1);
      }
    }

    // Run AI state machine for each living NPC
    this.state.npcs.forEach((npc) => {
      if (!npc.alive) return;

      switch (npc.state) {
        case NpcState.IDLE:
          this.updateIdle(npc, tickCount);
          break;
        case NpcState.PATROL:
          this.updatePatrol(npc, map, now, occupiedCheck, tickCount, roomId);
          break;
        case NpcState.CHASE:
          this.updateChase(npc, map, now, occupiedCheck, tickCount, roomId);
          break;
        case NpcState.ATTACK:
          this.updateAttack(npc, now, broadcast);
          break;
        case NpcState.FLEE:
          this.updateFlee(npc, map, now, occupiedCheck, tickCount, roomId);
          break;
        case NpcState.RETURN:
          this.updateReturn(npc, map, now, occupiedCheck, tickCount, roomId);
          break;
        default:
          npc.state = NpcState.IDLE;
      }
    });
  }

  // ── IDLE ─────────────────────────────────────────────────────────────────

  private updateIdle(npc: Npc, tickCount: number): void {
    const stats = NPC_STATS[npc.type];
    if (stats.passive) return;

    // Throttle: scan every IDLE_SCAN_INTERVAL ticks to avoid O(N²) per tick
    if (tickCount % IDLE_SCAN_INTERVAL !== 0) return;

    const npcPos = npc.getPosition();
    const entities = this.spatial.findEntitiesInRadius(
      npc.tileX,
      npc.tileY,
      AGGRO_RANGE,
    );

    let nearest: Entity | null = null;
    let minDist = Infinity;

    for (const entity of entities) {
      // Only aggro players (never other NPCs)
      if (entity instanceof Player && entity.isAttackable()) {
        const dist = MathUtils.manhattanDist(npcPos, entity.getPosition());
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

    // No targets nearby — occasionally start a short wander
    if (Math.random() < 0.15) {
      npc.patrolStepsLeft = PATROL_STEPS;
      npc.state = NpcState.PATROL;
    }
  }

  // ── PATROL ───────────────────────────────────────────────────────────────

  private updatePatrol(
    npc: Npc,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tickCount: number,
    roomId: string,
  ): void {
    // Still check for players while wandering
    if (tickCount % IDLE_SCAN_INTERVAL === 0) {
      const entities = this.spatial.findEntitiesInRadius(
        npc.tileX,
        npc.tileY,
        AGGRO_RANGE,
      );
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

    const dirs = [
      Direction.UP,
      Direction.DOWN,
      Direction.LEFT,
      Direction.RIGHT,
    ];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    this.movementSystem.tryMove(
      npc,
      dir,
      map,
      now,
      occupiedCheck,
      tickCount,
      roomId,
    );
    npc.patrolStepsLeft--;
  }

  // ── CHASE ────────────────────────────────────────────────────────────────

  private updateChase(
    npc: Npc,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tickCount: number,
    roomId: string,
  ): void {
    const target = this.spatial.findEntityBySessionId(npc.targetId);

    if (!target || !target.isAttackable()) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    const stats = NPC_STATS[npc.type];

    // Flee if low HP
    if (stats.fleesWhenLow && npc.hp / npc.maxHp < FLEE_HP_THRESHOLD) {
      npc.state = NpcState.FLEE;
      return;
    }

    const npcPos = npc.getPosition();
    const targetPos = target.getPosition();
    const dist = MathUtils.manhattanDist(npcPos, targetPos);

    // Leash break — go home
    if (dist > AGGRO_RANGE * LEASH_MULTIPLIER) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    // In attack range
    if (dist <= stats.meleeRange) {
      // Ranged NPC kiting: back away if target is too close
      if (stats.meleeRange > 1 && dist < Math.max(2, stats.meleeRange / 2)) {
        const awayDir = this.getAwayDirection(npc, target);
        this.movementSystem.tryMove(npc, awayDir, map, now, occupiedCheck, tickCount, roomId);
      }
      npc.state = NpcState.ATTACK;
      return;
    }

    this.moveTowards(npc, target.tileX, target.tileY, map, now, occupiedCheck, tickCount, roomId);
  }

  // ── ATTACK ───────────────────────────────────────────────────────────────

  private updateAttack(npc: Npc, now: number, broadcast: BroadcastFn): void {
    const target = this.spatial.findEntityBySessionId(npc.targetId);
    if (!target || !target.isAttackable()) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    const stats = NPC_STATS[npc.type];

    // Flee if low HP
    if (stats.fleesWhenLow && npc.hp / npc.maxHp < FLEE_HP_THRESHOLD) {
      npc.state = NpcState.FLEE;
      return;
    }

    const npcPos = npc.getPosition();
    const targetPos = target.getPosition();
    const dist = MathUtils.manhattanDist(npcPos, targetPos);

    if (dist > stats.meleeRange) {
      npc.state = NpcState.CHASE;
      return;
    }

    npc.facing = MathUtils.getDirection(npcPos, targetPos);

    // Spells first (heal-priority when low); then melee
    if (stats.spells.length > 0 && this.tryUseSpell(npc, now, broadcast)) {
      return;
    }

    this.combatSystem.tryAttack(
      npc,
      target.tileX,
      target.tileY,
      broadcast,
      now,
    );
  }

  // ── FLEE ─────────────────────────────────────────────────────────────────

  private updateFlee(
    npc: Npc,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tickCount: number,
    roomId: string,
  ): void {
    const threat = this.spatial.findEntityBySessionId(npc.targetId);

    if (!threat || !threat.alive) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    const dist = MathUtils.manhattanDist(
      npc.getPosition(),
      threat.getPosition(),
    );

    // Far enough from threat → return home
    if (dist > AGGRO_RANGE) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    const awayDir = this.getAwayDirection(npc, threat);
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

  // ── RETURN ───────────────────────────────────────────────────────────────

  private updateReturn(
    npc: Npc,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tickCount: number,
    roomId: string,
  ): void {
    const dist = Math.abs(npc.spawnX - npc.tileX) + Math.abs(npc.spawnY - npc.tileY);

    if (dist === 0) {
      // Arrived — full HP reset and go idle
      npc.hp = npc.maxHp;
      npc.state = NpcState.IDLE;
      return;
    }

    // Regenerate 2% of max HP per tick while returning
    npc.hp = Math.min(npc.maxHp, npc.hp + Math.ceil(npc.maxHp * 0.02));

    this.moveTowards(npc, npc.spawnX, npc.spawnY, map, now, occupiedCheck, tickCount, roomId);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Moves `npc` one step toward (targetX, targetY).
   * Tries the dominant axis first; falls back to the perpendicular axis on collision.
   */
  private moveTowards(
    npc: Npc,
    targetX: number,
    targetY: number,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tickCount: number,
    roomId: string,
  ): void {
    const dx = targetX - npc.tileX;
    const dy = targetY - npc.tileY;

    const primaryDir =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0 ? Direction.RIGHT : Direction.LEFT
        : dy > 0 ? Direction.DOWN : Direction.UP;

    const success = this.movementSystem.tryMove(npc, primaryDir, map, now, occupiedCheck, tickCount, roomId);

    if (!success) {
      const altDir =
        primaryDir === Direction.LEFT || primaryDir === Direction.RIGHT
          ? dy > 0 ? Direction.DOWN : Direction.UP
          : dx > 0 ? Direction.RIGHT : Direction.LEFT;
      this.movementSystem.tryMove(npc, altDir, map, now, occupiedCheck, tickCount, roomId);
    }
  }

  /** Returns the direction directly away from `target`. Never null. */
  private getAwayDirection(npc: Npc, target: Entity): Direction {
    const dx = npc.tileX - target.tileX;
    const dy = npc.tileY - target.tileY;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      return dy > 0 ? Direction.DOWN : Direction.UP;
    }
  }

  /**
   * Attempts to use a spell. Prioritises self-heal when HP < 30%.
   * Returns true if a spell was successfully queued.
   */
  private tryUseSpell(npc: Npc, now: number, broadcast: BroadcastFn): boolean {
    const stats = NPC_STATS[npc.type];
    if (!stats?.spells.length) return false;

    const target = this.spatial.findEntityBySessionId(npc.targetId);
    if (!target || !target.alive) return false;

    // Prioritise heal when below 30% HP
    if (npc.hp / npc.maxHp < 0.3) {
      const healId = stats.spells.find((id) => SPELLS[id]?.effect === "heal");
      if (healId) {
        return this.combatSystem.tryCast(
          npc,
          healId,
          npc.tileX,
          npc.tileY,
          broadcast,
          now,
        );
      }
    }

    // Otherwise pick a random available spell
    const spellId =
      stats.spells[Math.floor(Math.random() * stats.spells.length)];
    return this.combatSystem.tryCast(
      npc,
      spellId,
      target.tileX,
      target.tileY,
      broadcast,
      now,
    );
  }

  handleDeath(npc: Npc): void {
    this.respawns.push({
      type: npc.type,
      deadAt: Date.now(),
      spawnX: npc.spawnX,
      spawnY: npc.spawnY,
    });
    this.state.npcs.delete(npc.sessionId);
    this.spatial.removeFromGrid(npc);
  }
}
