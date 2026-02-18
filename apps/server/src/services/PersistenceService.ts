import { CharacterClass, EquipSlot, Prisma } from "../generated/prisma";
import { prisma } from "../database/db";
import { AuthService } from "../database/auth";
import { CLASS_STATS, Direction, ClassType } from "@abraxas/shared";
import type { InventoryEntry, EquipmentData } from "@abraxas/shared";

/** Maps game ClassType strings to Prisma CharacterClass enum values. */
const CLASS_TYPE_MAP: Partial<Record<string, CharacterClass>> = {
  warrior: CharacterClass.WARRIOR,
  wizard: CharacterClass.MAGE,
  archer: CharacterClass.RANGER,
  assassin: CharacterClass.ROGUE,
  paladin: CharacterClass.CLERIC,
  druid: CharacterClass.CLERIC,
};

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
  static async authenticateUser(username: string, passwordHash: string) {
    let user = await prisma.account.findUnique({ where: { username } });

    if (!user) {
      user = await prisma.account.create({
        data: { username, password: passwordHash },
      });
    } else {
      const isValid = await AuthService.verifyPassword(
        passwordHash,
        user.password,
      );
      if (!isValid) return null;
    }

    return user;
  }

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

    const characterClass = CLASS_TYPE_MAP[classType] ?? CharacterClass.WARRIOR;

    try {
      return await prisma.character.create({
        data: {
          account: { connect: { id: userId } },
          name: playerName,
          class: characterClass,
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
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new Error("Character name already taken");
      }
      throw e;
    }
  }

  static async savePlayer(
    userId: string,
    name: string,
    data: {
      x: number;
      y: number;
      mapName: string;
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

      await prisma.character.update({
        where: { name },
        data: {
          x: data.x,
          y: data.y,
          mapId: data.mapName,
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
      });

      const character = await prisma.character.findUnique({
        where: { name },
        include: { inventory: true },
      });

      if (!character?.inventory) return;

      await prisma.$transaction(async (tx) => {
        const currentSlots = await tx.inventorySlot.findMany({
          where: { inventoryId: character.inventory!.id },
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
                  inventoryId: character.inventory!.id,
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
      console.error("Failed to save player", e);
    }
  }
}
