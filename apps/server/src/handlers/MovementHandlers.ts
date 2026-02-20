import { type ClientMessages, type ClientMessageType, ServerMessageType } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { HandlerUtils } from "./HandlerUtils";
import type { RoomContext } from "./RoomContext";

export class MovementHandlers {
  static handleMove(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.Move],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player || player.stunned) return;

    const result = ctx.systems.movement.tryMove(
      player,
      data.direction,
      ctx.map,
      Date.now(),
      ctx.state.tick,
      ctx.roomId,
    );

    if (result.success) {
      if (player.meditating) {
        player.meditating = false;
      }
      if (result.warp) {
        if (result.warp.targetMap === ctx.roomId) {
          ctx.systems.movement.teleport(player, result.warp.targetX, result.warp.targetY);
        } else {
          client.send(ServerMessageType.Warp, {
            targetMap: result.warp.targetMap,
            targetX: result.warp.targetX,
            targetY: result.warp.targetY,
          });
        }
      }
    }
  }

  static handleGMTeleport(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.GMTeleport],
  ) {
    const player = ctx.state.players.get(client.sessionId);
    if (!player) return;

    if (player.role !== "GM" && player.role !== "ADMIN") {
      HandlerUtils.sendError(client, "gm.unauthorized");
      return;
    }

    const { tileX, tileY } = data;

    if (
      tileX < 0 ||
      tileX >= ctx.map.width ||
      tileY < 0 ||
      tileY >= ctx.map.height ||
      ctx.map.collision[tileY]?.[tileX] === 1
    ) {
      HandlerUtils.sendError(client, "gm.invalid_tile");
      return;
    }

    ctx.systems.movement.teleport(player, tileX, tileY);

    client.send(ServerMessageType.Notification, {
      message: `[GM] Teleported to ${tileX}, ${tileY}`,
    });
  }

  static handleFastTravel(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.FastTravel],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    const waypoints = ctx.map.waypoints ?? [];
    const waypoint = waypoints.find((w) => w.id === data.waypointId);

    if (!waypoint) {
      HandlerUtils.sendError(client, "fast_travel.invalid_waypoint");
      return;
    }

    // Validate destination tile
    if (
      waypoint.x < 0 ||
      waypoint.x >= ctx.map.width ||
      waypoint.y < 0 ||
      waypoint.y >= ctx.map.height ||
      ctx.map.collision[waypoint.y]?.[waypoint.x] === 1
    ) {
      HandlerUtils.sendError(client, "fast_travel.blocked");
      return;
    }

    ctx.systems.movement.teleport(player, waypoint.x, waypoint.y);

    client.send(ServerMessageType.FastTravelUsed, {
      waypointId: waypoint.id,
      tileX: waypoint.x,
      tileY: waypoint.y,
    });
  }
}

