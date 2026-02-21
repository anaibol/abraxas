import {
  type BroadcastFn,
  type ItemAffix,
  ItemRarity,
  type JoinOptions,
  NPC_STATS,
  NPC_VIEW_RADIUS,
  PLAYER_VIEW_RADIUS,
  type NpcType,
  PLAYER_RESPAWN_TIME_MS,
  ServerMessageType,
  SPAWN_PROTECTION_MS,
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
import { ItemAffixSchema } from "../schema/InventoryItem";
import type { Npc } from "../schema/Npc";
import type { Player } from "../schema/Player";
import { ChatService } from "../services/ChatService";
import { LevelService } from "../services/LevelService";
import { getMap } from "../services/MapService";
import { PersistenceService } from "../services/PersistenceService";
import { PlayerService } from "../services/PlayerService";
import { BankSystem } from "../systems/BankSystem";
import { BuffSystem } from "../systems/BuffSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { DamageCalculator } from "../systems/DamageCalculator";
import { DropSystem } from "../systems/DropSystem";
import { EffectResolver } from "../systems/EffectResolver";
import { FriendsSystem } from "../systems/FriendsSystem";
import { GuildSystem } from "../systems/GuildSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { MovementSystem } from "../systems/MovementSystem";
import { NpcSpawner } from "../systems/NpcSpawner";
import { NpcSystem } from "../systems/NpcSystem";
import { QuestSystem } from "../systems/QuestSystem";
import { RespawnSystem } from "../systems/RespawnSystem";
import { SocialSystem } from "../systems/SocialSystem";
import { TickSystem } from "../systems/TickSystem";
import { TradeSystem } from "../systems/TradeSystem";
import { WorldEventSystem } from "../systems/WorldEventSystem";
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
  private worldEventSystem!: WorldEventSystem;

  /** Per-client set of NPC sessionIds currently in the client's StateView. */
  private npcViewSets = new Map<string, Set<string>>();
  /** Per-client set of other Player sessionIds currently in the client's StateView. */
  private playerViewSets = new Map<string, Set<string>>();
  /** Per-client last-known player tile position; used to skip AoI rebuild when the player hasn't moved. */
  private lastPlayerTiles = new Map<string, { x: number; y: number }>();

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
      const dmg = new DamageCalculator(this.buffSystem);
      const effects = new EffectResolver(dmg, this.buffSystem, this.spatial, this.map, this.roomMapName);
      this.combat = new CombatSystem(
        this.state,
        this.spatial,
        this.buffSystem,
        this.map,
        this.roomMapName,
        dmg,
        effects,
      );
      const npcSpawner = new NpcSpawner(this.state, this.spatial);
      this.npcSystem = new NpcSystem(
        this.state,
        this.movement,
        this.combat,
        this.spatial,
        this.buffSystem,
        npcSpawner,
      );
      this.social = new SocialSystem(this.state, (sid) => this.findClient(sid));
      this.guild = new GuildSystem(this.state, (sid) => this.findClient(sid));
      this.friends = new FriendsSystem(this.state, (sid) => this.findClient(sid));
      this.trade = new TradeSystem(this.inventorySystem);
      this.bankSystem = new BankSystem(this.inventorySystem);
      this.worldEventSystem = new WorldEventSystem(this.state, this.npcSystem);

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
          buff: this.buffSystem,
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
        logger.info({
          intent: "gm_spawn",
          sessionId: player.sessionId,
          role: player.role,
          npcType: message.type,
        });
        if (player.role !== "ADMIN") {
          logger.warn({ intent: "gm_spawn", result: "rejected", role: player.role });
          return;
        }
        const npcType = message.type as NpcType;
        if (!NPC_STATS[npcType]) {
          logger.warn({ intent: "gm_spawn", result: "invalid_type", type: message.type });
          return;
        }
        this.npcSystem.spawnNpc(npcType, this.map);
        logger.debug({ intent: "gm_spawn", result: "success", type: npcType });
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
          worldEvent: this.worldEventSystem,
        },
        broadcast: this.broadcastMessage,
        onEntityDeath: (e, k) => this.onEntityDeath(e, k),
        onSummon: (caster, spellId, x, y) => this.onSummon(caster, spellId, x, y),
        gainXp: (p, a) => this.levelService.gainXp(p, a),
        sendQuestUpdates: (c, u) => HandlerUtils.sendQuestUpdates(c, u),
        findClient: (sid) => this.findClient(sid),
      });

      // B9: Await drop loading so players joining immediately see all drops.
      const savedDrops = await PersistenceService.loadWorldDrops(this.roomMapName);
      for (const d of savedDrops) {
        const drop = this.drops.createDrop(
          this.state.drops,
          d.tileX,
          d.tileY,
          d.itemType.toLowerCase() as "item" | "gold",
          d.id,
        );
        drop.itemId = d.itemId || "";
        drop.quantity = d.quantity;
        drop.goldAmount = d.goldAmount;
        drop.spawnedAt = d.spawnedAt.getTime();

        if (d.item) {
          drop.rarity = d.item.rarity ?? ItemRarity.COMMON;
          drop.nameOverride = d.item.nameOverride || "";
          const affixes = d.item.affixesJson || [];
          affixes.forEach((a) => {
            const s = new ItemAffixSchema();
            s.affixType = a.type;
            s.stat = a.stat;
            s.value = a.value;
            drop.affixes.push(s);
          });
        }
      }

      // ── NPC persistence: DB-first spawn ──────────────────────────────────
      // If the DB already has NPC rows for this map, restore them — the world
      // is resuming from a previous session (positions, HP, and levels carry over).
      // If the DB is empty this is a fresh boot; spawn from map config + random
      // count and immediately persist so the next restart can restore them.
      const savedNpcs = await PersistenceService.loadPersistentNpcs(this.roomMapName);

      if (savedNpcs.length > 0) {
        // Resume world — recreate each NPC from its saved state.
        for (const n of savedNpcs) {
          this.npcSystem.spawnNpcAt(
            n.npcType as NpcType,
            this.map,
            n.tileX,
            n.tileY,
            undefined,
            n.level,
            { isUnique: n.isUnique, uniqueId: n.uniqueId || undefined, dbId: n.id },
          );
        }
      } else {
        // Fresh boot — spawn from authoritative map sources, then persist.
        for (const n of this.map.npcs ?? []) {
          this.npcSystem.spawnNpcAt(n.type, this.map, n.x, n.y);
        }
        const npcCount = this.map.npcCount ?? 0;
        if (npcCount > 0) {
          this.npcSystem.spawnNpcs(npcCount, this.map);
        }

        // Persist the newly-spawned world so the next restart restores it.
        const toSave = Array.from(this.state.npcs.values()).map((npc) => ({
          npcType: npc.npcType,
          tileX: npc.tileX,
          tileY: npc.tileY,
          spawnX: npc.spawnX,
          spawnY: npc.spawnY,
          level: npc.level,
          hp: npc.hp,
          maxHp: npc.maxHp,
          isUnique: npc.isUnique ?? false,
          uniqueId: npc.uniqueId,
        }));
        PersistenceService.savePersistentNpcs(this.roomMapName, toSave).catch((e) =>
          logger.error({ message: "Failed to persist initial NPC spawn", error: String(e) }),
        );
      }

      this.setSimulationInterval((dt) => {
        this.tickSystem.tick(dt);
        this.tickNpcViews();
        this.tickPlayerViews();
      }, TICK_MS);

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

      // ── Kick previous session if this character is already online ──────
      for (const [existingSessionId, existingPlayer] of this.state.players) {
        if (existingPlayer.dbId === char.id) {
          logger.info({
            message: `Kicking duplicate session for character ${char.id}`,
            oldSession: existingSessionId,
            newSession: client.sessionId,
          });
          const oldClient = this.clients.getById(existingSessionId);
          if (oldClient) {
            oldClient.send(ServerMessageType.Error, {
              message: "game.logged_in_elsewhere",
            });
            oldClient.leave();
          }
          // Ensure clean state before setting up the new session
          await this.removePlayer(oldClient ?? { sessionId: existingSessionId } as Client);
          break;
        }
      }

      prisma.character
        .update({ where: { id: char.id }, data: { lastLoginAt: new Date() } })
        .catch(() => {});
      const player = await this.playerService.createPlayer(client, char, auth.id);
      player.role = auth.role;
      // Assign spawn point — prefer safe zone for both initial spawns and
      // returning players. New players get a dedicated newbieSpawn slot.
      let candidate: { x: number; y: number } | undefined;
      const isNewbie = player.xp === 0 && player.level === 1;
      if (
        isNewbie &&
        this.map.newbieSpawns &&
        this.map.newbieSpawns.length > 0
      ) {
        const spawnIndex = this.state.players.size;
        const spawnsArray = this.map.newbieSpawns;
        candidate = spawnsArray[spawnIndex % spawnsArray.length];
      } else if (this.map.safeZones && this.map.safeZones.length > 0) {
        // Place returning players inside a random safe zone tile
        const zone = this.map.safeZones[Math.floor(Math.random() * this.map.safeZones.length)];
        candidate = {
          x: zone.x + Math.floor(Math.random() * zone.w),
          y: zone.y + Math.floor(Math.random() * zone.h),
        };
      } else if (this.map.spawns && this.map.spawns.length > 0) {
        const spawnIndex = this.state.players.size;
        candidate = this.map.spawns[spawnIndex % this.map.spawns.length];
      }
      if (candidate) {
        const safe = findSafeSpawn(candidate.x, candidate.y, this.map, this.spatial);
        player.tileX = safe?.x ?? candidate.x;
        player.tileY = safe?.y ?? candidate.y;
      }
      // IMPORTANT: Add the player to state FIRST, then set up the StateView.
      // Colyseus 0.17+ requires the instance to be attached to the state tree
      // before it can be added to a view (calling view.add() on a detached
      // instance throws "Cannot add a detached instance to the StateView").
      this.state.players.set(client.sessionId, player);
      client.view = new StateView();
      client.view.add(player);
      // Seed the AoI view with NPCs in range around the player's spawn point.
      this.npcViewSets.set(client.sessionId, new Set());
      this.updateNpcView(client, player);
      // Seed the AoI view with other players in range.
      this.playerViewSets.set(client.sessionId, new Set());
      this.updatePlayerView(client, player);
      // Add the new player to all existing clients' views if they are nearby.
      for (const otherClient of this.clients) {
        if (otherClient.sessionId === client.sessionId) continue;
        const otherPlayer = this.state.players.get(otherClient.sessionId);
        if (!otherPlayer || !otherClient.view) continue;
        const otherSet = this.playerViewSets.get(otherClient.sessionId);
        if (!otherSet) continue;
        const dx = player.tileX - otherPlayer.tileX;
        const dy = player.tileY - otherPlayer.tileY;
        if (dx * dx + dy * dy <= PLAYER_VIEW_RADIUS * PLAYER_VIEW_RADIUS) {
          otherClient.view.add(player);
          otherSet.add(client.sessionId);
        }
      }
      // If the player logged out while dead, queue an immediate respawn
      // so they enter the world alive on the first server tick.
      if (!player.alive) {
        this.respawnSystem.queueRespawn(client.sessionId, Date.now() - PLAYER_RESPAWN_TIME_MS);
      }
      this.spatial.addToGrid(player);
      // Apply spawn protection immediately on join so nearby NPCs can't
      // kill the player in the first few ticks before they can react.
      this.buffSystem.applySpawnProtection(client.sessionId, SPAWN_PROTECTION_MS, Date.now());

      // Restore saved companions
      if (player.savedCompanions && player.savedCompanions.length > 0) {
        for (const comp of player.savedCompanions) {
          const spawnLoc =
            findSafeSpawn(player.tileX, player.tileY, this.map, this.spatial) ?? player;
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
      await this.allowReconnection(client, 10);
    } catch {
      await this.removePlayer(client);
    }
  }

  onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // Player is already in state.players, so view.add() is safe here.
    client.view = new StateView();
    client.view.add(player);
    // Re-seed the AoI views for the reconnecting client.
    this.npcViewSets.set(client.sessionId, new Set());
    this.updateNpcView(client, player);
    this.playerViewSets.set(client.sessionId, new Set());
    this.updatePlayerView(client, player);

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
      safeZones: this.map.safeZones,
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
      // B7: Collect companion IDs first, then delete — mutating during forEach is unsafe.
      const companionIds: string[] = [];
      for (const [id, npc] of this.state.npcs) {
        if (npc.ownerId === player.sessionId && npc.alive) {
          activeCompanions.push({
            type: npc.npcType,
            level: npc.level,
            exp: npc.exp,
            hp: npc.hp,
          });
          companionIds.push(id);
        }
      }
      // Bug #4 fix: Clean up spatial grid and combat state for each companion
      for (const id of companionIds) {
        const npc = this.state.npcs.get(id);
        if (npc) {
          this.spatial.removeFromGrid(npc);
          this.combat.removeEntity(npc.sessionId);
          this.buffSystem.removePlayer(npc.sessionId);
        }
        this.state.npcs.delete(id);
      }

      await this.playerService.cleanupPlayer(player, this.roomMapName, activeCompanions);
      // Bug #5 fix: Await bank persistence to complete before cleaning up player state
      await this.bankSystem.closeBank(player);
    }
    // Clean up AoI tracking for the departing client.
    this.npcViewSets.delete(client.sessionId);
    this.playerViewSets.delete(client.sessionId);
    this.lastPlayerTiles.delete(client.sessionId);
    // Remove the departing player from all other clients' player views.
    if (player) {
      for (const otherClient of this.clients) {
        if (otherClient.sessionId === client.sessionId) continue;
        const otherSet = this.playerViewSets.get(otherClient.sessionId);
        if (otherSet?.has(client.sessionId)) {
          otherClient.view?.remove(player);
          otherSet.delete(client.sessionId);
        }
      }
    }
    this.combat.removeEntity(client.sessionId);
    this.buffSystem.removePlayer(client.sessionId);
    this.respawnSystem.removePlayer(client.sessionId);
    this.trade.cancel(client.sessionId);
    if (player?.dbId) this.guild.unregisterPlayer(player.dbId);
    if (player?.userId) this.friends.setUserOffline(player.userId);
  }

  private onEntityDeath(entity: Entity, killerSessionId?: string) {
    // P-4: Soul Harvest Passive — use spatial lookup instead of iterating all players
    const HARVEST_RANGE = 5;
    const nearby = this.spatial.findEntitiesInRadius(
      entity.tileX, entity.tileY, HARVEST_RANGE,
    );
    for (const ent of nearby) {
      if (!ent.isPlayer()) continue;
      if (ent.classType !== "NECROMANCER" || !ent.alive) continue;

      const hpGain = Math.floor(ent.maxHp * 0.05);
      const manaGain = Math.floor(ent.maxMana * 0.05);
      ent.hp = Math.min(ent.maxHp, ent.hp + hpGain);
      ent.mana = Math.min(ent.maxMana, ent.mana + manaGain);

      if (ent.souls < ent.maxSouls) {
        ent.souls++;
      }

      this.broadcast(ServerMessageType.Heal, {
        sessionId: ent.sessionId,
        amount: hpGain,
        hpAfter: ent.hp,
      });
    }

    if (entity.isPlayer())
      this.onPlayerDeath(entity, killerSessionId);
    else if (entity.isNpc()) this.tickSystem.handleNpcDeath(entity, killerSessionId);
  }

  private onSummon(caster: Entity, spellId: string, x: number, y: number) {
    this.npcSystem.spawnSummon(caster, spellId, x, y);
  }

  private onPlayerDeath(player: Player, killerSessionId?: string) {
    player.hp = 0;
    player.alive = false;
    this.spatial.removeFromGrid(player);
    // B4: Clear buff/DoT state on death — prevents memory leak for connected-but-dead players
    this.buffSystem.removePlayer(player.sessionId);
    const dropped = this.inventorySystem.dropAllItems(player);
    for (const d of dropped) {
      // Bug #2 fix: Pass affix/rarity instance data so rare/epic gear isn't lost
      const instanceData = d.affixes?.length > 0 || (d.rarity && d.rarity !== 'COMMON')
        ? {
            rarity: d.rarity,
            nameOverride: d.nameOverride,
            affixes: Array.from(d.affixes).map((a) => ({
              type: a.affixType,
              stat: a.stat,
              value: a.value,
            })),
          }
        : undefined;
      this.drops.spawnItemDrop(
        this.state.drops,
        player.tileX,
        player.tileY,
        d.itemId,
        d.quantity,
        instanceData,
      );
    }
    if (player.gold > 0) {
      this.drops.spawnGoldDrop(this.state.drops, player.tileX, player.tileY, player.gold);
      player.gold = 0;
    }

    // Track PvP kill on the killer
    if (killerSessionId) {
      const killer = this.state.players.get(killerSessionId);
      if (killer?.alive) {
        killer.pvpKills++;
      }
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

  // ── NPC Area-of-Interest (AoI) filtering ──────────────────────────────────

  /**
   * Updates the Colyseus StateView for `client` so it includes exactly the NPCs
   * within NPC_VIEW_RADIUS tiles of `player`.  Called on join, reconnect, and
   * each tick (only rebuilds when the player has actually moved).
   */
  public updateNpcView(client: Client, player: Player): void {
    if (!client.view) return;

    const currentSet = this.npcViewSets.get(client.sessionId);
    if (!currentSet) return;

    // Always build the set of NPC ids that should be visible.
    const nearby = this.spatial.findEntitiesInRadius(player.tileX, player.tileY, NPC_VIEW_RADIUS);
    const nextIds = new Set<string>();
    for (const entity of nearby) {
      if (entity.isNpc()) {
        nextIds.add(entity.sessionId);
      }
    }

    // Add newly-visible NPCs.
    for (const id of nextIds) {
      if (!currentSet.has(id)) {
        const npc = this.state.npcs.get(id);
        if (npc) {
          client.view.add(npc);
          currentSet.add(id);
        }
      }
    }

    // Always run the remove pass so NPCs that died or were deleted while the
    // player was stationary are evicted from the view on the next tick.
    for (const id of currentSet) {
      const npc = this.state.npcs.get(id);
      const outOfRange = !nextIds.has(id);
      if (!npc || !npc.alive || outOfRange) {
        if (npc) client.view.remove(npc);
        currentSet.delete(id);
      }
    }
  }

  /**
   * Called from TickSystem each game tick to refresh per-client AoI views.
   * Only clients whose player position changed since the last call pay the
   * spatial query cost.
   */
  public tickNpcViews(): void {
    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      if (!player) continue;

      // Bug #10 fix: Only rebuild AoI when the player has actually moved.
      // The remove pass in updateNpcView handles dead/despawned NPCs even
      // for stationary players, so we still call it — but only when moved.
      const lastTile = this.lastPlayerTiles.get(client.sessionId);
      if (lastTile && lastTile.x === player.tileX && lastTile.y === player.tileY) {
        // Player hasn't moved, but still do a lightweight remove pass for dead NPCs
        const currentSet = this.npcViewSets.get(client.sessionId);
        if (currentSet && client.view) {
          for (const id of currentSet) {
            const npc = this.state.npcs.get(id);
            if (!npc || !npc.alive) {
              if (npc) client.view.remove(npc);
              currentSet.delete(id);
            }
          }
        }
        continue;
      }

      this.lastPlayerTiles.set(client.sessionId, { x: player.tileX, y: player.tileY });
      this.updateNpcView(client, player);
    }
  }

  // ── Player Area-of-Interest (AoI) filtering ────────────────────────────────

  /**
   * Updates the Colyseus StateView for `client` so it includes exactly the
   * other players within PLAYER_VIEW_RADIUS tiles.  The player's own schema
   * is always in their view (added during onJoin/onReconnect).
   */
  public updatePlayerView(client: Client, player: Player): void {
    if (!client.view) return;

    const currentSet = this.playerViewSets.get(client.sessionId);
    if (!currentSet) return;

    const nearby = this.spatial.findEntitiesInRadius(player.tileX, player.tileY, PLAYER_VIEW_RADIUS);
    const nextIds = new Set<string>();
    for (const entity of nearby) {
      if (entity.isPlayer() && entity.sessionId !== client.sessionId) {
        nextIds.add(entity.sessionId);
      }
    }

    // Add newly-visible players.
    for (const id of nextIds) {
      if (!currentSet.has(id)) {
        const otherPlayer = this.state.players.get(id);
        if (otherPlayer) {
          client.view.add(otherPlayer);
          currentSet.add(id);
        }
      }
    }

    // Remove players that left range or disconnected.
    for (const id of currentSet) {
      if (!nextIds.has(id)) {
        const otherPlayer = this.state.players.get(id);
        if (otherPlayer) client.view.remove(otherPlayer);
        currentSet.delete(id);
      }
    }
  }

  /**
   * Called from TickSystem each tick to refresh per-client player AoI views.
   * Uses the same move-check optimization as tickNpcViews.
   */
  public tickPlayerViews(): void {
    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      if (!player) continue;

      const lastTile = this.lastPlayerTiles.get(client.sessionId);
      if (lastTile && lastTile.x === player.tileX && lastTile.y === player.tileY) {
        // Player hasn't moved — lightweight remove pass for disconnected players
        const currentSet = this.playerViewSets.get(client.sessionId);
        if (currentSet && client.view) {
          for (const id of currentSet) {
            if (!this.state.players.has(id)) {
              currentSet.delete(id);
            }
          }
        }
        continue;
      }

      // lastPlayerTiles is already set by tickNpcViews, no need to set again
      this.updatePlayerView(client, player);
    }
  }
}
