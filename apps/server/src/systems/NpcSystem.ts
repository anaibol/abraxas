import {
  ABILITIES,
  AGGRO_RANGE,
  type BroadcastFn,
  DIRECTION_DELTA,
  Direction,
  EntityType,
  EXP_TABLE,
  MathUtils,
  NPC_RESPAWN_TIME_MS,
  NPC_STATS,
  NPC_TYPES,
  NpcState,
  type NpcType,
  ServerMessageType,
  type TileMap,
  type ClassStats,
} from "@abraxas/shared";
import { logger } from "../logger";
import type { GameState } from "../schema/GameState";
import { Npc } from "../schema/Npc";
import { Player } from "../schema/Player";
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
  npcType: NpcType;
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
      this.spawnNpcAt("merchant" as NpcType, map, map.spawns[0].x + 2, map.spawns[0].y);
    }
  }

  public spawnNpcAt(
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

    // Determine initial level
    if (forcedLevel !== undefined) {
      npc.level = forcedLevel;
    } else {
      npc.level = this.calculateSpawnLevel(type, map);
    }

    const stats = NPC_STATS[type];

    // Scale stats based on level (10% increase per level above 1)
    const scale = 1 + (npc.level - 1) * 0.1;
    npc.maxHp = Math.ceil(stats.hp * scale);
    npc.hp = npc.maxHp;
    npc.str = Math.ceil(stats.str * scale);
    npc.agi = Math.ceil(stats.agi * scale);
    npc.intStat = Math.ceil(stats.int * scale);
    npc.armor = Math.ceil(stats.armor * scale);

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

  private calculateSpawnLevel(npcType: NpcType, map: TileMap): number {
    const stats = NPC_STATS[npcType];
    if (stats.minLevel !== undefined && stats.maxLevel !== undefined) {
      return Math.floor(Math.random() * (stats.maxLevel - stats.minLevel + 1)) + stats.minLevel;
    } else if (stats.minLevel !== undefined) {
      return stats.minLevel;
    }
    return 1; // Default level
  }

  public spawnNpc(type: NpcType, map: TileMap, ownerId?: string): void {
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

    logger.error({ intent: "spawn_npc", result: "failed", npcType: type });
  }

  public spawnSummon(caster: Entity, abilityId: string, x: number, y: number): void {
    const ability = ABILITIES[abilityId];
    if (!ability) return;

    // Determine what to summon: ability ID encodes the type, or fall back to
    // the caster's configured summonType (used by NPC summoners).
    let typeToSummon: NpcType = "skeleton";
    if (abilityId === "summon_skeleton") typeToSummon = "skeleton";
    else if (abilityId === "summon_zombie") typeToSummon = "zombie";
    else if (caster instanceof Npc) {
      const npcStats = NPC_STATS[caster.npcType];
      if (npcStats?.summonType) typeToSummon = npcStats.summonType;
    }

    // Check caps
    const ownerStats = caster.getStats();
    let cap = 1;
    if (ownerStats && "maxCompanions" in ownerStats) {
      cap = (ownerStats as ClassStats).maxCompanions;
    }

    let liveMinions = 0;
    this.state.npcs.forEach((n) => {
      if (n.ownerId === caster.sessionId && n.alive) liveMinions++;
    });

    if (liveMinions >= cap) {
      // Find oldest summon and kill it to make room? Or just block?
      // Blocking for now as is traditional.
      return;
    }

    // Attempt to spawn at target tile
    const safe = findSafeSpawn(x, y, this.currentMap, this.spatial);
    const casterLevel = caster instanceof Npc || caster instanceof Player ? caster.level : 1;

    if (safe) {
      this.spawnNpcAt(typeToSummon, this.currentMap, safe.x, safe.y, caster.sessionId, casterLevel);
    } else {
      // Find safe spot near caster instead
      const fallback = findSafeSpawn(caster.tileX, caster.tileY, this.currentMap, this.spatial);
      if (fallback) {
        this.spawnNpcAt(
          typeToSummon,
          this.currentMap,
          fallback.x,
          fallback.y,
          caster.sessionId,
          casterLevel,
        );
      }
    }
  }

  tick(map: TileMap, now: number, tickCount: number, roomId: string, broadcast: BroadcastFn): void {
    // Store map reference for use in state handlers
    this.currentMap = map;
    this.respawns = this.respawns.filter((r) => {
      if (now - r.deadAt < NPC_RESPAWN_TIME_MS) return true;
      const safe = findSafeSpawn(r.spawnX, r.spawnY, map, this.spatial);
      safe ? this.spawnNpcAt(r.npcType, map, safe.x, safe.y) : this.spawnNpc(r.npcType, map);
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
        case NpcState.FOLLOW:
          this.updateFollow(npc, map, now, tickCount, roomId);
          break;
        default:
          npc.state = npc.ownerId ? NpcState.FOLLOW : NpcState.IDLE;
      }
    });
  }

  /** Returns the effective aggro radius for this NPC (bosses get a bonus). */
  private getAggroRange(npc: Npc): number {
    return NPC_STATS[npc.npcType].rareSpawn
      ? Math.floor(AGGRO_RANGE * BOSS_AGGRO_MULTIPLIER)
      : AGGRO_RANGE;
  }

  /** Finds the nearest attackable player within the NPC's aggro range, or null. */
  private scanForAggroTarget(npc: Npc): Player | null {
    return this.spatial.findNearestPlayer(npc.tileX, npc.tileY, this.getAggroRange(npc));
  }

  private updateIdle(npc: Npc, tickCount: number): void {
    if (npc.ownerId) {
      npc.state = NpcState.FOLLOW;
      return;
    }

    const stats = NPC_STATS[npc.npcType];
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

    // Tether sanity check (B018): If already outside radius, head home.
    const distToSpawn = MathUtils.manhattanDist(npc.getPosition(), { x: npc.spawnX, y: npc.spawnY });
    if (distToSpawn > PATROL_TETHER_RADIUS + 1) {
      npc.state = NpcState.RETURN;
      return;
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
    const stats = NPC_STATS[npc.npcType];
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

    const stats = NPC_STATS[npc.npcType];
    const dist = MathUtils.manhattanDist(npc.getPosition(), target.getPosition());
    const maxLeash = npc.ownerId ? AGGRO_RANGE * 2 : AGGRO_RANGE * LEASH_MULTIPLIER;
    
    if (dist > maxLeash) {
      npc.targetId = "";
      npc.state = npc.ownerId ? NpcState.FOLLOW : NpcState.RETURN;
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
      npc.state = npc.ownerId ? NpcState.FOLLOW : NpcState.RETURN;
      return;
    }

    if (this.checkAndFlee(npc)) return;

    const stats = NPC_STATS[npc.npcType];
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
      npc.state = npc.ownerId ? NpcState.FOLLOW : NpcState.RETURN;
      return;
    }

    const dist = MathUtils.manhattanDist(npc.getPosition(), threat.getPosition());
    if (dist > AGGRO_RANGE) {
      npc.targetId = "";
      npc.state = npc.ownerId ? NpcState.FOLLOW : NpcState.RETURN;
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
    npc.hp = Math.min(npc.maxHp, npc.hp + Math.ceil(npc.maxHp * 0.005));
    this.moveTowards(npc, npc.spawnX, npc.spawnY, map, now, tickCount, roomId);
  }

  private updateFollow(
    npc: Npc,
    map: TileMap,
    now: number,
    tickCount: number,
    roomId: string,
  ): void {
    if (!npc.ownerId) {
      npc.state = NpcState.RETURN;
      return;
    }

    const owner = this.spatial.findEntityBySessionId(npc.ownerId);
    if (!owner || !owner.alive) {
      // Owner is gone or dead. Let companion idle here until owner returns/revives.
      return;
    }

    // Leash to owner if too far
    const distToOwner = MathUtils.manhattanDist(npc.getPosition(), owner.getPosition());
    if (distToOwner > 15) {
      // B009: always teleport to a safe tile near the owner, never their exact tile.
      const safe = findSafeSpawn(owner.tileX, owner.tileY, map, this.spatial);
      if (safe) {
        const oldX = npc.tileX;
        const oldY = npc.tileY;
        npc.tileX = safe.x;
        npc.tileY = safe.y;
        npc.path = [];
        this.spatial.updatePosition(npc, oldX, oldY);
      }
      // If no safe spot found, stay in place rather than overlapping the owner.
      return;
    }

    // Assist owner in combat
    if (tickCount % IDLE_SCAN_INTERVAL === 0) {
      // If owner has an active attack buffer/windup, attack their target
      if (owner.bufferedAction?.type === "attack") {
        const t = this.spatial.findEntityAtTile(owner.bufferedAction.targetTileX!, owner.bufferedAction.targetTileY!);
        if (t && t.alive && t.sessionId !== npc.sessionId) {
          npc.targetId = t.sessionId;
          npc.state = NpcState.CHASE;
          return;
        }
      }
      
      // Defend owner: scan for nearby hostiles targeting the owner
      const nearbyEnemies = this.spatial.findEntitiesInRadius(owner.tileX, owner.tileY, AGGRO_RANGE);
      for (const enemy of nearbyEnemies) {
        if (enemy.entityType === EntityType.NPC && (enemy as Npc).targetId === owner.sessionId) {
          npc.targetId = enemy.sessionId;
          npc.state = NpcState.CHASE;
          return;
        }
      }
    }

    // Move to tether range
    if (distToOwner > 2) {
      this.moveTowards(npc, owner.tileX, owner.tileY, map, now, tickCount, roomId);
    } else {
      npc.path = [];
      // Naturally regenerate HP while following and resting (B008)
      if (tickCount % 25 === 0 && npc.hp < npc.maxHp) {
        npc.hp = Math.min(npc.maxHp, npc.hp + Math.ceil(npc.maxHp * 0.02));
      }
    }
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

  public gainExp(npc: Npc, amount: number, roomId: string, broadcast: BroadcastFn): void {
    if (!npc.alive || !npc.ownerId) return;

    npc.exp += amount;

    let nextLevelExp = EXP_TABLE[npc.level] || npc.level * 100;
    while (npc.exp >= nextLevelExp) {
      npc.exp -= nextLevelExp;
      this.levelUp(npc, roomId, broadcast);
      nextLevelExp = EXP_TABLE[npc.level] || npc.level * 100;
    }
  }

  private levelUp(npc: Npc, roomId: string, broadcast: BroadcastFn): void {
    npc.level++;

    // Stat boosts: ~10% increase per level based on base stats
    const stats = NPC_STATS[npc.npcType];
    const scale = 1 + (npc.level - 1) * 0.1;
    npc.maxHp = Math.ceil(stats.hp * scale);
    npc.hp = npc.maxHp;
    npc.str = Math.ceil(stats.str * scale);
    npc.agi = Math.ceil(stats.agi * scale);
    npc.intStat = Math.ceil(stats.int * scale);
    npc.armor = Math.ceil(stats.armor * scale);

    broadcast(ServerMessageType.LevelUp, {
      sessionId: npc.sessionId,
      level: npc.level,
    });

    logger.info({
      intent: "npc_levelup",
      sessionId: npc.sessionId,
      type: npc.npcType,
      level: npc.level,
      room: roomId,
    });
  }

  private getAwayDirection(npc: Npc, target: Entity): Direction {
    const dx = npc.tileX - target.tileX;
    const dy = npc.tileY - target.tileY;

    // Primary candidates for "away"
    const candidates: Direction[] = [];
    if (Math.abs(dx) >= Math.abs(dy)) {
      candidates.push(dx >= 0 ? Direction.RIGHT : Direction.LEFT);
      candidates.push(dy >= 0 ? Direction.DOWN : Direction.UP);
    } else {
      candidates.push(dy >= 0 ? Direction.DOWN : Direction.UP);
      candidates.push(dx >= 0 ? Direction.RIGHT : Direction.LEFT);
    }

    // Pick the first candidate that is actually walkable (B011)
    for (const dir of candidates) {
      const delta = DIRECTION_DELTA[dir];
      const nx = npc.tileX + delta.dx;
      const ny = npc.tileY + delta.dy;

      // Basic collision check (ignoring occupancy for flee flexibility)
      if (
        nx >= 0 && nx < this.currentMap.width &&
        ny >= 0 && ny < this.currentMap.height &&
        this.currentMap.collision[ny]?.[nx] === 0
      ) {
        return dir;
      }
    }

    // If all else fails, just return the first one
    return candidates[0];
  }

  private tryUseAbility(npc: Npc, now: number, broadcast: BroadcastFn): boolean {
    const stats = NPC_STATS[npc.npcType];
    if (!stats || !stats.abilities.length) return false;
    const target = this.spatial.findEntityBySessionId(npc.targetId);
    if (!target || !target.alive) return false;

    // Emergency heal takes priority regardless of the cast-chance roll.
    if (npc.hp / npc.maxHp < 0.3) {
      const healId = stats.abilities.find((id: string) => ABILITIES[id]?.effect === "heal");
      if (healId)
        return this.combatSystem.tryCast(npc, healId, npc.tileX, npc.tileY, broadcast, now);
    }

    // Probability gate: only attempt an ability a fraction of eligible ticks so
    // NPCs mix in auto-attacks rather than spamming abilities at maximum cooldown rate.
    if (Math.random() > stats.abilityCastChance) return false;

    // Only pick from abilities that are currently off cooldown; ignore ones still
    // on cooldown rather than wasting the roll and falling through to auto-attack.
    const available = stats.abilities.filter((id: string) => {
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
    const stats = NPC_STATS[summoner.npcType];
    if (!stats.summonType) return;

    // Use dynamic limit if summoner is a Player's companion, otherwise fallback to 3
    let cap = 3;
    const owner = summoner.ownerId ? this.spatial.findEntityBySessionId(summoner.ownerId) : null;
    if (owner && owner.getStats() && "maxCompanions" in owner.getStats()!) {
      cap = (owner.getStats() as import("@abraxas/shared").ClassStats).maxCompanions;
    }

    // Count how many minions this specific summoner has alive to enforce the cap.
    let liveMinions = 0;
    this.state.npcs.forEach((n) => {
      if (n.ownerId === summoner.sessionId && n.alive) liveMinions++;
    });
    if (liveMinions >= cap) return;

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
    this.combatSystem.removeEntity(npc.sessionId);
    this.respawns.push({
      npcType: npc.npcType,
      deadAt: Date.now(),
      spawnX: npc.spawnX,
      spawnY: npc.spawnY,
    });
    this.state.npcs.delete(npc.sessionId);
    this.spatial.removeFromGrid(npc);
  }
}
