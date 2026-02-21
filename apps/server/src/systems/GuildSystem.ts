import { type ServerMessages, ServerMessageType } from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { GuildRole } from "../generated/prisma";
import { HandlerUtils } from "../handlers/HandlerUtils";
import type { GameState } from "../schema/GameState";
import { GuildService } from "../services/GuildService";

export class GuildSystem {
  private invitations = new Map<
    string,
    {
      guildId: string;
      inviterSessionId: string;
      guildName: string;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  /** O(1) reverse lookup: dbId → sessionId. Updated on join/leave. */
  private dbIdToSessionId = new Map<string, string>();
  private executingGuildCreates = new Set<string>();

  constructor(
    private state: GameState,
    private findClient: (sessionId: string) => Client | undefined,
  ) {}

  /** Call on player join to register their dbId in the O(1) lookup. */
  registerPlayer(dbId: string, sessionId: string): void {
    this.dbIdToSessionId.set(dbId, sessionId);
  }

  /** Call on player leave to remove them from the O(1) lookup. */
  unregisterPlayer(dbId: string): void {
    this.dbIdToSessionId.delete(dbId);
  }

  async handleCreateGuild(client: Client, name: string): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.dbId) return;

    if (player.guildId) {
      HandlerUtils.sendError(client, "You are already in a guild.");
      return;
    }

    if (this.executingGuildCreates.has(player.dbId)) return;
    this.executingGuildCreates.add(player.dbId);

    if (player.gold < 1000) {
      // e.g. 1000 gold to create a guild
      this.executingGuildCreates.delete(player.dbId);
      HandlerUtils.sendError(client, "Not enough gold to create a guild.");
      return;
    }

    try {
      player.gold -= 1000;
      const guild = await GuildService.createGuild(name, player.dbId);
      player.guildId = guild.id;
      await this.broadcastGuildUpdate(guild.id);
      client.send(ServerMessageType.Notification, { message: "Guild created successfully!" });
    } catch (e) {
      player.gold += 1000;
      HandlerUtils.sendError(client, "Failed to create guild. Name might be taken.");
    } finally {
      this.executingGuildCreates.delete(player.dbId);
    }
  }

  async handleInvite(client: Client, targetName: string): Promise<void> {
    const inviter = this.state.players.get(client.sessionId);
    if (!inviter || !inviter.guildId) return;

    // Resolve target by name
    let targetSessionId: string | undefined;
    for (const [sid, p] of this.state.players) {
      if (p.name === targetName) {
        targetSessionId = sid;
        break;
      }
    }

    if (!targetSessionId) {
      HandlerUtils.sendError(client, "Player not found or not online.");
      return;
    }

    const target = this.state.players.get(targetSessionId);
    if (!target || target === inviter) return;

    if (target.guildId) {
      HandlerUtils.sendError(client, "Target is already in a guild.");
      return;
    }

    const memberRecord = await GuildService.getMember(inviter.dbId);
    if (!memberRecord || memberRecord.role === GuildRole.MEMBER) {
      HandlerUtils.sendError(client, "You do not have permission to invite.");
      return;
    }

    // Clear any existing invite before replacing (re-invite case)
    this.clearInvitation(targetSessionId);

    const timer = setTimeout(() => this.invitations.delete(targetSessionId), 60_000);
    this.invitations.set(targetSessionId, {
      guildId: inviter.guildId,
      inviterSessionId: inviter.sessionId,
      guildName: memberRecord.guild.name,
      timer,
    });

    const targetClient = this.findClient(targetSessionId);
    if (targetClient) {
      targetClient.send(ServerMessageType.GuildInvited, {
        guildId: inviter.guildId,
        inviterName: inviter.name,
        guildName: memberRecord.guild.name,
      });
      client.send(ServerMessageType.Notification, {
        message: `Invited ${target.name} to the guild.`,
      });
    }
  }

  private clearInvitation(sessionId: string): void {
    const existing = this.invitations.get(sessionId);
    if (existing) {
      clearTimeout(existing.timer);
      this.invitations.delete(sessionId);
    }
  }

  async handleAcceptInvite(client: Client, guildId: string): Promise<void> {
    const invite = this.invitations.get(client.sessionId);
    if (!invite || invite.guildId !== guildId) {
      HandlerUtils.sendError(client, "No pending invite for this guild.");
      return;
    }

    const player = this.state.players.get(client.sessionId);
    if (!player || !player.dbId) {
      this.invitations.delete(client.sessionId);
      return;
    }

    // Bug #15 fix: Prevent double-guild join if player joined another guild
    // between receiving and accepting this invite.
    if (player.guildId) {
      HandlerUtils.sendError(client, "You are already in a guild.");
      this.clearInvitation(client.sessionId);
      return;
    }

    try {
      // Bug #84: Enforce guild size cap
      const members = await GuildService.getGuildMembers(guildId);
      if (members.length >= 50) {
        HandlerUtils.sendError(client, "Guild is full (max 50 members).");
        this.clearInvitation(client.sessionId);
        return;
      }

      await GuildService.addMember(guildId, player.dbId);
      player.guildId = guildId;
      this.clearInvitation(client.sessionId);

      await this.broadcastGuildUpdate(guildId);
      this.broadcastToGuild(guildId, ServerMessageType.Notification, {
        message: `${player.name} has joined the guild!`,
      });
    } catch (e) {
      HandlerUtils.sendError(client, "Failed to join guild.");
    }
  }

  /** Sends an empty GuildUpdate to signal the client they are no longer in a guild. */
  private sendGuildLeft(client: Client): void {
    client.send(ServerMessageType.GuildUpdate, {
      guildId: "",
      name: "",
      members: [],
    });
  }

  async handleLeaveGuild(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.guildId || !player.dbId) return;

    const guildId = player.guildId;

    const memberRecord = await GuildService.getMember(player.dbId);
    if (!memberRecord) return;

    if (memberRecord.role === GuildRole.LEADER) {
      HandlerUtils.sendError(client, "Guild leader cannot leave. Pass leadership or disband.");
      return;
    }

    try {
      await GuildService.removeMember(player.dbId);
      player.guildId = "";

      this.broadcastToGuild(guildId, ServerMessageType.Notification, {
        message: `${player.name} has left the guild.`,
      });
      await this.broadcastGuildUpdate(guildId);
      this.sendGuildLeft(client);
    } catch (e) {
      HandlerUtils.sendError(client, "Failed to leave guild.");
    }
  }

  async handleKickPlayer(client: Client, targetName: string): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.guildId || !player.dbId) return;

    const memberRecord = await GuildService.getMember(player.dbId);
    if (!memberRecord || memberRecord.role === GuildRole.MEMBER) {
      HandlerUtils.sendError(client, "You do not have permission to kick.");
      return;
    }

    const guildId = player.guildId;
    const members = await GuildService.getGuildMembers(guildId);
    const targetMember = members.find((m) => m.character.name === targetName);

    if (!targetMember) {
      HandlerUtils.sendError(client, "Player not found in guild.");
      return;
    }

    if (
      targetMember.role === GuildRole.LEADER ||
      (memberRecord.role === GuildRole.OFFICER && targetMember.role === GuildRole.OFFICER)
    ) {
      HandlerUtils.sendError(client, "Cannot kick this player.");
      return;
    }

    try {
      await GuildService.removeMember(targetMember.characterId);

      // If target is online, update their state
      const onlineTargetSessionId = this.findSessionIdByDbId(targetMember.characterId);
      if (onlineTargetSessionId) {
        const targetPlayer = this.state.players.get(onlineTargetSessionId);
        if (targetPlayer) targetPlayer.guildId = "";
        const targetClient = this.findClient(onlineTargetSessionId);
        if (targetClient) {
          targetClient.send(ServerMessageType.Notification, {
            message: "You have been kicked from the guild.",
          });
          this.sendGuildLeft(targetClient);
        }
      }

      await this.broadcastGuildUpdate(guildId);
      this.broadcastToGuild(guildId, ServerMessageType.Notification, {
        message: `${targetName} was kicked from the guild.`,
      });
    } catch (e) {
      HandlerUtils.sendError(client, "Failed to kick player.");
    }
  }

  async handlePromotePlayer(client: Client, targetName: string): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.guildId || !player.dbId) return;

    const memberRecord = await GuildService.getMember(player.dbId);
    if (!memberRecord || memberRecord.role !== GuildRole.LEADER) {
      HandlerUtils.sendError(client, "Only the guild leader can promote.");
      return;
    }

    const guildId = player.guildId;
    const members = await GuildService.getGuildMembers(guildId);
    const targetMember = members.find((m) => m.character.name === targetName);

    if (!targetMember || targetMember.role !== GuildRole.MEMBER) {
      HandlerUtils.sendError(client, "Invalid promotion target.");
      return;
    }

    try {
      await GuildService.updateRole(targetMember.characterId, GuildRole.OFFICER);
      await this.broadcastGuildUpdate(guildId);
    } catch (e) {
      HandlerUtils.sendError(client, "Failed to promote player.");
    }
  }

  async handleDemotePlayer(client: Client, targetName: string): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.guildId || !player.dbId) return;

    const memberRecord = await GuildService.getMember(player.dbId);
    if (!memberRecord || memberRecord.role !== GuildRole.LEADER) {
      HandlerUtils.sendError(client, "Only the guild leader can demote.");
      return;
    }

    const guildId = player.guildId;
    const members = await GuildService.getGuildMembers(guildId);
    const targetMember = members.find((m) => m.character.name === targetName);

    if (!targetMember || targetMember.role !== GuildRole.OFFICER) {
      HandlerUtils.sendError(client, "Invalid demotion target.");
      return;
    }

    try {
      await GuildService.updateRole(targetMember.characterId, GuildRole.MEMBER);
      await this.broadcastGuildUpdate(guildId);
    } catch (e) {
      HandlerUtils.sendError(client, "Failed to demote player.");
    }
  }

  public async broadcastGuildUpdate(guildId: string): Promise<void> {
    const members = await GuildService.getGuildMembers(guildId);
    if (members.length === 0) return;

    const guildName = members[0].guild.name;

    const memberPayload: ServerMessages[ServerMessageType.GuildUpdate]["members"] = members.map(
      (m) => {
        const sessionId = this.findSessionIdByDbId(m.characterId);
        return {
          sessionId: sessionId ?? undefined,
          name: m.character.name,
          role: m.role === "LEADER" ? "LEADER" : m.role === "OFFICER" ? "OFFICER" : "MEMBER",
          online: !!sessionId,
        };
      },
    );

    const message: ServerMessages[ServerMessageType.GuildUpdate] = {
      guildId,
      name: guildName,
      members: memberPayload,
    };

    this.broadcastToGuild(guildId, ServerMessageType.GuildUpdate, message);
  }

  public broadcastToGuild<T extends ServerMessageType>(
    guildId: string,
    type: T,
    message: ServerMessages[T],
  ): void {
    for (const [sessionId, player] of this.state.players) {
      if (player.guildId === guildId) {
        const client = this.findClient(sessionId);
        if (client) {
          client.send(type, message);
        }
      }
    }
  }

  private findSessionIdByDbId(dbId: string): string | null {
    return this.dbIdToSessionId.get(dbId) ?? null;
  }
}
