import {
  ABILITIES,
  type Ability,
  EntityType,
  NPC_STATS,
  NpcState,
  type NpcStats,
  type NpcType,
} from "@abraxas/shared";
import { type } from "@colyseus/schema";
import { Char } from "./Char";

export class Npc extends Char {
  @type("string") npcType: NpcType = "orc";
  @type("uint8") spellCastPercent = 0;

  constructor() {
    super();
    this.entityType = EntityType.NPC;
  }

  @type("string") ownerId?: string;
  @type("uint8") level: number = 1;
  @type("uint32") exp: number = 0;

  @type("boolean") isUnique: boolean = false;
  @type("string") uniqueId?: string;
  @type("string") dbId?: string;

  // Server-only dataAI fields (not synced to clients) ──────────────────────
  /** Current AI state machine state. */
  state: NpcState = NpcState.IDLE;
  /** Session ID of the current chase/attack target. */
  targetId: string = "";
  /** Original spawn tile X — used for leashing and respawn. */
  spawnX: number = 0;
  /** Original spawn tile Y — used for leashing and respawn. */
  spawnY: number = 0;
  /** Steps remaining in PATROL wander before returning to IDLE. */
  patrolStepsLeft: number = 0;
  /** Cached A* path to follow. */
  path: { x: number; y: number }[] = [];
  /** X coordinate of the target the cached path goes to. */
  pathTargetTileX: number = -1;
  /** Y coordinate of the target the cached path goes to. */
  pathTargetTileY: number = -1;

  // ── Feature 29: Boss mechanics ─────────────────────────────────────────────
  /** Current boss phase (0 = normal, 1 = phase 2 triggered). */
  bossPhase: number = 0;
  /** Timestamp when the boss last transitioned phases (ms). */
  lastPhaseChangeAt: number = 0;

  // ── Feature 32: Bark system ────────────────────────────────────────────────
  /** Timestamp of the last bark broadcast (rate-limited). */
  lastBarkAt: number = 0;

  // ── Feature 34: Elite/Rare spawn timer ────────────────────────────────────
  /** Unix ms after which this rare NPC is allowed to respawn. 0 = not tracked. */
  rareRespawnAt: number = 0;

  getStats(): NpcStats | undefined {
    return NPC_STATS[this.npcType];
  }

  getAbility(abilityId: string): Ability | undefined {
    return ABILITIES[abilityId];
  }

  isPlayer(): this is never {
    return false;
  }

  isNpc(): this is Npc {
    return true;
  }
}
