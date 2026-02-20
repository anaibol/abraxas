import {
  ABILITIES,
  AGGRO_RANGE,
  type BroadcastFn,
  DIRECTION_DELTA,
  Direction,
  MathUtils,
  NPC_RESPAWN_TIME_MS,
  NPC_STATS,
  NPC_TYPES,
  NpcState,
  type NpcType,
  type TileMap,
} from "@abraxas/shared";
import { logger } from "../logger";
import type { GameState } from "../schema/GameState";
import { Npc } from "../schema/Npc";
import type { Player } from "../schema/Player";
import type { Entity, SpatialLookup } from "../utils/SpatialLookup";
import { findSafeSpawn } from "../utils/spawnUtils";
import { Pathfinder } from "../utils/Pathfinder";
import type { BuffSystem } from "./BuffSystem";
import type { CombatSystem } from "./CombatSystem";
import type { MovementSystem } from "./MovementSystem";

/** Scan for targets every N ticks (~500 ms at 20 TPS). */
const IDLE_SCAN_INTERVAL = 10;

/** Flee when HP falls below this fraction of max HP. */
const FLEE_HP_THRESHOLD = 0.25;

/** Drop aggro when distance exceeds this multiple of AGGRO_RANGE. */
const LEASH_MULTIPLIER = 1.5;

/** Number of random steps taken during a PATROL wander. */
const PATROL_STEPS = 4;

/** Max Manhattan distance a patrolling NPC may wander from its spawn point. */
const PATROL_TETHER_RADIUS = 8;

/** Boss/rare NPCs get a larger initial aggro radius (multiplier of AGGRO_RANGE). */
const BOSS_AGGRO_MULTIPLIER = 1.5;

/** Max number of live summon minions per summoner. */
const MAX_SUMMONS = 3;

type RespawnEntry = {
  type: NpcType;
  deadAt: number;
  spawnX: number;
  spawnY: number;
};

export class NpcSystem {
  private respawns: RespawnEntry[] = [];
  /** Cached map reference updated each tick; used by handlers that need map access. */
  private currentMap!: TileMap;

  constructor(
    private state: GameState,
    private movementSystem: MovementSystem,
    private combatSystem: CombatSystem,
    private spatial: SpatialLookup,
    private buffSystem: BuffSystem,
  ) {}

  spawnNpcs(count: number, map: TileMap): void {
    // Exclude passive NPCs (merchants/bankers) and rare/boss NPCs from the
    // random world-spawn pool. Rare NPCs must be placed via map.npcs entries.
    const types = NPC_TYPES.filter((t) => !NPC_STATS[t].passive && !NPC_STATS[t].rareSpawn);

    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      this.spawnNpc(type, map);
    }

    const mapHasMerchant = map.npcs?.some((n) => n.type === "merchant");
    if (!mapHasMerchant && map.spawns.length > 0) {
      this.spawnNpcAt("merchant", map, map.spawns[0].x + 2, map.spawns[0].y);
    }
  }

  public spawnNpcAt(type: NpcType, map: TileMap, x: number, y: number, ownerId?: string): void {
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
    if (ownerId) npc.ownerId = ownerId;

    this.state.npcs.set(npc.sessionId, npc);
    this.spatial.addToGrid(npc);
  }

    npc.spawnY = y;
    // Pick a random walkable tile then spiral to avoid any occupied cell
    for (let attempt = 0; attempt < 20; attempt++) {
      const rx = Math.floor(Math.random() * map.width);
      const ry = Math.floor(Math.random() * map.height);
      if (map.collision[ry]?.[rx] !== 0) continue;

      const safe = findSafeSpawn(rx, ry, map, this.spatial);
      if (safe) {
        this.spawnNpcAt(type, map, safe.x, safe.y, ownerId);
        return;
      }
    }

    logger.error({ intent: "spawn_npc", result: "failed", type });
  }

  tick(map: TileMap, now: number, tickCount: number, roomId: string, broadcast: BroadcastFn): void {
    // Store map reference for use in state handlers
    this.currentMap = map;
    this.respawns = this.respawns.filter((r) => {
      if (now - r.deadAt < NPC_RESPAWN_TIME_MS) return true;
      const safe = findSafeSpawn(r.spawnX, r.spawnY, map, this.spatial);
      safe ? this.spawnNpcAt(r.type, map, safe.x, safe.y) : this.spawnNpc(r.type, map);
      return false;
    });

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

  /** Returns the effective aggro radius for this NPC (bosses get a bonus). */
  private getAggroRange(npc: Npc): number {
    return NPC_STATS[npc.type].rareSpawn
      ? Math.floor(AGGRO_RANGE * BOSS_AGGRO_MULTIPLIER)
      : AGGRO_RANGE;
  }

  /** Finds the nearest attackable player within the NPC's aggro range, or null. */
  private scanForAggroTarget(npc: Npc): Player | null {
    return this.spatial.findNearestPlayer(npc.tileX, npc.tileY, this.getAggroRange(npc));
  }

  private updateIdle(npc: Npc, tickCount: number): void {
    const stats = NPC_STATS[npc.type];
    if (stats.passive) return;
    if (tickCount % IDLE_SCAN_INTERVAL !== 0) return;

    const target = this.scanForAggroTarget(npc);
    if (target) {
      npc.targetId = target.sessionId;
      npc.state = NpcState.CHASE;
      return;
    }

    if (Math.random() < 0.15) {
      npc.patrolStepsLeft = PATROL_STEPS;
      npc.state = NpcState.PATROL;
    }
  }

  private updatePatrol(
    npc: Npc,
    map: TileMap,
    now: number,
    tickCount: number,
    roomId: string,
  ): void {
    if (tickCount % IDLE_SCAN_INTERVAL === 0) {
      const target = this.scanForAggroTarget(npc);
      if (target) {
        npc.targetId = target.sessionId;
        npc.state = NpcState.CHASE;
        return;
      }
    }

    if (npc.patrolStepsLeft <= 0) {
      npc.state = NpcState.IDLE;
      return;
    }

    const dir = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT][
      Math.floor(Math.random() * 4)
    ];

    // Tether: discard the step (but still count it) if it would take the NPC
    // too far from its spawn point, so it stays in its home area.
    const { dx, dy } = DIRECTION_DELTA[dir];
    const nx = npc.tileX + dx;
    const ny = npc.tileY + dy;
    if (
      MathUtils.manhattanDist({ x: nx, y: ny }, { x: npc.spawnX, y: npc.spawnY }) <=
      PATROL_TETHER_RADIUS
    ) {
      this.movementSystem.tryMove(npc, dir, map, now, tickCount, roomId);
    }
    npc.patrolStepsLeft--;
  }

  /** Returns true and transitions to FLEE if the NPC should flee. */
  private checkAndFlee(npc: Npc): boolean {
    const stats = NPC_STATS[npc.type];
    if (stats.fleesWhenLow && npc.hp / npc.maxHp < FLEE_HP_THRESHOLD) {
      npc.state = NpcState.FLEE;
      return true;
    }
    return false;
  }

  private updateChase(
    npc: Npc,
    map: TileMap,
    now: number,
    tickCount: number,
    roomId: string,
  ): void {
    const target = this.spatial.findEntityBySessionId(npc.targetId);
    if (!target || !target.isAttackable()) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    if (this.checkAndFlee(npc)) return;

    const stats = NPC_STATS[npc.type];
    const dist = MathUtils.manhattanDist(npc.getPosition(), target.getPosition());
    if (dist > AGGRO_RANGE * LEASH_MULTIPLIER) {
      npc.targetId = "";
      npc.state = NpcState.RETURN;
      return;
    }

    if (dist <= stats.attackRange) {
      if (stats.attackRange > 1 && dist < Math.max(2, stats.attackRange / 2)) {
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

    if (this.checkAndFlee(npc)) return;

    const stats = NPC_STATS[npc.type];
    const dist = MathUtils.manhattanDist(npc.getPosition(), target.getPosition());
    if (dist > stats.attackRange) {
      npc.state = NpcState.CHASE;
      return;
    }

    npc.facing = MathUtils.getDirection(npc.getPosition(), target.getPosition());
    if (stats.abilities.length > 0 && this.tryUseAbility(npc, now, broadcast)) return;

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

  private updateReturn(
    npc: Npc,
    map: TileMap,
    now: number,
    tickCount: number,
    roomId: string,
  ): void {
    // Re-aggro any player that wanders into range while the NPC is heading home.
    if (tickCount % IDLE_SCAN_INTERVAL === 0) {
      const target = this.scanForAggroTarget(npc);
      if (target) {
        npc.targetId = target.sessionId;
        npc.state = NpcState.CHASE;
        return;
      }
    }

    const dist = MathUtils.manhattanDist(npc.getPosition(), { x: npc.spawnX, y: npc.spawnY });
    if (dist === 0) {
      npc.hp = npc.maxHp;
      npc.state = NpcState.IDLE;
      return;
    }
    npc.hp = Math.min(npc.maxHp, npc.hp + Math.ceil(npc.maxHp * 0.02));
    this.moveTowards(npc, npc.spawnX, npc.spawnY, map, now, tickCount, roomId);
  }

  private moveTowards(
    npc: Npc,
    tx: number,
    ty: number,
    map: TileMap,
    now: number,
    tickCount: number,
    roomId: string,
  ): void {
    const dx = tx - npc.tileX;
    const dy = ty - npc.tileY;

    if (dx === 0 && dy === 0) {
      npc.path = [];
      return;
    }

    // Recalculate if target moved or path is empty
    if (
      npc.pathTargetTileX !== tx ||
      npc.pathTargetTileY !== ty ||
      npc.path.length === 0
    ) {
      npc.pathTargetTileX = tx;
      npc.pathTargetTileY = ty;
      npc.path = Pathfinder.findPath(
        npc.tileX,
        npc.tileY,
        tx,
        ty,
        map,
        this.spatial,
        npc.sessionId,
      );
    }

    if (npc.path.length === 0) {
      // Target is unreachable or path fails.
      // Fallback to a single naive step rather than freezing entirely.
      const primaryDir = MathUtils.getDirection(npc.getPosition(), { x: tx, y: ty });
      this.movementSystem.tryMove(npc, primaryDir, map, now, tickCount, roomId);
      return;
    }

    // Peek next step
    const nextStep = npc.path[0];
    const dir = MathUtils.getDirection(npc.getPosition(), { x: nextStep.x, y: nextStep.y });

    const result = this.movementSystem.tryMove(npc, dir, map, now, tickCount, roomId);
    
    if (result.success) {
      // Successfully moved, consume the step
      npc.path.shift();
    } else {
      // Path is blocked (e.g. by another newly moved entity)! Clear path to force recalculation next tick.
      npc.path = [];

      // Try a naive alt-move so we don't just stand still this tick.
      if (dx !== 0 && dy !== 0) {
        const primaryDir = MathUtils.getDirection(npc.getPosition(), { x: tx, y: ty });
        const altDir =
          primaryDir === Direction.LEFT || primaryDir === Direction.RIGHT
            ? dy > 0
              ? Direction.DOWN
              : Direction.UP
            : dx > 0
              ? Direction.RIGHT
              : Direction.LEFT;
        this.movementSystem.tryMove(npc, altDir, map, now, tickCount, roomId);
      }
    }
  }

  private getAwayDirection(npc: Npc, target: Entity): Direction {
    const dx = npc.tileX - target.tileX;
    const dy = npc.tileY - target.tileY;
    return Math.abs(dx) >= Math.abs(dy)
      ? dx >= 0
        ? Direction.RIGHT
        : Direction.LEFT
      : dy > 0
        ? Direction.DOWN
        : Direction.UP;
  }

  private tryUseAbility(npc: Npc, now: number, broadcast: BroadcastFn): boolean {
    const stats = NPC_STATS[npc.type];
    if (!stats?.abilities.length) return false;
    const target = this.spatial.findEntityBySessionId(npc.targetId);
    if (!target || !target.alive) return false;

    // Emergency heal takes priority regardless of the cast-chance roll.
    if (npc.hp / npc.maxHp < 0.3) {
      const healId = stats.abilities.find((id) => ABILITIES[id]?.effect === "heal");
      if (healId)
        return this.combatSystem.tryCast(npc, healId, npc.tileX, npc.tileY, broadcast, now);
    }

    // Probability gate: only attempt an ability a fraction of eligible ticks so
    // NPCs mix in auto-attacks rather than spamming abilities at maximum cooldown rate.
    const abilityCastChance = stats.abilityCastChance ?? 0.4;
    if (Math.random() > abilityCastChance) return false;

    // Only pick from abilities that are currently off cooldown; ignore ones still
    // on cooldown rather than wasting the roll and falling through to auto-attack.
    const available = stats.abilities.filter((id) => {
      const cd = npc.spellCooldowns.get(id) ?? 0;
      return now >= cd;
    });
    if (!available.length) return false;

    const abilityId = available[Math.floor(Math.random() * available.length)];
    const didCast = this.combatSystem.tryCast(
      npc,
      abilityId,
      target.tileX,
      target.tileY,
      broadcast,
      now,
    );

    // If the chosen ability is a summon, actually spawn the minion server-side.
    if (didCast && ABILITIES[abilityId]?.effect === "summon") {
      this.handleSummonCast(npc);
    }

    return didCast;
  }

  /**
   * Called after a successful summon cast. Spawns one minion of the type
   * configured on the summoner's NpcStats.summonType, adjacent to the summoner,
   * up to MAX_SUMMONS total live summons.
   */
  private handleSummonCast(summoner: Npc): void {
    const map = this.currentMap;
    const stats = NPC_STATS[summoner.type];
    if (!stats.summonType) return;

    // Count how many minions this specific summoner has alive to enforce the cap.
    let liveMinions = 0;
    this.state.npcs.forEach((n) => {
      if (n.ownerId === summoner.sessionId && n.alive) liveMinions++;
    });
    if (liveMinions >= MAX_SUMMONS) return;

    // Try to place the minion in one of the four adjacent tiles.
    const dirs = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    for (const dir of dirs) {
      const { dx, dy } = DIRECTION_DELTA[dir];
      const tx = summoner.tileX + dx;
      const ty = summoner.tileY + dy;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
      if (map.collision[ty]?.[tx] !== 0) continue;
      if (this.spatial.isTileOccupied(tx, ty)) continue;
      this.spawnNpcAt(stats.summonType, map, tx, ty, summoner.sessionId);
      return;
    }
    // No adjacent tile free — fall back to a random spawn.
    this.spawnNpc(stats.summonType, map, summoner.sessionId);
  }

  handleDeath(npc: Npc): void {
    this.buffSystem.removePlayer(npc.sessionId);
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
