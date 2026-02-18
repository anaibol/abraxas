import { type } from "@colyseus/schema";
import { Char } from "./Char";
import { NPC_STATS } from "@abraxas/shared";
import { NpcState } from "@abraxas/shared";
import type { NpcType, NpcStats } from "@abraxas/shared";

export class Npc extends Char {
  @type("string") type: NpcType = "orc";

  // Combat stats (public — all clients can see NPC strength)
  @type("uint8") str: number = 0;
  @type("uint8") agi: number = 0;
  @type("uint8") intStat: number = 0;

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
}
