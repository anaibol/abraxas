import { Direction, DIRECTION_DELTA } from "../types";

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
  
  // Helper to get delta from direction, just wrapping the constant for consistency if needed
  getDelta(dir: Direction) {
      return DIRECTION_DELTA[dir];
  }
};
