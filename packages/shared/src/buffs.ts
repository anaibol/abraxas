export interface Buff {
  id: string;
  stat: string;
  amount: number;
  expiresAt: number;
  overrideBodyId?: number;
  overrideHeadId?: number;
}

export interface DoT {
  id: string;
  sourceSessionId: string;
  damage: number;
  intervalMs: number;
  expiresAt: number;
  lastTickAt: number;
}

export interface PlayerBuffState {
  buffs: Buff[];
  dots: DoT[];
  stunnedUntil: number;
  stealthedUntil: number;
  spawnProtectedUntil: number;
}
