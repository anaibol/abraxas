import { EquipSlot, Prisma } from "../generated/prisma";
import { prisma } from "../database/db";
import { Direction, ClassType } from "@abraxas/shared";
import type { InventoryEntry, EquipmentData } from "@abraxas/shared";
import { logger } from "../logger";

/** Maps EquipmentData keys to Prisma EquipSlot enum values. */
const EQUIPMENT_SLOT_MAP: Partial<Record<keyof EquipmentData, EquipSlot>> = {
  weapon: EquipSlot.WEAPON_MAIN,
  shield: EquipSlot.WEAPON_OFF,
  helmet: EquipSlot.HEAD,
  armor: EquipSlot.CHEST,
  ring: EquipSlot.RING1,
};

/** Common include shape used by loadChar and createChar. */
const CHAR_INCLUDE = {
  inventory: {
    include: {
      slots: {
        include: {
          item: {
            include: { itemDef: true },
          },
        },
      },
    },
  },
  stats: true,
  equipments: {
    include: {
      item: {
        include: { itemDef: true },
      },
    },
  },
} as const;

/** Strictly typed Character with all relations included. */
export type FullCharacter = Prisma.CharacterGetPayload<{
  include: typeof CHAR_INCLUDE;
}>;

/** Type guard for basic character relations. */
const charWithStats = Prisma.validator<Prisma.CharacterDefaultArgs>()({
  include: { stats: true },
});
type CharacterWithStats = Prisma.CharacterGetPayload<typeof charWithStats>;

export class PersistenceService {
  static async loadChar(id: string): Promise<FullCharacter | null> {
    return prisma.character.findUnique({
      where: { id },
      include: CHAR_INCLUDE,
    });
  }

  static async saveChar(
    id: string,
    data: {
      x: number;
      y: number;
      mapId: string;
      hp: number;
      maxHp: number;
      mana: number;
      maxMana: number;
      str: number;
      agi: number;
      intStat: number;
      facing: Direction;
      gold: number;
      level: number;
      xp: number;
      maxXp: number;
      inventory: InventoryEntry[];
      equipment: EquipmentData;
      classType: ClassType;
    },
  ) {
    try {
      const facingStr = (Direction[data.facing] ?? "DOWN").toLowerCase();

      const char = await prisma.character.update({
        where: { id },
        data: {
          x: data.x,
          y: data.y,
          mapId: data.mapId,
          gold: data.gold,
          level: data.level,
          exp: data.xp,
          facing: facingStr,
          stats: {
            update: {
              hp: data.hp,
              maxHp: data.maxHp,
              mp: data.mana,
              maxMp: data.maxMana,
              str: data.str,
              agi: data.agi,
              int: data.intStat,
            },
          },
        },
        include: CHAR_INCLUDE,
      });

      if (!char.inventory) return;
      const inventoryId = char.inventory.id;

      await prisma.$transaction(async (tx) => {
        const currentSlots = await tx.inventorySlot.findMany({
          where: { inventoryId },
          include: { item: { include: { itemDef: true } } },
        });

        const currentMap = new Map(currentSlots.map((s) => [s.idx, s]));
        const savedIndices = new Set<number>();

        for (const item of data.inventory) {
          savedIndices.add(item.slotIndex);
          const current = currentMap.get(item.slotIndex);

          if (current && current.item?.itemDef.code === item.itemId) {
            if (current.qty !== item.quantity) {
              await tx.inventorySlot.update({
                where: { id: current.id },
                data: { qty: item.quantity },
              });
            }
          } else {
            if (current) {
              await tx.inventorySlot.delete({ where: { id: current.id } });
              if (current.itemId) {
                await tx.itemInstance.delete({ where: { id: current.itemId } });
              }
            }

            const itemDef = await tx.itemDef.findUnique({
              where: { code: item.itemId },
            });

            if (itemDef) {
              const instance = await tx.itemInstance.create({
                data: {
                  itemDefId: itemDef.id,
                  boundToCharacterId: char.id,
                },
              });

              await tx.inventorySlot.create({
                data: {
                  inventoryId,
                  idx: item.slotIndex,
                  itemId: instance.id,
                  qty: item.quantity,
                },
              });
            }
          }
        }

        for (const current of currentSlots) {
          if (!savedIndices.has(current.idx)) {
            await tx.inventorySlot.delete({ where: { id: current.id } });
            if (current.itemId) {
              await tx.itemInstance.delete({ where: { id: current.itemId } });
            }
          }
        }

        for (const key of Object.keys(data.equipment) as (keyof EquipmentData)[]) {
          const schemaSlot = EQUIPMENT_SLOT_MAP[key];
          if (!schemaSlot) continue;

          const itemCode = data.equipment[key];

          if (!itemCode) {
            await tx.equipment.deleteMany({
              where: { characterId: char.id, slot: schemaSlot },
            });
          } else {
            const instance = await tx.itemInstance.findFirst({
              where: {
                boundToCharacterId: char.id,
                itemDef: { code: itemCode },
              },
            });

            if (instance) {
              await tx.equipment.upsert({
                where: {
                  characterId_slot: { characterId: char.id, slot: schemaSlot },
                },
                update: { itemId: instance.id },
                create: {
                  characterId: char.id,
                  slot: schemaSlot,
                  itemId: instance.id,
                },
              });
            }
          }
        }
      });
    } catch (e) {
      logger.error({ message: "Failed to save char", error: String(e) });
    }
  }
}
