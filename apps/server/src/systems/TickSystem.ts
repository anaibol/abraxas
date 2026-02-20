import {
  type BroadcastFn,
  NPC_DROPS,
  NPC_STATS,
  type ServerMessages,
  ServerMessageType,
  SPAWN_PROTECTION_MS,
  type TileMap,
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
    state.tick++;
    const now = Date.now();

    // 1. Buffs — resolves DoTs and expires effects for both Players and NPCs
    systems.buff.tick(
      now,
      (sid) => systems.spatial.findEntityBySessionId(sid),
      broadcast,
      (entity) => this.opts.onEntityDeath(entity),
    );

    // 2. NPCs
    systems.npc.tick(map, now, state.tick, roomId, broadcast);

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

    // 5. Natural Regeneration
    // Mana — normal: +1% maxMana every 20 ticks
    //        meditating: +2% maxMana every 5 ticks (~8x faster)
    // HP   — passive: +0.5% maxHp every 30 ticks
    for (const player of state.players.values()) {
      if (!player.alive) continue;
      if (player.meditating && state.tick % 5 === 0) restoreStat(player, "mana", 0.02);
      else if (!player.meditating && state.tick % 20 === 0) restoreStat(player, "mana", 0.01);
      if (state.tick % 30 === 0) restoreStat(player, "hp", 0.005);
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
    const stats = NPC_STATS[killedNpc.type];
    
    if (stats && typeof stats.expReward === "number") {
      // Find all living companions of this player to share EXP
      const activeCompanions: Npc[] = [];
      state.npcs.forEach((n) => {
        if (n.ownerId === player.sessionId && n.alive) {
          activeCompanions.push(n);
        }
      });

      if (activeCompanions.length > 0) {
        // Share EXP: 50% to player, 50% split among companions
        const playerExp = Math.ceil(stats.expReward * 0.5);
        const companionExp = Math.max(1, Math.floor((stats.expReward * 0.5) / activeCompanions.length));
        
        this.opts.gainXp(player, playerExp);
        for (const comp of activeCompanions) {
          systems.npc.gainExp(comp, companionExp, this.opts.roomId, this.opts.broadcast);
        }
      } else {
        // 100% to player if no companions
        this.opts.gainXp(player, stats.expReward);
      }
    }

    void systems.quests.updateProgress(player.dbId, "kill", killedNpc.type, 1).then((updates) => {
      if (updates.length > 0) {
        const client = this.opts.findClient(player.sessionId);
        if (client) this.opts.sendQuestUpdates(client, updates);
      }
    });

    const dropTable = NPC_DROPS[killedNpc.type];
    if (dropTable) {
      for (const entry of dropTable) {
        if (Math.random() < entry.chance) {
          const qty = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
          const ox = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
          const oy = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
          const tx = Math.max(0, Math.min(this.opts.map.width - 1, killedNpc.tileX + ox));
          const ty = Math.max(0, Math.min(this.opts.map.height - 1, killedNpc.tileY + oy));

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
