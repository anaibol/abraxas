import type { TileMap } from "@ao5/shared";
import { CLASS_STATS, STARTING_EQUIPMENT, RESPAWN_TIME_MS, ITEMS } from "@ao5/shared";
import type { Player } from "../schema/Player";
import { InventorySystem } from "./InventorySystem";

interface PendingRespawn {
  sessionId: string;
  respawnAt: number;
}

interface BroadcastFn {
  (type: string, data: Record<string, unknown>): void;
}

export class RespawnSystem {
  private pending: PendingRespawn[] = [];
  private inventorySystem: InventorySystem;

  constructor(inventorySystem: InventorySystem) {
    this.inventorySystem = inventorySystem;
  }

  queueRespawn(sessionId: string, now: number) {
    // Don't queue twice
    if (this.pending.some((p) => p.sessionId === sessionId)) return;
    this.pending.push({
      sessionId,
      respawnAt: now + RESPAWN_TIME_MS,
    });
  }

  removePlayer(sessionId: string) {
    this.pending = this.pending.filter((p) => p.sessionId !== sessionId);
  }

  tick(
    now: number,
    getPlayer: (sessionId: string) => Player | undefined,
    map: TileMap,
    broadcast: BroadcastFn
  ) {
    const remaining: PendingRespawn[] = [];

    for (const entry of this.pending) {
      if (now < entry.respawnAt) {
        remaining.push(entry);
        continue;
      }

      const player = getPlayer(entry.sessionId);
      if (!player) continue;

      // Pick a random spawn point
      const spawn = map.spawns[Math.floor(Math.random() * map.spawns.length)];

      const stats = CLASS_STATS[player.classType];
      player.tileX = spawn.x;
      player.tileY = spawn.y;
      player.hp = stats.hp;
      player.maxHp = stats.hp;
      player.mana = stats.mana;
      player.maxMana = stats.mana;
      player.alive = true;
      player.stealthed = false;
      player.stunned = false;
      player.str = stats.str;
      player.agi = stats.agi;
      player.intStat = stats.int;

      // Give starting equipment
      this.giveStartingEquipment(player);

      broadcast("respawn", {
        sessionId: player.sessionId,
        tileX: spawn.x,
        tileY: spawn.y,
      });
    }

    this.pending = remaining;
  }

  private giveStartingEquipment(player: Player) {
    const startingGear = STARTING_EQUIPMENT[player.classType];
    if (!startingGear) return;

    player.gold = startingGear.gold;

    for (const itemId of startingGear.items) {
      const def = ITEMS[itemId];
      if (!def) continue;

      // Auto-equip if it's an equipment item and the slot is empty
      if (def.slot !== "consumable") {
        const slotKey = `equip${def.slot.charAt(0).toUpperCase() + def.slot.slice(1)}` as keyof Player;
        if ((player as any)[slotKey] === "") {
          (player as any)[slotKey] = itemId;
          continue;
        }
      }
      // Otherwise add to inventory
      this.inventorySystem.addItem(player, itemId);
    }

    // Recalc stats with new equipment
    this.inventorySystem.recalcStats(player);
  }
}
