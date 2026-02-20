import { type BroadcastFn, EXP_TABLE, ServerMessageType } from "@abraxas/shared";
import type { Player } from "../schema/Player";

export class LevelService {
  constructor(
    private broadcast: BroadcastFn,
    private recalcStats: (player: Player) => void,
  ) {}

  gainXp(player: Player, amount: number) {
    player.xp += amount;

    while (player.xp >= player.maxXp) {
      player.xp -= player.maxXp;
      player.level++;
      player.maxXp = EXP_TABLE[player.level] || player.level * 100;

      // Recompute all stats including level bonuses; then fully restore HP/mana
      this.recalcStats(player);
      player.hp = player.maxHp;
      player.mana = player.maxMana;

      this.broadcast(ServerMessageType.LevelUp, {
        sessionId: player.sessionId,
        level: player.level,
      });
    }
  }
}
