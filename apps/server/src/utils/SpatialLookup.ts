import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { Npc } from "../schema/Npc";
import { MathUtils } from "@abraxas/shared";

/** Union of all concrete entity types that live in the game world. */
export type Entity = Player | Npc;

// ── Spatial hash grid ─────────────────────────────────────────────────────

export class SpatialLookup {
  // Spatial Hash Grid: "x,y" -> Set<sessionId>
  private grid = new Map<string, Set<string>>();

  constructor(private state: GameState) {
    // Initialize grid with current state if any
    this.state.players.forEach((p) => this.addToGrid(p));
    this.state.npcs.forEach((n) => this.addToGrid(n));
  }

  private getKey(x: number, y: number): string {
    return `${Math.floor(x)},${Math.floor(y)}`;
  }

  /** Clears and rebuilds the grid from the current state — call after devMode state restore. */
  rebuild(): void {
    this.grid.clear();
    this.state.players.forEach((p) => this.addToGrid(p));
    this.state.npcs.forEach((n) => this.addToGrid(n));
  }

  addToGrid(entity: Entity) {
    if (!entity.alive) return;
    const key = this.getKey(entity.tileX, entity.tileY);
    if (!this.grid.has(key)) {
      this.grid.set(key, new Set());
    }
    this.grid.get(key)!.add(entity.sessionId);
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
    if (this.state.players.has(sessionId))
      return this.state.players.get(sessionId);
    if (this.state.npcs.has(sessionId)) return this.state.npcs.get(sessionId);
    return undefined;
  }

  findEntityAtTile(x: number, y: number): Entity | undefined {
    const key = this.getKey(x, y);
    const cell = this.grid.get(key);

    if (!cell || cell.size === 0) return undefined;

    // Return first entity found in cell
    for (const sessionId of cell) {
      const entity = this.findEntityBySessionId(sessionId);
      if (entity && entity.alive && entity.tileX === x && entity.tileY === y) {
        return entity;
      }
    }
    return undefined;
  }

  findEntitiesInRadius(
    cx: number,
    cy: number,
    radius: number,
    excludeId?: string,
  ): Entity[] {
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
}
