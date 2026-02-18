import type { Direction, TileMap, ClassStats } from "@abraxas/shared";
import { DIRECTION_DELTA, CLASS_STATS, NPC_STATS } from "@abraxas/shared";
import type { Player } from "../schema/Player";
import type { Npc } from "../schema/Npc";
import { logger } from "../logger";
import { EntityUtils, Entity } from "../utils/EntityUtils";
import { SpatialLookup } from "../utils/SpatialLookup";

interface EntityTimers {
  lastMoveMs: number;
}

export class MovementSystem {
  private timers = new Map<string, EntityTimers>();

  constructor(private spatial: SpatialLookup) {}

  private getTimers(sessionId: string): EntityTimers {
    let t = this.timers.get(sessionId);
    if (!t) {
      t = { lastMoveMs: 0 };
      this.timers.set(sessionId, t);
    }
    return t;
  }

  removePlayer(sessionId: string) {
    this.timers.delete(sessionId);
  }

  tryMove(
    entity: Entity,
    direction: Direction,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tick: number,
    roomId: string
  ): boolean {
    const timers = this.getTimers(entity.sessionId);
    
    const stats = EntityUtils.getStats(entity);
    if (!stats) return false;

    const moveIntervalMs = 1000 / stats.speedTilesPerSecond;

    // Always update facing
    entity.facing = direction;

    // Check movement timing (with 15ms tolerance for network/clock jitter)
    if (now - timers.lastMoveMs < moveIntervalMs - 15) {
      // Only log debug for players to avoid spamming for NPCs
      if (EntityUtils.isPlayer(entity)) {
        logger.debug({
            room: roomId,
            tick,
            clientId: entity.sessionId,
            intent: "move",
            result: "too_fast",
        });
      }
      return false;
    }

    const delta = DIRECTION_DELTA[direction];
    const newX = entity.tileX + delta.dx;
    const newY = entity.tileY + delta.dy;

    // Bounds check
    if (newX < 0 || newX >= map.width || newY < 0 || newY >= map.height) {
      return false;
    }

    // Collision check
    if (map.collision[newY]?.[newX] === 1) {
      return false;
    }

    // Occupied check
    if (occupiedCheck(newX, newY, entity.sessionId)) {
      return false;
    }

    const posBefore = EntityUtils.getPosition(entity);

    entity.tileX = newX;
    entity.tileY = newY;

    // Update Spatial Grid
    this.spatial.updatePosition(entity, posBefore.x, posBefore.y);
    
    // Accumulated timing: advance from last move time, not from `now`.
    timers.lastMoveMs += moveIntervalMs;
    // Cap drift so we don't allow burst moves after a long idle
    if (now - timers.lastMoveMs > moveIntervalMs) {
      timers.lastMoveMs = now;
    }

    // Log only for players
    if (EntityUtils.isPlayer(entity)) {
        logger.info({
            room: roomId,
            tick,
            clientId: entity.sessionId,
            intent: "move",
            result: "ok",
            posBefore,
            posAfter: { x: newX, y: newY },
        });
    }

    return true;
  }
}
