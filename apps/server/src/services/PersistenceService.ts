import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { CLASS_STATS, STARTING_EQUIPMENT, ITEMS, NPC_STATS, EXP_TABLE, NPC_DROPS } from "@abraxas/shared";
import type { ClassStats } from "@abraxas/shared";
import "dotenv/config";
import { resolve } from "path";

// Initialize Prisma Client with Adapter
console.log("PersistenceService: DATABASE_URL:", process.env.DATABASE_URL);

const dbPath = process.env.DATABASE_URL || "file:dev.db";
// Ensure absolute file URL for local SQLite
const url = dbPath.startsWith("file:") ? `file://${resolve(process.cwd(), dbPath.replace("file:", ""))}` : dbPath;
console.log("PersistenceService: Using URL:", url);

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
                 inventory: "[]",
                 equipment: "{}"
             }
         });
    }

    static async savePlayer(
        name: string, 
        data: {
            x: number, y: number, hp: number, maxHp: number, mana: number, maxMana: number,
            str: number, agi: number, intStat: number, facing: string,
            gold: number, level: number, xp: number, maxXp: number,
            inventory: string, equipment: string, classType: string
        }
    ) {
        try {
            await prisma.player.updateMany({
                where: { name },
                data
            });
        } catch (e) {
            console.error("Failed to save player", e);
        }
    }
}