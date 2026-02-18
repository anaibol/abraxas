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
import { TileMap, Direction, ServerMessages, ClassType, JoinOptions, EquipmentSlot, InventoryEntry, EquipmentData, ClientMessageType, ServerMessageType, ClientMessages } from "@abraxas/shared";
import { logger } from "../logger";

import { MapService } from "../services/MapService";
import { PersistenceService } from "../services/PersistenceService";
import { AuthService } from "../database/auth";
import { prisma } from "../database/db";
import { MessageHandler } from "../handlers/MessageHandler";
import { SocialSystem } from "../systems/SocialSystem";
import { FriendsSystem } from "../systems/FriendsSystem";
import { SpatialLookup } from "../utils/SpatialLookup";
import { EntityUtils, Entity } from "../utils/EntityUtils";
import { QuestSystem } from "../systems/QuestSystem";

console.error("[ArenaRoom.ts] Module loading...");

export class ArenaRoom extends Room<any> {
  constructor() {
    super();
    console.error("[ArenaRoom] Constructor called");
  }

  private map!: TileMap;
  private roomMapName!: string;
  private movement!: MovementSystem;
  private buffSystem = new BuffSystem();
  private combat!: CombatSystem;
  private drops = new DropSystem();
  private inventorySystem = new InventorySystem();
  private respawnSystem = new RespawnSystem(this.inventorySystem);
  private npcSystem!: NpcSystem;
  private social!: SocialSystem;
  private friends!: FriendsSystem;
  private messageHandler!: MessageHandler;
  private spatial!: SpatialLookup;
  private quests = new QuestSystem();
  private spawnIndex = 0;

  async onCreate(options: JoinOptions & { mapName?: string }) {
    try {
        console.error("[ArenaRoom] Entering onCreate");
        this.setState(new GameState());
        console.error("[ArenaRoom] State initialized");
        
        this.roomMapName = options.mapName || "arena.test";
        console.error(`[ArenaRoom] Map name: ${this.roomMapName}`);
        
        const loadedMap = await MapService.getMap(this.roomMapName);
        if (!loadedMap) {
            console.error(`[ArenaRoom] Failed to load map: ${this.roomMapName}`);
            throw new Error(`Failed to load map: ${this.roomMapName}`);
        }
        this.map = loadedMap;
        console.error("[ArenaRoom] Map loaded");

        this.drops.setInventorySystem(this.inventorySystem);
        
        this.spatial = new SpatialLookup(this.state);
        this.movement = new MovementSystem(this.spatial);
        this.combat = new CombatSystem(this.buffSystem, this.spatial);
        this.npcSystem = new NpcSystem(this.state, this.movement, this.combat, this.spatial);

        this.social = new SocialSystem(this.state, (sid: string) => this.clients.find(c => c.sessionId === sid));
        this.friends = new FriendsSystem(this.state, (sid: string) => this.clients.find(c => c.sessionId === sid));

        this.messageHandler = new MessageHandler(
            this.state,
            this.map,
            this.roomId,
            this.movement,
            this.combat,
            this.inventorySystem,
            this.drops,
            this.social,
            this.friends,
            this.broadcast.bind(this),
            this.spatial.isTileOccupied.bind(this.spatial),
            (name: string) => {
                const player = Array.from(this.state.players.values()).find((p: any) => p.name === name);
                if (!player) return undefined;
                return this.clients.find(c => c.sessionId === (player as any).sessionId);
            },
            this.quests,
            this.gainXp.bind(this)
        );

        if (this.map.npcs) {
            for (const npcDef of this.map.npcs) {
                this.npcSystem.spawnNpcAt(npcDef.type, this.map, npcDef.x, npcDef.y);
            }
        }

        const npcCount = this.map.npcCount !== undefined ? this.map.npcCount : 20;
        if (npcCount > 0) {
            this.npcSystem.spawnNpcs(npcCount, this.map);
        }

        this.setSimulationInterval((dt) => this.tick(dt), TICK_MS);
        this.setPatchRate(TICK_MS);

        // Movement & Combat
        this.onMessage(ClientMessageType.Move, (client, data: ClientMessages[ClientMessageType.Move]) => {
            this.messageHandler.handleMove(client, data.direction);
        });

        this.onMessage(ClientMessageType.Attack, (client, data: ClientMessages[ClientMessageType.Attack]) => {
            this.messageHandler.handleAttack(client, data);
        });

        this.onMessage(ClientMessageType.Cast, (client, data: ClientMessages[ClientMessageType.Cast]) => {
            this.messageHandler.handleCast(client, data);
        });

        // Inventory
        this.onMessage(ClientMessageType.Pickup, (client, data: ClientMessages[ClientMessageType.Pickup]) => {
            this.messageHandler.handlePickup(client, data);
        });

        this.onMessage(ClientMessageType.Equip, (client, data: ClientMessages[ClientMessageType.Equip]) => {
            this.messageHandler.handleEquip(client, data);
        });

        this.onMessage(ClientMessageType.Unequip, (client, data: ClientMessages[ClientMessageType.Unequip]) => {
            this.messageHandler.handleUnequip(client, data);
        });

        this.onMessage(ClientMessageType.UseItem, (client, data: ClientMessages[ClientMessageType.UseItem]) => {
            this.messageHandler.handleUseItem(client, data);
        });

        this.onMessage(ClientMessageType.DropItem, (client, data: ClientMessages[ClientMessageType.DropItem]) => {
            this.messageHandler.handleDropItem(client, data);
        });

        // NPCs & Quests
        this.onMessage(ClientMessageType.Interact, (client, data: ClientMessages[ClientMessageType.Interact]) => {
            this.messageHandler.handleInteract(client, data);
        });

        this.onMessage(ClientMessageType.BuyItem, (client, data: ClientMessages[ClientMessageType.BuyItem]) => {
            this.messageHandler.handleBuyItem(client, data);
        });

        this.onMessage(ClientMessageType.SellItem, (client, data: ClientMessages[ClientMessageType.SellItem]) => {
            this.messageHandler.handleSellItem(client, data);
        });

        this.onMessage(ClientMessageType.QuestAccept, (client, data: ClientMessages[ClientMessageType.QuestAccept]) => {
            this.messageHandler.handleQuestAccept(client, data);
        });

        this.onMessage(ClientMessageType.QuestComplete, (client, data: ClientMessages[ClientMessageType.QuestComplete]) => {
            this.messageHandler.handleQuestComplete(client, data);
        });

        // Social
        this.onMessage(ClientMessageType.Chat, (client, data: ClientMessages[ClientMessageType.Chat]) => {
            this.messageHandler.handleChat(client, data);
        });

        this.onMessage(ClientMessageType.FriendRequest, (client, data: ClientMessages[ClientMessageType.FriendRequest]) => {
            this.messageHandler.handleFriendRequest(client, data);
        });

        this.onMessage(ClientMessageType.FriendAccept, (client, data: ClientMessages[ClientMessageType.FriendAccept]) => {
            this.messageHandler.handleFriendAccept(client, data);
        });

        // Party
        this.onMessage(ClientMessageType.PartyInvite, (client, data: ClientMessages[ClientMessageType.PartyInvite]) => {
            this.messageHandler.handlePartyInvite(client, data);
        });

        this.onMessage(ClientMessageType.PartyAccept, (client, data: ClientMessages[ClientMessageType.PartyAccept]) => {
            this.messageHandler.handlePartyAccept(client, data);
        });

        this.onMessage(ClientMessageType.PartyLeave, (client) => {
            this.messageHandler.handlePartyLeave(client);
        });

        this.onMessage(ClientMessageType.PartyKick, (client, data: ClientMessages[ClientMessageType.PartyKick]) => {
            this.messageHandler.handlePartyKick(client, data);
        });

        // Network
        this.onMessage(ClientMessageType.Ping, (client) => {
            this.messageHandler.handlePing(client);
        });

        this.onMessage(ClientMessageType.Audio, (client, data: ArrayBuffer) => {
            this.messageHandler.handleAudio(client, data);
        });

        logger.info({ room: this.roomId, intent: "room_created", result: "ok" });
        process.stderr.write("[ArenaRoom] onCreate completed successfully\n");
    } catch (e) {
        process.stderr.write(`[ArenaRoom] CRITICAL ERROR IN ONCREATE: ${e}\n`);
        if (e instanceof Error) {
            process.stderr.write(e.stack || "No stack trace available\n");
        }
        throw e;
    }
  }

  async onAuth(client: Client, options: JoinOptions) {
    console.error(`[ArenaRoom] onAuth entering for client ${client.sessionId}`);
    if (!options.token) {
        console.error("[ArenaRoom] onAuth: No token provided");
        throw new Error("Token required");
    }
    const payload = AuthService.verifyToken(options.token);
    if (!payload) {
        console.error("[ArenaRoom] onAuth: Invalid token");
        throw new Error("Invalid token");
    }
    
    // Fetch user to ensure valid
    console.error(`[ArenaRoom] onAuth: Fetching user ${payload.userId}`);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
        console.error(`[ArenaRoom] onAuth: User ${payload.userId} not found`);
        throw new Error("User not found");
    }

    console.error(`[ArenaRoom] onAuth: Success for user ${user.username}`);
    return { user };
  }

  async onJoin(client: Client, options: JoinOptions & { mapName?: string }, auth?: any) {
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
         dbPlayer = await PersistenceService.createPlayer(user.id, playerName, classType, spawn.x, spawn.y, this.roomMapName);
    } else {
        // If player is already saved, check if they are in the correct room
        if (dbPlayer.mapName !== this.roomMapName) {
            // If they are joining the wrong room, we should really redirect them or just teleport them here if we allow it.
            // For portals, the client will join the correct room.
            // If they login and join a random room, we might want to teleport them to their last saved map's room.
            // For now, let's just update their mapName if they specifically joined this room.
            logger.info({ room: this.roomId, clientId: client.sessionId, message: `Player ${playerName} joined ${this.roomMapName} but was last in ${dbPlayer.mapName}. Teleporting.` });
        }
    }

    const player = new Player();
    player.sessionId = client.sessionId;
    player.userId = user.id;
    player.name = dbPlayer.name;
    player.classType = dbPlayer.classType as ClassType; 
    
    player.dbId = dbPlayer.id; // Store prisma ID
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

    this.friends.setUserOnline(user.id, client.sessionId);
    await this.friends.sendUpdateToUser(user.id, client.sessionId);

    // Load Quests
    const quests = await this.quests.loadPlayerQuests(user.id, dbPlayer.id);
    client.send(ServerMessageType.QuestList, { quests });

    client.send(ServerMessageType.Welcome, {
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
        // Clean up social
        this.messageHandler.handlePartyLeave(client);
        this.friends.setUserOffline(player.userId);

        const inventory: InventoryEntry[] = [];
        (player.inventory as any).forEach((item: any) => {
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
            mapName: this.roomMapName,
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
            classType: player.classType,
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
      (sid: string) => {
        const entity = this.spatial.findEntityBySessionId(sid);
        return entity && EntityUtils.isPlayer(entity) ? (entity as Player) : undefined;
      },
      broadcast,
      (player: Entity) => {
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
        (x: number, y: number, excludeId: string) => this.spatial.isTileOccupied(x, y, excludeId),
        this.state.tick,
        this.roomId,
        broadcast,
        (caster: Entity, spellId: string, x: number, y: number) => this.onSummon(caster, spellId, x, y)
    );

    this.combat.processWindups(
      now,
      broadcast,
      this.state.tick,
      this.roomId,
      (entity: Entity, killerSessionId: string) => this.onEntityDeath(entity, killerSessionId),
      (caster: Entity, spellId: string, x: number, y: number) => this.onSummon(caster, spellId, x, y)
    );

    this.combat.processBufferedActions(
      now,
      broadcast,
      this.state.tick,
      this.roomId,
      (sessionId: string) => {
        const c = this.clients.find((cl: Client) => cl.sessionId === sessionId);
        return <T extends ServerMessageType>(type: T, data?: ServerMessages[T]) => c?.send(type, data);
      },
    );

    this.drops.expireDrops(this.state.drops, now);

    this.respawnSystem.tick(
      now,
      (sid: string) => this.state.players.get(sid),
      this.map,
      broadcast
    );
  }

  private onEntityDeath(entity: Entity, killerSessionId: string) {
    if (EntityUtils.isPlayer(entity)) {
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

      this.broadcast(ServerMessageType.Death, { sessionId: npc.sessionId, killerSessionId });
  }

  private onSummon(caster: Entity, spellId: string, x: number, y: number) {
      if (spellId === "summon_skeleton") {
          // Spawn 2-3 skeletons around the target area
          const count = 2 + Math.floor(Math.random() * 2);
          for (let i = 0; i < count; i++) {
              const rx = x + Math.floor(Math.random() * 3) - 1;
              const ry = y + Math.floor(Math.random() * 3) - 1;
              if (this.map.collision[ry]?.[rx] === 0) {
                  this.npcSystem.spawnNpcAt("skeleton", this.map, rx, ry);
              }
          }
      }
  }

  private handleNpcKillRewards(player: Player, npc: Npc) {
      // 1. Experience & Leveling
      const stats = NPC_STATS[npc.type];
      if (stats && stats.expReward) {
          this.gainXp(player, stats.expReward);
      }

      // 3. Quest Progress
      this.quests.updateProgress(player.userId, player.dbId, "kill", npc.type, 1).then(updatedQuests => {
          if (updatedQuests.length > 0) {
              const client = this.clients.find(c => c.sessionId === player.sessionId);
              if (client) {
                  for (const quest of updatedQuests) {
                      client.send(ServerMessageType.QuestUpdate, { quest });
                      if (quest.status === "completed") {
                        client.send(ServerMessageType.Notification, { message: `Quest Completed: ${QUESTS[quest.questId].title}` });
                      }
                  }
              }
          }
      });
      // 2. Drops (Diablo Style)
      const dropTable = NPC_DROPS[npc.type];
      if (dropTable) {
          for (const entry of dropTable) {
              if (Math.random() < entry.chance) {
                  const quantity = Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
                  
                  // Spread drops slightly
                  const offsetX = (Math.random() - 0.5) * 1.5; 
                  const offsetY = (Math.random() - 0.5) * 1.5;
                  
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
                killerName = (killer as Player).name;
            } else if (EntityUtils.isNpc(killer)) { // It's an NPC
                killerName = (killer as Npc).type;
            }
        }
    }

    this.broadcast(ServerMessageType.KillFeed, {
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

  public gainXp(player: Player, amount: number) {
      player.xp += amount;
      
      // Level up check
      while (player.xp >= player.maxXp) {
          player.xp -= player.maxXp;
          player.level++;
          
          const nextLevelEntry = EXP_TABLE[player.level]; 
          if (nextLevelEntry !== undefined) {
              player.maxXp = nextLevelEntry;
          } else {
              player.maxXp = Math.floor(player.maxXp * 1.2);
          }

          player.maxHp += 20;
          player.maxMana += 10;
          player.str += 2;
          player.agi += 2;
          player.intStat += 2;

          player.hp = player.maxHp;
          player.mana = player.maxMana;

          this.broadcast(ServerMessageType.LevelUp, {
              sessionId: player.sessionId,
              level: player.level,
          });
          
          const client = this.clients.find(c => c.sessionId === player.sessionId);
          if (client) {
              client.send(ServerMessageType.Notification, { message: `Level Up! You are now level ${player.level}!` });
          }
      }
  }
}
