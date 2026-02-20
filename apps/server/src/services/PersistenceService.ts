import type { EquipmentData, InventoryEntry } from "@abraxas/shared";
import { type ClassType, Direction } from "@abraxas/shared";
import { prisma } from "../database/db";
import { EquipSlot, type Prisma } from "../generated/prisma";
import { logger } from "../logger";

/** Maps EquipmentData keys to Prisma EquipSlot enum values. */
const EQUIPMENT_SLOT_MAP: Record<string, EquipSlot | undefined> = {
  weapon: EquipSlot.WEAPON_MAIN,
  shield: EquipSlot.WEAPON_OFF,
  helmet: EquipSlot.HEAD,
  armor: EquipSlot.CHEST,
  ring: EquipSlot.RING1,
  mount: EquipSlot.MOUNT,
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
  companions: true,
} as const;

/** Strictly typed Character with all relations included. */
export type FullCharacter = Prisma.CharacterGetPayload<{
  include: typeof CHAR_INCLUDE;
}>;

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
      companions: { type: string; level: number; exp: number; hp: number }[];
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
                  rarity: (item as any).rarity || "common",
                  nameOverride: (item as any).nameOverride,
                  affixesJson: (item as any).affixes || [],
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

        for (const [key, itemCode] of Object.entries(data.equipment)) {
          const schemaSlot = EQUIPMENT_SLOT_MAP[key];
          if (!schemaSlot) continue;

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

        // --- Save Companions ---
        await tx.companion.deleteMany({ where: { characterId: char.id } });
        if (data.companions && data.companions.length > 0) {
          await tx.companion.createMany({
            data: data.companions.map((comp) => ({
              characterId: char.id,
              type: comp.type,
              level: comp.level,
              exp: comp.exp,
              hp: comp.hp,
            })),
          });
        }
        // -----------------------
      });
    } catch (e) {
      logger.error({ message: "Failed to save char", error: String(e) });
    }
  }

  static async loadWorldDrops(mapId: string) {
    return prisma.worldDrop.findMany({
      where: { mapId },
      include: {
        item: {
          include: { itemDef: true },
        },
      },
    });
  }

  static async saveWorldDrop(data: {
    id: string;
    mapId: string;
    tileX: number;
    tileY: number;
    itemType: string;
    itemId?: string;
    quantity: number;
    goldAmount: number;
    instanceData?: { rarity: string; nameOverride?: string; affixes: any[] };
  }) {
    let itemInstanceId = data.itemId;

    if (data.itemType === "item" && data.instanceData) {
      const itemDef = await prisma.itemDef.findUnique({ where: { code: data.itemId } });
      if (itemDef) {
        const instance = await prisma.itemInstance.create({
          data: {
            itemDefId: itemDef.id,
            rarity: data.instanceData.rarity,
            nameOverride: data.instanceData.nameOverride,
            affixesJson: data.instanceData.affixes,
          },
        });
        itemInstanceId = instance.id;
      }
    }

    return prisma.worldDrop.create({
      data: {
        id: data.id,
        mapId: data.mapId,
        tileX: data.tileX,
        tileY: data.tileY,
        itemType: data.itemType,
        itemId: itemInstanceId,
        quantity: data.quantity,
        goldAmount: data.goldAmount,
      },
    });
  }

  static async deleteWorldDrop(id: string) {
    return prisma.worldDrop.deleteMany({ where: { id } });
  }

  static async loadPersistentNpcs(mapId: string) {
    return prisma.npc.findMany({ where: { mapId } });
  }

  static async savePersistentNpcs(
    mapId: string,
    npcs: {
      npcType: string;
      tileX: number;
      tileY: number;
      spawnX: number;
      spawnY: number;
      level: number;
      hp: number;
      maxHp: number;
      isUnique: boolean;
      uniqueId?: string;
    }[],
  ) {
    await prisma.npc.deleteMany({ where: { mapId } });
    return prisma.npc.createMany({
      data: npcs.map((n) => ({
        mapId,
        npcType: n.npcType,
        tileX: n.tileX,
        tileY: n.tileY,
        spawnX: n.spawnX,
        spawnY: n.spawnY,
        level: n.level,
        hp: n.hp,
        maxHp: n.maxHp,
        isUnique: n.isUnique,
        uniqueId: n.uniqueId,
      })),
    });
  }
}
