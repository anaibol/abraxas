import { Player } from "../schema/Player";
import { EXP_TABLE, LEVEL_UP_STATS, ServerMessageType } from "@abraxas/shared";

export class LevelService {
  constructor(private broadcast: (type: any, data?: any) => void) {}

  gainXp(player: Player, amount: number) {
    player.xp += amount;
    
    while (player.xp >= player.maxXp) {
      player.xp -= player.maxXp;
      player.level++;
      
      // Update maxXp for the new level
      player.maxXp = EXP_TABLE[player.level] || player.level * 100;

      // Apply stat bonuses
      const bonus = LEVEL_UP_STATS[player.classType] || LEVEL_UP_STATS.WARRIOR;
      player.maxHp += bonus.hp;
      player.hp = player.maxHp;
      player.maxMana += bonus.mp;
      player.mana = player.maxMana;
      player.str += bonus.str;
      player.agi += bonus.agi;
      player.intStat += bonus.int;

      // Notify the world
      this.broadcast(ServerMessageType.LevelUp, {
        sessionId: player.sessionId,
        level: player.level,
      });
    }
  }
}
