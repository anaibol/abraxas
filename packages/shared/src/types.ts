export type Direction = "up" | "down" | "left" | "right";
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
  durationMs?: number;
  aoeRadius?: number;
  buffStat?: string;
  buffAmount?: number;
  dotDamage?: number;
  dotIntervalMs?: number;
  dotDurationMs?: number;
}

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up:    { dx:  0, dy: -1 },
  down:  { dx:  0, dy:  1 },
  left:  { dx: -1, dy:  0 },
  right: { dx:  1, dy:  0 },
};
