import {
  ABILITIES,
  AGGRO_RANGE,
  type BroadcastFn,
  type ClassStats,
  DIRECTION_DELTA,
  Direction,

  EXP_TABLE,
  MathUtils,
  NPC_RESPAWN_TIME_MS,
  NPC_STATS,
  NPC_TYPES,
  NpcState,
  type NpcType,
  ServerMessageType,
  type TileMap,
} from "@abraxas/shared";
import { logger } from "../logger";
import type { GameState } from "../schema/GameState";
import { Npc } from "../schema/Npc";
import type { Player } from "../schema/Player";
import { Pathfinder } from "../utils/Pathfinder";
import type { Entity, SpatialLookup } from "../utils/SpatialLookup";
import { findSafeSpawn } from "../utils/spawnUtils";
import type { BuffSystem } from "./BuffSystem";
import type { CombatSystem } from "./CombatSystem";
import type { MovementSystem } from "./MovementSystem";
import type { NpcSpawner } from "./NpcSpawner";

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

/** Minimum ms between bark broadcasts per NPC (avoids bark spam). */
const BARK_COOLDOWN_MS = 8_000;



export class NpcSystem {
  /** Cached map reference updated each tick; used by handlers that need map access. */
  private currentMap!: TileMap;
  /** Broadcast fn set at the top of each tick and reused by bark helpers. */
  private broadcastFn!: BroadcastFn;

  constructor(
    private state: GameState,
    private movementSystem: MovementSystem,
    private combatSystem: CombatSystem,
    private spatial: SpatialLookup,
    private buffSystem: BuffSystem,
    public readonly spawner: NpcSpawner,
  ) {}

  // ── Spawn delegates (forwarded to NpcSpawner) ────────────────────────

  spawnNpcs(count: number, map: TileMap): void {
    this.spawner.spawnNpcs(count, map);
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
    return this.spawner.spawnNpcAt(type, map, tileX, tileY, ownerId, forcedLevel, persistenceData);
  }

  public spawnNpc(type: NpcType, map: TileMap, ownerId?: string): Npc | undefined {
    return this.spawner.spawnNpc(type, map, ownerId);
  }

  public spawnSummon(caster: Entity, abilityId: string, x: number, y: number): void {
    this.spawner.spawnSummon(caster, abilityId, x, y, this.currentMap);
  }

  tick(map: TileMap, now: number, tickCount: number, roomId: string, broadcast: BroadcastFn): void {
    // Store references for use in state handlers
    this.currentMap = map;
    this.broadcastFn = broadcast;
    this.spawner.processRespawns(map, now, NPC_RESPAWN_TIME_MS);

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

  /** Returns the effective aggro radius for this NPC.
   * Uses the per-NPC `aggroRange` stat when set; otherwise falls back to the
   * global AGGRO_RANGE constant.
   */
  private getAggroRange(npc: Npc): number {
    return NPC_STATS[npc.npcType].aggroRange ?? AGGRO_RANGE;
  }

  /** Finds the nearest attackable player within the NPC's aggro range, or null.
   *  Players standing inside a safe zone are excluded — NPCs should not aggro them.
   */
  private scanForAggroTarget(npc: Npc): Player | null {
    const candidate = this.spatial.findNearestPlayer(npc.tileX, npc.tileY, this.getAggroRange(npc));
    if (candidate && MathUtils.isInSafeZone(candidate.tileX, candidate.tileY, this.currentMap?.safeZones)) {
      return null;
    }
    return candidate;
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
      this.tryBark(npc, "aggro", this.broadcastFn);
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
    const distToSpawn = MathUtils.manhattanDist(npc.getPosition(), {
      x: npc.spawnX,
      y: npc.spawnY,
    });
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
    if (!target || !target.isAttackable() || MathUtils.isInSafeZone(target.tileX, target.tileY, this.currentMap?.safeZones)) {
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
    if (!target || !target.isAttackable() || MathUtils.isInSafeZone(target.tileX, target.tileY, this.currentMap?.safeZones)) {
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

    // Feature 29: Boss phase transition
    this.updateBossPhase(npc, now, broadcast);

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
        const t = this.spatial.findEntityAtTile(
          owner.bufferedAction.targetTileX!,
          owner.bufferedAction.targetTileY!,
        );
        if (t && t.alive && t.sessionId !== npc.sessionId) {
          npc.targetId = t.sessionId;
          npc.state = NpcState.CHASE;
          return;
        }
      }

      // Defend owner: scan for nearby hostiles targeting the owner
      const nearbyEnemies = this.spatial.findEntitiesInRadius(
        owner.tileX,
        owner.tileY,
        AGGRO_RANGE,
      );
      for (const enemy of nearbyEnemies) {
        if (enemy.isNpc() && enemy.targetId === owner.sessionId) {
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

    // P-6: Only recalculate if the target actually moved. When path is empty
    // but target hasn't moved (unreachable), skip — the naive fallback below handles it.
    if (npc.pathTargetTileX !== tx || npc.pathTargetTileY !== ty) {
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
    // D3: Use shared stat recalculation (resetHp=false to avoid full heal mid-combat)
    this.spawner.recalcNpcStats(npc, false);

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
        nx >= 0 &&
        nx < this.currentMap.width &&
        ny >= 0 &&
        ny < this.currentMap.height &&
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
      if (healId) {
        this.tryBark(npc, "low_hp", broadcast);
        return this.combatSystem.tryCast(npc, healId, npc.tileX, npc.tileY, broadcast, now);
      }
    }

    // Probability gate: only attempt an ability a fraction of eligible ticks so
    // NPCs mix in auto-attacks rather than spamming abilities at maximum cooldown rate.
    if (Math.random() > stats.abilityCastChance) return false;

    // Feature 30: Phase-aware ability pool.
    // In phase 2 (bossPhase >= 1), add phaseAbilities to the candidate pool.
    const phaseAbilities = npc.bossPhase >= 1 ? (stats.phaseAbilities ?? []) : [];
    const allAbilities = [...new Set([...stats.abilities, ...phaseAbilities])];

    // Only pick from abilities that are currently off cooldown; ignore ones still
    // on cooldown rather than wasting the roll and falling through to auto-attack.
    const available = allAbilities.filter((id: string) => {
      const cd = npc.spellCooldowns.get(id) ?? 0;
      return now >= cd;
    });
    if (!available.length) return false;

    // Prioritise: phaseAbilities come first when in phase 2, otherwise use order-as-priority.
    const ordered =
      npc.bossPhase >= 1
        ? [
            ...available.filter((id) => phaseAbilities.includes(id)),
            ...available.filter((id) => !phaseAbilities.includes(id)),
          ]
        : available;

    const abilityId = ordered[0];
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
      this.spawner.handleSummonCast(npc, this.currentMap);
    }

    return didCast;
  }

  // ── Feature 29: Boss Phase ────────────────────────────────────────────────
  /** Transitions the boss into phase 2 if HP has crossed the threshold. */
  private updateBossPhase(npc: Npc, now: number, broadcast: BroadcastFn): void {
    const stats = NPC_STATS[npc.npcType];
    if (!stats.bossPhaseThreshold || npc.bossPhase >= 1) return;
    if (npc.hp / npc.maxHp <= stats.bossPhaseThreshold) {
      npc.bossPhase = 1;
      npc.lastPhaseChangeAt = now;
      // Announce the transition
      broadcast(ServerMessageType.Notification, {
        message: `${npc.npcType.replaceAll("_", " ").toUpperCase()} enrages! The battle intensifies!`,
      });
      this.tryBark(npc, "low_hp", broadcast);
      logger.info({ intent: "boss_phase_2", npcId: npc.sessionId, type: npc.npcType });
    }
  }

  // ── Feature 32: Bark System ───────────────────────────────────────────────
  /**
   * Attempts to broadcast an NPC bark to all nearby clients.
   * Rate-limited by BARK_COOLDOWN_MS per NPC.
   */
  tryBark(npc: Npc, trigger: import("@abraxas/shared").BarkTrigger, broadcast: BroadcastFn): void {
    const stats = NPC_STATS[npc.npcType];
    const lines = stats.barks?.[trigger];
    if (!lines || lines.length === 0) return;

    const now = Date.now();
    if (now - npc.lastBarkAt < BARK_COOLDOWN_MS) return;

    npc.lastBarkAt = now;
    const text = lines[Math.floor(Math.random() * lines.length)];
    broadcast(ServerMessageType.NpcBark, { npcId: npc.sessionId, text });
  }

  handleDeath(npc: Npc): void {
    this.buffSystem.removePlayer(npc.sessionId);
    this.combatSystem.removeEntity(npc.sessionId);

    const stats = NPC_STATS[npc.npcType];
    const now = Date.now();

    if (stats.rareSpawnIntervalMs) {
      // Bug #27: Update the queue entry directly — the NPC is deleted below
      // so the forEach sync in tickRareSpawns would never see it.
      const respawnAt = now + stats.rareSpawnIntervalMs;
      const queueEntry = this.rareRespawnQueue.find((e) => e.npcType === npc.npcType);
      if (queueEntry) {
        queueEntry.rareRespawnAt = respawnAt;
      } else {
        this.rareRespawnQueue.push({
          npcType: npc.npcType,
          rareRespawnAt: respawnAt,
          spawnX: npc.spawnX,
          spawnY: npc.spawnY,
        });
      }
      logger.info({
        intent: "rare_npc_death",
        npcId: npc.sessionId,
        type: npc.npcType,
        respawnAt: new Date(respawnAt).toISOString(),
      });
    } else {
      this.spawner.queueRespawn(npc.npcType, npc.spawnX, npc.spawnY);
    }

    this.state.npcs.delete(npc.sessionId);
    this.spatial.removeFromGrid(npc);
  }

  // ── Feature 34: Rare spawn polling ───────────────────────────────────────
  /**
   * Called every tick by TickSystem.
   * Respawns rare NPCs whose `rareRespawnAt` timer has elapsed.
   * Rare NPCs are stored in the NPC registry with `rareRespawnAt > 0` and removed
   * from the map on death; we track pending rare respawns in a side array.
   */
  private rareRespawnQueue: {
    npcType: NpcType;
    rareRespawnAt: number;
    spawnX: number;
    spawnY: number;
  }[] = [];

  /** Register a rare NPC so its respawn timer can be polled. Call after map load. */
  registerRareNpc(type: NpcType, spawnX: number, spawnY: number, rareRespawnAt: number = 0): void {
    this.rareRespawnQueue.push({ npcType: type, rareRespawnAt, spawnX, spawnY });
  }

  tickRareSpawns(map: TileMap, now: number, broadcast: BroadcastFn): void {
    for (const entry of this.rareRespawnQueue) {
      if (entry.rareRespawnAt === 0 || now < entry.rareRespawnAt) continue;
      entry.rareRespawnAt = 0; // Reset — will be set again on next death via handleDeath
      const safe = this.spatial.isTileOccupied(entry.spawnX, entry.spawnY)
        ? null
        : { x: entry.spawnX, y: entry.spawnY };
      const spawnTile = safe ?? { x: entry.spawnX, y: entry.spawnY };
      this.spawner.spawnNpcAt(entry.npcType, map, spawnTile.x, spawnTile.y);
      broadcast(ServerMessageType.Notification, {
        message: `A ${entry.npcType.replaceAll("_", " ")} has been spotted in the world!`,
      });
      logger.info({ intent: "rare_npc_respawn", type: entry.npcType });
    }
  }
}
