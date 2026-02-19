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
import { MovementSystem } from "../systems/MovementSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { DropSystem } from "../systems/DropSystem";
import { BuffSystem } from "../systems/BuffSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { RespawnSystem } from "../systems/RespawnSystem";
import { NpcSystem } from "../systems/NpcSystem";
import {
  TICK_MS,
  TileMap,
  ClientMessageType,
  ServerMessageType,
  EQUIPMENT_SLOTS,
  type JoinOptions,
} from "@abraxas/shared";
import { logger } from "../logger";
import { MapService } from "../services/MapService";
import { PersistenceService } from "../services/PersistenceService";
import { AuthService } from "../database/auth";
import { prisma } from "../database/db";
import type { Account } from "../generated/prisma";
import { MessageHandler } from "../handlers/MessageHandler";
import { SocialSystem } from "../systems/SocialSystem";
import { FriendsSystem } from "../systems/FriendsSystem";
import { SpatialLookup, Entity } from "../utils/SpatialLookup";
import { QuestSystem } from "../systems/QuestSystem";
import { ChatService } from "../services/ChatService";
import { PlayerService } from "../services/PlayerService";
import { TickSystem } from "../systems/TickSystem";
import { LevelService } from "../services/LevelService";

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
  private respawnSystem = new RespawnSystem();
  private npcSystem!: NpcSystem;
  private social!: SocialSystem;
  private friends!: FriendsSystem;
  private messageHandler!: MessageHandler;
  private playerService!: PlayerService;
  private tickSystem!: TickSystem;
  private levelService!: LevelService;
  private spatial!: SpatialLookup;
  private quests = new QuestSystem();

  // ── Message Handlers ───────────────────────────────────────────────────
  messages: Messages<ArenaRoom> = {
    [ClientMessageType.Move]: validate(z.object({ direction: z.number() }), (client, data) => this.messageHandler.handleMove(client, data.direction)),
    [ClientMessageType.Attack]: validate(z.object({ targetTileX: z.number().optional(), targetTileY: z.number().optional() }), (client, data) => this.messageHandler.handleAttack(client, data)),
    [ClientMessageType.Cast]: validate(z.object({ spellId: z.string(), targetTileX: z.number(), targetTileY: z.number() }), (client, data) => this.messageHandler.handleCast(client, data)),
    [ClientMessageType.Pickup]: validate(z.object({ dropId: z.string() }), (client, data) => this.messageHandler.handlePickup(client, data)),
    [ClientMessageType.Equip]: validate(z.object({ itemId: z.string() }), (client, data) => this.messageHandler.handleEquip(client, data)),
    [ClientMessageType.Unequip]: validate(z.object({ slot: z.enum(EQUIPMENT_SLOTS) }), (client, data) => this.messageHandler.handleUnequip(client, data)),
    [ClientMessageType.UseItem]: validate(z.object({ itemId: z.string() }), (client, data) => this.messageHandler.handleUseItem(client, data)),
    [ClientMessageType.DropItem]: validate(z.object({ itemId: z.string() }), (client, data) => this.messageHandler.handleDropItem(client, data)),
    [ClientMessageType.Interact]: validate(z.object({ npcId: z.string() }), (client, data) => this.messageHandler.handleInteract(client, data)),
    [ClientMessageType.BuyItem]: validate(z.object({ itemId: z.string(), quantity: z.number() }), (client, data) => this.messageHandler.handleBuyItem(client, data)),
    [ClientMessageType.SellItem]: validate(z.object({ itemId: z.string(), quantity: z.number(), npcId: z.string().optional() }), (client, data) => this.messageHandler.handleSellItem(client, data)),
    [ClientMessageType.QuestAccept]: validate(z.object({ questId: z.string() }), (client, data) => this.messageHandler.handleQuestAccept(client, data)),
    [ClientMessageType.QuestComplete]: validate(z.object({ questId: z.string() }), (client, data) => this.messageHandler.handleQuestComplete(client, data)),
    [ClientMessageType.Chat]: validate(z.object({ message: z.string() }), (client, data) => this.messageHandler.handleChat(client, data)),
    [ClientMessageType.FriendRequest]: validate(z.object({ targetName: z.string() }), (client, data) => this.messageHandler.handleFriendRequest(client, data)),
    [ClientMessageType.FriendAccept]: validate(z.object({ requesterId: z.string() }), (client, data) => this.messageHandler.handleFriendAccept(client, data)),
    [ClientMessageType.PartyInvite]: validate(z.object({ targetSessionId: z.string() }), (client, data) => this.messageHandler.handlePartyInvite(client, data)),
    [ClientMessageType.PartyAccept]: validate(z.object({ partyId: z.string() }), (client, data) => this.messageHandler.handlePartyAccept(client, data)),
    [ClientMessageType.PartyLeave]: (client: Client) => this.messageHandler.handlePartyLeave(client),
    [ClientMessageType.PartyKick]: validate(z.object({ targetSessionId: z.string() }), (client, data) => this.messageHandler.handlePartyKick(client, data)),
    [ClientMessageType.Audio]: (client: Client, data: ArrayBuffer) => this.messageHandler.handleAudio(client, data),
  };

  async onCreate(options: JoinOptions & { mapName?: string }) {
    try {
      this.autoDispose = false;
      this.seatReservationTimeout = 60;
      this.setState(new GameState());

      this.roomMapName = options.mapName || "arena.test";
      const loadedMap = await MapService.getMap(this.roomMapName);
      if (!loadedMap) throw new Error(`Failed to load map: ${this.roomMapName}`);
      this.map = loadedMap;

      this.drops.setInventorySystem(this.inventorySystem);
      this.spatial = new SpatialLookup(this.state);
      this.movement = new MovementSystem(this.spatial);
      this.combat = new CombatSystem(this.spatial, this.buffSystem, this.map);
      this.npcSystem = new NpcSystem(this.state, this.movement, this.combat, this.spatial, this.buffSystem);
      this.social = new SocialSystem(this.state, (sid) => this.findClient(sid));
      this.friends = new FriendsSystem(this.state, (sid) => this.findClient(sid));

      this.playerService = new PlayerService(this.state, this.inventorySystem, this.spatial, this.quests, this.friends);
      this.levelService = new LevelService(this.broadcast.bind(this));

      const findClientByName = (name: string) => {
        const player = Array.from(this.state.players.values()).find((p) => p.name === name);
        return player ? this.findClient(player.sessionId) : undefined;
      };

      const chatService = new ChatService(this.broadcast.bind(this), findClientByName);

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
          friends: this.friends,
          quests: this.quests,
        },
        services: {
          chat: chatService,
          level: this.levelService,
        },
        broadcast: this.broadcast.bind(this),
        isTileOccupied: this.spatial.isTileOccupied.bind(this.spatial),
        findClientByName,
        gainXp: (player, amount) => this.levelService.gainXp(player, amount),
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
        broadcast: this.broadcast.bind(this),
        onEntityDeath: (e, k) => this.onEntityDeath(e, k),
        onSummon: (caster, spellId, x, y) => this.onSummon(caster, spellId, x, y),
        gainXp: (p, a) => this.levelService.gainXp(p, a),
        sendQuestUpdates: (c, u) => this.messageHandler.sendQuestUpdates(c, u),
        findClient: (sid) => this.findClient(sid),
      });

      if (this.map.npcs) {
        for (const npcDef of this.map.npcs) {
          this.npcSystem.spawnNpcAt(npcDef.type, this.map, npcDef.x, npcDef.y);
        }
      }
      const npcCount = this.map.npcCount ?? 20;
      if (npcCount > 0) this.npcSystem.spawnNpcs(npcCount, this.map);

      this.setSimulationInterval((dt) => this.tickSystem.tick(dt), TICK_MS);
      this.setPatchRate(TICK_MS);

      logger.info({ room: this.roomId, message: "onCreate completed successfully" });
    } catch (e: unknown) {
      logger.error({ message: `[ArenaRoom] onCreate error: ${e}` });
      throw e;
    }
  }

  static async onAuth(token: string, options: Record<string, unknown>, context: AuthContext) {
    const actualToken = (typeof token === "string" ? token : null) || context?.token || (typeof options?.token === "string" ? options.token : undefined);
    if (!actualToken || typeof actualToken !== "string") throw new Error("Authentication token required");
    try {
      const payload = AuthService.verifyToken(actualToken);
      if (!payload) throw new Error("Invalid token");
      const dbUser = await prisma.account.findUnique({ where: { id: payload.userId } });
      if (!dbUser) throw new Error("User not found");
      return dbUser;
    } catch (e: unknown) {
      throw e;
    }
  }

  async onJoin(client: Client, options: JoinOptions & { mapName?: string }, auth: Account) {
    try {
      const char = await PersistenceService.loadChar(options.charId);
      if (!char) {
        client.leave();
        return;
      }
      prisma.character.update({ where: { id: char.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
      const player = await this.playerService.createPlayer(client, char, auth.id);
      this.state.players.set(client.sessionId, player);
      client.view = new StateView();
      client.view.add(player);
      this.spatial.addToGrid(player);
      this.friends.setUserOnline(auth.id, client.sessionId);
      await this.friends.sendUpdateToUser(auth.id, client.sessionId);
      const quests = await this.quests.loadCharQuests(char.id);
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
    } catch (e: unknown) {
      logger.error({ message: `[ArenaRoom] onJoin error: ${e}` });
      client.leave(4000);
      throw e;
    }
  }

  async onLeave(client: Client, code?: number) {
    if (code !== CloseCode.CONSENTED) {
      try {
        await this.allowReconnection(client, 30);
        return;
      } catch {}
    }
    await this.removePlayer(client);
  }

  private async removePlayer(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.messageHandler.handlePartyLeave(client);
      await this.playerService.cleanupPlayer(player, this.roomMapName);
    }
    this.movement.removePlayer(client.sessionId);
    this.combat.removeEntity(client.sessionId);
    this.buffSystem.removePlayer(client.sessionId);
    this.respawnSystem.removePlayer(client.sessionId);
  }

  private onEntityDeath(entity: Entity, killerSessionId?: string) {
    if (entity instanceof Player) this.onPlayerDeath(entity, killerSessionId);
    else this.tickSystem.handleNpcDeath(entity, killerSessionId);
  }

  private onSummon(_caster: Entity, spellId: string, x: number, y: number) {
    if (spellId === "summon_skeleton") {
      if (this.state.npcs.size > 200) return;
      const skeletons = Array.from(this.state.npcs.values()).filter(n => n.type === "skeleton").length;
      if (skeletons > 50) return;
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const rx = x + Math.floor(Math.random() * 3) - 1;
        const ry = y + Math.floor(Math.random() * 3) - 1;
        if (rx >= 0 && rx < this.map.width && ry >= 0 && ry < this.map.height) {
          if (this.map.collision[ry]?.[rx] === 0 && !this.spatial.isTileOccupied(rx, ry, "")) {
            this.npcSystem.spawnNpcAt("skeleton", this.map, rx, ry);
          }
        }
      }
    }
  }

  private onPlayerDeath(player: Player, killerSessionId?: string) {
    player.hp = 0; player.alive = false;
    this.spatial.removeFromGrid(player);
    const dropped = this.inventorySystem.dropAllItems(player);
    for (const d of dropped) this.drops.spawnItemDrop(this.state.drops, player.tileX, player.tileY, d.itemId, d.quantity);
    if (player.gold > 0) {
      this.drops.spawnGoldDrop(this.state.drops, player.tileX, player.tileY, player.gold);
      player.gold = 0;
    }
    this.broadcast(ServerMessageType.Death, { sessionId: player.sessionId, killerSessionId });
    this.respawnSystem.queueRespawn(player.sessionId, Date.now());
  }

  private gainXp(player: Player, amount: number) {
    this.levelService.gainXp(player, amount);
  }

  private findClient(sid: string): Client | undefined {
    return this.clients.find((c) => c.sessionId === sid);
  }
}
