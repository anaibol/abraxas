import {
	type ClientMessageType,
	type JoinOptions,
	ServerMessageType,
	TICK_MS,
	type TileMap,
} from "@abraxas/shared";
import { type AuthContext, type Client, Room } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import { verifyToken } from "../database/auth";
import { prisma } from "../database/db";
import type { Account } from "../generated/prisma";
import { MessageHandler } from "../handlers/MessageHandler";
import { logger } from "../logger";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { ChatService } from "../services/ChatService";
import { LevelService } from "../services/LevelService";
import { getMap } from "../services/MapService";
import { PersistenceService } from "../services/PersistenceService";
import { PlayerService } from "../services/PlayerService";
import { BuffSystem } from "../systems/BuffSystem";
import { CombatSystem } from "../systems/CombatSystem";
import { DropSystem } from "../systems/DropSystem";
import { FriendsSystem } from "../systems/FriendsSystem";
import { InventorySystem } from "../systems/InventorySystem";
import { MovementSystem } from "../systems/MovementSystem";
import { NpcSystem } from "../systems/NpcSystem";
import { QuestSystem } from "../systems/QuestSystem";
import { RespawnSystem } from "../systems/RespawnSystem";
import { SocialSystem } from "../systems/SocialSystem";
import { TickSystem } from "../systems/TickSystem";
import { BankSystem } from "../systems/BankSystem";
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
	private trade!: TradeSystem;
	private bankSystem!: BankSystem;

	async onCreate(options: JoinOptions & { mapName?: string }) {
		try {
			this.roomMapName = options.mapName || "arena.test";
			const loadedMap = await getMap(this.roomMapName);
			if (!loadedMap)
				throw new Error(`Failed to load map: ${this.roomMapName}`);
			this.map = loadedMap;

			this.drops = new DropSystem(this.inventorySystem);
			this.spatial = new SpatialLookup(this.state);
			this.movement = new MovementSystem(this.spatial);
			this.combat = new CombatSystem(this.state, this.spatial, this.buffSystem, this.map);
			this.npcSystem = new NpcSystem(
				this.state,
				this.movement,
				this.combat,
				this.spatial,
				this.buffSystem,
			);
			this.social = new SocialSystem(this.state, (sid) => this.findClient(sid));
			this.friends = new FriendsSystem(this.state, (sid) =>
				this.findClient(sid),
			);
			this.trade = new TradeSystem(this.inventorySystem);
			this.bankSystem = new BankSystem(this.inventorySystem);

			this.playerService = new PlayerService(
				this.state,
				this.inventorySystem,
				this.spatial,
				this.quests,
				this.friends,
			);
			this.levelService = new LevelService(this.broadcast.bind(this), (p) =>
				this.inventorySystem.recalcStats(p),
			);

			const findClientByName = (name: string) => {
				const player = Array.from(this.state.players.values()).find(
					(p) => p.name === name,
				);
				return player ? this.findClient(player.sessionId) : undefined;
			};

			const chatService = new ChatService(
				this.broadcast.bind(this),
				findClientByName,
				(sid) => this.findClient(sid),
				this.social.broadcastToParty.bind(this.social),
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
					friends: this.friends,
					quests: this.quests,
					trade: this.trade,
					bank: this.bankSystem,
				},
				services: {
					chat: chatService,
					level: this.levelService,
				},
				broadcast: this.broadcast.bind(this),
				isTileOccupied: this.spatial.isTileOccupied.bind(this.spatial),
				findClientByName,
				findClientBySessionId: (sid) => this.findClient(sid),
			});

			this.messageHandler.registerHandlers(
				<T extends ClientMessageType>(
					type: T,
					// biome-ignore lint/suspicious/noExplicitAny: Colyseus onMessage is typed as any
					handler: (client: Client, message: any) => void,
				) => {
					this.onMessage(type, handler);
				},
			);

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
				onSummon: (caster, spellId, x, y) =>
					this.onSummon(caster, spellId, x, y),
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

			logger.info({ room: this.roomId, message: "onCreate completed successfully" });
		} catch (e: unknown) {
			logger.error({ message: `[ArenaRoom] onCreate error: ${e}` });
			throw e;
		}
	}

	static async onAuth(
		token: string,
		options: Record<string, unknown>,
		context: AuthContext,
	) {
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

	async onJoin(
		client: Client,
		options: JoinOptions & { mapName?: string },
		auth: Account,
	) {
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
			const player = await this.playerService.createPlayer(
				client,
				char,
				auth.id,
			);
			// Assign spawn point — spiral outward if the candidate tile is blocked
			const spawnIndex = this.state.players.size;
			const candidate = this.map.spawns[spawnIndex % this.map.spawns.length];
			if (candidate) {
				const safe = findSafeSpawn(
					candidate.x,
					candidate.y,
					this.map,
					this.spatial,
				);
				player.tileX = safe?.x ?? candidate.x;
				player.tileY = safe?.y ?? candidate.y;
			}
			this.state.players.set(client.sessionId, player);
			client.view = new StateView();
			client.view.add(player);
			this.spatial.addToGrid(player);
			this.friends.setUserOnline(auth.id, client.sessionId);
			await this.friends.sendUpdateToUser(auth.id, client.sessionId);
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
			tileX: player.tileX,
			tileY: player.tileY,
			mapWidth: this.map.width,
			mapHeight: this.map.height,
			tileSize: this.map.tileSize,
			collision: this.map.collision,
		});
	}

	async onLeave(client: Client) {
		await this.removePlayer(client);
	}

	private async removePlayer(client: Client) {
		const player = this.state.players.get(client.sessionId);
		if (player) {
			this.messageHandler.handlePartyLeave(client);
			await this.playerService.cleanupPlayer(player, this.roomMapName);
			await this.bankSystem.closeBank(player);
		}
		this.combat.removeEntity(client.sessionId);
		this.buffSystem.removePlayer(client.sessionId);
		this.respawnSystem.removePlayer(client.sessionId);
		this.trade.cancel(client.sessionId);
	}

	private onEntityDeath(entity: Entity, killerSessionId?: string) {
		if (entity instanceof Player) this.onPlayerDeath(entity, killerSessionId);
		else this.tickSystem.handleNpcDeath(entity, killerSessionId);
	}

	private onSummon(_caster: Entity, spellId: string, x: number, y: number) {
		if (spellId === "summon_skeleton") {
			if (this.state.npcs.size > 200) return;
			const skeletons = Array.from(this.state.npcs.values()).filter(
				(n) => n.type === "skeleton",
			).length;
			if (skeletons > 50) return;
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

	private onPlayerDeath(player: Player, killerSessionId?: string) {
		player.hp = 0;
		player.alive = false;
		this.spatial.removeFromGrid(player);
		const dropped = this.inventorySystem.dropAllItems(player);
		for (const d of dropped)
			this.drops.spawnItemDrop(
				this.state.drops,
				player.tileX,
				player.tileY,
				d.itemId,
				d.quantity,
			);
		if (player.gold > 0) {
			this.drops.spawnGoldDrop(
				this.state.drops,
				player.tileX,
				player.tileY,
				player.gold,
			);
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
