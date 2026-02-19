import { type } from "@colyseus/schema";
import { Char } from "./Char";
import { NPC_STATS, ABILITIES } from "@abraxas/shared";
import { NpcState } from "@abraxas/shared";
import type { NpcType, NpcStats, Ability } from "@abraxas/shared";

export class Npc extends Char {
  @type("string") type: NpcType = "orc";

  // ── Server-only AI fields (not synced to clients) ──────────────────────
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

  getStats(): NpcStats | undefined {
    return NPC_STATS[this.type];
  }

  getAbility(abilityId: string): Ability | undefined {
    return ABILITIES[abilityId];
  }
}
