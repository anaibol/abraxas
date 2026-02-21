import {
  type BroadcastFn,
  NPC_DROPS,
  NPC_STATS,
  type NpcId,
  type ServerMessages,
  ServerMessageType,
  SPAWN_PROTECTION_MS,
  type TileMap,
} from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import type { GameState } from "../schema/GameState";
import type { Npc } from "../schema/Npc";
import type { Player } from "../schema/Player";
import { logger } from "../logger";
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

export class TickSystem {
  constructor(private opts: TickOptions) {}

  /** Restores `ratio * max` (at least 1) of a stat, capped at its max. */
  private static restoreStat(player: Player, stat: "hp" | "mana", ratio: number): void {
    const max = stat === "hp" ? player.maxHp : player.maxMana;
    const cur = stat === "hp" ? player.hp : player.mana;
    if (cur >= max) return;
    const gain = Math.max(1, Math.floor(max * ratio));
    if (stat === "hp") player.hp = Math.min(max, cur + gain);
    else player.mana = Math.min(max, cur + gain);
  }

  tick(deltaTime: number) {
    const { state, map, roomId, systems, broadcast } = this.opts;
    const now = Date.now();

    state.tick++;

    // Time of day: 1 real minute = 1 game hour
    // Bug #79: Clamp deltaTime to prevent time-of-day jumps on lag spikes
    const clampedDelta = Math.min(deltaTime, 200);
    state.timeOfDay += (clampedDelta / 1000) * (1 / 60);
    if (state.timeOfDay >= 24) state.timeOfDay -= 24;

    // Bug #76: Weather randomises every ~50s (1000 ticks at 20 TPS)
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

    // 2. NPCs + world events
    systems.npc.tick(map, now, state.tick, roomId, broadcast);
    systems.npc.tickRareSpawns(map, now, broadcast);
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

    // 5. Natural regeneration & class resources
    // Cache mana_spring NPCs once per 20-tick interval to avoid O(players × npcs) work.
    const manaSprings =
      state.tick % 20 === 0
        ? Array.from(state.npcs.values()).filter(
            (n) => n.npcId === ("mana_spring" as NpcId) && n.alive && n.ownerId,
          )
        : null;

    for (const player of state.players.values()) {
      if (!player.alive) continue;

      const isIdle = now - player.lastMoveMs > 5000 && now - player.lastCombatMs > 5000;

      // Mana
      if (player.meditating && state.tick % 5 === 0) TickSystem.restoreStat(player, "mana", 0.02);
      else if (!player.meditating && state.tick % 100 === 0 && isIdle) {
        TickSystem.restoreStat(player, "mana", 0.01);
      }

      // HP
      if (state.tick % 100 === 0 && isIdle) TickSystem.restoreStat(player, "hp", 0.005);

      // Energy (Rogue) — fast regen
      if (player.classType === "ROGUE" && state.tick % 20 === 0) {
        player.energy = Math.min(
          player.maxEnergy,
          player.energy + Math.floor(player.maxEnergy * 0.1),
        );
      }

      // Focus (Ranger)
      if (player.classType === "RANGER" && state.tick % 20 === 0) {
        player.focus = Math.min(player.maxFocus, player.focus + Math.floor(player.maxFocus * 0.05));
      }

      // Rage (Warrior) — decays when out of combat
      if (player.classType === "WARRIOR" && state.tick % 50 === 0 && player.rage > 0) {
        player.rage = Math.max(0, player.rage - 2);
      }

      // Mana Spring: nearby friendly summon restores mana
      if (manaSprings) {
        for (const npc of manaSprings) {
          const dx = Math.abs(npc.tileX - player.tileX);
          const dy = Math.abs(npc.tileY - player.tileY);
          // Bug #77: Use Manhattan distance (consistent with other range checks)
          if (dx + dy <= 4) {
            // 4-tile radius
            player.mana = Math.min(player.maxMana, player.mana + 5);
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
      // Credit the kill to the player, or to a companion's owner
      let killerPlayer = state.players.get(killerSessionId);
      if (!killerPlayer) {
        const killerNpc = state.npcs.get(killerSessionId);
        if (killerNpc?.ownerId) killerPlayer = state.players.get(killerNpc.ownerId);
      }
      if (killerPlayer?.alive) {
        killerPlayer.npcKills++;
        this.handleNpcKillRewards(killerPlayer, npc);
      }
    }

    broadcast(ServerMessageType.Death, { sessionId: npc.sessionId, killerSessionId });
    systems.worldEvent.onEventNpcDied(npc.sessionId, broadcast);
  }

  private handleNpcKillRewards(player: Player, killedNpc: Npc) {
    const { systems, state } = this.opts;
    const stats = NPC_STATS[killedNpc.npcId];

    if (stats?.expReward) {
      const companions = Array.from(state.npcs.values()).filter(
        (n) => n.ownerId === player.sessionId && n.alive,
      );

      if (companions.length > 0) {
        // Bug #75: Use floor for both shares so total never exceeds reward
        const companionExp = Math.max(1, Math.floor((stats.expReward * 0.5) / companions.length));
        const totalCompanionExp = companionExp * companions.length;
        const playerExp = stats.expReward - totalCompanionExp;
        this.opts.gainXp(player, playerExp);
        for (const comp of companions) {
          systems.npc.gainExp(comp, companionExp, this.opts.roomId, this.opts.broadcast);
        }
      } else {
        this.opts.gainXp(player, stats.expReward);
      }
    }

    // Bug #97: DoT kills credit the DoT source as the killer — this is intentional.
    // The player who applied the DoT should get quest/XP credit.
    void systems.quests
      .updateProgress(player.dbId, "kill", killedNpc.npcId, 1)
      .then((updates) => {
        if (updates.length > 0) {
          const client = this.opts.findClient(player.sessionId);
          if (client) this.opts.sendQuestUpdates(client, updates);
        }
      })
      .catch((e) =>
        logger.error({ message: "Failed to update quest progress", error: String(e) }),
      );

    // Necromancer soul gain on kill
    if (player.classType === "NECROMANCER" && player.souls < player.maxSouls) {
      player.souls++;
    }

    const dropTable = NPC_DROPS[killedNpc.npcId];
    if (!dropTable) return;

    for (const entry of dropTable) {
      if (Math.random() >= entry.chance) continue;
      const qty = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
      let tx = killedNpc.tileX + Math.floor(Math.random() * 3) - 1;
      let ty = killedNpc.tileY + Math.floor(Math.random() * 3) - 1;
      tx = Math.max(0, Math.min(this.opts.map.width - 1, tx));
      ty = Math.max(0, Math.min(this.opts.map.height - 1, ty));
      // Bug #78: Fall back to NPC's tile if scatter position is blocked, verify NPC tile is also walkable
      if (this.opts.map.collision[ty]?.[tx] === 1) {
        tx = killedNpc.tileX;
        ty = killedNpc.tileY;
        // If even the NPC tile is blocked (NPC was removed), try the raw random position clamped
        if (this.opts.map.collision[ty]?.[tx] === 1) {
          tx = Math.max(0, Math.min(this.opts.map.width - 1, killedNpc.tileX));
          ty = Math.max(0, Math.min(this.opts.map.height - 1, killedNpc.tileY));
        }
      }
      if (entry.itemId === "gold") {
        systems.drops.spawnGoldDrop(this.opts.state.drops, tx, ty, qty);
      } else {
        systems.drops.spawnItemDrop(this.opts.state.drops, tx, ty, entry.itemId, qty);
      }
    }
  }
}
