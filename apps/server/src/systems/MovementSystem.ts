import { DIRECTION_DELTA, type Direction, ITEMS, type TileMap } from "@abraxas/shared";
import { logger } from "../logger";

import type { Entity, SpatialLookup } from "../utils/SpatialLookup";
import type { BuffSystem } from "./BuffSystem";

type MoveResult = {
  success: boolean;
  warp?: {
    targetMap: string;
    targetX: number;
    targetY: number;
  };
};

export class MovementSystem {
  constructor(
    private spatial: SpatialLookup,
    private buffSystem: BuffSystem,
  ) {}

  /** Instantly moves an entity to the target tile, updating the spatial grid. */
  teleport(entity: Entity, tileX: number, tileY: number): void {
    const oldX = entity.tileX;
    const oldY = entity.tileY;
    entity.tileX = tileX;
    entity.tileY = tileY;
    this.spatial.updatePosition(entity, oldX, oldY);
  }

  /**
   * Attempts to move an entity in a direction.
   * Handles timing, bounds, collision, and tile occupancy.
   * Returns a MoveResult with success status and optional warp data.
   */
  tryMove(
    entity: Entity,
    direction: Direction,
    map: TileMap,
    now: number,
    tick: number,
    roomId: string,
  ): MoveResult {
    // Bug #12 fix: Defense-in-depth — dead entities cannot move
    if (!entity.alive) return { success: false };

    const stats = entity.getStats();
    if (!stats) return { success: false };

    let speed = stats.speedTilesPerSecond;
    if (entity.isPlayer()) {
      // Bug #14 fix: Mount speed is additive, not a replacement.
      // speedOverride is now used as a bonus on top of base speed.
      if (entity.speedOverride > 0) speed += entity.speedOverride;
      // Apply mount speed bonus if a mount is equipped
      if (entity.equipMount?.itemId) {
        const mountBonus = ITEMS[entity.equipMount.itemId]?.stats?.speedBonus ?? 0;
        speed += mountBonus;
      }
    }

    // Apply speed buffs from BuffSystem
    speed += this.buffSystem.getBuffBonus(entity.sessionId, "speed", now);

    if (speed <= 0) return { success: false };
    const moveIntervalMs = 1000 / speed;

    // Movement timing check (15ms jitter tolerance)
    if (now - entity.lastMoveMs < moveIntervalMs - 15) {
      logger.debug({
        room: roomId,
        tick,
        entityId: entity.sessionId,
        intent: "move",
        result: "too_fast",
      });
      return { success: false };
    }

    const delta = DIRECTION_DELTA[direction];
    const newX = entity.tileX + delta.dx;
    const newY = entity.tileY + delta.dy;

    entity.facing = direction;

    // Bounds, Collision, and Occupancy checks
    if (
      newX < 0 ||
      newX >= map.width ||
      newY < 0 ||
      newY >= map.height ||
      map.collision[newY]?.[newX] === 1 ||
      // Bug #69: Removed NPC warp blocking — it could permanently trap NPCs
      // if a warp tile was on the only path between two areas
      this.spatial.isTileOccupied(newX, newY, entity.sessionId)
    ) {
      return { success: false };
    }

    const posBefore = entity.getPosition();
    entity.tileX = newX;
    entity.tileY = newY;

    this.spatial.updatePosition(entity, posBefore.x, posBefore.y);

    // Bug #68: Always set lastMoveMs to now to prevent drift after long idle
    entity.lastMoveMs = now;

    logger.debug({
      room: roomId,
      tick,
      entityId: entity.sessionId,
      intent: "move",
      result: "ok",
      posBefore,
      posAfter: { x: newX, y: newY },
    });

    // Warp detection
    const warp = map.warps?.find((w) => w.x === newX && w.y === newY);

    return { success: true, warp };
  }
}
