import { EntityType, MathUtils } from "@abraxas/shared";
import type { GameState } from "../schema/GameState";
import type { Npc } from "../schema/Npc";
import type { Player } from "../schema/Player";

/** Union of all concrete entity types that live in the game world. */
export type Entity = Player | Npc;

/** Q4: Type guard — narrows Entity to Player based on entityType enum. */
export function isPlayer(e: Entity): e is Player {
  return e.entityType === EntityType.PLAYER;
}

/** Q4: Type guard — narrows Entity to Npc based on entityType enum. */
export function isNpc(e: Entity): e is Npc {
  return e.entityType === EntityType.NPC;
}

// ── Spatial hash grid ─────────────────────────────────────────────────────

export class SpatialLookup {
  // P-2: Numeric keys avoid per-lookup string allocation.
  private grid = new Map<number, Set<string>>();
  private static readonly MAP_WIDTH = 1024;
  // P-3: Direct sessionId → Entity cache avoids two MapSchema lookups per call.
  private entityCache = new Map<string, Entity>();

  constructor(private state: GameState) {
    for (const p of this.state.players.values()) this.addToGrid(p);
    for (const n of this.state.npcs.values()) this.addToGrid(n);
  }

  private getKey(x: number, y: number): number {
    return Math.floor(y) * SpatialLookup.MAP_WIDTH + Math.floor(x);
  }

  /** Clears and rebuilds the grid from the current state — call after devMode state restore. */
  rebuild(): void {
    this.grid.clear();
    this.entityCache.clear();
    for (const p of this.state.players.values()) this.addToGrid(p);
    for (const n of this.state.npcs.values()) this.addToGrid(n);
  }

  addToGrid(entity: Entity) {
    if (!entity.alive) {
      // Defensive: ensure any stale grid entry is cleared for newly-dead entities.
      this.removeFromGrid(entity);
      return;
    }
    const key = this.getKey(entity.tileX, entity.tileY);
    let cell = this.grid.get(key);
    if (!cell) {
      cell = new Set();
      this.grid.set(key, cell);
    }
    cell.add(entity.sessionId);
    this.entityCache.set(entity.sessionId, entity);
  }

  removeFromGrid(entity: Entity) {
    const key = this.getKey(entity.tileX, entity.tileY);
    const cell = this.grid.get(key);
    if (cell) {
      cell.delete(entity.sessionId);
      if (cell.size === 0) {
        this.grid.delete(key);
      }
    }
    this.entityCache.delete(entity.sessionId);
  }

  updatePosition(entity: Entity, oldX: number, oldY: number) {
    // Remove from old pos
    const oldKey = this.getKey(oldX, oldY);
    const oldCell = this.grid.get(oldKey);
    if (oldCell) {
      oldCell.delete(entity.sessionId);
      if (oldCell.size === 0) this.grid.delete(oldKey);
    }

    // Add to new pos
    this.addToGrid(entity);
  }

  findEntityBySessionId(sessionId: string): Entity | undefined {
    // P-3: Use cache instead of two MapSchema lookups
    return this.entityCache.get(sessionId);
  }

  findEntityAtTile(tx: number, ty: number): Entity | undefined {
    const x = Number(tx);
    const y = Number(ty);
    const key = this.getKey(x, y);
    const cell = this.grid.get(key);

    if (!cell || cell.size === 0) {
      return undefined;
    }

    // Return first entity found in cell
    for (const sessionId of cell) {
      const entity = this.findEntityBySessionId(sessionId);
      if (entity) {
        const match = entity.alive && Number(entity.tileX) === x && Number(entity.tileY) === y;
        if (match) return entity;
      }
    }
    return undefined;
  }

  findEntitiesInRadius(cx: number, cy: number, radius: number, excludeId?: string): Entity[] {
    const result: Entity[] = [];

    // Optimization: Only check tiles within manhattan radius
    // Since we use Manhattan distance (dx+dy <= radius), the area is a diamond shape.
    // Iterating the bounding box is simplest.

    const minX = cx - radius;
    const maxX = cx + radius;
    const minY = cy - radius;
    const maxY = cy + radius;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // Quick check for Manhattan distance
        if (Math.abs(x - cx) + Math.abs(y - cy) > radius) continue;

        const key = this.getKey(x, y);
        const cell = this.grid.get(key);
        if (cell) {
          for (const sessionId of cell) {
            if (sessionId === excludeId) continue;
            const entity = this.findEntityBySessionId(sessionId);
            if (entity && entity.alive) {
              result.push(entity);
            }
          }
        }
      }
    }

    return result;
  }

  isTileOccupied(x: number, y: number, excludeId?: string): boolean {
    const key = this.getKey(x, y);
    const cell = this.grid.get(key);
    if (!cell) return false;

    for (const sessionId of cell) {
      if (sessionId === excludeId) continue;
      const entity = this.findEntityBySessionId(sessionId);
      if (entity && entity.alive) return true;
    }
    return false;
  }

  /** Finds the nearest attackable player within a radius, or null if none. */
  findNearestPlayer(cx: number, cy: number, radius: number): Player | null {
    const entities = this.findEntitiesInRadius(cx, cy, radius);
    let nearest: Player | null = null;
    let minDist = Infinity;

    for (const entity of entities) {
      if (entity.entityType === EntityType.PLAYER && entity.isAttackable()) {
        const dist = MathUtils.manhattanDist({ x: cx, y: cy }, entity.getPosition());
        if (dist < minDist) {
          minDist = dist;
          nearest = entity as Player;
        }
      }
    }
    return nearest;
  }
}
