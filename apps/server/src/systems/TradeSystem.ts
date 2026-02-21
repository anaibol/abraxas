import {
  ITEMS,
  type ItemRarity,
  MAX_INVENTORY_SLOTS,
  ServerMessageType,
  type StatType,
  type TradeOffer,
  type TradeState,
} from "@abraxas/shared";
import { logger } from "../logger";
import type { Player } from "../schema/Player";
import type { InventorySystem } from "./InventorySystem";

export class TradeSystem {
  private activeTrades = new Map<string, TradeState>();
  private pendingRequests = new Map<string, string>(); // targetSessionId -> requesterSessionId
  private executingTrades = new Set<string>();

  constructor(private inventorySystem: InventorySystem) {}

  handleRequest(
    requester: Player,
    target: Player,
    sendToClient: (
      sessionId: string,
      type: ServerMessageType,
      data: Record<string, unknown>,
    ) => void,
  ): boolean {
    if (this.activeTrades.has(requester.sessionId)) return false;
    if (this.activeTrades.has(target.sessionId)) return false;

    this.pendingRequests.set(target.sessionId, requester.sessionId);
    sendToClient(target.sessionId, ServerMessageType.TradeRequested, {
      requesterSessionId: requester.sessionId,
      requesterName: requester.name,
    });

    logger.info({
      intent: "trade_request",
      from: requester.sessionId,
      to: target.sessionId,
    });
    return true;
  }

  handleAccept(requester: Player, target: Player): TradeState | null {
    if (this.activeTrades.has(requester.sessionId) || this.activeTrades.has(target.sessionId)) {
      return null;
    }

    const tradeId = `${requester.sessionId}-${target.sessionId}`;
    const trade: TradeState = {
      tradeId,
      alice: {
        sessionId: requester.sessionId,
        name: requester.name,
        offer: { gold: 0, items: [], confirmed: false },
      },
      bob: {
        sessionId: target.sessionId,
        name: target.name,
        offer: { gold: 0, items: [], confirmed: false },
      },
    };

    this.activeTrades.set(requester.sessionId, trade);
    this.activeTrades.set(target.sessionId, trade);
    this.pendingRequests.delete(target.sessionId);

    logger.info({ intent: "trade_started", tradeId });
    return trade;
  }

  updateOffer(
    player: Player,
    offer: { gold: number; items: { itemId: string; quantity: number }[] },
  ) {
    const trade = this.activeTrades.get(player.sessionId);
    if (!trade) return null;

    const isAlice = trade.alice.sessionId === player.sessionId;
    const participant = isAlice ? trade.alice : trade.bob;
    const other = isAlice ? trade.bob : trade.alice;

    participant.offer.gold = Math.max(0, offer.gold);

    // Validate each item against the actual inventory to get metadata
    const validatedItems: TradeOffer["items"] = [];
    for (const off of offer.items) {
      // Bug #51: Clamp non-stackable item quantity to 1
      const itemDef = ITEMS[off.itemId];
      if (itemDef && !itemDef.stackable && off.quantity > 1) {
        off.quantity = 1;
      }
      const invItem = player.inventory.find((i) => i.itemId === off.itemId);
      if (!invItem || invItem.quantity < off.quantity) {
        logger.warn({
          message: "Invalid trade offer item",
          sessionId: player.sessionId,
          item: off,
        });
        return null; // Reject the whole update if any item is invalid
      }

      validatedItems.push({
        itemId: off.itemId,
        quantity: off.quantity,
        slotIndex: invItem.slotIndex,
        rarity: invItem.rarity,
        nameOverride: invItem.nameOverride,
        affixes: Array.from(invItem.affixes).map((a) => ({
          type: a.affixType,
          stat: a.stat,
          value: a.value,
        })),
      });
    }

    participant.offer.items = validatedItems;
    participant.offer.confirmed = false;
    other.offer.confirmed = false; // Reset other if offer changes

    return trade;
  }

  confirm(sessionId: string) {
    const trade = this.activeTrades.get(sessionId);
    if (!trade) return null;

    const isAlice = trade.alice.sessionId === sessionId;
    const participant = isAlice ? trade.alice : trade.bob;
    participant.offer.confirmed = true;

    return trade;
  }

  canComplete(trade: TradeState): boolean {
    return trade.alice.offer.confirmed && trade.bob.offer.confirmed;
  }

  async executeTrade(trade: TradeState, players: { get: (id: string) => Player | undefined }): Promise<boolean | null> {
    // Bug #1 fix: Check canComplete under the lock to prevent TOCTOU race
    if (this.executingTrades.has(trade.tradeId)) return null;
    this.executingTrades.add(trade.tradeId);

    try {
      // Must re-check after acquiring the lock
      if (!this.canComplete(trade)) return null;

      const alice = players.get(trade.alice.sessionId);
      const bob = players.get(trade.bob.sessionId);

      if (!alice || !bob) return false;

      // Validate Alice has everything
      if (!this.validateOffer(alice, trade.alice.offer)) return false;
      // Validate Bob has everything
      if (!this.validateOffer(bob, trade.bob.offer)) return false;

      // Validate Inventory Space
      if (!this.hasSpaceFor(alice, trade.alice.offer, trade.bob.offer)) return false;
      if (!this.hasSpaceFor(bob, trade.bob.offer, trade.alice.offer)) return false;

      // Transfer from Alice to Bob
      this.transfer(alice, bob, trade.alice.offer);
      // Transfer from Bob to Alice
      this.transfer(bob, alice, trade.bob.offer);

      this.cleanup(trade.alice.sessionId);
      this.cleanup(trade.bob.sessionId);

      return true;
    } finally {
      this.executingTrades.delete(trade.tradeId);
    }
  }

  private hasSpaceFor(
    player: Player,
    givingOffer: TradeOffer,
    receivingOffer: TradeOffer,
  ): boolean {
    // Count how many unique slots will be freed.
    // We assume giving items are removed first.
    let slotsFreed = 0;
    for (const off of givingOffer.items) {
      const slot = player.inventory.find((i) => i.itemId === off.itemId);
      if (slot && slot.quantity === off.quantity) {
        slotsFreed++;
      }
    }

    // Count how many new slots are needed.
    let slotsNeeded = 0;
    for (const off of receivingOffer.items) {
      const def = ITEMS[off.itemId];
      if (def?.stackable) {
        const existing = player.inventory.find((i) => i.itemId === off.itemId);
        if (existing) {
          const givingThisItem = givingOffer.items.find((i) => i.itemId === off.itemId);
          if (givingThisItem && givingThisItem.quantity === existing.quantity) {
            // We are giving the whole stack away. The incoming stack will take a slot.
            slotsNeeded++;
          }
          // Otherwise stacks onto existing, no new slot needed
        } else {
          slotsNeeded++;
        }
      } else {
        // Non-stackable always needs a slot per unit.
        slotsNeeded += off.quantity;
      }
    }

    return player.inventory.length - slotsFreed + slotsNeeded <= MAX_INVENTORY_SLOTS;
  }

  private validateOffer(player: Player, offer: TradeOffer): boolean {
    if (player.gold < offer.gold) return false;
    for (const item of offer.items) {
      const slot = player.inventory.find((s) => s.itemId === item.itemId);
      if (!slot || slot.quantity < item.quantity) return false;
    }
    return true;
  }

  private transfer(from: Player, to: Player, offer: TradeOffer) {
    if (offer.gold > 0) {
      from.gold -= offer.gold;
      to.gold += offer.gold;
    }
    for (const item of offer.items) {
      if (this.inventorySystem.removeItem(from, item.itemId, item.quantity, item.slotIndex)) {
        this.inventorySystem.addItem(to, item.itemId, item.quantity, {
          rarity: item.rarity!,
          nameOverride: item.nameOverride,
          affixes: item.affixes || [],
        });
      }
    }
  }

  cancel(sessionId: string) {
    const trade = this.activeTrades.get(sessionId);
    if (trade) {
      this.cleanup(trade.alice.sessionId);
      this.cleanup(trade.bob.sessionId);
      return trade;
    }
    this.pendingRequests.delete(sessionId);
    // Also remove any pending request where this player is the requester
    for (const [target, requester] of this.pendingRequests) {
      if (requester === sessionId) {
        this.pendingRequests.delete(target);
        break;
      }
    }
    return null;
  }

  private cleanup(sessionId: string) {
    this.activeTrades.delete(sessionId);
  }

  getActiveTrade(sessionId: string) {
    return this.activeTrades.get(sessionId);
  }
}
