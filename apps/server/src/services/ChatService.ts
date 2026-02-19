import { Client } from "@colyseus/core";
import { ChatChannel, ServerMessageType, ServerMessages } from "@abraxas/shared";
import { Player } from "../schema/Player";
import { logger } from "../logger";

export type BroadcastFn = <T extends ServerMessageType>(
  type: T,
  payload: ServerMessages[T]
) => void;

export class ChatService {
  constructor(
    private broadcast: BroadcastFn,
    private findClientByName: (name: string) => Client | undefined
  ) {}

  public handleChat(player: Player, message: string): void {
    const chatMsg = message.trim().slice(0, 100);
    const safeText = chatMsg.replace(/[<>]/g, "").trim();
    if (safeText.length === 0) return;

    if (safeText.startsWith("/w ") || safeText.startsWith("/whisper ")) {
      this.handleWhisper(player, safeText);
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

  private handleWhisper(player: Player, text: string): void {
    const parts = text.split(" ");
    if (parts.length < 3) return;

    const targetName = parts[1];
    const whisperMsg = parts.slice(2).join(" ").trim();
    if (!whisperMsg) return;

    const targetClient = this.findClientByName(targetName);
    if (!targetClient) {
      // In a real app we might send an error back to the player
      return;
    }

    // Send to recipient
    targetClient.send(ServerMessageType.Chat, {
      senderId: player.sessionId,
      senderName: player.name,
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
