import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Client, Room } from "@colyseus/sdk";
import { resolve } from "path";
import { createGameServer } from "../src/server";
import { TileMap, Direction, type JoinOptions, ServerMessageType } from "@abraxas/shared";
import { GameState } from "../src/schema/GameState";
import { Player } from "../src/schema/Player";
import { hashPassword, generateToken } from "../src/database/auth";
import { prisma } from "../src/database/db";
import type { Server } from "@colyseus/core";

const TEST_PORT = 4000 + Math.floor(Math.random() * 1000);
let server: Server;
let testMap: TileMap;

beforeAll(async () => {
    try {
        const mapPath = resolve(
            import.meta.dir,
            "../../../packages/shared/src/maps/arena.test.json"
        );
        testMap = await Bun.file(mapPath).json();
        server = await createGameServer({ port: TEST_PORT, map: testMap });
        await new Promise(r => setTimeout(r, 500));
    } catch (e) {
        console.error("[progression.test] beforeAll FAILED:", e);
        throw e;
    }
});

afterAll(async () => {
    await server.gracefullyShutdown(false);
});

function wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function waitForState(
    room: Room<GameState>,
    predicate: (state: GameState) => boolean,
    timeoutMs = 5000
): Promise<void> {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            try {
                if (room.state && room.state.players && predicate(room.state)) {
                    resolve();
                    return;
                }
            } catch (e) {
                // Ignore transient errors during state sync
            }
            if (Date.now() - start > timeoutMs) {
                reject(new Error("Timeout waiting for state condition"));
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

describe("Progression System", () => {
    test("Character gaining EXP and leveling up via combat", async () => {
        const client = new Client(`ws://127.0.0.1:${TEST_PORT}`);
        const testSuffix = Date.now().toString();
        const email = `prog_${testSuffix}@test.com`;
        const password = await hashPassword("password");
        
        await prisma.account.upsert({
            where: { email },
            update: { password, role: "ADMIN" },
            create: { email, password, role: "ADMIN" }
        });
        const user = await prisma.account.findUnique({ where: { email } });
        if (!user) throw new Error("Failed to create test user");

        const char = await prisma.character.create({
            data: {
                accountId: user.id,
                name: "ProgTester_" + testSuffix,
                class: "WARRIOR",
                stats: { create: { hp: 1000, maxHp: 1000, mp: 100, maxMp: 100, str: 200, agi: 100, int: 100 } },
                inventory: { create: { size: 40 } },
            }
        });

        const token = generateToken({ userId: user.id, email: user.email, role: user.role });
        const room = await client.joinOrCreate<GameState>("arena", {
            token,
            charId: char.id,
            classType: "WARRIOR"
        });

        console.log(`Joined room. sessionId: ${room.sessionId}`);

        await waitForState(room, (state) => {
            const p = state.players.get(room.sessionId);
            return p !== undefined;
        });
        const player = room.state.players.get(room.sessionId)!;
        
        console.log(`Player found in state at ${player.tileX},${player.tileY}`);

        // Spawn an NPC manually since npcCount is 0 in test map
        room.send("gm_spawn", { type: "orc" });
        console.log("Sent gm_spawn for orc");

        // Find an NPC without an owner
        await waitForState(room, (state) => {
            const npcs = Array.from(state.npcs.values());
            return npcs.some(n => !n.ownerId && n.npcType === "orc");
        });
        const npc = Array.from(room.state.npcs.values()).find(n => !n.ownerId && n.npcType === "orc")!;
        
        console.log(`Found NPC: ${npc.npcType} at ${npc.tileX},${npc.tileY}`);


        // Teleport to NPC
        room.send("gm_teleport", { tileX: npc.tileX, tileY: npc.tileY });
        await waitForState(room, (state) => {
            const p = state.players.get(room.sessionId);
            return p?.tileX === npc.tileX && p?.tileY === npc.tileY;
        });


        const initialXp = player.xp;

        // Attack NPC until dead
        const npcId = npc.sessionId;
        while (room.state.npcs.has(npcId)) {
            room.send("attack", {});
            await wait(200); 
        }

        // Verify EXP gain
        expect(player.xp).toBeGreaterThan(initialXp);
        
        await room.leave();
    });
});
