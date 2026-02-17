import type { Direction, TileMap } from "@ao5/shared";
import { DIRECTION_DELTA, CLASS_STATS } from "@ao5/shared";
import type { Player } from "../schema/Player";
import { logger } from "../logger";

interface PlayerTimers {
  lastMoveMs: number;
}

export class MovementSystem {
  private timers = new Map<string, PlayerTimers>();

  private getTimers(sessionId: string): PlayerTimers {
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
    player: Player,
    direction: Direction,
    map: TileMap,
    now: number,
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean,
    tick: number,
    roomId: string
  ): boolean {
    const timers = this.getTimers(player.sessionId);
    const stats = CLASS_STATS[player.classType];
    const moveIntervalMs = 1000 / stats.speedTilesPerSecond;

    // Always update facing
    player.facing = direction;

    // Check movement timing (with 15ms tolerance for network/clock jitter)
    if (now - timers.lastMoveMs < moveIntervalMs - 15) {
      logger.debug({
        room: roomId,
        tick,
        clientId: player.sessionId,
        intent: "move",
        result: "too_fast",
      });
      return false;
    }

    const delta = DIRECTION_DELTA[direction];
    const newX = player.tileX + delta.dx;
    const newY = player.tileY + delta.dy;

    // Bounds check
    if (newX < 0 || newX >= map.width || newY < 0 || newY >= map.height) {
      logger.debug({
        room: roomId,
        tick,
        clientId: player.sessionId,
        intent: "move",
        result: "out_of_bounds",
        posBefore: { x: player.tileX, y: player.tileY },
      });
      return false;
    }

    // Collision check
    if (map.collision[newY]?.[newX] === 1) {
      logger.debug({
        room: roomId,
        tick,
        clientId: player.sessionId,
        intent: "move",
        result: "blocked",
        posBefore: { x: player.tileX, y: player.tileY },
      });
      return false;
    }

    // Occupied check
    if (occupiedCheck(newX, newY, player.sessionId)) {
      logger.debug({
        room: roomId,
        tick,
        clientId: player.sessionId,
        intent: "move",
        result: "occupied",
        posBefore: { x: player.tileX, y: player.tileY },
      });
      return false;
    }

    const posBefore = { x: player.tileX, y: player.tileY };
    player.tileX = newX;
    player.tileY = newY;
    // Accumulated timing: advance from last move time, not from `now`.
    // This keeps rhythm consistent and avoids drift between client/server clocks.
    timers.lastMoveMs += moveIntervalMs;
    // Cap drift so we don't allow burst moves after a long idle
    if (now - timers.lastMoveMs > moveIntervalMs) {
      timers.lastMoveMs = now;
    }

    logger.info({
      room: roomId,
      tick,
      clientId: player.sessionId,
      intent: "move",
      result: "ok",
      posBefore,
      posAfter: { x: newX, y: newY },
    });

    return true;
  }
}
