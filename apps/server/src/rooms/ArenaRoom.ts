import {
  Room,
  Client,
  validate,
  type Messages,
  CloseCode,
  type AuthContext,
} from "@colyseus/core";
import { z } from "zod";
import { StateView } from "@colyseus/schema";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { InventoryItem } from "../schema/InventoryItem";
import { Npc } from "../schema/Npc";
import { MovementSystem } from "../systems/MovementSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { DropSystem } from "../systems/DropSystem";
import { BuffSystem } from "../systems/BuffSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { RespawnSystem } from "../systems/RespawnSystem";
import { NpcSystem } from "../systems/NpcSystem";
import {
  CLASS_STATS,
  TICK_MS,
  STARTING_EQUIPMENT,
  ITEMS,
  KILL_GOLD_BONUS,
  NPC_STATS,
  EXP_TABLE,
  NPC_DROPS,
  TileMap,
  Direction,
  ServerMessages,
  ClassType,
  JoinOptions,
  EquipmentSlot,
  InventoryEntry,
  EquipmentData,
  ClientMessageType,
  ServerMessageType,
  EQUIPMENT_SLOTS,
} from "@abraxas/shared";
import { logger } from "../logger";
import { MapService } from "../services/MapService";
import { PersistenceService } from "../services/PersistenceService";
import { AuthService } from "../database/auth";
import { prisma } from "../database/db";
// import { User } from "@prisma/client"; // Removed due to lint error
import { MessageHandler } from "../handlers/MessageHandler";
import { SocialSystem } from "../systems/SocialSystem";
import { FriendsSystem } from "../systems/FriendsSystem";
import { SpatialLookup, Entity } from "../utils/SpatialLookup";
import { QuestSystem } from "../systems/QuestSystem";

export class ArenaRoom extends Room<{ state: GameState }> {
  constructor() {
    super();
    logger.info({ message: "[ArenaRoom] Constructor called" });
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

  // ── Message Handlers (Colyseus 0.17 messages API) ───────────────────────
  messages: Messages<ArenaRoom> = {
    // Movement & Combat
    [ClientMessageType.Move]: validate(
      z.object({ direction: z.number() }),
      (client, data) => this.messageHandler.handleMove(client, data.direction),
    ),
    [ClientMessageType.Attack]: validate(
      z.object({
        targetTileX: z.number().optional(),
        targetTileY: z.number().optional(),
      }),
      (client, data) => this.messageHandler.handleAttack(client, data),
    ),
    [ClientMessageType.Cast]: validate(
      z.object({
        spellId: z.string(),
        targetTileX: z.number(),
        targetTileY: z.number(),
      }),
      (client, data) => this.messageHandler.handleCast(client, data),
    ),
    // Inventory
    [ClientMessageType.Pickup]: validate(
      z.object({ dropId: z.string() }),
      (client, data) => this.messageHandler.handlePickup(client, data),
    ),
    [ClientMessageType.Equip]: validate(
      z.object({ itemId: z.string() }),
      (client, data) => this.messageHandler.handleEquip(client, data),
    ),
    [ClientMessageType.Unequip]: validate(
      z.object({
        slot: z.enum(EQUIPMENT_SLOTS as [EquipmentSlot, ...EquipmentSlot[]]),
      }),
      (client, data) => this.messageHandler.handleUnequip(client, data),
    ),
    [ClientMessageType.UseItem]: validate(
      z.object({ itemId: z.string() }),
      (client, data) => this.messageHandler.handleUseItem(client, data),
    ),
    [ClientMessageType.DropItem]: validate(
      z.object({ itemId: z.string() }),
      (client, data) => this.messageHandler.handleDropItem(client, data),
    ),
    // NPCs & Quests
    [ClientMessageType.Interact]: validate(
      z.object({ npcId: z.string() }),
      (client, data) => this.messageHandler.handleInteract(client, data),
    ),
    [ClientMessageType.BuyItem]: validate(
      z.object({ itemId: z.string(), quantity: z.number() }),
      (client, data) => this.messageHandler.handleBuyItem(client, data),
    ),
    [ClientMessageType.SellItem]: validate(
      z.object({
        itemId: z.string(),
        quantity: z.number(),
        npcId: z.string().optional(),
      }),
      (client, data) => this.messageHandler.handleSellItem(client, data),
    ),
    [ClientMessageType.QuestAccept]: validate(
      z.object({ questId: z.string() }),
      (client, data) => this.messageHandler.handleQuestAccept(client, data),
    ),
    [ClientMessageType.QuestComplete]: validate(
      z.object({ questId: z.string() }),
      (client, data) => this.messageHandler.handleQuestComplete(client, data),
    ),
    // Social
    [ClientMessageType.Chat]: validate(
      z.object({ message: z.string() }),
      (client, data) => this.messageHandler.handleChat(client, data),
    ),
    [ClientMessageType.FriendRequest]: validate(
      z.object({ targetName: z.string() }),
      (client, data) => this.messageHandler.handleFriendRequest(client, data),
    ),
    [ClientMessageType.FriendAccept]: validate(
      z.object({ requesterId: z.string() }),
      (client, data) => this.messageHandler.handleFriendAccept(client, data),
    ),
    // Party
    [ClientMessageType.PartyInvite]: validate(
      z.object({ targetSessionId: z.string() }),
      (client, data) => this.messageHandler.handlePartyInvite(client, data),
    ),
    [ClientMessageType.PartyAccept]: validate(
      z.object({ partyId: z.string() }),
      (client, data) => this.messageHandler.handlePartyAccept(client, data),
    ),
    [ClientMessageType.PartyLeave]: (client: Client) =>
      this.messageHandler.handlePartyLeave(client),
    [ClientMessageType.PartyKick]: validate(
      z.object({ targetSessionId: z.string() }),
      (client, data) => this.messageHandler.handlePartyKick(client, data),
    ),
    // Audio (raw binary — no schema validation)
    [ClientMessageType.Audio]: (client: Client, data: ArrayBuffer) =>
      this.messageHandler.handleAudio(client, data),
  };

  async onCreate(options: JoinOptions & { mapName?: string }) {
    try {
      logger.info({ message: "[ArenaRoom] Entering onCreate" });
      this.autoDispose = false; // Prevent premature shutdown during tests
      this.seatReservationTimeout = 60;
      this.setState(new GameState());
      logger.info({ message: "[ArenaRoom] State initialized" });

      this.roomMapName = options.mapName || "arena.test";
      logger.info({ message: `[ArenaRoom] Map name: ${this.roomMapName}` });

      const loadedMap = await MapService.getMap(this.roomMapName);
      if (!loadedMap) {
        logger.error({
          message: `[ArenaRoom] Failed to load map: ${this.roomMapName}`,
        });
        throw new Error(`Failed to load map: ${this.roomMapName}`);
      }
      this.map = loadedMap;
      logger.info({ message: "[ArenaRoom] Map loaded" });

      this.drops.setInventorySystem(this.inventorySystem);

      this.spatial = new SpatialLookup(this.state);
      this.movement = new MovementSystem(this.spatial);
      this.combat = new CombatSystem(this.spatial, this.buffSystem, this.map);
      this.npcSystem = new NpcSystem(
        this.state,
        this.movement,
        this.combat,
        this.spatial,
      );

      this.social = new SocialSystem(this.state, (sid) => this.findClient(sid));
      this.friends = new FriendsSystem(this.state, (sid) =>
        this.findClient(sid),
      );

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
          const player = Array.from(this.state.players.values()).find(
            (p) => p.name === name,
          );
          return player ? this.findClient(player.sessionId) : undefined;
        },
        this.quests,
        this.gainXp.bind(this),
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

      logger.info({ room: this.roomId, intent: "room_created", result: "ok" });
      logger.info({ message: "[ArenaRoom] onCreate completed successfully" });
    } catch (e: unknown) {
      logger.error({
        message: `[ArenaRoom] CRITICAL ERROR IN ONCREATE: ${e}`,
      });
      if (e instanceof Error && e.stack) {
        logger.error({ message: e.stack });
      }
      throw e;
    }
  }

  /**
   * Static onAuth runs before the room instance is created — invalid tokens
   * are rejected without spinning up a room.
   */
  static async onAuth(token: string, options: any, context: AuthContext) {
    const actualToken =
      (typeof token === "string" ? token : null) ||
      context?.token ||
      options?.token;

    if (!actualToken || typeof actualToken !== "string") {
      logger.warn({
        message: `[ArenaRoom] onAuth missing token. type=${typeof actualToken}`,
        tokenParam: token,
        contextToken: context?.token,
        optionsToken: options?.token,
      });
      throw new Error("Authentication token required");
    }

    try {
      const payload = AuthService.verifyToken(actualToken);
      if (!payload) {
        throw new Error("Invalid token");
      }

      const dbUser = await prisma.account.findUnique({
        where: { id: payload.userId },
      });

      if (!dbUser) {
        throw new Error("User associated with token not found");
      }

      logger.info({
        message: `[ArenaRoom] onAuth success: ${dbUser.username}`,
        isWebSocket: !!context.ip,
      });

      return dbUser;
    } catch (e: any) {
      logger.error({ message: `[ArenaRoom] onAuth failed: ${e.message}` });
      throw e;
    }
  }

  async onJoin(
    client: Client,
    options: JoinOptions & { mapName?: string },
    auth: any,
  ) {
    try {
      logger.info({
        message: `[ArenaRoom] onJoin START: client=${client.sessionId} user=${auth?.username}`,
      });
      const classType = options?.classType || "warrior";
      if (!classType || !CLASS_STATS[classType]) {
        logger.warn({
          room: this.roomId,
          clientId: client.sessionId,
          intent: "join",
          result: "error",
          message: `Invalid classType: ${classType}`,
        });
        client.leave();
        return;
      }

      const user = auth;
      // Use the character name the client sent (set from DB after login/register).
      // Fall back to account username only if not provided.
      const playerName = options?.name || user.username;
      logger.info({
        message: `[ArenaRoom] onJoin: playerName=${playerName} userId=${user.id}`,
      });

      logger.info({
        message: `[ArenaRoom] onJoin logic starting for ${playerName}`,
      });
      let dbPlayer = await PersistenceService.loadPlayer(user.id, playerName);
      logger.info({ message: `[ArenaRoom] dbPlayer loaded: ${!!dbPlayer}` });

      if (!dbPlayer) {
        const spawn = this.map.spawns[this.spawnIndex % this.map.spawns.length];
        this.spawnIndex++;
        dbPlayer = await PersistenceService.createPlayer(
          user.id,
          playerName,
          classType,
          spawn.x,
          spawn.y,
          this.roomMapName,
        );
      } else {
        if (dbPlayer.mapId !== this.roomMapName) {
          logger.info({
            room: this.roomId,
            clientId: client.sessionId,
            message: `Player ${playerName} joined ${this.roomMapName} but was last in ${dbPlayer.mapId}. Teleporting.`,
          });
        }
      }
      logger.info({ message: "[ArenaRoom] ensuring dbPlayer is present" });

      if (!dbPlayer) {
        logger.error({ message: "Failed to load or create player" });
        client.leave();
        return;
      }

      const player = new Player();
      player.sessionId = client.sessionId;
      player.dbId = dbPlayer.id;
      player.userId = user.id;
      player.name = playerName;
      player.classType = (dbPlayer.class as string).toLowerCase() as ClassType;
      player.tileX = dbPlayer.x;
      player.tileY = dbPlayer.y;

      const stats = dbPlayer.stats;
      if (stats) {
        player.hp = stats.hp;
        player.maxHp = stats.maxHp;
        player.mana = stats.mp;
        player.maxMana = stats.maxMp;
        player.str = stats.str;
        player.agi = stats.agi;
        player.intStat = stats.int;
      }

      player.gold = Number(dbPlayer.gold);
      player.level = dbPlayer.level;
      player.xp = Number(dbPlayer.exp);
      player.maxXp = EXP_TABLE[player.level] ?? 100;

      // Map Inventory
      if (dbPlayer.inventory && dbPlayer.inventory.slots) {
        for (const slot of dbPlayer.inventory.slots) {
          if (slot.item && slot.item.itemDef) {
            const invItem = new InventoryItem();
            invItem.itemId = slot.item.itemDef.code;
            invItem.quantity = slot.qty;
            invItem.slotIndex = slot.idx;
            player.inventory.push(invItem);
          }
        }
      }

      const dirMap: Record<string, Direction> = {
        UP: Direction.UP,
        DOWN: Direction.DOWN,
        LEFT: Direction.LEFT,
        RIGHT: Direction.RIGHT,
      };
      player.facing = dirMap[dbPlayer.facing.toUpperCase()] ?? Direction.DOWN;
      player.alive = player.hp > 0;

      // Give starting gear if totally empty
      if (
        player.inventory.length === 0 &&
        !player.equipWeapon &&
        !player.equipArmor &&
        !player.equipShield &&
        !player.equipHelmet &&
        player.gold === 0
      ) {
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

      // Give this client exclusive visibility of their own private @view() fields
      client.view = new StateView();
      client.view.add(player);

      this.spatial.addToGrid(player);

      logger.info({ message: "[ArenaRoom] notifying friends" });
      this.friends.setUserOnline(user.id, client.sessionId);
      await this.friends.sendUpdateToUser(user.id, client.sessionId);
      logger.info({ message: "[ArenaRoom] mapping equipment" });

      // Map Equipments
      if (dbPlayer.equipments) {
        for (const eq of dbPlayer.equipments) {
          if (eq.item && eq.item.itemDef) {
            const code = eq.item.itemDef.code;
            switch (eq.slot) {
              case "WEAPON_MAIN":
                player.equipWeapon = code;
                break;
              case "WEAPON_OFF":
                player.equipShield = code;
                break;
              case "HEAD":
                player.equipHelmet = code;
                break;
              case "CHEST":
                player.equipArmor = code;
                break;
              case "RING1":
                player.equipRing = code;
                break;
            }
          }
        }
      }

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
    } catch (e: any) {
      logger.error({
        message: `[ArenaRoom] error in onJoin: ${e.message}`,
        stack: e.stack,
      });
      client.leave(4000); // Custom error code
      throw e;
    }
  }

  // ── devMode: persist out-of-state data across hot restarts ──────────────

  /**
   * Called before the room is cached on server shutdown (devMode only).
   * Return any JSON-serializable data that lives outside `this.state`.
   */
  onCacheRoom() {
    return { spawnIndex: this.spawnIndex };
  }

  /**
   * Called after the room and its state have been restored (devMode only).
   * Rebuild the spatial grid from the now-restored state so collision /
   * entity lookup works correctly without requiring clients to re-join.
   */
  onRestoreRoom(cached: { spawnIndex: number }): void {
    this.spawnIndex = cached.spawnIndex;
    // State is already restored at this point — rebuild the in-memory grid.
    this.spatial.rebuild();
    logger.info({
      room: this.roomId,
      message: `[ArenaRoom] Room restored — ${this.state.players.size} players, ${this.state.npcs.size} npcs`,
    });
  }

  async onLeave(client: Client, code?: number) {
    // CloseCode.CONSENTED = normal/voluntary close. Any other code = abrupt disconnect.
    if (code !== CloseCode.CONSENTED) {
      try {
        await this.allowReconnection(client, 30);
        logger.info({
          room: this.roomId,
          clientId: client.sessionId,
          intent: "reconnected",
          result: "ok",
        });
        return; // player reconnected — keep their state intact
      } catch {
        // reconnection timed out — fall through to cleanup
      }
    }

    await this.removePlayer(client);
  }

  private async removePlayer(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.messageHandler.handlePartyLeave(client);
      this.friends.setUserOffline(player.userId);

      const inventory: InventoryEntry[] = [];
      player.inventory.forEach((item) => {
        inventory.push({
          itemId: item.itemId,
          quantity: item.quantity,
          slotIndex: item.slotIndex,
        });
      });

      const equipment: EquipmentData = {
        weapon: player.equipWeapon,
        shield: player.equipShield,
        helmet: player.equipHelmet,
        armor: player.equipArmor,
        ring: player.equipRing,
      };

      await PersistenceService.savePlayer(player.userId, player.name, {
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
      });

      this.spatial.removeFromGrid(player);
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
        return entity instanceof Player ? entity : undefined;
      },
      broadcast,
      (player: Player) => {
        this.onEntityDeath(player);
      },
      this.roomId,
      this.state.tick,
    );

    this.npcSystem.tick(
      _deltaTime,
      this.map,
      now,
      (x: number, y: number, excludeId: string) =>
        this.spatial.isTileOccupied(x, y, excludeId),
      this.state.tick,
      this.roomId,
      broadcast,
    );

    this.combat.processWindups(
      now,
      broadcast,
      (entity: Entity, killerSessionId?: string) =>
        this.onEntityDeath(entity, killerSessionId),
      (caster: Entity, spellId: string, x: number, y: number) =>
        this.onSummon(caster, spellId, x, y),
    );

    this.combat.processBufferedActions(now, broadcast, (sessionId: string) => {
      const c = this.findClient(sessionId);
      return <T extends ServerMessageType>(type: T, data?: ServerMessages[T]) =>
        c?.send(type, data);
    });

    this.drops.expireDrops(this.state.drops, now);

    this.respawnSystem.tick(
      now,
      (sid: string) => this.state.players.get(sid),
      this.map,
      broadcast,
      (player: Player) => this.spatial.addToGrid(player),
    );
  }

  private onEntityDeath(entity: Entity, killerSessionId?: string) {
    if (entity instanceof Player) {
      this.onPlayerDeath(entity, killerSessionId);
    } else {
      this.onNpcDeath(entity, killerSessionId);
    }
  }

  private onNpcDeath(npc: Npc, killerSessionId?: string) {
    this.npcSystem.handleDeath(npc);

    if (killerSessionId) {
      const killer = this.state.players.get(killerSessionId);
      if (killer && killer.alive) {
        this.handleNpcKillRewards(killer, npc);
      }
    }

    this.broadcast(ServerMessageType.Death, {
      sessionId: npc.sessionId,
      killerSessionId,
    });
  }

  private onSummon(_caster: Entity, spellId: string, x: number, y: number) {
    if (spellId === "summon_skeleton") {
      // Global and type-specific limit to prevent DoS
      const totalNpcs = this.state.npcs.size;
      if (totalNpcs > 200) return;

      const currentSkeletons = Array.from(this.state.npcs.values()).filter(
        (n) => n.type === "skeleton",
      ).length;
      if (currentSkeletons > 50) return;

      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const rx = x + Math.floor(Math.random() * 3) - 1;
        const ry = y + Math.floor(Math.random() * 3) - 1;
        if (rx >= 0 && rx < this.map.width && ry >= 0 && ry < this.map.height) {
          if (
            this.map.collision[ry]?.[rx] === 0 &&
            !this.spatial.isTileOccupied(rx, ry, "")
          ) {
            this.npcSystem.spawnNpcAt("skeleton", this.map, rx, ry);
          }
        }
      }
    }
  }

  private handleNpcKillRewards(player: Player, npc: Npc) {
    const stats = NPC_STATS[npc.type];
    if (stats && stats.expReward) {
      this.gainXp(player, stats.expReward);
    }

    this.quests
      .updateProgress(player.userId, player.dbId, "kill", npc.type, 1)
      .then((updatedQuests) => {
        if (updatedQuests.length > 0) {
          const client = this.findClient(player.sessionId);
          if (client)
            this.messageHandler.sendQuestUpdates(client, updatedQuests);
        }
      });

    const dropTable = NPC_DROPS[npc.type];
    if (dropTable) {
      for (const entry of dropTable) {
        if (Math.random() < entry.chance) {
          const quantity =
            Math.floor(Math.random() * (entry.max - entry.min + 1)) + entry.min;
          const offsetX = (Math.random() - 0.5) * 1.5;
          const offsetY = (Math.random() - 0.5) * 1.5;

          if (entry.itemId === "gold") {
            this.drops.spawnGoldDrop(
              this.state.drops,
              npc.tileX + offsetX,
              npc.tileY + offsetY,
              quantity,
            );
          } else {
            this.drops.spawnItemDrop(
              this.state.drops,
              npc.tileX + offsetX,
              npc.tileY + offsetY,
              entry.itemId,
              quantity,
            );
          }
        }
      }
    }
  }

  private onPlayerDeath(player: Player, killerSessionId?: string) {
    // Mark dead immediately so the entity is no longer attackable / occupied
    player.hp = 0;
    player.alive = false;
    this.spatial.removeFromGrid(player);

    const droppedItems = this.inventorySystem.dropAllItems(player);
    for (const { itemId, quantity } of droppedItems) {
      this.drops.spawnItemDrop(
        this.state.drops,
        player.tileX,
        player.tileY,
        itemId,
        quantity,
      );
    }

    if (player.gold > 0) {
      this.drops.spawnGoldDrop(
        this.state.drops,
        player.tileX,
        player.tileY,
        player.gold,
      );
      player.gold = 0;
    }

    // Only player killers receive a gold bonus
    if (killerSessionId) {
      const killerPlayer = this.state.players.get(killerSessionId);
      if (killerPlayer) killerPlayer.gold += KILL_GOLD_BONUS;
    }

    let killerName = "";
    if (killerSessionId) {
      const killer = this.spatial.findEntityBySessionId(killerSessionId);
      killerName = killer
        ? killer instanceof Player
          ? killer.name
          : killer.type
        : "";
    }

    this.broadcast(ServerMessageType.KillFeed, {
      killerSessionId,
      victimSessionId: player.sessionId,
      killerName,
      victimName: player.name,
    });

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

  /** Looks up a connected client by session ID. */
  private findClient(sessionId: string): Client | undefined {
    return this.clients.find((c) => c.sessionId === sessionId);
  }

  /** Sends a message to a specific player by their session ID. */
  private sendToPlayer<T extends ServerMessageType>(
    sessionId: string,
    type: T,
    data: ServerMessages[T],
  ): void {
    this.findClient(sessionId)?.send(type, data);
  }

  public gainXp(player: Player, amount: number) {
    if (amount <= 0) return;
    player.xp += amount;

    let levelsGained = 0;
    const maxSafety = 100; // Prevent infinite loop if EXP_TABLE is broken

    while (
      player.xp >= player.maxXp &&
      player.level < 20 &&
      levelsGained < maxSafety
    ) {
      player.xp -= player.maxXp;
      player.level++;
      player.intStat += 2;

      player.hp = player.maxHp;
      player.mana = player.maxMana;

      this.broadcast(ServerMessageType.LevelUp, {
        sessionId: player.sessionId,
        level: player.level,
      });

      this.sendToPlayer(player.sessionId, ServerMessageType.Notification, {
        message: `Level Up! You are now level ${player.level}!`,
      });
    }
  }
}
