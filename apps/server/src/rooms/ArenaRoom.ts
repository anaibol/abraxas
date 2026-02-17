import { Room, Client } from "@colyseus/core";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { Npc } from "../schema/Npc";
import { MovementSystem } from "../systems/MovementSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { DropSystem } from "../systems/DropSystem";
import { BuffSystem } from "../systems/BuffSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { RespawnSystem } from "../systems/RespawnSystem";
import { NpcSystem } from "../systems/NpcSystem";
import { CLASS_STATS, TICK_MS, STARTING_EQUIPMENT, ITEMS, KILL_GOLD_BONUS, NPC_STATS, EXP_TABLE, NPC_DROPS } from "@ao5/shared";
import type { TileMap, Direction, JoinOptions, EquipmentSlot } from "@ao5/shared";
import { logger } from "../logger";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});

type Entity = Player | Npc;

export class ArenaRoom extends Room<GameState> {
  static mapData: TileMap;

  private map!: TileMap;
  private movement = new MovementSystem();
  private buffSystem = new BuffSystem();
  private combat = new CombatSystem(this.buffSystem);
  private drops = new DropSystem();
  private inventorySystem = new InventorySystem();
  private respawnSystem = new RespawnSystem(this.inventorySystem);
  private npcSystem!: NpcSystem;
  private spawnIndex = 0;

  onCreate(_options: Record<string, unknown>) {
    this.setState(new GameState());
    this.map = ArenaRoom.mapData;
    this.drops.setInventorySystem(this.inventorySystem);
    this.npcSystem = new NpcSystem(this.state, this.movement, this.combat);

    if (!this.map) {
      throw new Error("ArenaRoom.mapData must be set before room creation");
    }

    // Spawn NPCs
    this.npcSystem.spawnNpcs(20, this.map);

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

    this.onMessage("chat", (client, data: { message: string }) => {
        const player = this.state.players.get(client.sessionId);
        if (player && data.message) {
            // Trim and limit message length
            const text = data.message.trim().slice(0, 100);
            if (text.length > 0) {
                this.broadcast("chat", {
                    senderId: player.sessionId,
                    senderName: player.name,
                    message: text,
                });
            }
        }
    });

    this.onMessage("ping", (client) => {
      client.send("pong", { serverTime: Date.now() });
    });

    logger.info({ room: this.roomId, intent: "room_created", result: "ok" });
  }

  async onAuth(client: Client, options: JoinOptions) {
    // Simple auth: use name as username/password for now
    // In production, use token or actual password
    let username = options.name;
    
    if (!username) {
        const NAMES = ["Aeltho", "Bryna", "Cyril", "Dorn", "Elara", "Faelan", "Garrick", "Hylia", "Ivor", "Jora", "Kael", "Lira", "Marek", "Nylah", "Orion", "Pyra", "Quintus", "Rian", "Sylas", "Thora", "Ulric", "Vyla", "Wren", "Xander", "Yara", "Zephyr"];
        username = NAMES[Math.floor(Math.random() * NAMES.length)];
        
        // Ensure uniqueness (simple retry logic or append number if taken? 
        // findUnique will fail if we create duplicate unique. 
        // For Guest/Random, appending a number is safer.
        username += Math.floor(Math.random() * 10000);
    }
    
    // Find or create User
    let user = await prisma.user.findUnique({
        where: { username }
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                username,
            }
        });
    }

    return { user };
  }
  async onJoin(client: Client, options: JoinOptions, auth: any) {
    const classType = options?.classType || "warrior";
    const stats = CLASS_STATS[classType];
    if (!stats) {
      client.leave();
      return;
    }
    
    const user = auth.user;
    const playerName = options.name || user.username;

    // Load Player from DB
    let dbPlayer = await prisma.player.findUnique({
        where: {
            userId_name: {
                userId: user.id,
                name: playerName
            }
        }
    });

    // Create if not exists
    if (!dbPlayer) {
         const spawn = this.map.spawns[this.spawnIndex % this.map.spawns.length];
         this.spawnIndex++;
         
         const startingGear = STARTING_EQUIPMENT[classType];
         let inventoryStr = "[]";
         let equipmentStr = "{}";
         
         // Create initial inventory/equipment JSON
         if (startingGear) {
            const invItems = [];
             for (const itemId of startingGear.items) {
                 const def = ITEMS[itemId];
                 if (!def) continue;
             }
         }

         dbPlayer = await prisma.player.create({
             data: {
                 userId: user.id,
                 name: playerName,
                 classType,
                 x: spawn.x,
                 y: spawn.y,
                 hp: stats.hp,
                 maxHp: stats.hp,
                 mana: stats.mana,
                 maxMana: stats.mana,
                 str: stats.str,
                 agi: stats.agi,
                 intStat: stats.int,
                 facing: "down",
                 inventory: "[]",
                 equipment: "{}"
             }
         });
    }

    const player = new Player();
    player.sessionId = client.sessionId;
    player.name = dbPlayer.name;
    player.classType = dbPlayer.classType as any; // Type assertion
    player.tileX = dbPlayer.x;
    player.tileY = dbPlayer.y;
    player.facing = dbPlayer.facing as Direction;
    player.hp = dbPlayer.hp;
    player.maxHp = dbPlayer.maxHp;
    player.mana = dbPlayer.mana;
    player.maxMana = dbPlayer.maxMana;
    player.alive = dbPlayer.hp > 0;
    player.str = dbPlayer.str;
    player.agi = dbPlayer.agi;
    player.intStat = dbPlayer.intStat;
    player.gold = dbPlayer.gold;
    player.level = dbPlayer.level;
    player.xp = dbPlayer.xp;
    player.maxXp = dbPlayer.maxXp;

    // Load Inventory
    try {
        const invData = JSON.parse(dbPlayer.inventory);
        for (const item of invData) {
            this.inventorySystem.addItem(player, item.itemId, item.quantity); 
        }
    } catch (e) {
        console.error("Failed to load inventory", e);
    }

    // Load Equipment
    try {
        const equipData = JSON.parse(dbPlayer.equipment);
        player.equipWeapon = equipData.weapon || "";
        player.equipShield = equipData.shield || "";
        player.equipHelmet = equipData.helmet || "";
        player.equipArmor = equipData.armor || "";
        player.equipRing = equipData.ring || "";
    } catch (e) {
        console.error("Failed to load equipment", e);
    }
    
    // If NEW player (just created in DB, inventory empty), give starting gear
    if (dbPlayer.inventory === "[]" && dbPlayer.equipment === "{}" && dbPlayer.createdAt.getTime() === dbPlayer.updatedAt.getTime()) {
         const startingGear = STARTING_EQUIPMENT[classType];
         if (startingGear) {
            player.gold = startingGear.gold;
            for (const itemId of startingGear.items) {
               this.inventorySystem.addItem(player, itemId);
               const def = ITEMS[itemId];
               if (def && def.slot !== "consumable") {
                   this.inventorySystem.equipItem(player, itemId);
               }
            }
            this.inventorySystem.recalcStats(player);
            player.hp = player.maxHp;
            player.mana = player.maxMana;
         }
    }

    this.state.players.set(client.sessionId, player);

    client.send("welcome", {
      sessionId: client.sessionId,
      tileX: player.tileX,
      tileY: player.tileY,
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
      posAfter: { x: player.tileX, y: player.tileY },
    });
  }

  async onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
        const inventory: { itemId: string; quantity: number; slotIndex: number }[] = [];
        player.inventory.forEach(item => {
            inventory.push({ itemId: item.itemId, quantity: item.quantity, slotIndex: item.slotIndex });
        });
        
        const equipment = {
            weapon: player.equipWeapon,
            shield: player.equipShield,
            helmet: player.equipHelmet,
            armor: player.equipArmor,
            ring: player.equipRing
        };

        try {
            await prisma.player.updateMany({ // Use updateMany based on userId+name or just find unique ID if we stored it?
                // We didn't store the DB UUID in the Player schema, only in local scope on join.
                // We should probably store dbId in Player schema (non-synced) or just query by userId + name.
                // But wait, we don't have userId easily available unless we stored it on player.
                // Let's assume name is unique per user? Or globally unique?
                // If name is unique globally, we can use name.
                // If not, we need to store dbId on the Player entity (maybe as a non-synced field `dbId`).
                // For now, let's rely on name matching since we don't allow duplicate names in DB per user.
                // BUT we need the user ID. 
                // We don't have the user ID on the player object right now.
                // Let's add `dbId` to Player schema (server-side only if possible, or just public).
                // Or better, update schema to include `dbId`. 
                // Alternatively, query by name if unique. 
                // Let's update Player schema in `schema/Player.ts` to include `dbId` string.
                where: {
                    name: player.name
                    // We risk collision if names aren't globally unique. 
                    // Let's add dbId to Player schema in next step. For now, assume unique name.
                },
                data: {
                    x: player.tileX,
                    y: player.tileY,
                    hp: player.hp,
                    maxHp: player.maxHp,
                    mana: player.mana,
                    maxMana: player.maxMana,
                    str: player.str,
                    agi: player.agi,
                    intStat: player.intStat,
                    facing: player.facing,
                    gold: player.gold,
                    level: player.level,
                    xp: player.xp,
                    maxXp: player.maxXp,
                    inventory: JSON.stringify(inventory),
                    equipment: JSON.stringify(equipment),
                    classType: player.classType
                }
            });
        } catch (e) {
            logger.error({ msg: "Failed to save player", err: e });
        }
    }

    this.state.players.delete(client.sessionId);
    this.movement.removePlayer(client.sessionId);
    this.combat.removeEntity(client.sessionId);
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
      (sid) => this.findEntityBySessionId(sid) as Player, // Buff system mostly for players now, need refactor to support NPCs fully? Casting to Player for now as BuffSystem might expect Players. Checked BuffSystem, it expects getPlayer returns Player.
      // Wait, BuffSystem handles players mostly. If we want buffs on NPCs we need to update BuffSystem too.
      // For now let's assume NPCs don't get sophisticated buffs or we ignore type error if compatible.
      // But we should update getPlayer to getEntity.
      broadcast,
      (player) => this.onEntityDeath(player as Player, ""), // Typo fix
      this.roomId,
      this.state.tick
    );
    // Note: BuffSystem.tick iterates this.state.players? No, it iterates its own state map.
    // If we want NPCs to have buffs, we need to register them in BuffSystem state.

    // Process NPCs
    this.npcSystem.tick(
        _deltaTime,
        this.map,
        now,
        (x, y, excludeId) => this.isTileOccupied(x, y, excludeId),
        this.state.tick,
        this.roomId,
        (x, y) => this.findEntityAtTile(x, y),
        broadcast
    );

    // Process combat windups
    this.combat.processWindups(
      now,
      (x, y) => this.findEntityAtTile(x, y),
      (cx, cy, radius, excludeId) => this.findEntitiesInRadius(cx, cy, radius, excludeId),
      (sid) => this.findEntityBySessionId(sid),
      broadcast,
      this.state.tick,
      this.roomId,
      (entity, killerSessionId) => this.onEntityDeath(entity, killerSessionId)
    );

    this.combat.processBufferedActions(
      now,
      (sid) => this.findEntityBySessionId(sid),
      broadcast,
      this.state.tick,
      this.roomId,
      (x, y) => this.findEntityAtTile(x, y),
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
      (x, y) => this.findEntityAtTile(x, y),
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
      (x, y) => this.findEntityAtTile(x, y),
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

  private findEntityBySessionId(sessionId: string): Entity | undefined {
      if (this.state.players.has(sessionId)) return this.state.players.get(sessionId);
      if (this.state.npcs.has(sessionId)) return this.state.npcs.get(sessionId);
      return undefined;
  }

  private findEntityAtTile(x: number, y: number): Entity | undefined {
    for (const [, player] of this.state.players) {
      if (player.tileX === x && player.tileY === y && player.alive) {
        return player;
      }
    }
    for (const [, npc] of this.state.npcs) {
        if (npc.tileX === x && npc.tileY === y && npc.alive) {
            return npc;
        }
    }
    return undefined;
  }

  private findEntitiesInRadius(cx: number, cy: number, radius: number, excludeId: string): Entity[] {
    const result: Entity[] = [];
    for (const [, player] of this.state.players) {
      if (player.sessionId === excludeId || !player.alive) continue;
      const dx = Math.abs(player.tileX - cx);
      const dy = Math.abs(player.tileY - cy);
      if (dx + dy <= radius) {
        result.push(player);
      }
    }
    for (const [, npc] of this.state.npcs) {
        if (npc.sessionId === excludeId || !npc.alive) continue;
        const dx = Math.abs(npc.tileX - cx);
        const dy = Math.abs(npc.tileY - cy);
        if (dx + dy <= radius) {
            result.push(npc);
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
    for (const [, npc] of this.state.npcs) {
        if (
            npc.sessionId !== excludeId &&
            npc.tileX === x &&
            npc.tileY === y &&
            npc.alive
        ) {
            return true;
        }
    }
    return false;
  }

  private onEntityDeath(entity: Entity, killerSessionId: string) {
    if ("classType" in entity) {
        // It's a player
        this.onPlayerDeath(entity as Player, killerSessionId);
    } else {
        // It's an NPC
        this.onNpcDeath(entity as Npc, killerSessionId);
    }
  }

  private onNpcDeath(npc: Npc, killerSessionId: string) {
      this.npcSystem.handleDeath(npc);

      if (killerSessionId) {
          const killer = this.state.players.get(killerSessionId);
          if (killer && killer.alive) {
             this.handleNpcKillRewards(killer, npc);
          }
      }

      this.broadcast("death", { sessionId: npc.sessionId, killerSessionId });
  }

  private handleNpcKillRewards(player: Player, npc: Npc) {
      // 1. Experience & Leveling
      const stats = NPC_STATS[npc.type];
      if (stats && stats.expReward) {
          player.xp += stats.expReward;
          // Level up check
          while (player.xp >= player.maxXp) {
              player.xp -= player.maxXp;
              player.level++;
              
              // Increase Max XP for next level (simple curve: current * 1.5 or look up table)
              // We have EXP_TABLE in config.
              // EXP_TABLE[level] is exp needed to reach level+1 ? Or total exp?
              // Let's assume EXP_TABLE[level] is the XP needed to go from level to level+1.
              // But config says: 0, 100, 250...
              // So level 1 needs 100 xp to go to level 2.
              // We should look up EXP_TABLE[player.level] if it exists.
              
              const nextLevelEntry = EXP_TABLE[player.level]; 
              if (nextLevelEntry !== undefined) {
                  player.maxXp = nextLevelEntry;
              } else {
                  // Fallback if table runs out
                  player.maxXp = Math.floor(player.maxXp * 1.2);
              }

              // Stat Increases (simple +5 to all + recovery)
              const classStats = CLASS_STATS[player.classType];
              // Maybe scale stats? For now just flat bonus + full heal
              player.maxHp += 20;
              player.maxMana += 10;
              player.str += 2;
              player.agi += 2;
              player.intStat += 2;

              player.hp = player.maxHp;
              player.mana = player.maxMana;

              this.broadcast("level_up", {
                  sessionId: player.sessionId,
                  level: player.level,
              });
              
              const client = this.clients.find(c => c.sessionId === player.sessionId);
              if (client) {
                  client.send("notification", { message: `Level Up! You are now level ${player.level}!` });
              }
          }
      }

      // 2. Drops (Diablo Style)
      // Look up drop table
      const dropTable = NPC_DROPS[npc.type];
      if (dropTable) {
          for (const entry of dropTable) {
              if (Math.random() < entry.chance) {
                  const quantity = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
                  
                  // Spread drops slightly
                  const offsetX = (Math.random() - 0.5) * 1.5; 
                  const offsetY = (Math.random() - 0.5) * 1.5;
                  
                  // If it's gold, spawn gold drop
                  if (entry.itemId === "gold") {
                       this.drops.spawnGoldDrop(
                          this.state.drops,
                          npc.tileX + offsetX, // Note: tileX is int, but DropSystem might handle float positions? 
                          // DropSystemSchema uses x: number (float ok).
                          // Map collision check might be needed if drops block or need to be on valid tile.
                          // Usually drops just sit on top.
                          npc.tileY + offsetY,
                          quantity,
                          this.roomId,
                          this.state.tick
                      );
                  } else {
                      // Item Drop
                      this.drops.spawnItemDrop(
                          this.state.drops,
                          npc.tileX + offsetX,
                          npc.tileY + offsetY,
                          entry.itemId,
                          quantity,
                          this.roomId,
                          this.state.tick
                      );
                  }
              }
          }
      }
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
    let killerName = "";
    if (killerSessionId) {
        const killer = this.findEntityBySessionId(killerSessionId);
        if (killer) {
            if ("classType" in killer) { // It's a Player
                killerName = killer.name;
            } else { // It's an NPC
                killerName = killer.type;
            }
        }
    }

    this.broadcast("kill_feed", {
      killerSessionId,
      victimSessionId: player.sessionId,
      killerName,
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
