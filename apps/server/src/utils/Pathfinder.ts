import { MathUtils, type TileMap } from "@abraxas/shared";
import type { SpatialLookup } from "./SpatialLookup";

export interface PathNode {
  x: number;
  y: number;
}

interface AStarNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic cost to goal
  f: number; // Total cost (g + h)
  parent?: AStarNode;
}

/**
 * Lightweight A* Pathfinder for 2D grid maps.
 * Uses Manhattan distance heuristic and straight-line moves (no diagonals).
 */
export class Pathfinder {
  /**
   * Maximum nodes to expand before giving up.
   * Prevents severe lag spikes if a target is unreachable on a huge map.
   */
  private static MAX_ITERATIONS = 400;

  /**
   * Finds a path from (startX, startY) to (targetX, targetY).
   * Returns an array of coordinates representing the path (excluding the start node itself).
   * Returns empty array if no path is found or if start is already at target.
   */
  static findPath(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    map: TileMap,
    spatial: SpatialLookup,
    ignoreEntityId?: string,
  ): PathNode[] {
    if (startX === targetX && startY === targetY) {
      return [];
    }

    // Quick bounds check for target
    if (targetX < 0 || targetY < 0 || targetX >= map.width || targetY >= map.height) {
      return [];
    }
    // Cannot path to a blocked tile
    if (map.collision[targetY]?.[targetX] !== 0) {
      return [];
    }

    const openList: AStarNode[] = [];
    const closedSet = new Set<string>();

    const startNode: AStarNode = {
      x: startX,
      y: startY,
      g: 0,
      h: MathUtils.manhattanDist({ x: startX, y: startY }, { x: targetX, y: targetY }),
      f: 0,
    };
    startNode.f = startNode.g + startNode.h;

    openList.push(startNode);

    let iterations = 0;

    // Movement deltas: UP, DOWN, LEFT, RIGHT
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    while (openList.length > 0) {
      iterations++;
      if (iterations > Pathfinder.MAX_ITERATIONS) {
        // Fallback: return partial path to the node with lowest 'h' we found so far
        // to at least walk towards the target.
        break;
      }

      // Pop node with lowest f
      // Open list is usually small enough that sort is fine,
      // but popping min element is faster than full re-sort
      let lowestIndex = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[lowestIndex].f) {
          lowestIndex = i;
        }
      }

      const current = openList[lowestIndex];
      openList.splice(lowestIndex, 1);

      // Found the goal
      if (current.x === targetX && current.y === targetY) {
        return Pathfinder.reconstructPath(current);
      }

      const currentKey = `${current.x},${current.y}`;
      closedSet.add(currentKey);

      for (const dir of dirs) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;

        // Bounds check
        if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) {
          continue;
        }

        const neighborKey = `${nx},${ny}`;
        if (closedSet.has(neighborKey)) {
          continue;
        }

        // Collision check (static map)
        if (map.collision[ny]?.[nx] !== 0) {
          continue;
        }

        // Collision check (dynamic entities)
        // Allow pathing into the target tile itself, even if occupied by the target entity
        // or other entities, but try to avoid tiles occupied by other blocking entities on the way.
        // Actually, to keep it simple and avoid NPCs blocking each other entirely from
        // even formulating a path, we only treat hard map collisions as strictly blocking.
        // We will do another dynamic check right before taking the step.
        // However, we optionally can check spatial here.
        if (nx !== targetX || ny !== targetY) {
          // If tile is occupied by another entity, increase its G cost heavily to
          // encourage going around, rather than outright treating it as impassible,
          // because entities move.
          if (spatial.isTileOccupied(nx, ny, ignoreEntityId)) {
            // For now, let's treat dynamic entities as soft obstacles (high cost) rather than hard walls
            // so they don't block chokes permanently while computing path.
          }
        }

        // Standard g cost = 1 per step
        const isOccupied =
          (nx !== targetX || ny !== targetY) && spatial.isTileOccupied(nx, ny, ignoreEntityId);
        // Add huge penalty for walking through occupied tiles to strongly prefer open routes
        const stepCost = isOccupied ? 10 : 1;

        const tentativeG = current.g + stepCost;

        let neighbor = openList.find((n) => n.x === nx && n.y === ny);

        if (!neighbor) {
          neighbor = {
            x: nx,
            y: ny,
            g: tentativeG,
            h: MathUtils.manhattanDist({ x: nx, y: ny }, { x: targetX, y: targetY }),
            f: 0,
            parent: current,
          };
          neighbor.f = neighbor.g + neighbor.h;
          openList.push(neighbor);
        } else if (tentativeG < neighbor.g) {
          neighbor.parent = current;
          neighbor.g = tentativeG;
          neighbor.f = neighbor.g + neighbor.h;
        }
      }
    }

    return [];
  }

  private static reconstructPath(node: AStarNode): PathNode[] {
    const path: PathNode[] = [];
    let current: AStarNode | undefined = node;

    while (current?.parent) {
      path.push({ x: current.x, y: current.y });
      current = current.parent;
    }

    // The start node does not get pushed because we check current.parent
    // Path is built backwards from goal, so reverse it
    return path.reverse();
  }
}
