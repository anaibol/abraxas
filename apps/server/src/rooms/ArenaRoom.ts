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
  WelcomeData,
  QUESTS,
  EQUIPMENT_SLOTS,
} from "@abraxas/shared";
import { logger } from "../logger";
import { MapService } from "../services/MapService";
import { PersistenceService } from "../services/PersistenceService";
import { AuthService } from "../database/auth";
import { prisma } from "../database/db";
import { User } from "@prisma/client";
import { MessageHandler } from "../handlers/MessageHandler";
import { SocialSystem } from "../systems/SocialSystem";
import { FriendsSystem } from "../systems/FriendsSystem";
import { SpatialLookup } from "../utils/SpatialLookup";
import { isPlayer, isNpc, Entity } from "../utils/EntityUtils";
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
      this.combat = new CombatSystem(this.buffSystem, this.spatial);
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
  static async onAuth(
    token: string,
    _options: JoinOptions & { mapName?: string },
    context: AuthContext,
  ) {
    if (!token) {
      logger.error({ message: "[ArenaRoom] onAuth: No token provided" });
      throw new Error("Token required");
    }
    const payload = AuthService.verifyToken(token);
    if (!payload) {
      logger.error({ message: "[ArenaRoom] onAuth: Invalid token" });
      throw new Error("Invalid token");
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) {
      logger.error({
        message: `[ArenaRoom] onAuth: User ${payload.userId} not found`,
      });
      throw new Error("User not found");
    }
    logger.info({
      message: `[ArenaRoom] onAuth ok — user=${user.username} ip=${context.ip ?? "?"}`,
    });
    return { user };
  }

  async onJoin(
    client: Client,
    options: JoinOptions & { mapName?: string },
    auth: { user: User },
  ) {
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

    const user = auth.user;
    const playerName = user.username;

    let dbPlayer = await PersistenceService.loadPlayer(user.id, playerName);

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
      if (dbPlayer.mapName !== this.roomMapName) {
        logger.info({
          room: this.roomId,
          clientId: client.sessionId,
          message: `Player ${playerName} joined ${this.roomMapName} but was last in ${dbPlayer.mapName}. Teleporting.`,
        });
      }
    }

    const player = new Player();
    player.sessionId = client.sessionId;
    player.userId = user.id;
    player.name = dbPlayer.name;
    player.classType = dbPlayer.classType as ClassType;

    player.dbId = dbPlayer.id;
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

    for (const item of dbPlayer.inventory) {
      this.inventorySystem.addItem(player, item.itemId, item.quantity);
    }

    player.equipWeapon = dbPlayer.equipWeapon || "";
    player.equipShield = dbPlayer.equipShield || "";
    player.equipHelmet = dbPlayer.equipHelmet || "";
    player.equipArmor = dbPlayer.equipArmor || "";
    player.equipRing = dbPlayer.equipRing || "";

    if (
      dbPlayer.inventory.length === 0 &&
      !player.equipWeapon &&
      !player.equipArmor &&
      !player.equipShield &&
      !player.equipHelmet
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

    this.friends.setUserOnline(user.id, client.sessionId);
    await this.friends.sendUpdateToUser(user.id, client.sessionId);

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
        return entity && isPlayer(entity) ? entity : undefined;
      },
      broadcast,
      (player: Entity) => {
        if (isPlayer(player)) {
          this.onEntityDeath(player, "");
        }
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
      (entity: Entity, killerSessionId: string) =>
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
    );
  }

  private onEntityDeath(entity: Entity, killerSessionId: string) {
    if (isPlayer(entity)) {
      this.onPlayerDeath(entity, killerSessionId);
    } else {
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

    this.broadcast(ServerMessageType.Death, {
      sessionId: npc.sessionId,
      killerSessionId,
    });
  }

  private onSummon(_caster: Entity, spellId: string, x: number, y: number) {
    if (spellId === "summon_skeleton") {
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

  private onPlayerDeath(player: Player, killerSessionId: string) {
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

    if (killerSessionId) {
      const killer = this.state.players.get(killerSessionId);
      if (killer) {
        killer.gold += KILL_GOLD_BONUS;
      }
    }

    let killerName = "";
    if (killerSessionId) {
      const killer = this.spatial.findEntityBySessionId(killerSessionId);
      if (killer) {
        if (isPlayer(killer)) {
          killerName = killer.name;
        } else if (isNpc(killer)) {
          killerName = killer.type;
        }
      }
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
    player.xp += amount;

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

      this.sendToPlayer(player.sessionId, ServerMessageType.Notification, {
        message: `Level Up! You are now level ${player.level}!`,
      });
    }
  }
}
