import { ServerMessageType } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { prisma } from "../database/db";
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
    this.broadcastStatusToFriends(userId, true);
  }

  public setUserOffline(userId: string) {
    this.onlineUsers.delete(userId);
    this.broadcastStatusToFriends(userId, false);
  }

  private async broadcastStatusToFriends(userId: string, online: boolean) {
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
      client.send(ServerMessageType.Error, { message: "Player not found" });
      return;
    }

    if (targetUser.id === player.userId) {
      client.send(ServerMessageType.Error, {
        message: "You cannot friend yourself",
      });
      return;
    }

    try {
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

  public async sendUpdateToUser(userId: string, sessionId: string) {
    const client = this.findClient(sessionId);
    if (!client) return;

    const [outgoing, incoming, pendingIncoming] = await Promise.all([
      prisma.requesterFriend.findMany({
        where: { requesterId: userId, status: "ACCEPTED" },
      }),
      prisma.recipientFriend.findMany({
        where: { recipientId: userId, status: "ACCEPTED" },
      }),
      // Requests sent TO this user that are still pending
      prisma.requesterFriend.findMany({
        where: { recipientId: userId, status: "PENDING" },
        include: { requester: { include: { characters: { take: 1 } } } },
      }),
    ]);

    const friendIds = [
      ...outgoing.map((f) => f.recipientId),
      ...incoming.map((f) => f.requesterId),
    ];

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
