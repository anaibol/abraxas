import { type ClientMessages, ClientMessageType, ServerMessageType } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import type { RoomContext } from "./RoomContext";
import { HandlerUtils } from "./HandlerUtils";

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
		const player = HandlerUtils.getActivePlayer(ctx, client);
		if (!player || player.role !== "ADMIN") {
			HandlerUtils.sendError(client, "game.error_generic");
			return;
		}

		ctx.systems.movement.teleport(player, data.targetTileX, data.targetTileY);
	}
}
