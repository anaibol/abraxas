import { Client } from "@colyseus/core";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { Party } from "../schema/Party";
import { ServerMessageType, ServerMessages } from "@abraxas/shared";

export class SocialSystem {
  private invitations = new Map<
    string,
    { partyId: string; inviterSessionId: string }
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

    // Check if target is already in a party
    if (target.partyId) {
      this.sendError(client, "social.already_in_party");
      return;
    }

    let partyId = inviter.partyId;
    if (!partyId) {
      // Create a new party
      partyId = crypto.randomUUID();
      const party = new Party();
      party.id = partyId;
      party.leaderSessionId = inviter.sessionId;
      party.memberIds.push(inviter.sessionId);
      this.state.parties.set(partyId, party);
      inviter.partyId = partyId;
      this.broadcastPartyUpdate(partyId);
    } else {
      const party = this.state.parties.get(partyId);
      if (party && party.leaderSessionId !== inviter.sessionId) {
        this.sendError(client, "social.leader_only_invite");
        return;
      }
    }

    // Send invitation to target
    this.invitations.set(targetSessionId, {
      partyId,
      inviterSessionId: inviter.sessionId,
    });
    const targetClient = this.findClient(targetSessionId);
    if (targetClient) {
      targetClient.send(ServerMessageType.PartyInvited, {
        partyId,
        inviterName: inviter.name,
      });
      client.send(ServerMessageType.Notification, {
        message: "social.invited_to_party",
        templateData: { name: target.name },
      });
    }
  }

  handleAcceptInvite(client: Client, partyId: string): void {
    const invite = this.invitations.get(client.sessionId);
    if (!invite || invite.partyId !== partyId) {
      this.sendError(client, "social.no_invite");
      return;
    }

    const party = this.state.parties.get(partyId);
    const player = this.state.players.get(client.sessionId);

    if (!party || !player) {
      this.invitations.delete(client.sessionId);
      return;
    }

    if (party.memberIds.length >= 5) {
      this.sendError(client, "social.party_full");
      this.invitations.delete(client.sessionId);
      return;
    }

    // Join party
    player.partyId = partyId;
    party.memberIds.push(client.sessionId);
    this.invitations.delete(client.sessionId);

    this.broadcastPartyUpdate(partyId);
    this.broadcastToParty(partyId, ServerMessageType.Notification, {
      message: "social.joined_party",
      templateData: { name: player.name },
    });
  }

  /** Sends an empty PartyUpdate to signal the client they are no longer in a party. */
  private sendPartyLeft(client: Client): void {
    client.send(ServerMessageType.PartyUpdate, {
      partyId: "",
      leaderId: "",
      members: [],
    });
  }

  handleLeaveParty(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.partyId) return;

    const partyId = player.partyId;
    const party = this.state.parties.get(partyId);
    if (!party) return;

    this.removePlayerFromParty(party, client.sessionId);
    player.partyId = "";

    this.broadcastToParty(partyId, ServerMessageType.Notification, {
      message: "social.left_party",
      templateData: { name: player.name },
    });
    this.broadcastPartyUpdate(partyId);
    this.sendPartyLeft(client);
  }

  handleKickPlayer(client: Client, targetSessionId: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.partyId) return;

    const party = this.state.parties.get(player.partyId);
    if (!party || party.leaderSessionId !== client.sessionId) {
      this.sendError(client, "social.leader_only_kick");
      return;
    }

    if (targetSessionId === client.sessionId) return;

    const target = this.state.players.get(targetSessionId);
    if (target && target.partyId === player.partyId) {
      this.removePlayerFromParty(party, targetSessionId);
      target.partyId = "";

      const targetClient = this.findClient(targetSessionId);
      if (targetClient) {
        targetClient.send(ServerMessageType.Notification, {
          message: "social.kicked_from_party",
        });
        this.sendPartyLeft(targetClient);
      }
      this.broadcastPartyUpdate(party.id);
    }
  }

  private removePlayerFromParty(party: Party, sessionId: string): void {
    const index = party.memberIds.indexOf(sessionId);
    if (index !== -1) {
      party.memberIds.splice(index, 1);
    }

    if (party.memberIds.length === 0) {
      this.state.parties.delete(party.id);
    } else if (party.leaderSessionId === sessionId) {
      // New leader
      const newLeaderId = party.memberIds[0];
      if (newLeaderId) {
        party.leaderSessionId = newLeaderId;
        const newLeader = this.state.players.get(newLeaderId);
        if (newLeader) {
          this.broadcastToParty(party.id, ServerMessageType.Notification, {
            message: "social.new_leader",
            templateData: { name: newLeader.name },
          });
        }
      }
    }
  }

  private broadcastPartyUpdate(partyId: string): void {
    const party = this.state.parties.get(partyId);
    if (!party) return;

    const members = party.memberIds.map((sid) => {
      const p = this.state.players.get(sid);
      return { sessionId: sid, name: p ? p.name : "Unknown" };
    });

    this.broadcastToParty(partyId, ServerMessageType.PartyUpdate, {
      partyId: party.id,
      leaderId: party.leaderSessionId,
      members,
    });
  }

  public broadcastToParty<T extends ServerMessageType>(
    partyId: string,
    type: T,
    message: ServerMessages[T],
  ): void {
    const party = this.state.parties.get(partyId);
    if (!party) return;

    party.memberIds.forEach((sid) => {
      const client = this.findClient(sid);
      if (client) {
        client.send(type, message);
      }
    });
  }
}
