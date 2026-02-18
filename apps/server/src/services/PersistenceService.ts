import { EquipSlot, Prisma } from "../generated/prisma";
import { prisma } from "../database/db";
import { CLASS_STATS, Direction, ClassType } from "@abraxas/shared";
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

/** Common include shape used by both loadPlayer and createPlayer. */
const PLAYER_INCLUDE = {
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

export class PersistenceService {
  static async loadPlayer(userId: string, playerName: string) {
    return prisma.character.findFirst({
      where: { accountId: userId, name: playerName },
      include: PLAYER_INCLUDE,
    });
  }

  static async createPlayer(
    userId: string,
    playerName: string,
    classType: ClassType,
    x: number,
    y: number,
    mapName: string,
  ) {
    const stats = CLASS_STATS[classType];
    if (!stats) throw new Error("Invalid class type");

    try {
      return await prisma.character.create({
        data: {
          account: { connect: { id: userId } },
          name: playerName,
          class: classType,
          mapId: mapName,
          x,
          y,
          stats: {
            create: {
              hp: stats.hp,
              maxHp: stats.hp,
              mp: stats.mana,
              maxMp: stats.mana,
              str: stats.str,
              agi: stats.agi,
              int: stats.int,
            },
          },
          inventory: { create: { size: 40 } },
        },
        include: PLAYER_INCLUDE,
      });
    } catch (e: unknown) {
      if (
        e instanceof Error &&
        (e as { code?: string }).code === "P2002"
      ) {
        throw new Error("Character name already taken");
      }
      throw e;
    }
  }

  static async savePlayer(
    characterId: string,
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

      const character = await prisma.character.update({
        where: { id: characterId },
        data: {
          x: data.x,
          y: data.y,
          mapId: data.mapId,
          gold: BigInt(data.gold),
          level: data.level,
          exp: BigInt(data.xp),
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
        include: { inventory: true },
      });

      if (!character.inventory) return;
      const inventoryId = character.inventory.id;

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
                  boundToCharacterId: character.id,
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

        // Update equipment slots
        for (const key of Object.keys(
          data.equipment,
        ) as (keyof EquipmentData)[]) {
          const schemaSlot = EQUIPMENT_SLOT_MAP[key];
          if (!schemaSlot) continue;

          const itemCode = data.equipment[key];

          if (!itemCode) {
            await tx.equipment.deleteMany({
              where: { characterId: character.id, slot: schemaSlot },
            });
          } else {
            const instance = await tx.itemInstance.findFirst({
              where: {
                boundToCharacterId: character.id,
                itemDef: { code: itemCode },
              },
            });

            if (instance) {
              await tx.equipment.upsert({
                where: {
                  characterId_slot: {
                    characterId: character.id,
                    slot: schemaSlot,
                  },
                },
                update: { itemId: instance.id },
                create: {
                  characterId: character.id,
                  slot: schemaSlot,
                  itemId: instance.id,
                },
              });
            }
          }
        }
      });
    } catch (e) {
      logger.error({ message: "Failed to save player", error: String(e) });
    }
  }
}
