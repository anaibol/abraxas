import { Direction } from "../types";

export interface Point {
  x: number;
  y: number;
}

export const MathUtils = {
  dist(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  manhattanDist(p1: Point, p2: Point): number {
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
  },

  getDirection(from: Point, to: Point): Direction {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      return dy > 0 ? Direction.DOWN : Direction.UP;
    }
  },

  // Returns an array of points on the line between p1 and p2 (inclusive of p1, exclusive of p2 or inclusive depending on use)
  getLine(p1: Point, p2: Point): Point[] {
    const points: Point[] = [];
    let x1 = p1.x;
    let y1 = p1.y;
    const x2 = p2.x;
    const y2 = p2.y;

    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      points.push({ x: x1, y: y1 });
      if (x1 === x2 && y1 === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x1 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y1 += sy;
      }
    }
    return points;
  },

  /** B34: Shared safe-zone check — returns true if (x,y) is inside any zone rect. */
  isInSafeZone(
    x: number,
    y: number,
    safeZones?: { x: number; y: number; w: number; h: number }[],
  ): boolean {
    if (!safeZones) return false;
    for (const zone of safeZones) {
      if (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h) {
        return true;
      }
    }
    return false;
  },
};
