import { Player } from "../schema/Player";
import { Npc } from "../schema/Npc";
import { CLASS_STATS, NPC_STATS, NpcStats } from "@abraxas/shared";

export type Entity = Player | Npc;

export function isPlayer(entity: Entity): entity is Player {
  return "classType" in entity;
}

export function isNpc(entity: Entity): entity is Npc {
  return "type" in entity && !("classType" in entity);
}

export function getEntityStats(entity: Entity): NpcStats | undefined {
  return isPlayer(entity)
    ? CLASS_STATS[entity.classType]
    : NPC_STATS[entity.type];
}

export function getEntityPosition(entity: Entity) {
  return { x: entity.tileX, y: entity.tileY };
}

export function isAttackable(entity: Entity): boolean {
  return entity.alive && !entity.stealthed;
}
