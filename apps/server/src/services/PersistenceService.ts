import { prisma } from "../database/db";
import { AuthService } from "../database/auth";
import { CLASS_STATS, Direction, ClassType } from "@abraxas/shared";
import type { InventoryEntry, EquipmentData } from "@abraxas/shared";
import { Prisma } from "@prisma/client";

export class PersistenceService {
  static async authenticateUser(username: string, passwordHash: string) {
    // Find existing user
    let user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      // Register new user
      user = await prisma.user.create({
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
    return await prisma.player.findFirst({
      where: {
        userId,
        name: playerName,
      },
      include: {
        inventory: true,
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

    const playerData: Prisma.PlayerCreateInput = {
      user: { connect: { id: userId } },
      name: playerName,
      classType,
      mapName,
      x,
      y,
      hp: stats.hp,
      maxHp: stats.hp,
      mana: stats.mana || 0,
      maxMana: stats.mana || 0,
      str: stats.str,
      agi: stats.agi,
      intStat: stats.int,
      facing: "down",
    };

    return await prisma.player.create({
      data: playerData,
      include: {
        inventory: true,
      },
    });
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
      // Direction enum → lowercase string ("down", "up", etc.)
      const facingStr = (Direction[data.facing] ?? "DOWN").toLowerCase();

      // 1. Update Player Stats
      await prisma.player.update({
        where: { name },
        data: {
          x: data.x,
          y: data.y,
          mapName: data.mapName,
          hp: data.hp,
          maxHp: data.maxHp,
          mana: data.mana,
          maxMana: data.maxMana,
          str: data.str,
          agi: data.agi,
          intStat: data.intStat,
          facing: facingStr,
          gold: data.gold,
          level: data.level,
          xp: data.xp,
          maxXp: data.maxXp,
          classType: data.classType,
          equipWeapon: data.equipment.weapon,
          equipArmor: data.equipment.armor,
          equipShield: data.equipment.shield,
          equipHelmet: data.equipment.helmet,
          equipRing: data.equipment.ring,
        },
      });

      // 2. Update Inventory (Delete and recreate - simple but could be optimized)
      const player = await prisma.player.findUnique({ where: { name } });
      if (player) {
        // Optimization: In a real high-traffic game, we'd only sync diffs.
        // For now, wrapping in a transaction ensures data integrity.
        await prisma.$transaction([
          prisma.inventoryItem.deleteMany({ where: { playerId: player.id } }),
          prisma.inventoryItem.createMany({
            data: data.inventory.map((item) => ({
              playerId: player.id,
              itemId: item.itemId,
              quantity: item.quantity,
              slotIndex: item.slotIndex,
            })),
          }),
        ]);
      }
    } catch (e) {
      console.error("Failed to save player", e);
    }
  }
}
