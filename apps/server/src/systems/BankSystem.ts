import type { ItemAffix } from "@abraxas/shared";
import { type InventoryEntry, ITEMS, ItemRarity, type StatType } from "@abraxas/shared";
import { prisma } from "../database/db";
import { ItemRarity as PrismaItemRarity } from "../generated/prisma";
import { logger } from "../logger";
import type { Player } from "../schema/Player";
import type { InventorySystem } from "./InventorySystem";

const MAX_BANK_SLOTS = 50;

export class BankSystem {
  constructor(private inventory: InventorySystem) {}

  /** Load bank items directly from DB. No in-memory cache. */
  async openBank(player: Player): Promise<InventoryEntry[]> {
    const dbBank = await prisma.bank.findUnique({
      where: { characterId: player.dbId },
      include: { slots: { include: { item: { include: { itemDef: true } } } } },
    });

    return (
      dbBank?.slots.map((s) => ({
        itemId: s.item?.itemDef.code || "",
        quantity: s.qty,
        slotIndex: s.idx,
        rarity: s.item?.rarity ?? ItemRarity.COMMON,
        affixes: (s.item?.affixesJson as ItemAffix[]) || [],
      })) || []
    );
  }

  /** Deposit an item from player inventory into the bank. Writes directly to DB. */
  async deposit(
    player: Player,
    itemId: string,
    quantity: number,
    slotIndex: number,
    onError?: (msg: string) => void,
  ): Promise<boolean> {
    // Find item in player inventory
    const invItem = player.inventory.find((i) => i.slotIndex === slotIndex);
    if (!invItem || invItem.itemId !== itemId || invItem.quantity < quantity) {
      onError?.("Item not found in inventory");
      return false;
    }

    const def = ITEMS[itemId];
    if (!def) return false;

    try {
      await prisma.$transaction(async (tx) => {
        // Ensure bank exists
        const bank = await tx.bank.upsert({
          where: { characterId: player.dbId },
          update: {},
          create: { characterId: player.dbId },
        });

        // Load current bank slots
        const currentSlots = await tx.bankSlot.findMany({
          where: { bankId: bank.id },
          include: { item: { include: { itemDef: true } } },
        });

        // Capacity check
        let neededSlots = 0;
        if (def.stackable) {
          const existingSlot = currentSlots.find((s) => s.item?.itemDef.code === itemId);
          if (!existingSlot) neededSlots = 1;
        } else {
          neededSlots = quantity;
        }

        if (currentSlots.length + neededSlots > MAX_BANK_SLOTS) {
          throw new Error("game.bank_full");
        }

        if (def.stackable) {
          const existingSlot = currentSlots.find((s) => s.item?.itemDef.code === itemId);
          if (existingSlot) {
            // Update existing stack quantity
            await tx.bankSlot.update({
              where: { id: existingSlot.id },
              data: { qty: existingSlot.qty + quantity },
            });
          } else {
            // Create new stack
            const itemDef = await tx.itemDef.findUnique({ where: { code: itemId } });
            if (!itemDef) throw new Error("Item def not found");

            const usedIndices = new Set(currentSlots.map((s) => s.idx));
            let nextIdx = 0;
            while (usedIndices.has(nextIdx) && nextIdx < MAX_BANK_SLOTS) nextIdx++;

            const instance = await tx.itemInstance.create({
              data: {
                itemDefId: itemDef.id,
                rarity: (invItem.rarity ?? ItemRarity.COMMON) as PrismaItemRarity,
                affixesJson: Array.from(invItem.affixes).map((a) => ({
                  type: a.affixType,
                  stat: a.stat,
                  value: a.value,
                })),
              },
            });

            await tx.bankSlot.create({
              data: { bankId: bank.id, idx: nextIdx, itemId: instance.id, qty: quantity },
            });
          }
        } else {
          // Non-stackable: create separate slots for each
          const itemDef = await tx.itemDef.findUnique({ where: { code: itemId } });
          if (!itemDef) throw new Error("Item def not found");

          const usedIndices = new Set(currentSlots.map((s) => s.idx));
          for (let i = 0; i < quantity; i++) {
            let nextIdx = 0;
            while (usedIndices.has(nextIdx) && nextIdx < MAX_BANK_SLOTS) nextIdx++;
            usedIndices.add(nextIdx);

            const instance = await tx.itemInstance.create({
              data: {
                itemDefId: itemDef.id,
                rarity: (invItem.rarity ?? ItemRarity.COMMON) as PrismaItemRarity,
                affixesJson: Array.from(invItem.affixes).map((a) => ({
                  type: a.affixType,
                  stat: a.stat,
                  value: a.value,
                })),
              },
            });

            await tx.bankSlot.create({
              data: { bankId: bank.id, idx: nextIdx, itemId: instance.id, qty: 1 },
            });
          }
        }
      });

      // Success — remove from player inventory
      if (invItem.quantity > quantity) {
        invItem.quantity -= quantity;
      } else {
        const idx = player.inventory.indexOf(invItem);
        player.inventory.splice(idx, 1);
      }

      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "game.bank_full") {
        onError?.(msg);
      } else {
        logger.error({ message: "Bank deposit failed", error: msg });
        onError?.("Bank operation failed");
      }
      return false;
    }
  }

  /** Withdraw an item from the bank into player inventory. Writes directly to DB. */
  async withdraw(
    player: Player,
    itemId: string,
    quantity: number,
    bankSlotIndex: number,
    onError?: (msg: string) => void,
  ): Promise<boolean> {
    try {
      // Load the specific bank slot from DB
      const bank = await prisma.bank.findUnique({
        where: { characterId: player.dbId },
        include: { slots: { include: { item: { include: { itemDef: true } } } } },
      });

      if (!bank) {
        onError?.("Bank not open");
        return false;
      }

      const bankSlot = bank.slots.find((s) => s.idx === bankSlotIndex);
      if (!bankSlot || bankSlot.item?.itemDef.code !== itemId || bankSlot.qty < quantity) {
        onError?.("Item not found in bank");
        return false;
      }

      const instanceData = {
        rarity: bankSlot.item?.rarity ?? ItemRarity.COMMON,
        affixes: (bankSlot.item?.affixesJson as ItemAffix[]) || [],
      };

      // Try to add to inventory first
      if (!this.inventory.addItem(player, itemId, quantity, instanceData, onError)) {
        return false;
      }

      // Success — remove from bank in DB
      if (bankSlot.qty > quantity) {
        await prisma.bankSlot.update({
          where: { id: bankSlot.id },
          data: { qty: bankSlot.qty - quantity },
        });
      } else {
        // Remove slot and its item instance
        await prisma.bankSlot.delete({ where: { id: bankSlot.id } });
        if (bankSlot.itemId) {
          await prisma.itemInstance.delete({ where: { id: bankSlot.itemId } }).catch(() => {});
        }
      }

      return true;
    } catch (e) {
      logger.error({ message: "Bank withdraw failed", error: String(e) });
      onError?.("Bank operation failed");
      return false;
    }
  }

  /** No-op — bank is now persisted directly on each operation. */
  async closeBank(_player: Player): Promise<void> {
    // Nothing to do — data is already in DB
  }
}
