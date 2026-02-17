import { Room, Client } from "@colyseus/core";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { MovementSystem } from "../systems/MovementSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { DropSystem } from "../systems/DropSystem";
import { BuffSystem } from "../systems/BuffSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { RespawnSystem } from "../systems/RespawnSystem";
import { CLASS_STATS, TICK_MS, STARTING_EQUIPMENT, ITEMS, KILL_GOLD_BONUS } from "@ao5/shared";
import type { TileMap, Direction, JoinOptions, EquipmentSlot } from "@ao5/shared";
import { logger } from "../logger";

export class ArenaRoom extends Room<GameState> {
  static mapData: TileMap;

  private map!: TileMap;
  private movement = new MovementSystem();
  private buffSystem = new BuffSystem();
  private combat = new CombatSystem(this.buffSystem);
  private drops = new DropSystem();
  private inventorySystem = new InventorySystem();
  private respawnSystem = new RespawnSystem(this.inventorySystem);
  private spawnIndex = 0;

  onCreate(_options: Record<string, unknown>) {
    this.setState(new GameState());
    this.map = ArenaRoom.mapData;
    this.drops.setInventorySystem(this.inventorySystem);

    if (!this.map) {
      throw new Error("ArenaRoom.mapData must be set before room creation");
    }

    this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
    this.setPatchRate(TICK_MS);

    this.onMessage("move", (client, data: { direction: Direction }) => {
      this.handleMove(client, data.direction);
    });

    this.onMessage("attack", (client, data?: { targetTileX?: number; targetTileY?: number }) => {
      this.handleAttack(client, data?.targetTileX, data?.targetTileY);
    });

    this.onMessage(
      "cast",
      (
        client,
        data: { spellId: string; targetTileX: number; targetTileY: number }
      ) => {
        this.handleCast(client, data);
      }
    );

    this.onMessage("pickup", (client, data: { dropId: string }) => {
      this.handlePickup(client, data.dropId);
    });

    this.onMessage("equip", (client, data: { itemId: string }) => {
      this.handleEquip(client, data.itemId);
    });

    this.onMessage("unequip", (client, data: { slot: EquipmentSlot }) => {
      this.handleUnequip(client, data.slot);
    });

    this.onMessage("use_item", (client, data: { itemId: string }) => {
      this.handleUseItem(client, data.itemId);
    });

    this.onMessage("drop_item", (client, data: { itemId: string }) => {
      this.handleDropItem(client, data.itemId);
    });

    this.onMessage("ping", (client) => {
      client.send("pong", { serverTime: Date.now() });
    });

    logger.info({ room: this.roomId, intent: "room_created", result: "ok" });
  }

  onJoin(client: Client, options: JoinOptions) {
    const classType = options?.classType || "warrior";
    const stats = CLASS_STATS[classType];
    if (!stats) {
      client.leave();
      return;
    }

    const spawn = this.map.spawns[this.spawnIndex % this.map.spawns.length];
    this.spawnIndex++;

    const player = new Player();
    player.sessionId = client.sessionId;
    player.name = options?.name || "Unknown";
    player.classType = classType;
    player.tileX = spawn.x;
    player.tileY = spawn.y;
    player.facing = "down";
    player.hp = stats.hp;
    player.maxHp = stats.hp;
    player.mana = stats.mana;
    player.maxMana = stats.mana;
    player.alive = true;
    player.str = stats.str;
    player.agi = stats.agi;
    player.intStat = stats.int;
    player.gold = 0;

    this.state.players.set(client.sessionId, player);

    // Give starting equipment
    const startingGear = STARTING_EQUIPMENT[classType];
    if (startingGear) {
      player.gold = startingGear.gold;
      for (const itemId of startingGear.items) {
        const def = ITEMS[itemId];
        if (!def) continue;
        if (def.slot !== "consumable") {
          const slotKey = `equip${def.slot.charAt(0).toUpperCase() + def.slot.slice(1)}` as keyof typeof player;
          if ((player as any)[slotKey] === "") {
            (player as any)[slotKey] = itemId;
            continue;
          }
        }
        this.inventorySystem.addItem(player, itemId);
      }
      this.inventorySystem.recalcStats(player);
      // Update HP/mana to new maxes
      player.hp = player.maxHp;
      player.mana = player.maxMana;
    }

    client.send("welcome", {
      sessionId: client.sessionId,
      tileX: spawn.x,
      tileY: spawn.y,
      mapWidth: this.map.width,
      mapHeight: this.map.height,
      tileSize: this.map.tileSize,
      collision: this.map.collision,
    });

    logger.info({
      room: this.roomId,
      clientId: client.sessionId,
      intent: "join",
      result: "ok",
      posAfter: { x: spawn.x, y: spawn.y },
    });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.movement.removePlayer(client.sessionId);
    this.combat.removePlayer(client.sessionId);
    this.buffSystem.removePlayer(client.sessionId);
    this.respawnSystem.removePlayer(client.sessionId);

    logger.info({
      room: this.roomId,
      clientId: client.sessionId,
      intent: "leave",
      result: "ok",
    });
  }

  private tick(_deltaTime: number) {
    this.state.tick++;
    const now = Date.now();
    const broadcast = this.broadcast.bind(this);

    // Process buffs/DoTs
    this.buffSystem.tick(
      now,
      (sid) => this.state.players.get(sid),
      broadcast,
      (player) => this.onPlayerDeath(player, ""),
      this.roomId,
      this.state.tick
    );

    // Process combat windups
    this.combat.processWindups(
      now,
      (x, y) => this.findPlayerAtTile(x, y),
      (cx, cy, radius, excludeId) => this.findPlayersInRadius(cx, cy, radius, excludeId),
      (sid) => this.state.players.get(sid),
      broadcast,
      this.state.tick,
      this.roomId,
      (player, killerSessionId) => this.onPlayerDeath(player, killerSessionId)
    );

    this.combat.processBufferedActions(
      now,
      (sid) => this.state.players.get(sid),
      broadcast,
      this.state.tick,
      this.roomId,
      (x, y) => this.findPlayerAtTile(x, y),
      (sessionId) => {
        const c = this.clients.find((cl) => cl.sessionId === sessionId);
        return (type: string, data?: Record<string, unknown>) => c?.send(type, data ?? {});
      },
    );

    // Expire old drops
    this.drops.expireDrops(this.state.drops, now);

    // Process respawns
    this.respawnSystem.tick(
      now,
      (sid) => this.state.players.get(sid),
      this.map,
      broadcast
    );
  }

  private handleMove(client: Client, direction: Direction) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;
    if (player.stunned) return;

    this.movement.tryMove(
      player,
      direction,
      this.map,
      Date.now(),
      (x, y, excludeId) => this.isTileOccupied(x, y, excludeId),
      this.state.tick,
      this.roomId
    );
  }

  private handleAttack(client: Client, targetTileX?: number, targetTileY?: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;

    this.combat.tryAttack(
      player,
      Date.now(),
      this.broadcast.bind(this),
      this.state.tick,
      this.roomId,
      targetTileX,
      targetTileY,
      (x, y) => this.findPlayerAtTile(x, y),
      (type, data) => client.send(type, data ?? {}),
    );
  }

  private handleCast(
    client: Client,
    data: { spellId: string; targetTileX: number; targetTileY: number }
  ) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;

    this.combat.tryCast(
      player,
      data.spellId,
      data.targetTileX,
      data.targetTileY,
      Date.now(),
      this.broadcast.bind(this),
      this.state.tick,
      this.roomId,
      (x, y) => this.findPlayerAtTile(x, y),
      (type, data) => client.send(type, data ?? {}),
    );
  }

  private handlePickup(client: Client, dropId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;

    this.drops.tryPickup(
      player,
      dropId,
      this.state.drops,
      this.roomId,
      this.state.tick
    );
  }

  private handleEquip(client: Client, itemId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;
    this.inventorySystem.equipItem(player, itemId);
  }

  private handleUnequip(client: Client, slot: EquipmentSlot) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;
    this.inventorySystem.unequipItem(player, slot);
  }

  private handleUseItem(client: Client, itemId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;
    if (this.inventorySystem.useItem(player, itemId)) {
      this.broadcast("item_used", {
        sessionId: client.sessionId,
        itemId,
      });
    }
  }

  private handleDropItem(client: Client, itemId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;
    if (this.inventorySystem.removeItem(player, itemId)) {
      this.drops.spawnItemDrop(
        this.state.drops,
        player.tileX,
        player.tileY,
        itemId,
        1,
        this.roomId,
        this.state.tick
      );
    }
  }

  private findPlayerAtTile(x: number, y: number): Player | undefined {
    for (const [, player] of this.state.players) {
      if (player.tileX === x && player.tileY === y && player.alive) {
        return player;
      }
    }
    return undefined;
  }

  private findPlayersInRadius(cx: number, cy: number, radius: number, excludeId: string): Player[] {
    const result: Player[] = [];
    for (const [, player] of this.state.players) {
      if (player.sessionId === excludeId || !player.alive) continue;
      const dx = Math.abs(player.tileX - cx);
      const dy = Math.abs(player.tileY - cy);
      if (dx + dy <= radius) {
        result.push(player);
      }
    }
    return result;
  }

  private isTileOccupied(
    x: number,
    y: number,
    excludeId: string
  ): boolean {
    for (const [, player] of this.state.players) {
      if (
        player.sessionId !== excludeId &&
        player.tileX === x &&
        player.tileY === y &&
        player.alive
      ) {
        return true;
      }
    }
    return false;
  }

  private onPlayerDeath(player: Player, killerSessionId: string) {
    // Full-loot: drop all items and equipment
    const droppedItems = this.inventorySystem.dropAllItems(player);
    for (const { itemId, quantity } of droppedItems) {
      this.drops.spawnItemDrop(
        this.state.drops,
        player.tileX,
        player.tileY,
        itemId,
        quantity,
        this.roomId,
        this.state.tick
      );
    }

    // Drop gold
    if (player.gold > 0) {
      this.drops.spawnGoldDrop(
        this.state.drops,
        player.tileX,
        player.tileY,
        player.gold,
        this.roomId,
        this.state.tick
      );
      player.gold = 0;
    }

    // Award kill bonus gold to killer
    if (killerSessionId) {
      const killer = this.state.players.get(killerSessionId);
      if (killer) {
        killer.gold += KILL_GOLD_BONUS;
      }
    }

    // Broadcast kill feed
    this.broadcast("kill_feed", {
      killerSessionId,
      victimSessionId: player.sessionId,
      killerName: killerSessionId ? this.state.players.get(killerSessionId)?.name ?? "" : "",
      victimName: player.name,
    });

    // Queue respawn
    this.respawnSystem.queueRespawn(player.sessionId, Date.now());

    logger.info({
      room: this.roomId,
      tick: this.state.tick,
      clientId: player.sessionId,
      intent: "death",
      result: "ok",
      posAfter: { x: player.tileX, y: player.tileY },
    });
  }
}
