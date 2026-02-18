import { Player } from "../schema/Player";
import { Npc } from "../schema/Npc";
import { CLASS_STATS, NPC_STATS, ClassStats } from "@abraxas/shared";

export type Entity = Player | Npc;

export const EntityUtils = {
  isPlayer(entity: Entity): entity is Player {
    return "classType" in entity;
  },

  isNpc(entity: Entity): entity is Npc {
    return "type" in entity && !("classType" in entity);
  },

  getStats(entity: Entity): ClassStats | undefined {
    if (this.isPlayer(entity)) {
      return CLASS_STATS[entity.classType];
    }
    return NPC_STATS[entity.type];
  },

  isAlive(entity: Entity): boolean {
    return entity.alive;
  },
  
  getPosition(entity: Entity) {
      return { x: entity.tileX, y: entity.tileY };
  }
};
