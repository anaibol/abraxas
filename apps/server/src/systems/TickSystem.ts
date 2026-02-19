import type { Client } from "@colyseus/core";
import type { GameState } from "../schema/GameState";
import type { Player } from "../schema/Player";
import type { Npc } from "../schema/Npc";
import { ServerMessageType, NPC_STATS, NPC_DROPS, type TileMap, type ServerMessages, type BroadcastFn } from "@abraxas/shared";
import type { SpatialLookup, Entity } from "../utils/SpatialLookup";
import type { BuffSystem } from "../systems/BuffSystem";
import type { NpcSystem } from "../systems/NpcSystem";
import type { CombatSystem } from "../systems/CombatSystem";
import type { DropSystem } from "../systems/DropSystem";
import type { RespawnSystem } from "../systems/RespawnSystem";
import type { QuestSystem } from "../systems/QuestSystem";

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
  sendQuestUpdates: (client: Client, updates: Awaited<ReturnType<QuestSystem["updateProgress"]>>) => void;
  findClient: (sid: string) => Client | undefined;
}

export class TickSystem {
  constructor(private opts: TickOptions) {}

  tick(deltaTime: number) {
    const { state, map, roomId, systems, broadcast } = this.opts;
    state.tick++;
    const now = Date.now();

    // 1. Buffs
    systems.buff.tick(
      now,
      (sid) => {
        const entity = systems.spatial.findEntityBySessionId(sid);
        return entity instanceof Player ? entity : undefined;
      },
      broadcast,
      (p) => this.opts.onEntityDeath(p),
      roomId,
      state.tick,
    );

    // 2. NPCs
    systems.npc.tick(
      deltaTime,
      map,
      now,
      state.tick,
      roomId,
      broadcast,
    );

    // 3. Combat
    systems.combat.processWindups(
      now,
      broadcast,
      (e, k) => this.opts.onEntityDeath(e, k),
      (caster, spellId, x, y) => this.opts.onSummon(caster, spellId, x, y),
    );

    systems.combat.processBufferedActions(
      now, 
      broadcast, 
      (sid) => {
        const c = this.opts.findClient(sid);
        return <T extends ServerMessageType>(type: T, data?: ServerMessages[T]) => c?.send(type, data);
      },
      (e, k) => this.opts.onEntityDeath(e, k),
      (caster, spellId, x, y) => this.opts.onSummon(caster, spellId, x, y),
    );

    // 4. Drops
    systems.drops.expireDrops(state.drops, now);

    // 5. Natural Regeneration (Every 20 ticks)
    if (state.tick % 20 === 0) {
      for (const player of state.players.values()) {
        if (player.alive && player.mana < player.maxMana) {
          player.mana = Math.min(
            player.maxMana,
            player.mana + Math.max(1, Math.floor(player.maxMana * 0.01))
          );
        }
      }
    }

    // 6. Respawns
    systems.respawn.tick(
      now,
      (sid) => state.players.get(sid),
      map,
      broadcast,
      (p) => systems.spatial.addToGrid(p),
    );
  }

  handleNpcDeath(npc: Npc, killerSessionId?: string) {
    const { systems, state, broadcast } = this.opts;
    systems.npc.handleDeath(npc);

    if (killerSessionId) {
      const killer = state.players.get(killerSessionId);
      if (killer?.alive) {
        this.handleNpcKillRewards(killer, npc);
      }
    }

    broadcast(ServerMessageType.Death, {
      sessionId: npc.sessionId,
      killerSessionId,
    });
  }

  private handleNpcKillRewards(player: Player, npc: Npc) {
    const { systems } = this.opts;
    const stats = NPC_STATS[npc.type];
    if (stats && typeof stats.expReward === "number") {
      this.opts.gainXp(player, stats.expReward);
    }

    systems.quests.updateProgress(player.dbId, "kill", npc.type, 1).then((updates) => {
      if (updates.length > 0) {
        const client = this.opts.findClient(player.sessionId);
        if (client) this.opts.sendQuestUpdates(client, updates);
      }
    });

    const dropTable = NPC_DROPS[npc.type];
    if (dropTable) {
      for (const entry of dropTable) {
        if (Math.random() < entry.chance) {
          const qty = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
          const ox = (Math.random() - 0.5) * 1.5;
          const oy = (Math.random() - 0.5) * 1.5;
          if (entry.itemId === "gold") {
            systems.drops.spawnGoldDrop(this.opts.state.drops, npc.tileX + ox, npc.tileY + oy, qty);
          } else {
            systems.drops.spawnItemDrop(this.opts.state.drops, npc.tileX + ox, npc.tileY + oy, entry.itemId, qty);
          }
        }
      }
    }
  }
}
