import { type ClientMessages, ClientMessageType } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import type { RoomContext } from "./RoomContext";
import { HandlerUtils } from "./HandlerUtils";
import { AdminHandlers } from "./AdminHandlers";

export class SocialHandlers {
	static handleChat(
		ctx: RoomContext,
		client: Client,
		data: ClientMessages[ClientMessageType.Chat],
	): void {
		const player = HandlerUtils.getActivePlayer(ctx, client);
		if (!player) return;

		if (data.message === "/gm" || data.message.startsWith("/gm ")) {
			AdminHandlers.handleGMCommand(ctx, client, player, data.message.slice(3).trim());
			return;
		}

		ctx.services.chat.handleChat(player, data.message);
	}

	static handleFriendRequest(
		ctx: RoomContext,
		client: Client,
		data: ClientMessages[ClientMessageType.FriendRequest],
	): void {
		ctx.systems.friends.handleFriendRequest(client, data.targetName);
	}

	static handleFriendAccept(
		ctx: RoomContext,
		client: Client,
		data: ClientMessages[ClientMessageType.FriendAccept],
	): void {
		ctx.systems.friends.handleFriendAccept(client, data.requesterId);
	}

	static handleGroupInvite(
		ctx: RoomContext,
		client: Client,
		data: ClientMessages[ClientMessageType.GroupInvite],
	): void {
		ctx.systems.social.handleInvite(client, data.targetSessionId);
	}

	static handleGroupAccept(
		ctx: RoomContext,
		client: Client,
		data: ClientMessages[ClientMessageType.GroupAccept],
	): void {
		ctx.systems.social.handleAcceptInvite(client, data.groupId);
	}

	static handleGroupLeave(ctx: RoomContext, client: Client): void {
		ctx.systems.social.handleLeaveGroup(client);
	}

	static handleGroupKick(
		ctx: RoomContext,
		client: Client,
		data: ClientMessages[ClientMessageType.GroupKick],
	): void {
		ctx.systems.social.handleKickPlayer(client, data.targetSessionId);
	}
}
