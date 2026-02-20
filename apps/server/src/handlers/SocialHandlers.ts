import type { ClientMessages, ClientMessageType } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { AdminHandlers } from "./AdminHandlers";
import { HandlerUtils } from "./HandlerUtils";
import type { RoomContext } from "./RoomContext";

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

  static handleGuildCreate(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.GuildCreate],
  ): void {
    ctx.systems.guild.handleCreateGuild(client, data.name);
  }

  static handleGuildInvite(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.GuildInvite],
  ): void {
    ctx.systems.guild.handleInvite(client, data.targetName);
  }

  static handleGuildAccept(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.GuildAccept],
  ): void {
    ctx.systems.guild.handleAcceptInvite(client, data.guildId);
  }

  static handleGuildLeave(ctx: RoomContext, client: Client): void {
    ctx.systems.guild.handleLeaveGuild(client);
  }

  static handleGuildKick(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.GuildKick],
  ): void {
    ctx.systems.guild.handleKickPlayer(client, data.targetName);
  }

  static handleGuildPromote(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.GuildPromote],
  ): void {
    ctx.systems.guild.handlePromotePlayer(client, data.targetName);
  }

  static handleGuildDemote(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.GuildDemote],
  ): void {
    ctx.systems.guild.handleDemotePlayer(client, data.targetName);
  }
}
