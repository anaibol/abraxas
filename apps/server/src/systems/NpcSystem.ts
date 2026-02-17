import { ClassStats, NPC_STATS, TileMap } from "@ao5/shared";
import { Npc } from "../schema/Npc";
import { Player } from "../schema/Player";
import { GameState } from "../schema/GameState";
import { MovementSystem } from "./MovementSystem";
import { CombatSystem } from "./CombatSystem";
import { logger } from "../logger";

const AGGRO_RANGE = 8;
const RESPAWN_TIME_MS = 10000;

type Entity = Player | Npc;

export class NpcSystem {
  private respawns: { type: string; deadAt: number }[] = [];

  constructor(
    private state: GameState,
    private movementSystem: MovementSystem,
    private combatSystem: CombatSystem
  ) {}

  spawnNpcs(count: number, map: TileMap) {
    const types = Object.keys(NPC_STATS);
    
    for (let i = 0; i < count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        this.spawnNpc(type, map);
    }
  }

  private spawnNpc(type: string, map: TileMap) {
    const npc = new Npc();
    npc.sessionId = crypto.randomUUID();
    npc.type = type;
    
    // Find valid spawn location
    let attempts = 0;
    while (attempts < 100) {
        const tx = Math.floor(Math.random() * map.width);
        const ty = Math.floor(Math.random() * map.height);
        if (map.collision[ty]?.[tx] === 0) {
            npc.tileX = tx;
            npc.tileY = ty;
            break;
        }
        attempts++;
    }

    const stats = NPC_STATS[type];
    npc.hp = stats.hp;
    npc.maxHp = stats.hp;
    npc.mana = stats.mana || 0;
    npc.str = stats.str;
    npc.agi = stats.agi;
    npc.intStat = stats.int;
    npc.alive = true;

    this.state.npcs.set(npc.sessionId, npc);
    logger.info({
        intent: "spawn_npc",
        type: type,
        x: npc.tileX,
        y: npc.tileY
    });
  }

  tick(
    dt: number, 
    map: TileMap, 
    now: number, 
    occupiedCheck: (x: number, y: number, excludeId: string) => boolean, 
    tickCount: number, 
    roomId: string,
    findEntityAtTile: (x: number, y: number) => Entity | undefined,
    broadcast: (type: string, data: Record<string, unknown>) => void
  ) {
    // Handle respawns
    for (let i = this.respawns.length - 1; i >= 0; i--) {
        const respawn = this.respawns[i];
        if (now - respawn.deadAt > RESPAWN_TIME_MS) {
            this.spawnNpc(respawn.type, map);
            this.respawns.splice(i, 1);
        }
    }

    // AI Logic
    this.state.npcs.forEach((npc) => {
        if (!npc.alive) return;

        // Simple State Machine:
        // 1. Find nearest player
        // 2. If in aggro range -> Chase
        // 3. If in attack range -> Attack

        let nearestPlayerId: string | null = null;
        let minDist = Infinity;

        this.state.players.forEach((player) => {
            if (!player.alive || player.stealthed) return; // Don't aggro dead or stealthed
            // Check if player is on same map (implicit)
            
            const dx = player.tileX - npc.tileX;
            const dy = player.tileY - npc.tileY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < minDist) {
                minDist = dist;
                nearestPlayerId = player.sessionId;
            }
        });

        if (nearestPlayerId && minDist <= AGGRO_RANGE) {
            const target = this.state.players.get(nearestPlayerId)!;
            const dist = Math.abs(target.tileX - npc.tileX) + Math.abs(target.tileY - npc.tileY); // Manhattan for grid range check
            const stats = NPC_STATS[npc.type];

            if (dist <= stats.meleeRange) {
                // Face target
                let dx = 0;
                let dy = 0;
                if (target.tileX > npc.tileX) dx = 1;
                else if (target.tileX < npc.tileX) dx = -1;
                if (target.tileY > npc.tileY) dy = 1;
                else if (target.tileY < npc.tileY) dy = -1;
                
                if (dx === 1) npc.facing = "right";
                else if (dx === -1) npc.facing = "left";
                else if (dy === 1) npc.facing = "down";
                else if (dy === -1) npc.facing = "up";

                // Attack
                this.combatSystem.tryAttack(
                    npc,
                    now,
                    broadcast,
                    tickCount,
                    roomId,
                    undefined,
                    undefined,
                    findEntityAtTile
                );
            } else {
                // Move towards
                let dx = 0;
                let dy = 0;
                if (target.tileX > npc.tileX) dx = 1;
                else if (target.tileX < npc.tileX) dx = -1;
                
                if (target.tileY > npc.tileY) dy = 1;
                else if (target.tileY < npc.tileY) dy = -1;

                // Prefer axis with larger distance
                let moveDir: "up" | "down" | "left" | "right" | null = null;
                if (Math.abs(target.tileX - npc.tileX) > Math.abs(target.tileY - npc.tileY)) {
                     // Try X first
                     if (dx > 0) moveDir = "right";
                     else if (dx < 0) moveDir = "left";
                } else {
                     if (dy > 0) moveDir = "down";
                     else if (dy < 0) moveDir = "up";
                }

                if (moveDir) {
                    this.movementSystem.tryMove(npc, moveDir, map, now, occupiedCheck, tickCount, roomId);
                }
            }
        }
    });

    // Handle dead NPCs removal
    this.state.npcs.forEach((npc) => {
        if (!npc.alive && !this.respawns.some(r => r.type === npc.type && Date.now() - r.deadAt < 100)) { // preventing double add, though logic below ensures single removal
             // Actually, we should check if they are already in respawn list? 
             // Or rely on ArenaRoom calling handleDeath?
             // ArenaRoom calls onDeath callback. We should likely handle NPC death there or expose a method.
        }
    });
  }

  handleDeath(npc: Npc) {
      this.respawns.push({ type: npc.type, deadAt: Date.now() });
      this.state.npcs.delete(npc.sessionId);
  }
}
