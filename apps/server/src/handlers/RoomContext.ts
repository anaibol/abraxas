import type { GameState } from "../schema/GameState";
import type { TileMap, BroadcastFn } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import type { ChatService } from "../services/ChatService";
import type { LevelService } from "../services/LevelService";
import type { CombatSystem } from "../systems/CombatSystem";
import type { DropSystem } from "../systems/DropSystem";
import type { FriendsSystem } from "../systems/FriendsSystem";
import type { InventorySystem } from "../systems/InventorySystem";
import type { MovementSystem } from "../systems/MovementSystem";
import type { QuestSystem } from "../systems/QuestSystem";
import { SocialSystem } from "../systems/SocialSystem";
import { GuildSystem } from "../systems/GuildSystem";
import { TradeSystem } from "../systems/TradeSystem";
import type { BankSystem } from "../systems/BankSystem";
import type { NpcSystem } from "../systems/NpcSystem";

/** Dependency container for handlers to reduce constructor bloat. */
export interface RoomContext {
	state: GameState;
	map: TileMap;
	roomId: string;
	systems: {
		movement: MovementSystem;
		combat: CombatSystem;
		inventory: InventorySystem;
		drops: DropSystem;
		social: SocialSystem;
		guild: GuildSystem;
		friends: FriendsSystem;
		quests: QuestSystem;
		trade: TradeSystem;
		bank: BankSystem;
		npc: NpcSystem;
	};
	services: {
		chat: ChatService;
		level: LevelService;
	};
	broadcast: BroadcastFn;
	isTileOccupied: (x: number, y: number, excludeId: string) => boolean;
	findClientByName: (name: string) => Client | undefined;
	findClientBySessionId: (sessionId: string) => Client | undefined;
}
