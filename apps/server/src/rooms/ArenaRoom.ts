import {
  type BroadcastFn,
  type ClassStats,
  type ClientMessages,
  type ClientMessageType,
  type ItemAffix,
  type JoinOptions,
  EntityType,
  type NpcType,
  PLAYER_RESPAWN_TIME_MS,
  ServerMessageType,
  TICK_MS,
  type TileMap,
} from "@abraxas/shared";
import { type AuthContext, type Client, Room } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import { verifyToken } from "../database/auth";
import { prisma } from "../database/db";
import type { Account } from "../generated/prisma";
import { HandlerUtils } from "../handlers/HandlerUtils";
import { MessageHandler } from "../handlers/MessageHandler";
import { SocialHandlers } from "../handlers/SocialHandlers";
import { logger } from "../logger";
import { GameState } from "../schema/GameState";
import { InventoryItem, ItemAffixSchema } from "../schema/InventoryItem";
import { Npc } from "../schema/Npc";
import { Player } from "../schema/Player";
import { ChatService } from "../services/ChatService";
import { LevelService } from "../services/LevelService";
import { getMap } from "../services/MapService";
import { PersistenceService } from "../services/PersistenceService";
import { PlayerService } from "../services/PlayerService";
import { BankSystem } from "../systems/BankSystem";
import { BuffSystem } from "../systems/BuffSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { DropSystem } from "../systems/DropSystem";
import { FriendsSystem } from "../systems/FriendsSystem";
import { GuildSystem } from "../systems/GuildSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { MovementSystem } from "../systems/MovementSystem";
import { NpcSystem } from "../systems/NpcSystem";
import { QuestSystem } from "../systems/QuestSystem";
import { RespawnSystem } from "../systems/RespawnSystem";
import { SocialSystem } from "../systems/SocialSystem";
import { TickSystem } from "../systems/TickSystem";
import { TradeSystem } from "../systems/TradeSystem";
import { type Entity, SpatialLookup } from "../utils/SpatialLookup";
import { findSafeSpawn } from "../utils/spawnUtils";

export class ArenaRoom extends Room<{ state: GameState }> {
  autoDispose = false;
  seatReservationTimeout = 60;
  maxMessagesPerSecond = 20;
  patchRate = TICK_MS;
  state = new GameState();

  private map!: TileMap;
  private roomMapName!: string;
  private movement!: MovementSystem;
  private buffSystem = new BuffSystem();
  private combat!: CombatSystem;
  private drops!: DropSystem;
  private inventorySystem = new InventorySystem(this.buffSystem);
  private respawnSystem = new RespawnSystem();
  private npcSystem!: NpcSystem;
  private social!: SocialSystem;
  private guild!: GuildSystem;
  private friends!: FriendsSystem;
  private messageHandler!: MessageHandler;
  private playerService!: PlayerService;
  private tickSystem!: TickSystem;
  private levelService!: LevelService;
  private spatial!: SpatialLookup;
  private quests = new QuestSystem();
  private trade!: TradeSystem;
  private bankSystem!: BankSystem;

  private broadcastMessage: BroadcastFn = (type, data, options) => {
    const broadcastOpts: { except?: Client | Client[] } = {};
    if (options?.except) {
      const isClient = (obj: unknown): obj is Client =>
        typeof obj === "object" && obj !== null && "sessionId" in obj;
      if (Array.isArray(options.except) && options.except.every(isClient)) {
        broadcastOpts.except = options.except;
      } else if (isClient(options.except)) {
        broadcastOpts.except = options.except;
      }
    }
    this.broadcast(String(type), data, broadcastOpts);
  };

  async onCreate(options: JoinOptions & { mapName?: string }) {
    try {
      this.roomMapName = options.mapName || "arena.test";
      const loadedMap = await getMap(this.roomMapName);
      if (!loadedMap) throw new Error(`Failed to load map: ${this.roomMapName}`);
      this.map = loadedMap;

      this.drops = new DropSystem(this.inventorySystem);
      this.spatial = new SpatialLookup(this.state);
      this.movement = new MovementSystem(this.spatial, this.buffSystem);
      this.combat = new CombatSystem(this.state, this.spatial, this.buffSystem, this.map, this.roomMapName);
      this.npcSystem = new NpcSystem(
        this.state,
        this.movement,
        this.combat,
        this.spatial,
        this.buffSystem,
      );
      this.social = new SocialSystem(this.state, (sid) => this.findClient(sid));
      this.guild = new GuildSystem(this.state, (sid) => this.findClient(sid));
      this.friends = new FriendsSystem(this.state, (sid) => this.findClient(sid));
      this.trade = new TradeSystem(this.inventorySystem);
      this.bankSystem = new BankSystem(this.inventorySystem);

      this.playerService = new PlayerService(
        this.state,
        this.inventorySystem,
        this.spatial,
        this.quests,
        this.friends,
      );
      this.levelService = new LevelService(this.broadcastMessage, (p) =>
        this.inventorySystem.recalcStats(p),
      );

      const findClientByName = (name: string) => {
        const player = Array.from(this.state.players.values()).find((p) => p.name === name);
        return player ? this.findClient(player.sessionId) : undefined;
      };

      const chatService = new ChatService(
        this.broadcastMessage,
        findClientByName,
        (sid) => this.findClient(sid),
        this.social.broadcastToGroup.bind(this.social),
        this.guild.broadcastToGuild.bind(this.guild),
      );

      this.messageHandler = new MessageHandler({
        state: this.state,
        map: this.map,
        roomId: this.roomId,
        systems: {
          movement: this.movement,
          combat: this.combat,
          inventory: this.inventorySystem,
          drops: this.drops,
          social: this.social,
          guild: this.guild,
          friends: this.friends,
          quests: this.quests,
          trade: this.trade,
          bank: this.bankSystem,
          npc: this.npcSystem,
        },
        services: {
          chat: chatService,
          level: this.levelService,
        },
        broadcast: this.broadcastMessage,
        isTileOccupied: this.spatial.isTileOccupied.bind(this.spatial),
        findClientByName,
        findClientBySessionId: (sid) => this.findClient(sid),
      });

      this.messageHandler.registerHandlers((type, handler) => this.onMessage(type, handler));

      this.onMessage("gm_spawn", (client, message) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        logger.info({ intent: "gm_spawn", sessionId: player.sessionId, role: player.role, npcType: message.type });
        if (player.role !== "ADMIN") {
          logger.warn({ intent: "gm_spawn", result: "rejected", role: player.role });
          return;
        }
        this.npcSystem.spawnNpc(message.type as NpcType, this.map);
        logger.debug({ intent: "gm_spawn", result: "success", type: message.type });
      });

      this.tickSystem = new TickSystem({
        state: this.state,
        map: this.map,
        roomId: this.roomId,
        systems: {
          buff: this.buffSystem,
          npc: this.npcSystem,
          combat: this.combat,
          drops: this.drops,
          respawn: this.respawnSystem,
          quests: this.quests,
          spatial: this.spatial,
        },
        broadcast: this.broadcastMessage,
        onEntityDeath: (e, k) => this.onEntityDeath(e, k),
        onSummon: (caster, spellId, x, y) => this.onSummon(caster, spellId, x, y),
        gainXp: (p, a) => this.levelService.gainXp(p, a),
        sendQuestUpdates: (c, u) => HandlerUtils.sendQuestUpdates(c, u),
        findClient: (sid) => this.findClient(sid),
      });

      // Load persistent state
      PersistenceService.loadWorldDrops(this.roomMapName).then((drops) => {
        for (const d of drops) {
          const drop = this.drops.createDrop(this.state.drops, d.tileX, d.tileY, d.itemType.toLowerCase() as "item" | "gold", d.id);
          drop.itemId = d.itemId || "";
          drop.quantity = d.quantity;
          drop.goldAmount = d.goldAmount;
          drop.spawnedAt = d.spawnedAt.getTime();
          
          if (d.item) {
              drop.rarity = d.item.rarity || "common";
              drop.nameOverride = d.item.nameOverride || "";
              const affixes = (d.item.affixesJson as unknown as ItemAffix[]) || [];
              affixes.forEach((a) => {
                  const s = new ItemAffixSchema();
                  s.affixType = a.type;
                  s.stat = a.stat;
                  s.value = a.value;
                  drop.affixes.push(s);
              });
          }
        }
      });

      PersistenceService.loadPersistentNpcs(this.roomMapName).then((npcs) => {
        for (const n of npcs) {
          this.npcSystem.spawnNpcAt(n.npcType as NpcType, this.map, n.tileX, n.tileY, undefined, n.level, {
              isUnique: n.isUnique,
              uniqueId: n.uniqueId || undefined,
              dbId: n.id
          });
        }
      });

      for (const n of this.map.npcs ?? []) {
          // Check if this NPC is already loaded from persistence 
          // (Basic implementation: if a persistent NPC exists at this location, skip)
          // For now just spawning them as usual but unique ones should be handled carefully.
          this.npcSystem.spawnNpcAt(n.type, this.map, n.x, n.y);
      }
      const npcCount = this.map.npcCount ?? 0;
      if (npcCount > 0) {
        this.npcSystem.spawnNpcs(npcCount, this.map);
      }

      this.setSimulationInterval((dt) => this.tickSystem.tick(dt), TICK_MS);

      logger.info({ room: this.roomId, message: "onCreate completed successfully" });
    } catch (e: unknown) {
      logger.error({ message: `[ArenaRoom] onCreate error: ${e}` });
      throw e;
    }
  }

  static async onAuth(token: string, options: Record<string, unknown>, context: AuthContext) {
    const actualToken =
      (typeof token === "string" ? token : null) ||
      context?.token ||
      (typeof options?.token === "string" ? options.token : undefined);
    if (!actualToken || typeof actualToken !== "string")
      throw new Error("Authentication token required");
    const payload = verifyToken(actualToken);
    if (!payload) throw new Error("Invalid token");
    const dbUser = await prisma.account.findUnique({
      where: { id: payload.userId },
    });
    if (!dbUser) throw new Error("User not found");
    return dbUser;
  }

  async onJoin(client: Client, options: JoinOptions & { mapName?: string }, auth: Account) {
    try {
      const char = await PersistenceService.loadChar(options.charId);
      if (!char) {
        // Throw so Colyseus rejects the join cleanly without leaving a ghost
        // session in allowReconnection limbo.
        throw new Error(`Character not found: ${options.charId}`);
      }
      prisma.character
        .update({ where: { id: char.id }, data: { lastLoginAt: new Date() } })
        .catch(() => {});
      const player = await this.playerService.createPlayer(client, char, auth.id);
      player.role = auth.role;
      // Assign spawn point — spiral outward if the candidate tile is blocked
      const spawnIndex = this.state.players.size;
      let spawnsArray = this.map.spawns;
      if (
        this.playerService.isPlayerTotallyNew(player) &&
        this.map.newbieSpawns &&
        this.map.newbieSpawns.length > 0
      ) {
        spawnsArray = this.map.newbieSpawns;
      }
      const candidate = spawnsArray[spawnIndex % spawnsArray.length];
      if (candidate) {
        console.error(`[DEBUG_SPAWN] mapName: ${this.roomMapName}, candidate: ${candidate.x},${candidate.y}, spawns length: ${spawnsArray.length}, map width: ${this.map.width}`);
        const safe = findSafeSpawn(candidate.x, candidate.y, this.map, this.spatial);
        player.tileX = safe?.x ?? candidate.x;
        player.tileY = safe?.y ?? candidate.y;
      }
      this.state.players.set(client.sessionId, player);
      // If the player logged out while dead, queue an immediate respawn
      // so they enter the world alive on the first server tick.
      if (!player.alive) {
        this.respawnSystem.queueRespawn(client.sessionId, Date.now() - PLAYER_RESPAWN_TIME_MS);
      }
      client.view = new StateView();
      client.view.add(player);
      this.spatial.addToGrid(player);

      // Restore saved companions
      if (player.savedCompanions && player.savedCompanions.length > 0) {
        for (const comp of player.savedCompanions) {
          const spawnLoc = findSafeSpawn(player.tileX, player.tileY, this.map, this.spatial) ?? player;
          const sx = "x" in spawnLoc ? spawnLoc.x : spawnLoc.tileX;
          const sy = "y" in spawnLoc ? spawnLoc.y : spawnLoc.tileY;

          const newNpc = this.npcSystem.spawnNpcAt(
            comp.type as NpcType,
            this.map,
            sx,
            sy,
            player.sessionId,
          );
          
          // Apply saved level and HP
          newNpc.level = comp.level;
          newNpc.exp = comp.exp;
          newNpc.hp = Math.min(newNpc.maxHp, comp.hp);
        }
        // clear it from memory since they exist in the world now
        player.savedCompanions = [];
      }

      this.friends.setUserOnline(auth.id, client.sessionId);
      await this.friends.sendUpdateToUser(auth.id, client.sessionId);
      if (player.dbId) this.guild.registerPlayer(player.dbId, client.sessionId);
      const quests = await this.quests.loadCharQuests(char.id);
      client.send(ServerMessageType.QuestList, { quests });
      this.sendWelcome(client, player);
      logger.info({
        room: this.roomId,
        sessionId: client.sessionId,
        message: `Player ${player.name} joined at ${player.tileX},${player.tileY}`,
      });
    } catch (e: unknown) {
      logger.error({ message: `[ArenaRoom] onJoin error: ${e}` });
      throw e;
    }
  }

  async onDrop(client: Client) {
    if (!this.state.players.has(client.sessionId)) {
      await this.removePlayer(client);
      return;
    }
    try {
      await this.allowReconnection(client, 30);
    } catch {
      await this.removePlayer(client);
    }
  }

  onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    client.view = new StateView();
    client.view.add(player);

    if (player.userId) {
      this.friends.setUserOnline(player.userId, client.sessionId);
    }

    this.sendWelcome(client, player);
  }

  private sendWelcome(client: Client, player: Player) {
    client.send(ServerMessageType.Welcome, {
      sessionId: client.sessionId,
      roomMapName: this.roomMapName,
      tileX: player.tileX,
      tileY: player.tileY,
      mapWidth: this.map.width,
      mapHeight: this.map.height,
      tileSize: this.map.tileSize,
      collision: this.map.collision,
      tileTypes: this.map.tileTypes,
      warps: this.map.warps,
      role: player.role,
    });
  }



  async onLeave(client: Client) {
    await this.removePlayer(client);
  }

  private async removePlayer(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      SocialHandlers.handleGroupLeave(this.messageHandler.ctx, client);

      const activeCompanions: { type: string; level: number; exp: number; hp: number }[] = [];
      this.state.npcs.forEach((npc) => {
        if (npc.ownerId === player.sessionId && npc.alive) {
          activeCompanions.push({
            type: npc.npcType,
            level: npc.level,
            exp: npc.exp,
            hp: npc.hp,
          });
          // Also remove the companion from the game world when the player logs out
          this.state.npcs.delete(npc.sessionId);
        }
      });

      await this.playerService.cleanupPlayer(player, this.roomMapName, activeCompanions);
      await this.bankSystem.closeBank(player);
    }
    this.combat.removeEntity(client.sessionId);
    this.buffSystem.removePlayer(client.sessionId);
    this.respawnSystem.removePlayer(client.sessionId);
    this.trade.cancel(client.sessionId);
    if (player?.dbId) this.guild.unregisterPlayer(player.dbId);
    if (player?.userId) this.friends.setUserOffline(player.userId);
  }

  private onEntityDeath(entity: Entity, killerSessionId?: string) {
    // Soul Harvest Passive: Necromancer nearby
    this.state.players.forEach((player) => {
      if (player.classType === "NECROMANCER" && player.alive) {
        const dx = player.tileX - entity.tileX;
        const dy = player.tileY - entity.tileY;
        const distSq = dx * dx + dy * dy;
        const HARVEST_RANGE = 5;
        if (distSq <= HARVEST_RANGE * HARVEST_RANGE) {
          const hpGain = Math.floor(player.maxHp * 0.05);
          const manaGain = Math.floor(player.maxMana * 0.05);
          player.hp = Math.min(player.maxHp, player.hp + hpGain);
          player.mana = Math.min(player.maxMana, player.mana + manaGain);

          // Add a soul
          if (player.souls < player.maxSouls) {
            player.souls++;
          }

          this.broadcast(ServerMessageType.Heal, {
            sessionId: player.sessionId,
            amount: hpGain,
            hpAfter: player.hp,
          });
        }
      }
    });

    if (entity.entityType === EntityType.PLAYER) this.onPlayerDeath(entity as Player, killerSessionId);
    else this.tickSystem.handleNpcDeath(entity as Npc, killerSessionId);
  }

  private onSummon(caster: Entity, spellId: string, x: number, y: number) {
    this.npcSystem.spawnSummon(caster, spellId, x, y);
  }

  private onPlayerDeath(player: Player, killerSessionId?: string) {
    player.hp = 0;
    player.alive = false;
    this.spatial.removeFromGrid(player);
    const dropped = this.inventorySystem.dropAllItems(player);
    for (const d of dropped)
      this.drops.spawnItemDrop(this.state.drops, player.tileX, player.tileY, d.itemId, d.quantity);
    if (player.gold > 0) {
      this.drops.spawnGoldDrop(this.state.drops, player.tileX, player.tileY, player.gold);
      player.gold = 0;
    }
    this.broadcast(ServerMessageType.Death, {
      sessionId: player.sessionId,
      killerSessionId,
    });
    this.respawnSystem.queueRespawn(player.sessionId, Date.now());
  }

  private findClient(sid: string): Client | undefined {
    return this.clients.getById(sid);
  }
}
