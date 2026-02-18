import { ServerMessageType, ServerMessages } from "@abraxas/shared";
import type { BroadcastFn } from "@abraxas/shared";

export function broadcastDamage(
  broadcast: BroadcastFn,
  targetSessionId: string,
  amount: number,
  hpAfter: number,
  type: "physical" | "magic" | "dot" = "physical",
) {
  broadcast(ServerMessageType.Damage, {
    targetSessionId,
    amount,
    hpAfter,
    type,
  } as ServerMessages[ServerMessageType.Damage]);
}

export function broadcastDeath(
  broadcast: BroadcastFn,
  sessionId: string,
  killerSessionId?: string,
) {
  broadcast(ServerMessageType.Death, {
    sessionId,
    killerSessionId: killerSessionId ?? undefined,
  } as ServerMessages[ServerMessageType.Death]);
}

export function broadcastAttackHit(
  broadcast: BroadcastFn,
  sessionId: string,
  targetSessionId: string | null,
  dodged?: boolean,
) {
  broadcast(ServerMessageType.AttackHit, {
    sessionId,
    targetSessionId,
    dodged: !!dodged,
  } as ServerMessages[ServerMessageType.AttackHit]);
}

export function broadcastRespawn(
  broadcast: BroadcastFn,
  sessionId: string,
  tileX: number,
  tileY: number,
) {
  broadcast(ServerMessageType.Respawn, {
    sessionId,
    tileX,
    tileY,
  } as ServerMessages[ServerMessageType.Respawn]);
}

export function broadcastKillFeed(
  broadcast: BroadcastFn,
  killerSessionId: string | null,
  victimSessionId: string,
  killerName: string,
  victimName: string,
) {
  broadcast(ServerMessageType.KillFeed, {
    killerSessionId,
    victimSessionId,
    killerName,
    victimName,
  } as ServerMessages[ServerMessageType.KillFeed]);
}

export function broadcastLevelUp(
  broadcast: BroadcastFn,
  sessionId: string,
  level: number,
) {
  broadcast(ServerMessageType.LevelUp, {
    sessionId,
    level,
  } as ServerMessages[ServerMessageType.LevelUp]);
}

export function broadcastNotification(
  broadcast: BroadcastFn,
  message: string,
) {
  broadcast(ServerMessageType.Notification, { message } as ServerMessages[ServerMessageType.Notification]);
}

export function broadcastAttackStart(
  broadcast: BroadcastFn,
  sessionId: string,
  facing: number,
) {
  broadcast(ServerMessageType.AttackStart, { sessionId, facing } as ServerMessages[ServerMessageType.AttackStart]);
}

export function broadcastCastStart(
  broadcast: BroadcastFn,
  sessionId: string,
  spellId: string,
  targetTileX: number,
  targetTileY: number,
) {
  broadcast(ServerMessageType.CastStart, { sessionId, spellId, targetTileX, targetTileY } as ServerMessages[ServerMessageType.CastStart]);
}

export function broadcastCastHit(
  broadcast: BroadcastFn,
  sessionId: string,
  spellId: string,
  targetTileX: number,
  targetTileY: number,
  fxId?: number,
) {
  broadcast(ServerMessageType.CastHit, { sessionId, spellId, targetTileX, targetTileY, fxId } as ServerMessages[ServerMessageType.CastHit]);
}

export function broadcastBuffApplied(
  broadcast: BroadcastFn,
  sessionId: string,
  spellId: string,
  durationMs: number,
) {
  broadcast(ServerMessageType.BuffApplied, { sessionId, spellId, durationMs } as ServerMessages[ServerMessageType.BuffApplied]);
}

export function broadcastStealthApplied(
  broadcast: BroadcastFn,
  sessionId: string,
  durationMs: number,
) {
  broadcast(ServerMessageType.StealthApplied, { sessionId, durationMs } as ServerMessages[ServerMessageType.StealthApplied]);
}

export function broadcastHeal(
  broadcast: BroadcastFn,
  sessionId: string,
  amount: number,
  hpAfter: number,
) {
  broadcast(ServerMessageType.Heal, { sessionId, amount, hpAfter } as ServerMessages[ServerMessageType.Heal]);
}

export function broadcastStunApplied(
  broadcast: BroadcastFn,
  targetSessionId: string,
  durationMs: number,
) {
  broadcast(ServerMessageType.StunApplied, { targetSessionId, durationMs } as ServerMessages[ServerMessageType.StunApplied]);
}
