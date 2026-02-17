export enum Direction {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3
}
export type ClassType = "warrior" | "wizard" | "archer" | "assassin" | "paladin" | "druid";
export type NpcType = "orc" | "skeleton" | "goblin" | "wolf";

export interface JoinOptions {
  name: string;
  classType: ClassType;
}

export interface TileMap {
  width: number;
  height: number;
  tileSize: number;
  collision: number[][];
  spawns: { x: number; y: number }[];
}

export interface ClassStats {
  hp: number;
  mana: number;
  str: number;
  agi: number;
  int: number;
  speedTilesPerSecond: number;
  meleeRange: number;
  meleeCooldownMs: number;
  meleeWindupMs: number;
  spells: string[];
  expReward?: number;
}

export type EntityStats = ClassStats;

export type SpellEffect = "damage" | "heal" | "dot" | "buff" | "stun" | "stealth" | "aoe";

export interface SpellDef {
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
}

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

export const DIRECTION_DELTA: Record<number, { dx: number; dy: number }> = {
  [Direction.UP]:    { dx:  0, dy: -1 },
  [Direction.DOWN]:  { dx:  0, dy:  1 },
  [Direction.LEFT]:  { dx: -1, dy:  0 },
  [Direction.RIGHT]: { dx:  1, dy:  0 },
};

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
}

export interface PlayerEntityState extends BaseEntityState {
  classType: ClassType;
  equipWeapon: string;
  equipShield: string;
  equipHelmet: string;
  type?: never;
}

export interface NpcEntityState extends BaseEntityState {
  type: NpcType;
  classType?: never;
}

export type EntityState = PlayerEntityState | NpcEntityState;

export type ServerMessages = {
  welcome: {
    sessionId: string;
    tileX: number;
    tileY: number;
    mapWidth: number;
    mapHeight: number;
    tileSize: number;
    collision: number[][];
  };
  attack_start: { sessionId: string; facing: Direction };
  attack_hit: { sessionId: string; targetSessionId: string | null; dodged?: boolean };
  cast_start: { sessionId: string; spellId: string; targetTileX: number; targetTileY: number };
  cast_hit: { sessionId: string; spellId: string; targetTileX: number; targetTileY: number; fxId: number };
  damage: { targetSessionId: string; amount: number; hpAfter: number; type: "physical" | "magic" | "dot" };
  heal: { sessionId: string; amount: number; hpAfter: number };
  death: { sessionId: string; killerSessionId?: string };
  respawn: { sessionId: string; tileX: number; tileY: number };
  buff_applied: { sessionId: string; spellId: string; durationMs: number };
  stealth_applied: { sessionId: string; durationMs: number };
  stun_applied: { targetSessionId: string; durationMs: number };
  kill_feed: { killerName: string; victimName: string; killerSessionId?: string; victimSessionId: string };
  chat: { senderId: string; senderName: string; message: string };
  notification: { message: string };
  item_used: { sessionId: string; itemId: string };
  invalid_target: undefined;
  pong: { serverTime: number };
  level_up: { sessionId: string; level: number };
};

export interface BroadcastFn {
  <T extends keyof ServerMessages>(type: T, data: ServerMessages[T]): void;
}

export interface StatBonuses {
  str: number;
  agi: number;
  int: number;
  hp: number;
  mana: number;
  armor: number;
}
