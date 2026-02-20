import {
  type BroadcastFn,
  NPC_DROPS,
  NPC_STATS,
  type ServerMessages,
  ServerMessageType,
  SPAWN_PROTECTION_MS,
  type TileMap,
  type NpcType,
} from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import type { GameState } from "../schema/GameState";
import type { Npc } from "../schema/Npc";
import type { Player } from "../schema/Player";
import type { BuffSystem } from "../systems/BuffSystem";
import type { CombatSystem } from "../systems/CombatSystem";
import type { DropSystem } from "../systems/DropSystem";
import type { NpcSystem } from "../systems/NpcSystem";
import type { QuestSystem } from "../systems/QuestSystem";
import type { RespawnSystem } from "../systems/RespawnSystem";
import type { WorldEventSystem } from "../systems/WorldEventSystem";
import type { Entity, SpatialLookup } from "../utils/SpatialLookup";
import { findSafeSpawn } from "../utils/spawnUtils";

interface TickOptions {
  state: GameState;
  map: TileMap;
  roomId: string;
  systems: {
    buff: BuffSystem;
    npc: NpcSystem;
    combat: CombatSystem;
    drops: DropSystem;
    respawn: RespawnSystem;
    quests: QuestSystem;
    spatial: SpatialLookup;
    worldEvent: WorldEventSystem;
  };
  broadcast: BroadcastFn;
  onEntityDeath: (entity: Entity, killerSessionId?: string) => void;
  onSummon: (caster: Entity, spellId: string, x: number, y: number) => void;
  gainXp: (player: Player, amount: number) => void;
  sendQuestUpdates: (
    client: Client,
    updates: Awaited<ReturnType<QuestSystem["updateProgress"]>>,
  ) => void;
  findClient: (sid: string) => Client | undefined;
}

/** Restores `ratio * max` (at least 1) of a stat, capped at its max. */
function restoreStat(player: Player, stat: "hp" | "mana", ratio: number): void {
  const max = stat === "hp" ? player.maxHp : player.maxMana;
  const cur = stat === "hp" ? player.hp : player.mana;
  if (cur >= max) return;
  const gain = Math.max(1, Math.floor(max * ratio));
  if (stat === "hp") player.hp = Math.min(max, cur + gain);
  else player.mana = Math.min(max, cur + gain);
}

export class TickSystem {
  constructor(private opts: TickOptions) {}

  tick(deltaTime: number) {
    const { state, map, roomId, systems, broadcast } = this.opts;
    const now = Date.now();
    
    // Increment game tick
    state.tick++;
    
    // 0. Update time of day (1 minute real = 1 hour game)
    state.timeOfDay += (deltaTime / 1000) * (1 / 60);
    if (state.timeOfDay >= 24) {
      state.timeOfDay -= 24;
    }

    // Basic weather randomization every 1000 ticks (~40 seconds)
    if (state.tick % 1000 === 0) {
      const rnd = Math.random();
      if (rnd < 0.7) state.weather = "clear";
      else if (rnd < 0.85) state.weather = "rain";
      else state.weather = "snow";
    }

    // 1. Buffs — resolves DoTs and expires effects for both Players and NPCs
    systems.buff.tick(
      now,
      (sid) => systems.spatial.findEntityBySessionId(sid),
      broadcast,
      (entity, killerId) => this.opts.onEntityDeath(entity, killerId),
    );

    // 2. NPCs
    systems.npc.tick(map, now, state.tick, roomId, broadcast);
    systems.npc.tickRareSpawns(map, now, broadcast);

    // 2b. World Events
    systems.worldEvent.tick(map, now, broadcast);

    // 3. Combat
    const { onEntityDeath, onSummon, findClient } = this.opts;
    systems.combat.processWindups(now, broadcast, onEntityDeath, onSummon);

    systems.combat.processBufferedActions(
      now,
      broadcast,
      (sid) => {
        const c = findClient(sid);
        return <T extends ServerMessageType>(type: T, data?: ServerMessages[T]) =>
          c?.send(type, data);
      },
      onEntityDeath,
      onSummon,
    );

    // 4. Drops
    systems.drops.expireDrops(state.drops, now);

    // 5. Natural Regeneration & Class Resources
    for (const player of state.players.values()) {
      if (!player.alive) continue;

      // Mana (Standard)
      if (player.meditating && state.tick % 5 === 0) restoreStat(player, "mana", 0.02);
      else if (!player.meditating && state.tick % 20 === 0) restoreStat(player, "mana", 0.01);

      // HP (Standard)
      if (state.tick % 30 === 0) restoreStat(player, "hp", 0.005);

      // Energy (Rogue) - Rapidly regenerate 10% Every 20 ticks (~0.8s)
      if (player.classType === "ROGUE" && state.tick % 20 === 0) {
        player.energy = Math.min(player.maxEnergy, player.energy + Math.floor(player.maxEnergy * 0.1));
      }

      // Focus (Ranger) - Rapidly regenerate 5% Every 20 ticks (~0.8s)
      if (player.classType === "RANGER" && state.tick % 20 === 0) {
        player.focus = Math.min(player.maxFocus, player.focus + Math.floor(player.maxFocus * 0.05));
      }

      // Rage (Warrior) - Decay -2 per 50 ticks (~2s) if not at 0
      if (player.classType === "WARRIOR" && state.tick % 50 === 0 && player.rage > 0) {
        player.rage = Math.max(0, player.rage - 2);
      }

      // Mana Spring (Friendly Summon) nearby
      if (state.tick % 20 === 0) {
        for (const npc of state.npcs.values()) {
          if (npc.npcType === ("mana_spring" as NpcType) && npc.alive && npc.ownerId) {
            const dx = npc.tileX - player.tileX;
            const dy = npc.tileY - player.tileY;
            if (dx * dx + dy * dy <= 4 * 4) { // 4 tile radius
              player.mana = Math.min(player.maxMana, player.mana + 5);
              // Notification/Broadcast could be added here but might be too noisy
            }
          }
        }
      }
    }

    // 6. Respawns
    systems.respawn.tick(
      now,
      (sid) => state.players.get(sid),
      map,
      broadcast,
      (p) => {
        systems.spatial.addToGrid(p);
        systems.buff.applySpawnProtection(p.sessionId, SPAWN_PROTECTION_MS, now);
        p.spawnProtection = true;
      },
      (x, y) => findSafeSpawn(x, y, map, systems.spatial),
    );
  }

  handleNpcDeath(npc: Npc, killerSessionId?: string) {
    const { systems, state, broadcast } = this.opts;
    systems.npc.handleDeath(npc);

    if (killerSessionId) {
      // If the killer is a Player
      let killerPlayer = state.players.get(killerSessionId);
      
      // If the killer is a Companion, give the kill credit to its Owner
      if (!killerPlayer) {
        const killerNpc = state.npcs.get(killerSessionId);
        if (killerNpc && killerNpc.ownerId) {
          killerPlayer = state.players.get(killerNpc.ownerId);
        }
      }

      if (killerPlayer?.alive) {
        this.handleNpcKillRewards(killerPlayer, npc);
      }
    }

    broadcast(ServerMessageType.Death, {
      sessionId: npc.sessionId,
      killerSessionId,
    });
  }

  private handleNpcKillRewards(player: Player, killedNpc: Npc) {
    const { systems, state } = this.opts;
    const stats = NPC_STATS[killedNpc.npcType];
    
    if (stats && typeof stats.expReward === "number") {
      const activeCompanions: Npc[] = [];
      state.npcs.forEach((n) => {
        if (n.ownerId === player.sessionId && n.alive) {
          activeCompanions.push(n);
        }
      });

      if (activeCompanions.length > 0) {
        const playerExp = Math.ceil(stats.expReward * 0.5);
        const companionExp = Math.max(1, Math.floor((stats.expReward * 0.5) / activeCompanions.length));
        
        this.opts.gainXp(player, playerExp);
        for (const comp of activeCompanions) {
          systems.npc.gainExp(comp, companionExp, this.opts.roomId, this.opts.broadcast);
        }
      } else {
        this.opts.gainXp(player, stats.expReward);
      }
    }

    void systems.quests.updateProgress(player.dbId, "kill", killedNpc.npcType, 1).then((updates) => {
      if (updates.length > 0) {
        const client = this.opts.findClient(player.sessionId);
        if (client) this.opts.sendQuestUpdates(client, updates);
      }
    });

    const dropTable = NPC_DROPS[killedNpc.npcType];

    // Necromancer soul gain on kill
    if (player.classType === "NECROMANCER" && player.souls < player.maxSouls) {
      player.souls++;
    }

    if (dropTable) {
      for (const entry of dropTable) {
        if (Math.random() < entry.chance) {
          const qty = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
          const ox = Math.floor(Math.random() * 3) - 1;
          const oy = Math.floor(Math.random() * 3) - 1;
          let tx = Math.max(0, Math.min(this.opts.map.width - 1, killedNpc.tileX + ox));
          let ty = Math.max(0, Math.min(this.opts.map.height - 1, killedNpc.tileY + oy));

          // Collision check for loot: if blocked, drop at NPC's feet
          if (this.opts.map.collision[ty]?.[tx] === 1) {
            tx = killedNpc.tileX;
            ty = killedNpc.tileY;
          }

          if (entry.itemId === "gold") {
            systems.drops.spawnGoldDrop(this.opts.state.drops, tx, ty, qty);
          } else {
            systems.drops.spawnItemDrop(this.opts.state.drops, tx, ty, entry.itemId, qty);
          }
        }
      }
    }
  }
}
