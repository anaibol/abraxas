import { DIRECTION_DELTA, type NpcType, ServerMessageType } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { logger } from "../logger";
import type { Player } from "../schema/Player";
import { HandlerUtils } from "./HandlerUtils";
import type { RoomContext } from "./RoomContext";

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
        if (
          ctx.systems.inventory.addItem(player, itemId, qty, undefined, (msg) =>
            HandlerUtils.sendError(client, msg),
          )
        ) {
          client.send(ServerMessageType.Notification, {
            message: `[GM] Spawned ${qty}x ${itemId}`,
          });
          logger.info({
            room: ctx.roomId,
            sessionId: client.sessionId,
            message: `[GM] ${player.name} spawned ${qty}x ${itemId}`,
          });
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
        logger.info({
          room: ctx.roomId,
          sessionId: client.sessionId,
          message: `[GM] ${player.name} gave themselves ${amount} gold`,
        });
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
        logger.info({
          room: ctx.roomId,
          sessionId: client.sessionId,
          message: `[GM] ${player.name} gave themselves ${amount} XP`,
        });
        break;
      }
      case "heal": {
        player.hp = player.maxHp;
        player.mana = player.maxMana;
        client.send(ServerMessageType.Notification, {
          message: `[GM] Healed to full`,
        });
        logger.info({
          room: ctx.roomId,
          sessionId: client.sessionId,
          message: `[GM] ${player.name} fully healed`,
        });
        break;
      }
      case "speed": {
        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount < 0) {
          HandlerUtils.sendError(client, "Usage: /gm speed <amount>");
          return;
        }
        player.speedOverride = amount;
        client.send(ServerMessageType.Notification, {
          message: `[GM] Speed overridden to ${amount}`,
        });
        logger.info({
          room: ctx.roomId,
          sessionId: client.sessionId,
          message: `[GM] ${player.name} changed speed to ${amount}`,
        });
        break;
      }
      case "spawn": {
        const npcId = args[1] as NpcType | undefined;
        if (!npcId) {
          HandlerUtils.sendError(client, "Usage: /gm spawn <npcId>");
          return;
        }
        const delta = DIRECTION_DELTA[player.facing];
        const spawnX = player.tileX + delta.dx;
        const spawnY = player.tileY + delta.dy;

        if (spawnX >= 0 && spawnX < ctx.map.width && spawnY >= 0 && spawnY < ctx.map.height) {
          ctx.systems.npc.spawnNpcAt(npcId, ctx.map, spawnX, spawnY);
          client.send(ServerMessageType.Notification, {
            message: `[GM] Spawned ${npcId} at ${spawnX},${spawnY}`,
          });
          logger.info({
            room: ctx.roomId,
            sessionId: client.sessionId,
            message: `[GM] ${player.name} spawned ${npcId}`,
          });
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
          message: `[Server] ${msg}`,
        });
        logger.info({
          room: ctx.roomId,
          sessionId: client.sessionId,
          message: `[GM] ${player.name} announced: ${msg}`,
        });
        break;
      }
      case "ct": {
        const targetMap = args[1];
        const targetX = parseInt(args[2]);
        const targetY = parseInt(args[3]);
        if (!targetMap || Number.isNaN(targetX) || Number.isNaN(targetY)) {
          HandlerUtils.sendError(client, "Usage: /gm ct <mapName> <x> <y>");
          return;
        }
        if (!ctx.map.warps) ctx.map.warps = [];
        ctx.map.warps.push({
          x: player.tileX,
          y: player.tileY,
          targetMap,
          targetX,
          targetY,
        });
        client.send(ServerMessageType.Notification, {
          message: `[GM] Teleport created at ${player.tileX},${player.tileY} → ${targetMap} (${targetX},${targetY})`,
        });
        logger.info({
          room: ctx.roomId,
          sessionId: client.sessionId,
          message: `[GM] ${player.name} created teleport at ${player.tileX},${player.tileY} → ${targetMap} (${targetX},${targetY})`,
        });
        break;
      }
      case "dt": {
        if (!ctx.map.warps || ctx.map.warps.length === 0) {
          HandlerUtils.sendError(client, "No warps on this map");
          return;
        }
        const idx = ctx.map.warps.findIndex(
          (w) => w.x === player.tileX && w.y === player.tileY,
        );
        if (idx === -1) {
          HandlerUtils.sendError(client, "No teleport at your current tile");
          return;
        }
        const removed = ctx.map.warps.splice(idx, 1)[0];
        client.send(ServerMessageType.Notification, {
          message: `[GM] Removed teleport at ${player.tileX},${player.tileY} (was → ${removed.targetMap} ${removed.targetX},${removed.targetY})`,
        });
        logger.info({
          room: ctx.roomId,
          sessionId: client.sessionId,
          message: `[GM] ${player.name} removed teleport at ${player.tileX},${player.tileY}`,
        });
        break;
      }
      case "tp": {
        const x = parseInt(args[1]);
        const y = parseInt(args[2]);
        if (Number.isNaN(x) || Number.isNaN(y)) {
          HandlerUtils.sendError(client, "Usage: /gm tp <x> <y>");
          return;
        }
        if (
          x < 0 ||
          x >= ctx.map.width ||
          y < 0 ||
          y >= ctx.map.height ||
          ctx.map.collision[y]?.[x] === 1
        ) {
          HandlerUtils.sendError(client, "gm.invalid_tile");
          return;
        }
        ctx.systems.movement.teleport(player, x, y);
        client.send(ServerMessageType.Notification, { message: `[GM] Teleported to ${x}, ${y}` });
        logger.info({
          room: ctx.roomId,
          sessionId: client.sessionId,
          message: `[GM] ${player.name} tp to ${x},${y}`,
        });
        break;
      }
      case "goto": {
        const targetName = args[1];
        if (!targetName) {
          HandlerUtils.sendError(client, "Usage: /gm goto <playerName>");
          return;
        }
        const target = Array.from(ctx.state.players.values()).find(
          (p) => p.name.toLowerCase() === targetName.toLowerCase(),
        );
        if (!target) {
          HandlerUtils.sendError(client, `Player not found: ${targetName}`);
          return;
        }
        ctx.systems.movement.teleport(player, target.tileX, target.tileY);
        client.send(ServerMessageType.Notification, {
          message: `[GM] Teleported to ${target.name}`,
        });
        logger.info({
          room: ctx.roomId,
          sessionId: client.sessionId,
          message: `[GM] ${player.name} goto ${target.name}`,
        });
        break;
      }
      default:
        if (command) {
          HandlerUtils.sendError(client, `Unknown GM command: ${command}`);
        } else {
          HandlerUtils.sendError(
            client,
            "Commands: item, gold, xp, heal, spawn, announce, tp, goto, ct, dt",
          );
        }
        break;
    }
  }
}
