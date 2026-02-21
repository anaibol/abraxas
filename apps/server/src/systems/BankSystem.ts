import type { ItemAffix } from "@abraxas/shared";
import { type InventoryEntry, ITEMS, ItemRarity, type StatType } from "@abraxas/shared";
import { prisma } from "../database/db";
import { logger } from "../logger";
import type { Player } from "../schema/Player";
import type { InventorySystem } from "./InventorySystem";

export class BankSystem {
  private activeBanks = new Map<string, InventoryEntry[]>();

  constructor(private inventory: InventorySystem) {}

  async openBank(player: Player): Promise<InventoryEntry[]> {
    if (this.activeBanks.has(player.sessionId)) {
      return this.activeBanks.get(player.sessionId)!;
    }

    // Load from DB
    const dbBank = await prisma.bank.findUnique({
      where: { characterId: player.dbId },
      include: { slots: { include: { item: { include: { itemDef: true } } } } },
    });

    const items: InventoryEntry[] =
      dbBank?.slots.map((s) => ({
        itemId: s.item?.itemDef.code || "",
        quantity: s.qty,
        slotIndex: s.idx,
        rarity: s.item?.rarity ?? ItemRarity.COMMON,
        affixes: s.item?.affixesJson || [],
      })) || [];

    this.activeBanks.set(player.sessionId, items);
    return items;
  }

  deposit(
    player: Player,
    itemId: string,
    quantity: number,
    slotIndex: number,
    onError?: (msg: string) => void,
  ): boolean {
    const bankItems = this.activeBanks.get(player.sessionId);
    if (!bankItems) {
      onError?.("Bank not open");
      return false;
    }

    // Find item in player inventory
    const invItem = player.inventory.find((i) => i.slotIndex === slotIndex);
    if (!invItem || invItem.itemId !== itemId || invItem.quantity < quantity) {
      onError?.("Item not found in inventory");
      return false;
    }

    const def = ITEMS[itemId];
    if (!def) return false;

    // Capacity Check (Max 50 slots)
    // For stackable items, it only takes a new slot if it doesn't already exist.
    // For non-stackable, it takes 'quantity' new slots.
    const currentSlots = bankItems.length;
    let neededSlots = 0;
    if (def.stackable) {
      if (!bankItems.find((i) => i.itemId === itemId)) {
        neededSlots = 1;
      }
    } else {
      neededSlots = quantity;
    }

    if (currentSlots + neededSlots > 50) {
      onError?.("game.bank_full");
      return false;
    }

    // Move to bank
    if (def.stackable) {
      const existing = bankItems.find((i) => i.itemId === itemId);
      if (existing) {
        // Bug #53: Stackable items should never have unique affixes, so merging quantities is safe.
        // If a stackable item somehow has affixes, the existing stack's affixes are preserved.
        existing.quantity += quantity;
      } else {
        const nextIdx = this.getNextIndex(bankItems);
        bankItems.push({
          itemId,
          quantity,
          slotIndex: nextIdx,
          rarity: invItem.rarity,
          affixes: Array.from(invItem.affixes).map((a) => ({
            type: a.affixType,
            stat: a.stat,
            value: a.value,
          })),
        });
      }
    } else {
      // Non-stackable: add as separate slots
      for (let i = 0; i < quantity; i++) {
        const nextIdx = this.getNextIndex(bankItems);
        bankItems.push({
          itemId,
          quantity: 1,
          slotIndex: nextIdx,
          rarity: invItem.rarity,
          affixes: Array.from(invItem.affixes).map((a) => ({
            type: a.affixType,
            stat: a.stat,
            value: a.value,
          })),
        });
      }
    }

    // Remove from inventory
    if (invItem.quantity > quantity) {
      invItem.quantity -= quantity;
    } else {
      const idx = player.inventory.indexOf(invItem);
      player.inventory.splice(idx, 1);
    }

    return true;
  }

  withdraw(
    player: Player,
    itemId: string,
    quantity: number,
    bankSlotIndex: number,
    onError?: (msg: string) => void,
  ): boolean {
    const bankItems = this.activeBanks.get(player.sessionId);
    if (!bankItems) {
      onError?.("Bank not open");
      return false;
    }

    const bankItem = bankItems.find((i) => i.slotIndex === bankSlotIndex);
    if (!bankItem || bankItem.itemId !== itemId || bankItem.quantity < quantity) {
      onError?.("Item not found in bank");
      return false;
    }

    // Try add to inventory
    const instanceData = {
      rarity: bankItem.rarity,
      affixes: bankItem.affixes || [],
    };

    if (this.inventory.addItem(player, itemId, quantity, instanceData, onError)) {
      // Remove from bank
      if (bankItem.quantity > quantity) {
        bankItem.quantity -= quantity;
      } else {
        const idx = bankItems.indexOf(bankItem);
        bankItems.splice(idx, 1);
      }
      return true;
    }

    return false;
  }

  async closeBank(player: Player) {
    const items = this.activeBanks.get(player.sessionId);
    if (!items) return;

    try {
      // Bug #3 fix: Use explicit 30s timeout (default 5s is too short for 50-slot banks)
      // and batch itemDef lookups to reduce round-trips.
      await prisma.$transaction(async (tx) => {
        const bank = await tx.bank.upsert({
          where: { characterId: player.dbId },
          update: {},
          create: { characterId: player.dbId },
        });

        // Bug #52: Delete old ItemInstances linked to bank slots before deleting slots
        const oldSlots = await tx.bankSlot.findMany({
          where: { bankId: bank.id },
          select: { itemId: true },
        });
        const oldItemIds = oldSlots.map((s) => s.itemId).filter(Boolean) as string[];
        if (oldItemIds.length > 0) {
          await tx.itemInstance.deleteMany({ where: { id: { in: oldItemIds } } });
        }
        // Delete old slots
        await tx.bankSlot.deleteMany({ where: { bankId: bank.id } });

        // Batch-resolve all itemDef codes in one query
        const uniqueCodes = [...new Set(items.map((i) => i.itemId))];
        const itemDefs = await tx.itemDef.findMany({
          where: { code: { in: uniqueCodes } },
        });
        const defMap = new Map(itemDefs.map((d) => [d.code, d]));

        // Create new slots
        for (const item of items) {
          const itemDef = defMap.get(item.itemId);
          if (!itemDef) continue;

          const instance = await tx.itemInstance.create({
            data: {
              itemDefId: itemDef.id,
              rarity: item.rarity ?? ItemRarity.COMMON,
              affixesJson: item.affixes ?? [],
            },
          });

          await tx.bankSlot.create({
            data: {
              bankId: bank.id,
              idx: item.slotIndex,
              itemId: instance.id,
              qty: item.quantity,
            },
          });
        }
      }, { timeout: 30_000 });
    } catch (e) {
      logger.error({ message: "Failed to persist bank", error: String(e) });
    } finally {
      this.activeBanks.delete(player.sessionId);
    }
  }

  private getNextIndex(items: InventoryEntry[]): number {
    const used = new Set(items.map((i) => i.slotIndex));
    for (let i = 0; i < 1000; i++) {
      if (!used.has(i)) return i;
    }
    return 999;
  }
}
