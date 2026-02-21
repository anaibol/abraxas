import { ServerMessageType } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { prisma } from "../database/db";
import { HandlerUtils } from "../handlers/HandlerUtils";
import { logger } from "../logger";
import type { GameState } from "../schema/GameState";

export class FriendsSystem {
  private onlineUsers = new Map<string, string>(); // userId -> sessionId

  constructor(
    private state: GameState,
    private findClient: (sessionId: string) => Client | undefined,
  ) {}

  public setUserOnline(userId: string, sessionId: string) {
    this.onlineUsers.set(userId, sessionId);
    this.broadcastStatusToFriends(userId, true).catch((e) =>
      logger.error({ message: "Failed to broadcast online status", error: String(e) }),
    );
  }

  public setUserOffline(userId: string) {
    this.onlineUsers.delete(userId);
    this.broadcastStatusToFriends(userId, false).catch((e) =>
      logger.error({ message: "Failed to broadcast offline status", error: String(e) }),
    );
  }

  private async broadcastStatusToFriends(userId: string, _online: boolean) {
    // Find all accepted friends
    const friendships = await prisma.requesterFriend.findMany({
      where: {
        OR: [
          { requesterId: userId, status: "ACCEPTED" },
          { recipientId: userId, status: "ACCEPTED" },
        ],
      },
    });

    for (const f of friendships) {
      const friendId = f.requesterId === userId ? f.recipientId : f.requesterId;
      const friendSessionId = this.onlineUsers.get(friendId);
      if (friendSessionId) {
        const client = this.findClient(friendSessionId);
        if (client) {
          await this.sendUpdateToUser(friendId, friendSessionId);
        }
      }
    }
  }

  public async handleFriendRequest(client: Client, targetName: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const targetUser = await prisma.account.findFirst({
      where: { characters: { some: { name: targetName } } },
    });

    if (!targetUser) {
      HandlerUtils.sendError(client, "Player not found");
      return;
    }

    if (targetUser.id === player.userId) {
      HandlerUtils.sendError(client, "You cannot friend yourself");
      return;
    }

    try {
      // Bug #91: Check if friendship already exists in either direction
      const existing = await prisma.requesterFriend.findFirst({
        where: {
          OR: [
            { requesterId: player.userId, recipientId: targetUser.id },
            { requesterId: targetUser.id, recipientId: player.userId },
          ],
        },
      });
      if (existing) {
        HandlerUtils.sendError(client, existing.status === "PENDING" ? "Friend request already sent" : "Already friends");
        return;
      }

      await prisma.requesterFriend.upsert({
        where: {
          requesterId_recipientId: {
            requesterId: player.userId,
            recipientId: targetUser.id,
          },
        },
        update: {},
        create: {
          requesterId: player.userId,
          recipientId: targetUser.id,
          status: "PENDING",
        },
      });

      client.send(ServerMessageType.Notification, {
        message: `Friend request sent to ${targetName}`,
      });

      // Notify target if online
      const targetSessionId = this.onlineUsers.get(targetUser.id);
      if (targetSessionId) {
        const targetClient = this.findClient(targetSessionId);
        if (targetClient) {
          targetClient.send(ServerMessageType.FriendInvited, {
            requesterId: player.userId,
            requesterName: player.name,
          });
        }
      }
    } catch (e) {
      logger.error({
        message: "Error sending friend request",
        error: String(e),
      });
    }
  }

  public async handleFriendAccept(client: Client, requesterId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    try {
      await prisma.requesterFriend.update({
        where: {
          requesterId_recipientId: { requesterId, recipientId: player.userId },
        },
        data: { status: "ACCEPTED" },
      });

      client.send(ServerMessageType.Notification, {
        message: "Friend request accepted",
      });

      await this.sendUpdateToUser(player.userId, client.sessionId);

      const requesterSessionId = this.onlineUsers.get(requesterId);
      if (requesterSessionId) {
        await this.sendUpdateToUser(requesterId, requesterSessionId);
      }
    } catch (e) {
      logger.error({
        message: "Error accepting friend request",
        error: String(e),
      });
    }
  }

  public async handleFriendRemove(client: Client, friendId: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    try {
      // Remove in both directions (handles either party initiating removal)
      await prisma.requesterFriend.deleteMany({
        where: {
          OR: [
            { requesterId: player.userId, recipientId: friendId },
            { requesterId: friendId, recipientId: player.userId },
          ],
        },
      });

      // Push updated friend list to the remover
      await this.sendUpdateToUser(player.userId, client.sessionId);

      // Notify the removed friend if online
      const friendSessionId = this.onlineUsers.get(friendId);
      if (friendSessionId) {
        const friendClient = this.findClient(friendSessionId);
        if (friendClient) {
          friendClient.send(ServerMessageType.FriendRemove, { friendId: player.userId });
          await this.sendUpdateToUser(friendId, friendSessionId);
        }
      }
    } catch (e) {
      logger.error({
        message: "Error removing friend",
        error: String(e),
      });
    }
  }

  public async sendUpdateToUser(userId: string, sessionId: string) {
    const client = this.findClient(sessionId);
    if (!client) return;

    const [allAccepted, pendingIncoming] = await Promise.all([
      // B083: Single OR query handles both directions — avoids dual-table inconsistency
      prisma.requesterFriend.findMany({
        where: {
          OR: [
            { requesterId: userId, status: "ACCEPTED" },
            { recipientId: userId, status: "ACCEPTED" },
          ],
        },
      }),
      // Requests sent TO this user that are still pending
      prisma.requesterFriend.findMany({
        where: { recipientId: userId, status: "PENDING" },
        include: { requester: { include: { characters: { take: 1 } } } },
      }),
    ]);

    const friendIds = allAccepted.map((f) =>
      f.requesterId === userId ? f.recipientId : f.requesterId,
    );

    const [friendUsers] = await Promise.all([
      friendIds.length > 0
        ? prisma.account.findMany({
            where: { id: { in: friendIds } },
            include: { characters: { take: 1 } },
          })
        : Promise.resolve([]),
    ]);

    const friends = friendUsers.map((user) => ({
      id: user.id,
      name: user.characters[0]?.name ?? "Unknown",
      online: this.onlineUsers.has(user.id),
    }));

    const pendingRequests = pendingIncoming.map((f) => ({
      id: f.requesterId,
      name: f.requester.characters[0]?.name ?? "Unknown",
    }));

    client.send(ServerMessageType.FriendUpdate, { friends, pendingRequests });
  }
}
