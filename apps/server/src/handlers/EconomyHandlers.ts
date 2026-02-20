import {
  type ClientMessages,
  type ClientMessageType,
  ITEMS,
  MERCHANT_INVENTORY,
  ServerMessageType,
  type TradeState,
} from "@abraxas/shared";
import type { Client } from "@colyseus/core";
import type { Player } from "../schema/Player";
import { HandlerUtils } from "./HandlerUtils";
import { InteractionHandlers } from "./InteractionHandlers";
import type { RoomContext } from "./RoomContext";

export class EconomyHandlers {
  // ── Trading ─────────────────────────────────────────────────────────────
  static handleTradeRequest(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.TradeRequest],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    const target = ctx.state.players.get(data.targetSessionId);
    if (!player || !target || !target.alive) return;

    if (!HandlerUtils.assertInRange(client, player, target, 3, "game.too_far_trade")) return;

    ctx.systems.trade.handleRequest(player, target, (sid, type, msg) => {
      ctx.findClientBySessionId(sid)?.send(type, msg);
    });
  }

  static handleTradeAccept(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.TradeAccept],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    const requester = ctx.state.players.get(data.requesterSessionId);
    if (!player || !requester || !requester.alive) return;

    const trade = ctx.systems.trade.handleAccept(requester, player);
    if (trade) {
      const rClient = ctx.findClientBySessionId(requester.sessionId);
      rClient?.send(ServerMessageType.TradeStarted, {
        targetSessionId: player.sessionId,
        targetName: player.name,
      });
      client.send(ServerMessageType.TradeStarted, {
        targetSessionId: requester.sessionId,
        targetName: requester.name,
      });

      EconomyHandlers.sendToParticipants(ctx, trade, ServerMessageType.TradeStateUpdate, trade);
    } else {
      HandlerUtils.sendError(client, "game.trade_failed_accept");
    }
  }

  private static sendToParticipants(
    ctx: RoomContext,
    trade: TradeState,
    type: ServerMessageType,
    data: unknown,
  ) {
    ctx.findClientBySessionId(trade.alice.sessionId)?.send(type, data);
    ctx.findClientBySessionId(trade.bob.sessionId)?.send(type, data);
  }

  static handleTradeOfferUpdate(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.TradeOfferUpdate],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    const trade = ctx.systems.trade.updateOffer(client.sessionId, data);
    if (trade) {
      EconomyHandlers.sendToParticipants(ctx, trade, ServerMessageType.TradeStateUpdate, trade);
    }
  }

  static handleTradeConfirm(ctx: RoomContext, client: Client): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    const trade = ctx.systems.trade.confirm(client.sessionId);
    if (trade) {
      EconomyHandlers.sendToParticipants(ctx, trade, ServerMessageType.TradeStateUpdate, trade);

      if (ctx.systems.trade.canComplete(trade)) {
        ctx.systems.trade.executeTrade(trade, ctx.state.players).then((success) => {
          if (success) {
            EconomyHandlers.sendToParticipants(ctx, trade, ServerMessageType.TradeCompleted, {});
          } else {
            EconomyHandlers.sendToParticipants(ctx, trade, ServerMessageType.TradeCancelled, {
              reason: "game.trade_failed_validation",
            });
          }
        });
      }
    }
  }

  static handleTradeCancel(ctx: RoomContext, client: Client): void {
    const trade = ctx.systems.trade.cancel(client.sessionId);
    if (trade) {
      EconomyHandlers.sendToParticipants(ctx, trade, ServerMessageType.TradeCancelled, {
        reason: "game.trade_cancelled_by_player",
      });
    }
  }

  // ── Bank Handlers ────────────────────────────────────────────────────────

  static async openBank(ctx: RoomContext, client: Client) {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    const items = await ctx.systems.bank.openBank(player);
    client.send(ServerMessageType.BankOpened, {});
    client.send(ServerMessageType.BankSync, { items });
  }

  static handleBankDeposit(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.BankDeposit],
  ) {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    if (
      ctx.systems.bank.deposit(player, data.itemId, data.quantity, data.slotIndex, (msg: string) =>
        HandlerUtils.sendError(client, msg),
      )
    ) {
      EconomyHandlers.syncBank(ctx, client, player);
    }
  }

  static handleBankWithdraw(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.BankWithdraw],
  ) {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    if (
      ctx.systems.bank.withdraw(
        player,
        data.itemId,
        data.quantity,
        data.bankSlotIndex,
        (msg: string) => HandlerUtils.sendError(client, msg),
      )
    ) {
      EconomyHandlers.syncBank(ctx, client, player);
    }
  }

  static handleBankClose(ctx: RoomContext, client: Client) {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    ctx.systems.bank.closeBank(player);
  }

  private static async syncBank(ctx: RoomContext, client: Client, player: Player) {
    const items = await ctx.systems.bank.openBank(player);
    client.send(ServerMessageType.BankSync, { items });
  }

  // ── Shops ────────────────────────────────────────────────────────────────

  static handleBuyItem(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.BuyItem],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    if (!InteractionHandlers.isNearNpcType(ctx, player, "merchant")) {
      HandlerUtils.sendHint(client, "game.too_far_merchant");
      return;
    }

    const merchantStock = MERCHANT_INVENTORY.general_store ?? [];
    if (!merchantStock.includes(data.itemId)) {
      HandlerUtils.sendError(client, "game.not_available");
      return;
    }

    const itemDef = ITEMS[data.itemId];
    if (!itemDef) return;

    const quantity = Math.max(1, data.quantity ?? 1);

    if (!itemDef.stackable && quantity > 1) {
      HandlerUtils.sendError(client, "game.only_buy_one");
      return;
    }

    const totalCost = itemDef.goldValue * quantity;
    if (player.gold < totalCost) {
      HandlerUtils.sendError(client, "game.not_enough_gold");
      return;
    }

    if (
      ctx.systems.inventory.addItem(player, data.itemId, quantity, undefined, (msg: string) =>
        HandlerUtils.sendError(client, msg),
      )
    ) {
      player.gold -= totalCost;
      client.send(ServerMessageType.Notification, {
        message: "game.bought_item",
        templateData: { quantity, item: itemDef.name },
      });
    }
  }

  static handleSellItem(
    ctx: RoomContext,
    client: Client,
    data: ClientMessages[ClientMessageType.SellItem],
  ): void {
    const player = HandlerUtils.getActivePlayer(ctx, client);
    if (!player) return;

    if (!InteractionHandlers.isNearNpcType(ctx, player, "merchant")) {
      HandlerUtils.sendHint(client, "game.too_far_merchant");
      return;
    }

    const itemDef = ITEMS[data.itemId];
    if (!itemDef) return;

    const slot = player.inventory.find((s) => s.itemId === data.itemId);
    if (!slot) {
      HandlerUtils.sendError(client, "game.item_not_found");
      return;
    }
    const quantity = Math.min(data.quantity ?? 1, slot.quantity);
    if (quantity <= 0) return;

    const sellValue = Math.floor(itemDef.goldValue * 0.5) * quantity;

    if (ctx.systems.inventory.removeItem(player, slot.slotIndex, quantity)) {
      player.gold += sellValue;
      client.send(ServerMessageType.Notification, {
        message: "game.sold_item",
        templateData: { quantity, item: itemDef.name, gold: sellValue },
      });
    } else {
      HandlerUtils.sendError(client, "game.item_not_found");
    }
  }
}
