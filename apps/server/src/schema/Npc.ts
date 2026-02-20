import type { Ability, NpcStats, NpcType } from "@abraxas/shared";
import { ABILITIES, NPC_STATS, NpcState } from "@abraxas/shared";
import { type } from "@colyseus/schema";
import { Char } from "./Char";

export class Npc extends Char {
  @type("string") type: NpcType = "orc";
  @type("number") spellCastPercent = 0;

  @type("string") ownerId?: string;

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

  getStats(): NpcStats | undefined {
    return NPC_STATS[this.type];
  }

  getAbility(abilityId: string): Ability | undefined {
    return ABILITIES[abilityId];
  }
}
