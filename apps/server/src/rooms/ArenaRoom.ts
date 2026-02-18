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
import { CLASS_STATS, TICK_MS, STARTING_EQUIPMENT, ITEMS, KILL_GOLD_BONUS, NPC_STATS, EXP_TABLE, NPC_DROPS } from "@abraxas/shared";
import { TileMap, Direction, ServerMessages, ClassType, JoinOptions, EquipmentSlot, InventoryEntry, EquipmentData } from "@abraxas/shared";
import { logger } from "../logger";

import { PersistenceService } from "../services/PersistenceService";
import { AuthService } from "../database/auth";
import { prisma } from "../database/db";
import { MessageHandler } from "../handlers/MessageHandler";
import { SpatialLookup } from "../utils/SpatialLookup";
import { EntityUtils, Entity } from "../utils/EntityUtils";

export class ArenaRoom extends Room<GameState> {
  static mapData: TileMap;

  private map!: TileMap;
  private movement!: MovementSystem;
  private buffSystem = new BuffSystem();
  private combat!: CombatSystem;
  private drops = new DropSystem();
  private inventorySystem = new InventorySystem();
  private respawnSystem = new RespawnSystem(this.inventorySystem);
  private npcSystem!: NpcSystem;
  private messageHandler!: MessageHandler;
  private spatial!: SpatialLookup;
  private spawnIndex = 0;

  onCreate(_options: Record<string, unknown>) {
    this.setState(new GameState());
    this.map = ArenaRoom.mapData;
    this.drops.setInventorySystem(this.inventorySystem);
    
    // Initialize utilities and systems in dependency order
    this.spatial = new SpatialLookup(this.state);
    this.movement = new MovementSystem(this.spatial);
    this.combat = new CombatSystem(this.buffSystem, this.spatial);
    this.npcSystem = new NpcSystem(this.state, this.movement, this.combat, this.spatial);

    if (!this.map) {
      throw new Error("ArenaRoom.mapData must be set before room creation");
    }

    this.messageHandler = new MessageHandler(
        this.state,
        this.map,
        this.roomId,
        this.movement,
        this.combat,
        this.inventorySystem,
        this.drops,
        this.broadcast.bind(this),
        this.spatial.isTileOccupied.bind(this.spatial)
    );

    // Spawn NPCs
    const npcCount = this.map.npcCount !== undefined ? this.map.npcCount : 20;
    if (npcCount > 0) {
        this.npcSystem.spawnNpcs(npcCount, this.map);
    }

    this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
    this.setPatchRate(TICK_MS);

    this.onMessage("move", (client, data: { direction: Direction }) => {
      this.messageHandler.handleMove(client, data.direction);
    });

    this.onMessage("attack", (client, data?: { targetTileX?: number; targetTileY?: number }) => {
      this.messageHandler.handleAttack(client, data?.targetTileX, data?.targetTileY);
    });

    this.onMessage(
      "cast",
      (
        client,
        data: { spellId: string; targetTileX: number; targetTileY: number }
      ) => {
        this.messageHandler.handleCast(client, data);
      }
    );

    this.onMessage("pickup", (client, data: { dropId: string }) => {
      this.messageHandler.handlePickup(client, data.dropId);
    });

    this.onMessage("equip", (client, data: { itemId: string }) => {
      this.messageHandler.handleEquip(client, data.itemId);
    });

    this.onMessage("unequip", (client, data: { slot: EquipmentSlot }) => {
      this.messageHandler.handleUnequip(client, data.slot);
    });

    this.onMessage("use_item", (client, data: { itemId: string }) => {
      this.messageHandler.handleUseItem(client, data.itemId);
    });

    this.onMessage("drop_item", (client, data: { itemId: string }) => {
      this.messageHandler.handleDropItem(client, data.itemId);
    });

    this.onMessage("chat", (client, data: { message: string }) => {
        this.messageHandler.handleChat(client, data.message);
    });

    this.onMessage("interact", (client, data: { npcId: string }) => {
        this.messageHandler.handleInteract(client, data.npcId);
    });

    this.onMessage("buy_item", (client, data: { itemId: string; quantity: number }) => {
        this.messageHandler.handleBuyItem(client, data);
    });

    this.onMessage("sell_item", (client, data: { itemId: string; quantity: number }) => {
        this.messageHandler.handleSellItem(client, data);
    });

    this.onMessage("ping", (client) => {
      client.send("pong", { serverTime: Date.now() });
    });

    logger.info({ room: this.roomId, intent: "room_created", result: "ok" });
  }

  async onAuth(client: Client, options: JoinOptions) {
    if (!options.token) {
        throw new Error("Token required");
    }
    const payload = AuthService.verifyToken(options.token);
    if (!payload) {
        throw new Error("Invalid token");
    }
    
    // Fetch user to ensure valid
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new Error("User not found");

    return { user };
  }

  async onJoin(client: Client, options: JoinOptions, auth: any) {
    const classType = options?.classType || "warrior";
    if (!classType || !CLASS_STATS[classType]) {
      logger.warn({ room: this.roomId, clientId: client.sessionId, intent: "join", result: "error", message: `Invalid classType: ${classType}` });
      client.leave();
      return;
    }
    
    const user = auth.user;
    // For now, Player Name = Username. 
    // In future, allow multiple characters per user.
    const playerName = user.username; 

    // Find or Create Player Character
    let dbPlayer = await PersistenceService.loadPlayer(user.id, playerName);

    if (!dbPlayer) {
         // Create new character at spawn point
         const spawn = this.map.spawns[this.spawnIndex % this.map.spawns.length];
         this.spawnIndex++;
         dbPlayer = await PersistenceService.createPlayer(user.id, playerName, classType, spawn.x, spawn.y);
    }

    const player = new Player();
    player.sessionId = client.sessionId;
    player.userId = user.id;
    player.name = dbPlayer.name;
    player.classType = dbPlayer.classType; 
    
    player.tileX = dbPlayer.x;
    player.tileY = dbPlayer.y;

    const dirKey = dbPlayer.facing.toUpperCase();
    if (dirKey === "UP") player.facing = Direction.UP;
    else if (dirKey === "DOWN") player.facing = Direction.DOWN;
    else if (dirKey === "LEFT") player.facing = Direction.LEFT;
    else if (dirKey === "RIGHT") player.facing = Direction.RIGHT;
    else player.facing = Direction.DOWN;

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

    // Load Inventory (Relation)
    for (const item of dbPlayer.inventory) {
        this.inventorySystem.addItem(player, item.itemId, item.quantity); 
    }

    // Load Equipment (Fields)
    player.equipWeapon = dbPlayer.equipWeapon || "";
    player.equipShield = dbPlayer.equipShield || "";
    player.equipHelmet = dbPlayer.equipHelmet || "";
    player.equipArmor = dbPlayer.equipArmor || "";
    player.equipRing = dbPlayer.equipRing || "";
    
    // Starting Gear for new characters (empty inv/equip)
    if (dbPlayer.inventory.length === 0 && 
        !player.equipWeapon && !player.equipArmor && !player.equipShield && !player.equipHelmet) {
         
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
    this.spatial.addToGrid(player); // Register in spatial grid

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
        const inventory: InventoryEntry[] = [];
        player.inventory.forEach(item => {
            inventory.push({ itemId: item.itemId, quantity: item.quantity, slotIndex: item.slotIndex });
        });
        
        const equipment: EquipmentData = {
            weapon: player.equipWeapon,
            shield: player.equipShield,
            helmet: player.equipHelmet,
            armor: player.equipArmor,
            ring: player.equipRing
        };
        
        const playerData = {
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
            inventory,
            equipment,
            classType: player.classType
        };

        await PersistenceService.savePlayer(player.userId, player.name, playerData);
        this.spatial.removeFromGrid(player); // Remove from spatial grid
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

    this.buffSystem.tick(
      now,
      (sid) => {
        const entity = this.spatial.findEntityBySessionId(sid);
        return entity && EntityUtils.isPlayer(entity) ? entity : undefined;
      },
      broadcast,
      (player) => {
        if (EntityUtils.isPlayer(player)) {
          this.onEntityDeath(player, "");
        }
      },
      this.roomId,
      this.state.tick
    );

    this.npcSystem.tick(
        _deltaTime,
        this.map,
        now,
        (x, y, excludeId) => this.spatial.isTileOccupied(x, y, excludeId),
        this.state.tick,
        this.roomId,
        broadcast
    );

    this.combat.processWindups(
      now,
      broadcast,
      this.state.tick,
      this.roomId,
      (entity, killerSessionId) => this.onEntityDeath(entity, killerSessionId)
    );

    this.combat.processBufferedActions(
      now,
      broadcast,
      this.state.tick,
      this.roomId,
      (sessionId) => {
        const c = this.clients.find((cl) => cl.sessionId === sessionId);
        return (type: string, data?: Record<string, unknown>) => c?.send(type, data ?? {});
      },
    );

    this.drops.expireDrops(this.state.drops, now);

    this.respawnSystem.tick(
      now,
      (sid) => this.state.players.get(sid),
      this.map,
      broadcast
    );
  }

  private onEntityDeath(entity: Entity, killerSessionId: string) {
    if (EntityUtils.isPlayer(entity)) {
        // It's a player
        this.onPlayerDeath(entity, killerSessionId);
    } else {
        // It's an NPC
        this.onNpcDeath(entity, killerSessionId);
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
                          npc.tileX + offsetX, 
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
        const killer = this.spatial.findEntityBySessionId(killerSessionId);
        if (killer) {
            if (EntityUtils.isPlayer(killer)) { // It's a Player
                killerName = killer.name;
            } else if (EntityUtils.isNpc(killer)) { // It's an NPC
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
