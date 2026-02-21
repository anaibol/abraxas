import type { BroadcastFn, TileMap } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import type { GameState } from "../schema/GameState";
import type { ChatService } from "../services/ChatService";
import type { LevelService } from "../services/LevelService";
import type { BankSystem } from "../systems/BankSystem";
import type { CombatSystem } from "../systems/CombatSystem";
import type { DropSystem } from "../systems/DropSystem";
import type { FriendsSystem } from "../systems/FriendsSystem";
import type { GuildSystem } from "../systems/GuildSystem";
import type { InventorySystem } from "../systems/InventorySystem";
import type { MovementSystem } from "../systems/MovementSystem";
import type { NpcSystem } from "../systems/NpcSystem";
import type { QuestSystem } from "../systems/QuestSystem";
import type { BuffSystem } from "../systems/BuffSystem";
import type { SocialSystem } from "../systems/SocialSystem";
import type { TradeSystem } from "../systems/TradeSystem";

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
    buff: BuffSystem;
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
