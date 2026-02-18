import type { Direction, TileMap } from "@abraxas/shared";
import { DIRECTION_DELTA } from "@abraxas/shared";
import { logger } from "../logger";
import { SpatialLookup, Entity } from "../utils/SpatialLookup";
import { Player } from "../schema/Player";

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

  removePlayer(sessionId: string): void {
    this.timers.delete(sessionId);
  }

  tryMove(
    entity: Entity,
    direction: Direction,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tick: number,
    roomId: string,
  ): boolean {
    const timers = this.getTimers(entity.sessionId);

    const stats = entity.getStats();
    if (!stats) return false;

    const speed = stats.speedTilesPerSecond;
    if (speed <= 0) return false; // Guard against stationary entities
    const moveIntervalMs = 1000 / speed;

    // Only update facing if move is successful
    // entity.facing = direction; // Moved down

    // Check movement timing (with 15ms tolerance for network/clock jitter)
    if (now - timers.lastMoveMs < moveIntervalMs - 15) {
      // Only log debug for players to avoid spamming for NPCs
      if (entity instanceof Player) {
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

    const posBefore = entity.getPosition();

    // Only update facing if move is successful
    entity.facing = direction;
    
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
    if (entity instanceof Player) {
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
