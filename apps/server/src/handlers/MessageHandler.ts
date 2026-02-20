import {
  type ClientMessages,
  ClientMessageType,
  MathUtils,
  ServerMessageType,
  VOICE_RANGE,
} from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import { CombatHandlers } from "./CombatHandlers";
import { EconomyHandlers } from "./EconomyHandlers";
import { HandlerUtils } from "./HandlerUtils";
import { InteractionHandlers } from "./InteractionHandlers";
import { ItemHandlers } from "./ItemHandlers";
import { MovementHandlers } from "./MovementHandlers";
import type { RoomContext } from "./RoomContext";
import { SocialHandlers } from "./SocialHandlers";
import { TamingHandlers } from "./TamingHandlers";



export class MessageHandler {
  constructor(public ctx: RoomContext) {}

  /**
   * Registers all message handlers with the room.
   * This allows for a clean, declarative setup in the Room class.
   */
  registerHandlers(
    register: <T extends ClientMessageType>(
      type: T,
      handler: (client: Client, message: ClientMessages[T]) => void,
    ) => void,
  ) {
    register(ClientMessageType.Move, (c, m) => MovementHandlers.handleMove(this.ctx, c, m));
    register(ClientMessageType.GMTeleport, (c, m) =>
      MovementHandlers.handleGMTeleport(this.ctx, c, m),
    );

    register(ClientMessageType.Attack, (c, m) => CombatHandlers.handleAttack(this.ctx, c, m));
    register(ClientMessageType.Cast, (c, m) => CombatHandlers.handleCast(this.ctx, c, m));
    register(ClientMessageType.Meditate, (c) => CombatHandlers.handleMeditate(this.ctx, c));
    register(ClientMessageType.TogglePvP, (c) => CombatHandlers.handleTogglePvP(this.ctx, c));

    register(ClientMessageType.Pickup, (c, m) => ItemHandlers.handlePickup(this.ctx, c, m));
    register(ClientMessageType.DropItem, (c, m) => ItemHandlers.handleDropItem(this.ctx, c, m));
    register(ClientMessageType.Equip, (c, m) => ItemHandlers.handleEquip(this.ctx, c, m));
    register(ClientMessageType.Unequip, (c, m) => ItemHandlers.handleUnequip(this.ctx, c, m));
    register(ClientMessageType.UseItem, (c, m) => ItemHandlers.handleUseItem(this.ctx, c, m));
    register(ClientMessageType.Tame, (c, m) => TamingHandlers.handleTame(this.ctx, c, m));

    register(ClientMessageType.Interact, (c, m) =>
      InteractionHandlers.handleInteract(this.ctx, c, m),
    );
    register(ClientMessageType.QuestAccept, (c, m) =>
      InteractionHandlers.handleQuestAccept(this.ctx, c, m),
    );
    register(ClientMessageType.QuestComplete, (c, m) =>
      InteractionHandlers.handleQuestComplete(this.ctx, c, m),
    );

    register(ClientMessageType.Chat, (c, m) => SocialHandlers.handleChat(this.ctx, c, m));
    register(ClientMessageType.GroupInvite, (c, m) =>
      SocialHandlers.handleGroupInvite(this.ctx, c, m),
    );
    register(ClientMessageType.GroupAccept, (c, m) =>
      SocialHandlers.handleGroupAccept(this.ctx, c, m),
    );
    register(ClientMessageType.GroupLeave, (c) => SocialHandlers.handleGroupLeave(this.ctx, c));
    register(ClientMessageType.GroupKick, (c, m) => SocialHandlers.handleGroupKick(this.ctx, c, m));
    register(ClientMessageType.FriendRequest, (c, m) =>
      SocialHandlers.handleFriendRequest(this.ctx, c, m),
    );
    register(ClientMessageType.FriendAccept, (c, m) =>
      SocialHandlers.handleFriendAccept(this.ctx, c, m),
    );
    register(ClientMessageType.FriendRemove, (c, m) =>
      SocialHandlers.handleFriendRemove(this.ctx, c, m),
    );

    register(ClientMessageType.GuildCreate, (c, m) =>
      SocialHandlers.handleGuildCreate(this.ctx, c, m),
    );
    register(ClientMessageType.GuildInvite, (c, m) =>
      SocialHandlers.handleGuildInvite(this.ctx, c, m),
    );
    register(ClientMessageType.GuildAccept, (c, m) =>
      SocialHandlers.handleGuildAccept(this.ctx, c, m),
    );
    register(ClientMessageType.GuildLeave, (c) => SocialHandlers.handleGuildLeave(this.ctx, c));
    register(ClientMessageType.GuildKick, (c, m) => SocialHandlers.handleGuildKick(this.ctx, c, m));
    register(ClientMessageType.GuildPromote, (c, m) =>
      SocialHandlers.handleGuildPromote(this.ctx, c, m),
    );
    register(ClientMessageType.GuildDemote, (c, m) =>
      SocialHandlers.handleGuildDemote(this.ctx, c, m),
    );

    register(ClientMessageType.BuyItem, (c, m) => EconomyHandlers.handleBuyItem(this.ctx, c, m));
    register(ClientMessageType.SellItem, (c, m) => EconomyHandlers.handleSellItem(this.ctx, c, m));
    register(ClientMessageType.TradeRequest, (c, m) =>
      EconomyHandlers.handleTradeRequest(this.ctx, c, m),
    );
    register(ClientMessageType.TradeAccept, (c, m) =>
      EconomyHandlers.handleTradeAccept(this.ctx, c, m),
    );
    register(ClientMessageType.TradeOfferUpdate, (c, m) =>
      EconomyHandlers.handleTradeOfferUpdate(this.ctx, c, m),
    );
    register(ClientMessageType.TradeConfirm, (c) =>
      EconomyHandlers.handleTradeConfirm(this.ctx, c),
    );
    register(ClientMessageType.TradeCancel, (c) => EconomyHandlers.handleTradeCancel(this.ctx, c));
    register(ClientMessageType.BankDeposit, (c, m) =>
      EconomyHandlers.handleBankDeposit(this.ctx, c, m),
    );
    register(ClientMessageType.BankWithdraw, (c, m) =>
      EconomyHandlers.handleBankWithdraw(this.ctx, c, m),
    );
    register(ClientMessageType.BankClose, (c) => EconomyHandlers.handleBankClose(this.ctx, c));

    register(ClientMessageType.Audio, this.handleAudio.bind(this));
  }

  private handleAudio(client: Client, data: ArrayBuffer): void {
    const speaker = HandlerUtils.getActivePlayer(this.ctx, client);
    if (!speaker) return;

    for (const [sessionId, player] of this.ctx.state.players) {
      if (sessionId === client.sessionId) continue;
      if (MathUtils.dist(speaker.getPosition(), player.getPosition()) > VOICE_RANGE) continue;

      const target = this.ctx.findClientBySessionId(sessionId);
      target?.send(ServerMessageType.Audio, { sessionId: client.sessionId, data });
    }
  }
}
