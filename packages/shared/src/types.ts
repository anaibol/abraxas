export enum Direction {
	UP = 0,
	DOWN = 1,
	LEFT = 2,
	RIGHT = 3,
}

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
	[Direction.UP]: { dx: 0, dy: -1 },
	[Direction.DOWN]: { dx: 0, dy: 1 },
	[Direction.LEFT]: { dx: -1, dy: 0 },
	[Direction.RIGHT]: { dx: 1, dy: 0 },
};
export const EQUIPMENT_SLOTS = [
	"weapon",
	"armor",
	"shield",
	"helmet",
	"ring",
] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export type ClassType = "WARRIOR" | "MAGE" | "ROGUE" | "CLERIC" | "RANGER" | "PALADIN";
export type NpcType =
	| "orc"
	| "skeleton"
	| "goblin"
	| "wolf"
	| "merchant"
	| "spider"
	| "ghost"
	| "lich"
	| "banker";

export enum NpcState {
	IDLE = "idle",
	PATROL = "patrol",
	CHASE = "chase",
	ATTACK = "attack",
	FLEE = "flee",
	RETURN = "return",
}

export interface JoinOptions {
	charId: string;
	classType: ClassType;
}

export type QuestType = "kill" | "collect" | "talk";
export type QuestStatus =
	| "NOT_STARTED"
	| "IN_PROGRESS"
	| "COMPLETED"
	| "TURNED_IN";

export interface QuestRequirement {
	type: QuestType;
	target: string; // Enemy type or Item ID or NPC ID
	count: number;
}

export interface QuestReward {
	exp: number;
	gold: number;
	items?: { itemId: string; quantity: number }[];
}

export type Quest = {
	id: string;
	title: string;
	description: string;
	npcId: string;
	requirements: QuestRequirement[];
	rewards: QuestReward;
};

export interface PlayerQuestState {
	questId: string;
	status: QuestStatus;
	progress: Record<string, number>; // Maps requirement target to current count
}
export interface Warp {
	x: number;
	y: number;
	targetMap: string;
	targetX: number;
	targetY: number;
}

export interface TileMap {
	width: number;
	height: number;
	tileSize: number;
	collision: number[][];
	spawns: { x: number; y: number }[];
	npcCount?: number;
	merchantCount?: number;
	npcs?: { type: NpcType; x: number; y: number }[];
	warps?: Warp[];
}

/** Stats shared by all character types (players and NPCs). */
export interface NpcStats {
	hp: number;
	str: number;
	agi: number;
	int: number;
	speedTilesPerSecond: number;
	meleeRange: number;
	meleeCooldownMs: number;
	meleeWindupMs: number;
	armor: number;
	spells: string[];
	expReward?: number;
	/** NPC will not aggro players and does not move (e.g. merchants). */
	passive?: boolean;
	/** NPC flees when HP drops below 25%. */
	fleesWhenLow?: boolean;
}

/** Stats for player classes — extends NpcStats with a required mana pool. */
export interface ClassStats extends NpcStats {
	mana: number;
}

export type SpellEffect =
	| "damage"
	| "heal"
	| "dot"
	| "buff"
	/** Negative stat modifier applied to an enemy (slow, weaken, vulnerability). */
	| "debuff"
	| "stun"
	| "stealth"
	| "aoe"
	/** Deals damage AND heals the caster for a portion of that damage. */
	| "leech"
	/** Heals all same-faction entities within aoeRadius of the target tile. */
	| "aoe_heal"
	| "summon";

export type Spell = {
	id: string;
	rangeTiles: number;
	manaCost: number;
	baseDamage: number;
	scalingStat: "str" | "agi" | "int";
	scalingRatio: number;
	cooldownMs: number;
	windupMs: number;
	effect: SpellEffect;
	key: string;
	fxId: number;
	durationMs?: number;
	aoeRadius?: number;
	buffStat?: string;
	buffAmount?: number;
	dotDamage?: number;
	dotIntervalMs?: number;
	dotDurationMs?: number;
	/** Fraction of damage returned as healing to the caster (used by "leech" effect). */
	leechRatio?: number;
};

export interface InventoryEntry {
	itemId: string;
	quantity: number;
	slotIndex: number;
}

export interface EquipmentData {
	weapon: string;
	shield: string;
	helmet: string;
	armor: string;
	ring: string;
}

export interface TradeOffer {
	gold: number;
	items: { itemId: string; quantity: number }[];
	confirmed: boolean;
}

export interface TradeState {
	tradeId: string;
	alice: {
		sessionId: string;
		name: string;
		offer: TradeOffer;
	};
	bob: {
		sessionId: string;
		name: string;
		offer: TradeOffer;
	};
}

export interface BaseEntityState {
	sessionId: string;
	tileX: number;
	tileY: number;
	name: string;
	facing: Direction;
	hp: number;
	maxHp: number;
	alive: boolean;
	stealthed: boolean;
	stunned: boolean;
	spawnProtection: boolean;
}

export interface PlayerEntityState extends BaseEntityState {
	classType: ClassType;
	mana: number;
	maxMana: number;
	equipWeapon: string;
	equipShield: string;
	equipHelmet: string;
	meditating: boolean;
	type?: never;
}

export interface NpcEntityState extends BaseEntityState {
	type: NpcType;
	classType?: never;
}

export type EntityState = PlayerEntityState | NpcEntityState;

export enum ServerMessageType {
	Welcome = "welcome",
	AttackStart = "attack_start",
	AttackHit = "attack_hit",
	CastStart = "cast_start",
	CastHit = "cast_hit",
	Damage = "damage",
	Heal = "heal",
	Death = "death",
	Respawn = "respawn",
	BuffApplied = "buff_applied",
	StealthApplied = "stealth_applied",
	StunApplied = "stun_applied",
	KillFeed = "kill_feed",
	Chat = "chat",
	Notification = "notification",
	ItemUsed = "item_used",
	InvalidTarget = "invalid_target",
	LevelUp = "level_up",
	OpenShop = "open_shop",
	BuyItem = "buy_item",
	SellItem = "sell_item",
	Error = "error",
	FriendRequest = "friend_request",
	FriendInvited = "friend_invited",
	FriendAccept = "friend_accept",
	FriendRemove = "friend_remove",
	FriendUpdate = "friend_update",
	PartyInvite = "party_invite",
	PartyInvited = "party_invited",
	PartyAccept = "party_accept",
	PartyLeave = "party_leave",
	PartyKick = "party_kick",
	PartyUpdate = "party_update",
	Warp = "warp",
	Audio = "audio",
	QuestList = "quest_list",
	QuestUpdate = "quest_update",
	QuestAvailable = "quest_available",
	OpenDialogue = "open_dialogue",

	// Trading
	TradeRequested = "trade_requested",
	TradeStarted = "trade_started",
	TradeStateUpdate = "trade_state_update",
	TradeCompleted = "trade_completed",
	TradeCancelled = "trade_cancelled",

	// Bank
	BankOpened = "bank_opened",
	BankSync = "bank_sync",
}

export enum ChatChannel {
	Global = "global",
	Party = "party",
	Whisper = "whisper",
	System = "system",
}

export type ServerMessages = {
	[ServerMessageType.Welcome]: {
		sessionId: string;
		tileX: number;
		tileY: number;
		mapWidth: number;
		mapHeight: number;
		tileSize: number;
		collision: number[][];
	};
	[ServerMessageType.AttackStart]: { sessionId: string; facing: Direction };
	[ServerMessageType.AttackHit]: {
		sessionId: string;
		targetSessionId: string | null;
		dodged?: boolean;
	};
	[ServerMessageType.CastStart]: {
		sessionId: string;
		spellId: string;
		targetTileX: number;
		targetTileY: number;
	};
	[ServerMessageType.CastHit]: {
		sessionId: string;
		spellId: string;
		targetTileX: number;
		targetTileY: number;
		fxId: number;
	};
	[ServerMessageType.Damage]: {
		targetSessionId: string;
		amount: number;
		hpAfter: number;
		type: "physical" | "magic" | "dot";
	};
	[ServerMessageType.Heal]: {
		sessionId: string;
		amount: number;
		hpAfter: number;
	};
	[ServerMessageType.Death]: { sessionId: string; killerSessionId?: string };
	[ServerMessageType.Respawn]: {
		sessionId: string;
		tileX: number;
		tileY: number;
	};
	[ServerMessageType.BuffApplied]: {
		sessionId: string;
		spellId: string;
		durationMs: number;
	};
	[ServerMessageType.StealthApplied]: { sessionId: string; durationMs: number };
	[ServerMessageType.StunApplied]: {
		targetSessionId: string;
		durationMs: number;
	};
	[ServerMessageType.KillFeed]: {
		killerName: string;
		victimName: string;
		killerSessionId?: string;
		victimSessionId: string;
	};
	[ServerMessageType.Chat]: {
		senderId: string;
		senderName: string;
		message: string;
		channel?: ChatChannel;
	};
	[ServerMessageType.Notification]: {
		message: string;
		templateData?: Record<string, any>;
	};
	[ServerMessageType.ItemUsed]: { sessionId: string; itemId: string };
	[ServerMessageType.InvalidTarget]: null;
	[ServerMessageType.LevelUp]: { sessionId: string; level: number };
	[ServerMessageType.OpenShop]: { npcId: string; inventory: string[] };
	[ServerMessageType.BuyItem]: { itemId: string; quantity: number };
	[ServerMessageType.SellItem]: { itemId: string; quantity: number };
	[ServerMessageType.Error]: { message: string; templateData?: Record<string, any> };
	[ServerMessageType.FriendRequest]: { targetName: string };
	[ServerMessageType.FriendInvited]: {
		requesterId: string;
		requesterName: string;
	};
	[ServerMessageType.FriendAccept]: { requesterId: string };
	[ServerMessageType.FriendRemove]: { friendId: string };
	[ServerMessageType.FriendUpdate]: {
		friends: { id: string; name: string; online: boolean }[];
		pendingRequests: { id: string; name: string }[];
	};
	[ServerMessageType.PartyInvite]: { targetSessionId: string };
	[ServerMessageType.PartyInvited]: { partyId: string; inviterName: string };
	[ServerMessageType.PartyAccept]: { partyId: string };
	[ServerMessageType.PartyLeave]: {};
	[ServerMessageType.PartyKick]: { targetSessionId: string };
	[ServerMessageType.PartyUpdate]: {
		partyId: string;
		leaderId: string;
		members: { sessionId: string; name: string }[];
	};
	[ServerMessageType.Warp]: {
		targetMap: string;
		targetX: number;
		targetY: number;
	};
	[ServerMessageType.Audio]: { sessionId: string; data: ArrayBuffer };
	[ServerMessageType.QuestList]: { quests: PlayerQuestState[] };
	[ServerMessageType.QuestUpdate]: { quest: PlayerQuestState };
	[ServerMessageType.QuestAvailable]: { npcId: string; questIds: string[] };
	[ServerMessageType.OpenDialogue]: {
		npcId: string;
		text: string;
		options: { text: string; action: string; data?: unknown }[];
	};

	// Trading
	[ServerMessageType.TradeRequested]: {
		requesterSessionId: string;
		requesterName: string;
	};
	[ServerMessageType.TradeStarted]: {
		targetSessionId: string;
		targetName: string;
	};
	[ServerMessageType.TradeStateUpdate]: TradeState;
	[ServerMessageType.TradeCompleted]: {};
	[ServerMessageType.TradeCancelled]: { reason: string };

	// Bank
	[ServerMessageType.BankOpened]: {};
	[ServerMessageType.BankSync]: { items: InventoryEntry[] };
};

export type WelcomeData = ServerMessages[ServerMessageType.Welcome];

export enum ClientMessageType {
	Move = "move",
	Attack = "attack",
	Cast = "cast",
	Pickup = "pickup",
	Equip = "equip",
	Unequip = "unequip",
	UseItem = "use_item",
	DropItem = "drop_item",
	Chat = "chat",
	Audio = "audio",
	PartyInvite = "party_invite",
	PartyAccept = "party_accept",
	PartyLeave = "party_leave",
	PartyKick = "party_kick",
	FriendRequest = "friend_request",
	FriendAccept = "friend_accept",
	Interact = "interact",
	BuyItem = "buy_item",
	SellItem = "sell_item",
	QuestAccept = "quest_accept",
	QuestComplete = "quest_complete",

	// Trading
	TradeRequest = "trade_request",
	TradeAccept = "trade_accept",
	TradeOfferUpdate = "trade_offer_update",
	TradeConfirm = "trade_confirm",
	TradeCancel = "trade_cancel",

	// Bank
	BankDeposit = "bank_deposit",
	BankWithdraw = "bank_withdraw",
	BankClose = "bank_close",

	Meditate = "meditate",
}

export type ClientMessages = {
	[ClientMessageType.Move]: { direction: Direction };
	[ClientMessageType.Attack]: { targetTileX?: number; targetTileY?: number };
	[ClientMessageType.Cast]: {
		spellId: string;
		targetTileX: number;
		targetTileY: number;
	};
	[ClientMessageType.Pickup]: { dropId: string };
	[ClientMessageType.Equip]: { itemId: string };
	[ClientMessageType.Unequip]: { slot: EquipmentSlot };
	[ClientMessageType.UseItem]: { itemId: string };
	[ClientMessageType.DropItem]: { itemId: string; quantity?: number };
	[ClientMessageType.Chat]: { message: string };
	[ClientMessageType.Audio]: ArrayBuffer;
	[ClientMessageType.PartyInvite]: { targetSessionId: string };
	[ClientMessageType.PartyAccept]: { partyId: string };
	[ClientMessageType.PartyLeave]: {};
	[ClientMessageType.PartyKick]: { targetSessionId: string };
	[ClientMessageType.FriendRequest]: { targetName: string };
	[ClientMessageType.FriendAccept]: { requesterId: string };
	[ClientMessageType.Interact]: { npcId: string };
	[ClientMessageType.BuyItem]: { itemId: string; quantity: number };
	[ClientMessageType.SellItem]: {
		itemId: string;
		quantity: number;
		npcId?: string;
	};
	[ClientMessageType.QuestAccept]: { questId: string };
	[ClientMessageType.QuestComplete]: { questId: string };

	// Trading
	[ClientMessageType.TradeRequest]: { targetSessionId: string };
	[ClientMessageType.TradeAccept]: { requesterSessionId: string };
	[ClientMessageType.TradeOfferUpdate]: {
		gold: number;
		items: { itemId: string; quantity: number }[];
	};
	[ClientMessageType.TradeConfirm]: {};
	[ClientMessageType.TradeCancel]: {};

	// Bank
	[ClientMessageType.BankDeposit]: {
		itemId: string;
		quantity: number;
		slotIndex: number;
	};
	[ClientMessageType.BankWithdraw]: {
		itemId: string;
		quantity: number;
		bankSlotIndex: number;
	};
	[ClientMessageType.BankClose]: {};

	[ClientMessageType.Meditate]: {};
};

export interface BroadcastFn {
	<T extends keyof ServerMessages>(
		type: T,
		data: ServerMessages[T],
		options?: { except?: any; exceptSessionId?: string },
	): void;
}

export interface StatBonuses {
	str: number;
	agi: number;
	int: number;
	hp: number;
	mana: number;
	armor: number;
}
