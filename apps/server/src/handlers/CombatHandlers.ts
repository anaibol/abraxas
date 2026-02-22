import { type ClientMessages, type ClientMessageType, ServerMessageType } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { HandlerUtils } from "./HandlerUtils";
import type { RoomContext } from "./RoomContext";

export class CombatHandlers {
  static handleMeditate(ctx: RoomContext, client: Client): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player || player.stunned) return;
    player.meditating = !player.meditating;
  }

  static handleAttack(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.Attack],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    if (player.spawnProtection) {
      player.spawnProtection = false;
      ctx.systems.buff.clearSpawnProtection(client.sessionId);
    }
    const { targetX, targetY } = HandlerUtils.resolveTarget(player, data);
    ctx.systems.combat.tryAttack(
      player,
      targetX,
      targetY,
      ctx.broadcast,
      Date.now(),
      (type, payload) => client.send(type, payload),
    );
  }

  static handleCast(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.Cast],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    if (player.spawnProtection) {
      player.spawnProtection = false;
      ctx.systems.buff.clearSpawnProtection(client.sessionId);
    }
    const { targetX, targetY } = HandlerUtils.resolveTarget(player, data);
    ctx.systems.combat.tryCast(
      player,
      data.abilityId,
      targetX,
      targetY,
      ctx.broadcast,
      Date.now(),
      (type, payload) => client.send(type, payload),
    );
  }
}
