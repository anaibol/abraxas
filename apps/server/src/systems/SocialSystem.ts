import { Client } from "@colyseus/core";
import { GameState } from "../schema/GameState";
import { Player } from "../schema/Player";
import { Party } from "../schema/Party";
import { ArraySchema } from "@colyseus/schema";
import { logger } from "../logger";

export class SocialSystem {
    private invitations = new Map<string, { partyId: string; inviterSessionId: string }>();

    constructor(
        private state: GameState, 
        private findClient: (sessionId: string) => Client | undefined
    ) {}

    handleInvite(client: Client, targetSessionId: string): void {
        const inviter = this.state.players.get(client.sessionId);
        const target = this.state.players.get(targetSessionId);

        if (!inviter || !target || inviter === target) return;

        // Check if target is already in a party
        if (target.partyId) {
            client.send("error", { message: "Player is already in a party" });
            return;
        }

        let partyId = inviter.partyId;
        if (!partyId) {
            // Create a new party
            partyId = Math.random().toString(36).substring(2, 9);
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
                client.send("error", { message: "Only the party leader can invite" });
                return;
            }
        }

        // Send invitation to target
        this.invitations.set(targetSessionId, { partyId, inviterSessionId: inviter.sessionId });
        const targetClient = this.findClient(targetSessionId);
        if (targetClient) {
            targetClient.send("party_invited", { partyId, inviterName: inviter.name });
            client.send("notification", { message: `Invited ${target.name} to party` });
        }
    }

    handleAcceptInvite(client: Client, partyId: string): void {
        const invite = this.invitations.get(client.sessionId);
        if (!invite || invite.partyId !== partyId) {
            client.send("error", { message: "No active invitation for this party" });
            return;
        }

        const party = this.state.parties.get(partyId);
        const player = this.state.players.get(client.sessionId);

        if (!party || !player) {
            this.invitations.delete(client.sessionId);
            return;
        }

        if (party.memberIds.length >= 5) {
            client.send("error", { message: "Party is full" });
            this.invitations.delete(client.sessionId);
            return;
        }

        // Join party
        player.partyId = partyId;
        party.memberIds.push(client.sessionId);
        this.invitations.delete(client.sessionId);

        this.broadcastPartyUpdate(partyId);
        this.broadcastToParty(partyId, "notification", { message: `${player.name} joined the party` });
    }

    handleLeaveParty(client: Client): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.partyId) return;

        const partyId = player.partyId;
        const party = this.state.parties.get(partyId);
        if (!party) return;

        this.removePlayerFromParty(party, client.sessionId);
        player.partyId = "";

        this.broadcastToParty(partyId, "notification", { message: `${player.name} left the party` });
        this.broadcastPartyUpdate(partyId);
        client.send("party_update", { partyId: "", leaderId: "", members: [] });
    }

    handleKickPlayer(client: Client, targetSessionId: string): void {
        const player = this.state.players.get(client.sessionId);
        if (!player || !player.partyId) return;

        const party = this.state.parties.get(player.partyId);
        if (!party || party.leaderSessionId !== client.sessionId) {
            client.send("error", { message: "Only the leader can kick players" });
            return;
        }

        if (targetSessionId === client.sessionId) return;

        const target = this.state.players.get(targetSessionId);
        if (target && target.partyId === player.partyId) {
            this.removePlayerFromParty(party, targetSessionId);
            target.partyId = "";
            
            const targetClient = this.findClient(targetSessionId);
            if (targetClient) {
                targetClient.send("notification", { message: "You were kicked from the party" });
                targetClient.send("party_update", { partyId: "", leaderId: "", members: [] });
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
                    this.broadcastToParty(party.id, "notification", { message: `${newLeader.name} is now the party leader` });
                }
            }
        }
    }

    private broadcastPartyUpdate(partyId: string): void {
        const party = this.state.parties.get(partyId);
        if (!party) return;

        const members = party.memberIds.map(sid => {
            const p = this.state.players.get(sid);
            return { sessionId: sid, name: p ? p.name : "Unknown" };
        });

        this.broadcastToParty(partyId, "party_update", {
            partyId: party.id,
            leaderId: party.leaderSessionId,
            members
        });
    }

    public broadcastToParty(partyId: string, type: string, message: any): void {
        const party = this.state.parties.get(partyId);
        if (!party) return;

        party.memberIds.forEach(sid => {
            const client = this.findClient(sid);
            if (client) {
                client.send(type, message);
            }
        });
    }
}
