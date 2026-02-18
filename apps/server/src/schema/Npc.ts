import { type } from "@colyseus/schema";
import { Char } from "./Char";
import { NPC_STATS } from "@abraxas/shared";
import type { NpcType, NpcStats } from "@abraxas/shared";

export class Npc extends Char {
  @type("string") type: NpcType = "orc";

  // AI state
  @type("string") state: string = "idle";
  @type("string") targetId: string = "";

  // Combat stats (public — all clients can see NPC strength)
  @type("uint8") str: number = 0;
  @type("uint8") agi: number = 0;
  @type("uint8") intStat: number = 0;

  getStats(): NpcStats | undefined {
    return NPC_STATS[this.type];
  }
}
