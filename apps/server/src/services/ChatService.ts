import type { Client } from "@colyseus/core";
import { ChatChannel, ServerMessageType, type ServerMessages } from "@abraxas/shared";
import type { Player } from "../schema/Player";
import { logger } from "../logger";

export type BroadcastFn = <T extends ServerMessageType>(
  type: T,
  payload: ServerMessages[T]
) => void;

export class ChatService {
  constructor(
    private broadcast: BroadcastFn,
    private findClientByName: (name: string) => Client | undefined,
    private findClientBySessionId: (sessionId: string) => Client | undefined,
    private broadcastToGroup: <T extends ServerMessageType>(groupId: string, type: T, msg: ServerMessages[T]) => void,
  ) {}

  public handleChat(player: Player, message: string): void {
    const chatMsg = message.trim().slice(0, 100);
    const safeText = chatMsg.replace(/[<>]/g, "").trim();
    if (safeText.length === 0) return;

    if (safeText.startsWith("/w ") || safeText.startsWith("/whisper ")) {
      this.handleWhisper(player, safeText);
      return;
    }

    if (safeText.startsWith("/p ")) {
      this.handleGroupChat(player, safeText.slice(3).trim());
      return;
    }

    // Global chat
    this.broadcast(ServerMessageType.Chat, {
      senderId: player.sessionId,
      senderName: player.name,
      message: safeText,
      channel: ChatChannel.Global,
    });

    logger.debug({
      intent: "chat",
      clientId: player.sessionId,
      channel: ChatChannel.Global,
      message: safeText,
    });
  }

  private handleGroupChat(player: Player, text: string): void {
    if (!text || !player.groupId) {
      const senderClient = this.findClientBySessionId(player.sessionId);
      senderClient?.send(ServerMessageType.Notification, {
        message: player.groupId ? "Message cannot be empty." : "You are not in a group.",
      });
      return;
    }

    this.broadcastToGroup(player.groupId, ServerMessageType.Chat, {
      senderId: player.sessionId,
      senderName: player.name,
      message: text,
      channel: ChatChannel.Group,
    });

    logger.debug({
      intent: "chat",
      clientId: player.sessionId,
      channel: ChatChannel.Group,
      groupId: player.groupId,
      message: text,
    });
  }

  private handleWhisper(player: Player, text: string): void {
    const parts = text.split(" ");
    if (parts.length < 3) return;

    const targetName = parts[1];
    const whisperMsg = parts.slice(2).join(" ").trim();
    if (!whisperMsg) return;

    const targetClient = this.findClientByName(targetName);
    if (!targetClient) {
      const senderClient = this.findClientBySessionId(player.sessionId);
      senderClient?.send(ServerMessageType.Chat, {
        senderId: "",
        senderName: "System",
        message: `Player "${targetName}" not found or offline.`,
        channel: ChatChannel.Whisper,
      });
      return;
    }

    // Send to recipient
    targetClient.send(ServerMessageType.Chat, {
      senderId: player.sessionId,
      senderName: player.name,
      message: whisperMsg,
      channel: ChatChannel.Whisper,
    });

    // Echo back to sender
    const senderClient = this.findClientBySessionId(player.sessionId);
    senderClient?.send(ServerMessageType.Chat, {
      senderId: player.sessionId,
      senderName: `To ${targetName}`,
      message: whisperMsg,
      channel: ChatChannel.Whisper,
    });

    logger.debug({
      intent: "chat",
      clientId: player.sessionId,
      channel: ChatChannel.Whisper,
      target: targetName,
      message: whisperMsg,
    });
  }
}
