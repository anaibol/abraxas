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
