import { type ClientMessages, type ClientMessageType, ServerMessageType } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { logger } from "../logger";
import { HandlerUtils } from "./HandlerUtils";
import type { RoomContext } from "./RoomContext";

export class FastTravelHandlers {
  /**
   * Feature 88: Fast Travel
   * Teleports a player to a named waypoint on the current map.
   * Player must be alive and the waypoint must exist on this map.
   */
  static handleFastTravel(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.FastTravel],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    const waypoints = ctx.map.waypoints ?? [];
    const wp = waypoints.find((w) => w.id === data.waypointId);

    if (!wp) {
      HandlerUtils.sendError(client, "fast_travel.unknown_waypoint");
      return;
    }

    // Validate destination tile
    if (ctx.map.collision[wp.y]?.[wp.x] !== 0) {
      HandlerUtils.sendError(client, "fast_travel.blocked");
      return;
    }

    ctx.systems.movement.teleport(player, wp.x, wp.y);

    client.send(ServerMessageType.FastTravelUsed, {
      waypointId: wp.id,
      tileX: wp.x,
      tileY: wp.y,
    });

    client.send(ServerMessageType.Notification, {
      message: `Traveled to ${wp.label}.`,
    });

    logger.debug({
      intent: "fast_travel",
      sessionId: client.sessionId,
      waypointId: wp.id,
      tileX: wp.x,
      tileY: wp.y,
    });
  }
}
