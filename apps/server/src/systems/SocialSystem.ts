import { Client } from "@colyseus/core";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { Group } from "../schema/Group";
import { ServerMessageType, ServerMessages } from "@abraxas/shared";

export class SocialSystem {
  private invitations = new Map<
    string,
    { groupId: string; inviterSessionId: string }
  >();

  constructor(
    private state: GameState,
    private findClient: (sessionId: string) => Client | undefined,
  ) {}

  private sendError(client: Client, message: string): void {
    client.send(ServerMessageType.Error, { message });
  }

  handleInvite(client: Client, targetSessionId: string): void {
    const inviter = this.state.players.get(client.sessionId);
    const target = this.state.players.get(targetSessionId);

    if (!inviter || !target || inviter === target) return;

    // Check if target is already in a group
    if (target.groupId) {
      this.sendError(client, "social.already_in_group");
      return;
    }

    let groupId = inviter.groupId;
    if (!groupId) {
      // Create a new group
      groupId = crypto.randomUUID();
      const group = new Group();
      group.id = groupId;
      group.leaderSessionId = inviter.sessionId;
      group.memberIds.push(inviter.sessionId);
      this.state.groups.set(groupId, group);
      inviter.groupId = groupId;
      this.broadcastGroupUpdate(groupId);
    } else {
      const group = this.state.groups.get(groupId);
      if (group && group.leaderSessionId !== inviter.sessionId) {
        this.sendError(client, "social.leader_only_invite");
        return;
      }
    }

    // Send invitation to target
    this.invitations.set(targetSessionId, {
      groupId,
      inviterSessionId: inviter.sessionId,
    });
    const targetClient = this.findClient(targetSessionId);
    if (targetClient) {
      targetClient.send(ServerMessageType.GroupInvited, {
        groupId,
        inviterName: inviter.name,
      });
      client.send(ServerMessageType.Notification, {
        message: "social.invited_to_group",
        templateData: { name: target.name },
      });
    }
  }

  handleAcceptInvite(client: Client, groupId: string): void {
    const invite = this.invitations.get(client.sessionId);
    if (!invite || invite.groupId !== groupId) {
      this.sendError(client, "social.no_invite");
      return;
    }

    const group = this.state.groups.get(groupId);
    const player = this.state.players.get(client.sessionId);

    if (!group || !player) {
      this.invitations.delete(client.sessionId);
      return;
    }

    if (group.memberIds.length >= 5) {
      this.sendError(client, "social.group_full");
      this.invitations.delete(client.sessionId);
      return;
    }

    // Join group
    player.groupId = groupId;
    group.memberIds.push(client.sessionId);
    this.invitations.delete(client.sessionId);

    this.broadcastGroupUpdate(groupId);
    this.broadcastToGroup(groupId, ServerMessageType.Notification, {
      message: "social.joined_group",
      templateData: { name: player.name },
    });
  }

  /** Sends an empty GroupUpdate to signal the client they are no longer in a group. */
  private sendGroupLeft(client: Client): void {
    client.send(ServerMessageType.GroupUpdate, {
      groupId: "",
      leaderId: "",
      members: [],
    });
  }

  handleLeaveGroup(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.groupId) return;

    const groupId = player.groupId;
    const group = this.state.groups.get(groupId);
    if (!group) return;

    this.removePlayerFromGroup(group, client.sessionId);
    player.groupId = "";

    this.broadcastToGroup(groupId, ServerMessageType.Notification, {
      message: "social.left_group",
      templateData: { name: player.name },
    });
    this.broadcastGroupUpdate(groupId);
    this.sendGroupLeft(client);
  }

  handleKickPlayer(client: Client, targetSessionId: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.groupId) return;

    const group = this.state.groups.get(player.groupId);
    if (!group || group.leaderSessionId !== client.sessionId) {
      this.sendError(client, "social.leader_only_kick");
      return;
    }

    if (targetSessionId === client.sessionId) return;

    const target = this.state.players.get(targetSessionId);
    if (target && target.groupId === player.groupId) {
      this.removePlayerFromGroup(group, targetSessionId);
      target.groupId = "";

      const targetClient = this.findClient(targetSessionId);
      if (targetClient) {
        targetClient.send(ServerMessageType.Notification, {
          message: "social.kicked_from_group",
        });
        this.sendGroupLeft(targetClient);
      }
      this.broadcastGroupUpdate(group.id);
    }
  }

  private removePlayerFromGroup(group: Group, sessionId: string): void {
    const index = group.memberIds.indexOf(sessionId);
    if (index !== -1) {
      group.memberIds.splice(index, 1);
    }

    if (group.memberIds.length === 0) {
      this.state.groups.delete(group.id);
    } else if (group.leaderSessionId === sessionId) {
      // New leader
      const newLeaderId = group.memberIds[0];
      if (newLeaderId) {
        group.leaderSessionId = newLeaderId;
        const newLeader = this.state.players.get(newLeaderId);
        if (newLeader) {
          this.broadcastToGroup(group.id, ServerMessageType.Notification, {
            message: "social.new_leader",
            templateData: { name: newLeader.name },
          });
        }
      }
    }
  }

  private broadcastGroupUpdate(groupId: string): void {
    const group = this.state.groups.get(groupId);
    if (!group) return;

    const members = group.memberIds.map((sid) => {
      const p = this.state.players.get(sid);
      return { sessionId: sid, name: p ? p.name : "Unknown" };
    });

    this.broadcastToGroup(groupId, ServerMessageType.GroupUpdate, {
      groupId: group.id,
      leaderId: group.leaderSessionId,
      members,
    });
  }

  public broadcastToGroup<T extends ServerMessageType>(
    groupId: string,
    type: T,
    message: ServerMessages[T],
  ): void {
    const group = this.state.groups.get(groupId);
    if (!group) return;

    group.memberIds.forEach((sid) => {
      const client = this.findClient(sid);
      if (client) {
        client.send(type, message);
      }
    });
  }
}
