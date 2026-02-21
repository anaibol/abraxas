import type { EquipmentData, InventoryEntry } from "@abraxas/shared";
import { type ClassType, Direction, ItemRarity } from "@abraxas/shared";
import { prisma } from "../database/db";
import { type DropType, EquipSlot, ItemRarity as PrismaItemRarity, type Prisma } from "../generated/prisma";
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
    const char = await prisma.character.findUnique({
      where: { id },
      include: CHAR_INCLUDE,
    });
    return char as FullCharacter | null;
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
      pvpKills: number;
      npcKills: number;
      pvpEnabled: boolean;
    },
  ) {
    try {
      // Bug #59: Use robust fallback for Direction enum → DB string
      const facingLookup: Record<number, string> = {
        [Direction.UP]: "UP",
        [Direction.DOWN]: "DOWN",
        [Direction.LEFT]: "LEFT",
        [Direction.RIGHT]: "RIGHT",
      };
      const facingStr = facingLookup[data.facing] ?? "DOWN";

      const char = (await prisma.character.update({
        where: { id },
        data: {
          x: data.x,
          y: data.y,
          mapId: data.mapId,
          gold: data.gold,
          level: data.level,
          exp: data.xp,
          facing: facingStr,
          pvpKills: data.pvpKills,
          npcKills: data.npcKills,
          pvpEnabled: data.pvpEnabled,
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
      })) as FullCharacter;

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
            // Same item in the same slot — update qty AND metadata in-place.
            // B094: preserves the ItemInstance DB row id so no FK churn.
            if (current.qty !== item.quantity) {
              await tx.inventorySlot.update({
                where: { id: current.id },
                data: { qty: item.quantity },
              });
            }
            if (current.itemId) {
              await tx.itemInstance.update({
                where: { id: current.itemId },
                data: {
                  rarity: item.rarity ?? ItemRarity.COMMON,
                  nameOverride: item.nameOverride ?? null,
                  affixesJson: item.affixes ?? [],
                },
              });
            }
          } else {
            // Different item in this slot (or slot is new) — must replace.
            if (current) {
              await tx.inventorySlot.delete({ where: { id: current.id } });
              // Bug #57: Don't eagerly delete itemInstance since it might just be moved to Equipment
            }

            const itemDef = await tx.itemDef.findUnique({
              where: { code: item.itemId },
            });

            if (itemDef) {
              const instance = await tx.itemInstance.create({
                data: {
                  itemDefId: itemDef.id,
                  boundToCharacterId: char.id,
                  rarity: item.rarity ?? ItemRarity.COMMON,
                  nameOverride: item.nameOverride,
                  affixesJson: item.affixes ?? [],
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
            // Bug #57: Don't eagerly delete itemInstance since it might just be moved to Equipment
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
            // Bug #58: Prefer the instance already linked to this equipment slot
            const existingEquip = await tx.equipment.findUnique({
              where: { characterId_slot: { characterId: char.id, slot: schemaSlot } },
              include: { item: { include: { itemDef: true } } },
            });
            const instance =
              (existingEquip?.item && existingEquip.item.itemDef?.code === itemCode ? existingEquip.item : null) ??
              await tx.itemInstance.findFirst({
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

        // Bug #60: Upsert companions by type to preserve DB IDs
        const existingCompanions = await tx.companion.findMany({
          where: { characterId: char.id },
        });
        const existingMap = new Map(existingCompanions.map((c) => [c.type, c]));
        const savedTypes = new Set<string>();

        for (const comp of data.companions ?? []) {
          savedTypes.add(comp.type);
          const existing = existingMap.get(comp.type);
          if (existing) {
            await tx.companion.update({
              where: { id: existing.id },
              data: { level: comp.level, exp: comp.exp, hp: comp.hp },
            });
          } else {
            await tx.companion.create({
              data: {
                characterId: char.id,
                type: comp.type,
                level: comp.level,
                exp: comp.exp,
                hp: comp.hp,
              },
            });
          }
        }

        // Remove companions no longer owned
        for (const existing of existingCompanions) {
          if (!savedTypes.has(existing.type)) {
            await tx.companion.delete({ where: { id: existing.id } });
          }
        }
        // -----------------------

        // Bug #57: Clean up all orphaned ItemInstances cleanly after all relationships are updated
        await tx.itemInstance.deleteMany({
          where: {
            boundToCharacterId: char.id,
            inventorySlot: null,
            equipment: null,
            bankSlot: null,
            worldDrop: null, // Should be null anyway for bound items
          },
        });
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
    instanceData?: { rarity: ItemRarity; nameOverride?: string; affixes: import("@abraxas/shared").ItemAffix[] };
  }) {
    let itemInstanceId = data.itemId;

    if (data.itemType === "item" && data.instanceData) {
      const itemDef = await prisma.itemDef.findUnique({ where: { code: data.itemId } });
      if (itemDef) {
        const instance = await prisma.itemInstance.create({
          data: {
            itemDefId: itemDef.id,
            // Bug #61: ItemRarity values are already uppercase by contract ("COMMON", etc.)
            rarity: (data.instanceData.rarity || "COMMON") as PrismaItemRarity,
            nameOverride: data.instanceData.nameOverride,
            affixesJson: data.instanceData.affixes ?? [],
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
        itemType: data.itemType.toUpperCase() as DropType,
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
