import { ServerMessageType, DIRECTION_DELTA } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import type { RoomContext } from "./RoomContext";
import type { Player } from "../schema/Player";
import { HandlerUtils } from "./HandlerUtils";
import { logger } from "../logger";

export class AdminHandlers {
	static handleGMCommand(ctx: RoomContext, client: Client, player: Player, commandLine: string) {
		if (player.role !== "GM" && player.role !== "ADMIN") {
			HandlerUtils.sendError(client, "gm.unauthorized");
			return;
		}

		const args = commandLine.trim().split(" ");
		const command = args[0]?.toLowerCase();

		switch (command) {
			case "item": {
				const itemId = args[1];
				const qty = parseInt(args[2]) || 1;
				if (!itemId) {
					HandlerUtils.sendError(client, "Usage: /gm item <itemId> [qty]");
					return;
				}
				if (ctx.systems.inventory.addItem(player, itemId, qty, (msg) => HandlerUtils.sendError(client, msg))) {
					client.send(ServerMessageType.Notification, {
						message: `[GM] Spawned ${qty}x ${itemId}`,
					});
					logger.info({ room: ctx.roomId, sessionId: client.sessionId, message: `[GM] ${player.name} spawned ${qty}x ${itemId}` });
				}
				break;
			}
			case "gold": {
				const amount = parseInt(args[1]);
				if (isNaN(amount)) {
					HandlerUtils.sendError(client, "Usage: /gm gold <amount>");
					return;
				}
				player.gold += amount;
				client.send(ServerMessageType.Notification, {
					message: `[GM] Added ${amount} gold`,
				});
				logger.info({ room: ctx.roomId, sessionId: client.sessionId, message: `[GM] ${player.name} gave themselves ${amount} gold` });
				break;
			}
			case "xp": {
				const amount = parseInt(args[1]);
				if (isNaN(amount)) {
					HandlerUtils.sendError(client, "Usage: /gm xp <amount>");
					return;
				}
				ctx.services.level.gainXp(player, amount);
				client.send(ServerMessageType.Notification, {
					message: `[GM] Added ${amount} XP`,
				});
				logger.info({ room: ctx.roomId, sessionId: client.sessionId, message: `[GM] ${player.name} gave themselves ${amount} XP` });
				break;
			}
			case "heal": {
				player.hp = player.maxHp;
				player.mana = player.maxMana;
				client.send(ServerMessageType.Notification, {
					message: `[GM] Healed to full`,
				});
				logger.info({ room: ctx.roomId, sessionId: client.sessionId, message: `[GM] ${player.name} fully healed` });
				break;
			}
			case "spawn": {
				const npcType = args[1] as any;
				if (!npcType) {
					HandlerUtils.sendError(client, "Usage: /gm spawn <npcType>");
					return;
				}
				const delta = DIRECTION_DELTA[player.facing];
				const spawnX = player.tileX + delta.dx;
				const spawnY = player.tileY + delta.dy;
				
				if (spawnX >= 0 && spawnX < ctx.map.width && spawnY >= 0 && spawnY < ctx.map.height) {
					ctx.systems.npc.spawnNpcAt(npcType, ctx.map, spawnX, spawnY);
					client.send(ServerMessageType.Notification, {
						message: `[GM] Spawned ${npcType} at ${spawnX},${spawnY}`,
					});
					logger.info({ room: ctx.roomId, sessionId: client.sessionId, message: `[GM] ${player.name} spawned ${npcType}` });
				} else {
					HandlerUtils.sendError(client, "Invalid spawn location");
				}
				break;
			}
			case "announce": {
				const msg = args.slice(1).join(" ");
				if (!msg) {
					HandlerUtils.sendError(client, "Usage: /gm announce <message>");
					return;
				}
				ctx.broadcast(ServerMessageType.Notification, {
					message: `[Server] ${msg}`
				});
				logger.info({ room: ctx.roomId, sessionId: client.sessionId, message: `[GM] ${player.name} announced: ${msg}` });
				break;
			}
			default:
				if (command) {
					HandlerUtils.sendError(client, `Unknown GM command: ${command}`);
				} else {
					HandlerUtils.sendError(client, "Commands: item, gold, xp, heal, spawn, announce");
				}
				break;
		}
	}
}
