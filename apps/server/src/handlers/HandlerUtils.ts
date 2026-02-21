import {
  DIRECTION_DELTA,
  MathUtils,
  type PlayerQuestState,
  QUESTS,
  ServerMessageType,
} from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import type { Player } from "../schema/Player";
import type { RoomContext } from "./RoomContext";

export class HandlerUtils {
  /** Returns the player if they exist and are alive, otherwise `null`. */
  static getActivePlayer(ctx: RoomContext, client: Client): Player | null {
    const player = ctx.state.players.get(client.sessionId);
    return player?.alive ? player : null;
  }

  /** Sends a typed error message to the client. */
  static sendError(client: Client, message: string): void {
    client.send(ServerMessageType.Error, { message });
  }

  /** Sends a silent hint to the client (console-only, no toast). */
  static sendHint(client: Client, message: string): void {
    client.send(ServerMessageType.Error, { message, silent: true });
  }

  /** Resolves the target tile from explicit coords or falls back to the tile in front of the player. */
  static resolveTarget(
    player: Player,
    data: { targetTileX?: number; targetTileY?: number },
  ): { targetX: number; targetY: number } {
    if (data.targetTileX !== undefined && data.targetTileY !== undefined) {
      return { targetX: data.targetTileX, targetY: data.targetTileY };
    }
    const delta = DIRECTION_DELTA[player.facing];
    return { targetX: player.tileX + delta.dx, targetY: player.tileY + delta.dy };
  }

  /**
   * Returns true if `a` is within `range` tiles of `b` (Manhattan distance).
   * Sends an error to the client and returns false if not.
   */
  static assertInRange(
    client: Client,
    a: { tileX: number; tileY: number },
    b: { tileX: number; tileY: number },
    range: number,
    errorKey: string,
  ): boolean {
    const dist = MathUtils.chebyshevDist({ x: a.tileX, y: a.tileY }, { x: b.tileX, y: b.tileY });
    if (dist > range) {
      HandlerUtils.sendHint(client, errorKey);
      return false;
    }
    return true;
  }

  /** Sends quest update notifications for a set of updated quest states. */
  static sendQuestUpdates(client: Client, updatedQuests: PlayerQuestState[]): void {
    for (const quest of updatedQuests) {
      client.send(ServerMessageType.QuestUpdate, { quest });
      if (quest.status === "COMPLETED") {
        const def = QUESTS[quest.questId];
        client.send(ServerMessageType.Notification, {
          message: "quest.completed",
          templateData: { title: def.title, exp: def.rewards.exp, gold: def.rewards.gold },
        });
      }
    }
  }
}
