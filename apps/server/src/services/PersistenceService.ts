import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { CLASS_STATS, STARTING_EQUIPMENT, ITEMS, NPC_STATS, EXP_TABLE, NPC_DROPS, Direction } from "@abraxas/shared";
import type { ClassStats, InventoryEntry, EquipmentData } from "@abraxas/shared";
import "dotenv/config";
import { resolve } from "path";

// Initialize Prisma Client with Adapter

const DEFAULT_DB_PATH = "file:../../dev.db";
const dbPath = process.env.DATABASE_URL || DEFAULT_DB_PATH;

let url = dbPath;
if (dbPath === DEFAULT_DB_PATH) {
   // Resolve default path relative to this file to ensure it hits apps/server/dev.db
   // regardless of where the script is run from (CWD)
   const relativePath = dbPath.replace("file:", "");
   url = `file://${resolve(import.meta.dir, relativePath)}`;
}

const adapter = new PrismaLibSql({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prisma = new PrismaClient({ 
    adapter,
    log: ["query", "info", "warn", "error"]
});

export class PersistenceService {
    static async authenticateUser(usernameInput: string | undefined): Promise<any> {
        let username = usernameInput;
    
        if (!username) {
            const NAMES = ["Aeltho", "Bryna", "Cyril", "Dorn", "Elara", "Faelan", "Garrick", "Hylia", "Ivor", "Jora", "Kael", "Lira", "Marek", "Nylah", "Orion", "Pyra", "Quintus", "Rian", "Sylas", "Thora", "Ulric", "Vyla", "Wren", "Xander", "Yara", "Zephyr"];
            username = NAMES[Math.floor(Math.random() * NAMES.length)];
            username += Math.floor(Math.random() * 10000);
        }
        
        let user = await prisma.user.findUnique({
            where: { username }
        });
    
        if (!user) {
            user = await prisma.user.create({
                data: {
                    username,
                }
            });
        }
    
        return user;
    }

    static async loadPlayer(userId: string, playerName: string) {
        return await prisma.player.findUnique({
            where: {
                userId_name: {
                    userId,
                    name: playerName
                }
            }
        });
    }

    static async createPlayer(userId: string, playerName: string, classType: string, x: number, y: number) {
        const stats = CLASS_STATS[classType];
        if (!stats) throw new Error("Invalid class type");

        return await prisma.player.create({
             data: {
                 userId,
                 name: playerName,
                 classType,
                 x,
                 y,
                 hp: stats.hp,
                 maxHp: stats.hp,
                 mana: stats.mana,
                 maxMana: stats.mana,
                 str: stats.str,
                 agi: stats.agi,
                 intStat: stats.int,
                 facing: "down",
                 inventory: JSON.stringify([]),
                 equipment: JSON.stringify({})
             }
         });
    }

    static async savePlayer(
        userId: string,
        name: string, 
        data: {
            x: number, y: number, hp: number, maxHp: number, mana: number, maxMana: number,
            str: number, agi: number, intStat: number, facing: Direction,
            gold: number, level: number, xp: number, maxXp: number,
            inventory: InventoryEntry[], equipment: EquipmentData, classType: string
        }
    ) {
        try {
            await prisma.player.update({
                where: { 
                    userId_name: {
                        userId,
                        name
                    }
                 },
                data: {
                    x: data.x,
                    y: data.y,
                    hp: data.hp,
                    maxHp: data.maxHp,
                    mana: data.mana,
                    maxMana: data.maxMana,
                    str: data.str,
                    agi: data.agi,
                    intStat: data.intStat,
                    facing: Direction[data.facing].toLowerCase(),
                    gold: data.gold,
                    level: data.level,
                    xp: data.xp,
                    maxXp: data.maxXp,
                    inventory: JSON.stringify(data.inventory),
                    equipment: JSON.stringify(data.equipment),
                    classType: data.classType
                }
            });
        } catch (e) {
            console.error("Failed to save player", e);
        }
    }
}