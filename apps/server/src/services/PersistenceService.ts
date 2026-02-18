import { prisma } from "../database/db";
import { AuthService } from "../database/auth";
import { CLASS_STATS, Direction, ClassType } from "@abraxas/shared";
import type { InventoryEntry, EquipmentData } from "@abraxas/shared";
import { Prisma } from "@prisma/client";

export class PersistenceService {
  static async authenticateUser(username: string, passwordHash: string) {
    // Find existing user
    let user = await prisma.account.findUnique({
      where: { username },
    });

    if (!user) {
      // Register new user
      user = await prisma.account.create({
        data: {
          username,
          password: passwordHash,
        },
      });
    } else {
      // Verify password
      const isValid = await AuthService.verifyPassword(
        passwordHash,
        user.password,
      );
      if (!isValid) return null;
    }

    return user;
  }

  static async loadPlayer(userId: string, playerName: string) {
    return await prisma.character.findFirst({
      where: {
        accountId: userId,
        name: playerName,
      },
      include: {
        inventory: {
          include: {
            slots: {
              include: {
                item: {
                  include: {
                    itemDef: true,
                  },
                },
              },
            },
          },
        },
        stats: true,
      },
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

    // Map ClassType to CharacterClass enum
    const classMap: Record<string, string> = {
      warrior: "WARRIOR",
      wizard: "MAGE",
      archer: "RANGER",
      assassin: "ROGUE",
      paladin: "CLERIC",
      druid: "CLERIC", // Fallback
    };

    try {
      return await prisma.character.create({
        data: {
          account: { connect: { id: userId } },
          name: playerName,
          class: classMap[classType] as any || "WARRIOR",
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
          inventory: {
            create: {
              size: 40,
            },
          },
        },
        include: {
          inventory: {
            include: {
              slots: true,
            },
          },
          stats: true,
        },
      });
    } catch (e: any) {
      if (e.code === "P2002") {
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

      // 1. Update Character and Stats
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

      // 2. Update Inventory
      const character = await prisma.character.findUnique({
        where: { name },
        include: { inventory: true },
      });

      if (character && character.inventory) {
        await prisma.$transaction(async (tx) => {
          // Clear existing slots for this inventory
          await tx.inventorySlot.deleteMany({
            where: { inventoryId: character.inventory!.id },
          });

          // Recreate slots. Note: This assumes ItemDef already exists for all itemIds.
          // In a more robust system, we would findOrCreate ItemDef.
          for (const item of data.inventory) {
            // Find the ItemDef
            const itemDef = await tx.itemDef.findUnique({
              where: { code: item.itemId },
            });

            if (itemDef) {
              // Create an Instance
              const instance = await tx.itemInstance.create({
                data: {
                  itemDefId: itemDef.id,
                  boundToCharacterId: character.id,
                },
              });

              // Assign to slot
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
        });
      }
    } catch (e) {
      console.error("Failed to save player", e);
    }
  }
}
