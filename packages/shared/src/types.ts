export enum Direction {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3,
}

export enum EntityType {
  PLAYER = "player",
  NPC = "npc",
}

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  [Direction.UP]: { dx: 0, dy: -1 },
  [Direction.DOWN]: { dx: 0, dy: 1 },
  [Direction.LEFT]: { dx: -1, dy: 0 },
  [Direction.RIGHT]: { dx: 1, dy: 0 },
};
export const EQUIPMENT_SLOTS = ["weapon", "armor", "shield", "helmet", "ring", "mount"] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export enum DropType {
  ITEM = "item",
  GOLD = "gold",
}

export enum ItemRarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary",
}

export enum StatType {
  STR = "str",
  AGI = "agi",
  INT = "int",
  HP = "hp",
  MANA = "mana",
  ARMOR = "armor",
  STUN = "stun",
  INVULNERABLE = "invulnerable",
  RAGE = "rage",
  ENERGY = "energy",
  FOCUS = "focus",
  HOLY_POWER = "holyPower",
  COMBO_POINTS = "comboPoints",
  CRIT_CHANCE = "critChance",
  CRIT_MULTIPLIER = "critMultiplier",
  HIT_RATING = "hitRating",
  ARMOR_PEN = "armorPen",
  DODGE_CHANCE = "dodgeChance",
  PARRY_CHANCE = "parryChance",
  BLOCK_CHANCE = "blockChance",
}

export interface ItemAffix {
  type: string;
  value: number;
  stat: StatType;
}

export interface ItemInstanceData {
  id: string;
  itemDefId: string;
  rarity: ItemRarity;
  nameOverride?: string;
  affixes: ItemAffix[];
}
export type ClassType =
  | "WARRIOR"
  | "MAGE"
  | "ROGUE"
  | "CLERIC"
  | "RANGER"
  | "PALADIN"
  | "NECROMANCER"
  | "DRUID";
export type BarkTrigger = "aggro" | "low_hp" | "kill" | "idle";

export type NpcType =
  | "orc"
  | "skeleton"
  | "goblin"
  | "wolf"
  | "merchant"
  | "spider"
  | "ghost"
  | "lich"
  | "banker"
  | "zombie"
  | "troll"
  | "bat"
  | "dark_knight"
  | "horse"
  | "skeleton_archer"
  | "vampire"
  | "gargoyle"
  | "elephant"
  | "dragon"
  | "bear"
  | "mana_spring"
  | "explosive_trap"
  | "phantom_pet"
  | "decoy";

export enum NpcState {
  IDLE = "idle",
  PATROL = "patrol",
  CHASE = "chase",
  ATTACK = "attack",
  FLEE = "flee",
  RETURN = "return",
  FOLLOW = "follow",
}

export interface JoinOptions {
  charId: string;
  classType: ClassType;
}

export type QuestType = "kill" | "collect" | "talk";
export type QuestStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "TURNED_IN";

export interface QuestRequirement {
  type: QuestType;
  target: string; // Enemy type or Item ID or NPC ID
  count: number;
}

export interface QuestReward {
  exp: number;
  gold: number;
  items: { itemId: string; quantity: number }[];
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
export interface FastTravelWaypoint {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface MinimapMarker {
  id: string;
  tileX: number;
  tileY: number;
  type: "quest" | "waypoint" | "event";
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
  /** Visual tile type per cell: 0=grass, 1=wall, 2=tree, 3=water */
  tileTypes?: number[][];
  spawns: { x: number; y: number }[];
  newbieSpawns?: { x: number; y: number }[];
  safeZones?: { x: number; y: number; w: number; h: number }[];
  npcCount?: number;
  merchantCount?: number;
  npcs?: { type: NpcType; x: number; y: number }[];
  warps?: Warp[];
  waypoints?: FastTravelWaypoint[];
}

/** Stats shared by all character types (players and NPCs). */
export interface CharStats {
  hp: number;
  str: number;
  agi: number;
  int: number;
  speedTilesPerSecond: number;
  /** Range in tiles for the auto-attack. Values > 1 use ranged (AGI-scaling) formula. */
  attackRange: number;
  attackCooldownMs: number;
  attackWindupMs: number;
  armor: number;

  // Secondary Offensive/Defensive Stats
  critChance?: number;
  critMultiplier?: number;
  hitRating?: number;
  armorPen?: number;
  dodgeChance?: number;
  parryChance?: number;
  blockChance?: number;

  abilities: string[];
  passive?: boolean;
  fleesWhenLow?: boolean;
  abilityCastChance?: number;
  rareSpawn?: boolean;
}

export interface NpcStats extends CharStats {
  /** NPC will not aggro players and does not move (e.g. merchants). */
  passive: boolean;
  /** NPC flees when HP drops below 25%. */
  fleesWhenLow: boolean;
  /**
   * Probability (0–1) that the NPC will attempt an ability use on any given
   * attack tick when the ability is off cooldown.
   */
  abilityCastChance: number;
  /**
   * When true the NPC is excluded from the random world-spawn pool.
   */
  rareSpawn: boolean;
  expReward?: number;
  /**
   * Which NPC type is spawned when this NPC uses a "summon" ability.
   */
  summonType?: NpcType;
  /** Minimum recommended player level for this NPC's difficulty bracket. */
  minLevel?: number;
  /** Maximum recommended player level for this NPC's difficulty bracket. */
  maxLevel?: number;

  // ── Feature 31: Per-NPC aggro radius ──────────────────────────────────────
  /** Override the global AGGRO_RANGE for this NPC type. */
  aggroRange?: number;

  // ── Feature 32: Bark system ───────────────────────────────────────────────
  /** Lines spoken by the NPC on various triggers (aggro, low_hp, kill, idle). */
  barks?: Partial<Record<BarkTrigger, string[]>>;

  // ── Feature 29: Boss mechanics ────────────────────────────────────────────
  /** HP fraction (0–1) at which boss enters phase 2. Only applies to bosses. */
  bossPhaseThreshold?: number;
  /** Additional abilities unlocked when boss enters phase 2. */
  phaseAbilities?: string[];

  // ── Feature 34: Elite/Rare spawn timer ───────────────────────────────────
  /** How long after death before this rare NPC respawns (ms). Requires rareSpawn=true. */
  rareSpawnIntervalMs?: number;
}

/** Stats for player classes — extends CharStats with a required mana pool. */
export interface ClassStats extends CharStats {
  mana: number;
  maxCompanions: number;
}

export enum DamageSchool {
  PHYSICAL = "physical",
  MAGICAL = "magical",
}

export type AbilityEffect =
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
  | "summon"
  /** Removes stun from a target ally. */
  | "cleanse"
  /** Removes stealth from all enemies in aoeRadius. */
  | "reveal";

export type Ability = {
  id: string;
  key: string;
  requiredLevel: number;
  manaCost: number;
  baseDamage: number;
  scalingStat: StatType;
  scalingRatio: number;
  cooldownMs: number;
  windupMs: number;
  effect: string | AbilityEffect | StatType;
  /**
   * Determines the damage formula and mitigation used when this ability deals damage.
   * "physical" uses armor reduction (and dodge for melee-range abilities).
   * "magical" uses INT-based magic resistance.
   */
  damageSchool: DamageSchool;
  fxId: number;
  rangeTiles: number;
  durationMs?: number;
  aoeRadius: number;
  buffStat?: StatType;
  buffAmount?: number;
  summonType?: string;
  leechRatio?: number;
  dotDamage?: number;
  dotIntervalMs?: number;
  dotDurationMs?: number;
  appearanceOverride?: { bodyId: number; headId: number };
  soulCost?: number;
  rageCost?: number;
  energyCost?: number;
  focusCost?: number;
  holyPowerCost?: number;
  comboPointsCost?: number;
  comboPointsGain?: number;

  executeThreshold?: number;     // 0.0 to 1.0. Applies executeMultiplier to damage if target HP is below this %.
  executeMultiplier?: number;    // Multiplier for damage when in execute threshold.
  comboDamageMultiplier?: number;// Additional damage multiplier per combo point spent.
};

export interface InventoryEntry {
  itemId: string;
  quantity: number;
  slotIndex: number;
  rarity: ItemRarity;
  nameOverride?: string;
  affixes: ItemAffix[];
}

export interface EquipmentData {
  weapon: string;
  shield: string;
  helmet: string;
  armor: string;
  ring: string;
  mount: string;
}

export interface TradeOffer {
  gold: number;
  items: {
    itemId: string;
    quantity: number;
    slotIndex: number;
    rarity: ItemRarity;
    nameOverride?: string;
    affixes: ItemAffix[];
  }[];
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
  overrideBodyId?: number;
  overrideHeadId?: number;
}

export interface PlayerEntityState extends BaseEntityState {
  classType: ClassType;
  mana: number;
  maxMana: number;
  /** Public equip item IDs exposed by equipWeaponId / equipShieldId etc. on the schema */
  equipWeaponId: string;
  equipShieldId: string;
  equipHelmetId: string;
  equipArmorId: string;
  equipRingId: string;
  equipMountId: string;
  meditating: boolean;
  guildId?: string;
  pvpEnabled: boolean;
  type?: never;
}

export interface NpcEntityState extends BaseEntityState {
  /** EntityType discriminator — always "npc" */
  type?: never;
  /** The NPC species (e.g. "orc", "wolf") — maps to Npc.npcType on the server */
  npcType: NpcType;
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
  GroupInvite = "group_invite",
  GroupInvited = "group_invited",
  GroupAccept = "group_accept",
  GroupLeave = "group_leave",
  GroupKick = "group_kick",
  GroupUpdate = "group_update",
  Warp = "warp",
  Audio = "audio",
  QuestList = "quest_list",
  QuestUpdate = "quest_update",
  QuestAvailable = "quest_available",
  OpenDialogue = "open_dialogue",

  // NPC
  NpcBark = "npc_bark",
  WorldEventStart = "world_event_start",
  WorldEventEnd = "world_event_end",
  WorldEventProgress = "world_event_progress",

  // Fast Travel
  FastTravelUsed = "fast_travel_used",

  // Trading
  TradeRequested = "trade_requested",
  TradeStarted = "trade_started",
  TradeStateUpdate = "trade_state_update",
  TradeCompleted = "trade_completed",
  TradeCancelled = "trade_cancelled",

  // Bank
  BankOpened = "bank_opened",
  BankSync = "bank_sync",

  // Guild
  GuildInvited = "guild_invited",
  GuildUpdate = "guild_update",
}

export enum ChatChannel {
  Global = "global",
  Group = "group",
  Guild = "guild",
  Whisper = "whisper",
  System = "system",
}

export type ServerMessages = {
  [ServerMessageType.Welcome]: {
    sessionId: string;
    roomMapName: string;
    tileX: number;
    tileY: number;
    mapWidth: number;
    mapHeight: number;
    tileSize: number;
    collision: number[][];
    tileTypes?: number[][];
    warps?: Warp[];
    role?: string;
    safeZones?: { x: number; y: number; w: number; h: number }[];
  };
  [ServerMessageType.AttackStart]: {
    sessionId: string;
    facing: Direction;
    targetTileX?: number;
    targetTileY?: number;
  };
  [ServerMessageType.AttackHit]: {
    sessionId: string;
    targetSessionId: string | null;
    dodged?: boolean;
  };
  [ServerMessageType.CastStart]: {
    sessionId: string;
    abilityId: string;
    targetTileX: number;
    targetTileY: number;
  };
  [ServerMessageType.CastHit]: {
    sessionId: string;
    abilityId: string;
    targetTileX: number;
    targetTileY: number;
    fxId: number;
  };
  [ServerMessageType.Damage]: {
    targetSessionId: string;
    amount: number;
    hpAfter: number;
    type: "physical" | "magic" | "dot";
    crit?: boolean;
    blocked?: boolean;
    parried?: boolean;
    dodged?: boolean;
    glancing?: boolean;
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
    abilityId: string;
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
    templateData?: Record<string, unknown>;
  };
  [ServerMessageType.ItemUsed]: { sessionId: string; itemId: string };
  [ServerMessageType.InvalidTarget]: null;
  [ServerMessageType.LevelUp]: { sessionId: string; level: number };
  [ServerMessageType.OpenShop]: { npcId: string; inventory: string[] };
  [ServerMessageType.BuyItem]: { itemId: string; quantity: number };
  [ServerMessageType.SellItem]: { itemId: string; quantity: number };
  [ServerMessageType.Error]: {
    message: string;
    templateData?: Record<string, unknown>;
    silent?: boolean;
  };
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
  [ServerMessageType.GroupInvite]: { targetSessionId: string };
  [ServerMessageType.GroupInvited]: { groupId: string; inviterName: string };
  [ServerMessageType.GroupAccept]: { groupId: string };
  [ServerMessageType.GroupLeave]: {};
  [ServerMessageType.GroupKick]: { targetSessionId: string };
  [ServerMessageType.GroupUpdate]: {
    groupId: string;
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

  // NPC
  [ServerMessageType.NpcBark]: { npcId: string; text: string };
  [ServerMessageType.WorldEventStart]: { eventId: string; name: string; description: string; durationMs: number; totalNpcs: number };
  [ServerMessageType.WorldEventEnd]: { eventId: string };
  [ServerMessageType.WorldEventProgress]: { eventId: string; npcsDead: number; npcsTotalCount: number };

  // Fast Travel
  [ServerMessageType.FastTravelUsed]: { waypointId: string; tileX: number; tileY: number };

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

  // Guild
  [ServerMessageType.GuildInvited]: { guildId: string; inviterName: string; guildName: string };
  [ServerMessageType.GuildUpdate]: {
    guildId: string;
    name: string;
    members: {
      sessionId?: string;
      name: string;
      role: "LEADER" | "OFFICER" | "MEMBER";
      online: boolean;
    }[];
  };
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
  GroupInvite = "group_invite",
  GroupAccept = "group_accept",
  GroupLeave = "group_leave",
  GroupKick = "group_kick",
  FriendRequest = "friend_request",
  FriendAccept = "friend_accept",
  FriendRemove = "friend_remove",
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

  // PvP
  TogglePvP = "toggle_pvp",

  // Guilds
  GuildCreate = "guild_create",
  GuildInvite = "guild_invite",
  GuildAccept = "guild_accept",
  GuildLeave = "guild_leave",
  GuildKick = "guild_kick",
  GuildPromote = "guild_promote",
  GuildDemote = "guild_demote",

  Meditate = "meditate",
  Tame = "tame",

  // Fast Travel
  FastTravel = "fast_travel",

  // GM commands
  GMTeleport = "gm_teleport",
}

export type ClientMessages = {
  [ClientMessageType.Move]: { direction: Direction };
  [ClientMessageType.Attack]: { targetTileX?: number; targetTileY?: number };
  [ClientMessageType.Cast]: {
    abilityId: string;
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
  [ClientMessageType.GroupInvite]: { targetSessionId: string };
  [ClientMessageType.GroupAccept]: { groupId: string };
  [ClientMessageType.GroupLeave]: {};
  [ClientMessageType.GroupKick]: { targetSessionId: string };
  [ClientMessageType.FriendRequest]: { targetName: string };
  [ClientMessageType.FriendAccept]: { requesterId: string };
  [ClientMessageType.FriendRemove]: { friendId: string };
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
    items: { itemId: string; quantity: number; slotIndex: number }[];
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

  // PvP
  [ClientMessageType.TogglePvP]: {};

  // Guilds
  [ClientMessageType.GuildCreate]: { name: string };
  [ClientMessageType.GuildInvite]: { targetName: string };
  [ClientMessageType.GuildAccept]: { guildId: string };
  [ClientMessageType.GuildLeave]: {};
  [ClientMessageType.GuildKick]: { targetName: string };
  [ClientMessageType.GuildPromote]: { targetName: string };
  [ClientMessageType.GuildDemote]: { targetName: string };

  [ClientMessageType.Meditate]: {};
  [ClientMessageType.Tame]: { targetSessionId: string };

  // Fast Travel
  [ClientMessageType.FastTravel]: { waypointId: string };

  // GM commands
  [ClientMessageType.GMTeleport]: { tileX: number; tileY: number };
};

export type BroadcastFn<TClient = unknown> = <T extends keyof ServerMessages>(
  type: T,
  data: ServerMessages[T],
  options?: { except?: TClient | TClient[]; exceptSessionId?: string },
) => void;

export interface StatBonuses {
  str: number;
  agi: number;
  int: number;
  hp: number;
  mana: number;
  armor: number;
  critChance?: number;
  critMultiplier?: number;
  hitRating?: number;
  armorPen?: number;
  dodgeChance?: number;
  parryChance?: number;
  blockChance?: number;
}

// ── Feature 35: World Events ──────────────────────────────────────────────────

/** A timed world event that spawns waves of NPCs on a recurring schedule. */
export interface WorldEvent {
  /** Unique identifier for this event type. */
  id: string;
  /** Display name shown to players. */
  name: string;
  /** Broadcast description when the event begins. */
  description: string;
  /** NPC types + count to spawn when the event starts. */
  spawns: { npcType: NpcType; count: number }[];
  /** How long the event lasts (ms). */
  durationMs: number;
  /** How often the event recurs (ms between event ends and next start). */
  intervalMs: number;
}
