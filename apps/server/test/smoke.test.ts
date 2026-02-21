import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Direction, type JoinOptions, type TileMap } from "@abraxas/shared";
import type { Server } from "@colyseus/core";
import { Client, type Room } from "@colyseus/sdk";
import { resolve } from "path";
import { generateToken, hashPassword } from "../src/database/auth";
import { prisma } from "../src/database/db";
import type { GameState } from "../src/schema/GameState";
import type { Player } from "../src/schema/Player";
import { createGameServer } from "../src/server";

const TEST_PORT = 2500 + Math.floor(Math.random() * 1000);
let server: Server;
let testMap: TileMap;
let clientA: Client;
let clientB: Client;

/**
 * Test map (arena.test.json):
 *   10x10 grid
 *   collision[3][3] = 1  (blocked tile)
 *   spawns: [{x:2,y:4}, {x:4,y:4}]
 *
 * Player A (warrior) -> spawn (2,4)
 * Player B (wizard)  -> spawn (4,4)
 */

beforeAll(async () => {
  try {
    const mapPath = resolve(import.meta.dir, "../../../packages/shared/src/maps/arena.test.json");
    testMap = await Bun.file(mapPath).json();
    server = await createGameServer({ port: TEST_PORT, map: testMap });
    // Ensure Bun.serve is ready
    await new Promise((r) => setTimeout(r, 500));

    clientA = new Client(`ws://127.0.0.1:${TEST_PORT}`);
    clientB = new Client(`ws://127.0.0.1:${TEST_PORT}`);
  } catch (e) {
    console.error("[smoke.test] beforeAll FAILED:", e);
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
  timeoutMs = 3000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (room.state && predicate(room.state)) {
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error("Timeout waiting for state condition"));
      } else {
        setTimeout(check, 30);
      }
    };
    check();
  });
}

function getPlayer(room: Room<GameState>, sessionId: string): Player | undefined {
  return room.state.players.get(sessionId);
}

function expectPlayer(room: Room<GameState>, sessionId: string): Player {
  const p = getPlayer(room, sessionId);
  if (!p) throw new Error(`Player ${sessionId} not found`);
  return p;
}

describe("Arena multiplayer smoke test", () => {
  test("full game flow: join, move, blocked move, melee, spell, disconnect", async () => {
    try {
      // ---- Step 1: Both clients join ----
      const testSuffix = Date.now().toString();
      const nameA = "Warrior_" + testSuffix;
      const nameB = "Wizard_" + testSuffix;
      const emailA = `warrior_${testSuffix}@test.com`;
      const emailB = `wizard_${testSuffix}@test.com`;

      // Seed users
      const password = await hashPassword("password");
      const userA = await prisma.account.upsert({
        where: { email: emailA },
        update: { password, role: "ADMIN" },
        create: { email: emailA, password, role: "ADMIN" },
      });
      const userB = await prisma.account.upsert({
        where: { email: emailB },
        update: { password },
        create: { email: emailB, password },
      });

      const tokenA = generateToken({ userId: userA.id, email: emailA, role: userA.role });
      const tokenB = generateToken({ userId: userB.id, email: emailB, role: userB.role });
      console.log("[smoke.test] Step 0.3: Tokens generated");

      async function joinWithRetry(
        client: Client,
        token: string,
        opts: JoinOptions & { mapName?: string },
        attempts = 3,
      ) {
        // Set token correctly for Colyseus 0.17
        client.auth.token = token;

        let lastErr: Error | undefined;

        for (let i = 0; i < attempts; i++) {
          try {
            return await client.joinOrCreate("arena", opts);
          } catch (e: unknown) {
            const err = e as Error & { code?: number };
            lastErr = err;
            console.error(`[smoke.test] joinWithRetry attempt ${i + 1} failed:`, e);
            // If reservation expired (524), retry after a short delay
            const msg = err?.message || String(e) || "";
            if (msg.includes("seat reservation expired") || err.code === 524) {
              await wait(300);
              continue;
            }
            throw e;
          }
        }
        throw lastErr;
      }

      // Create characters for the users
      const charA = await prisma.character.create({
        data: {
          accountId: userA.id,
          name: nameA,
          class: "WARRIOR",
          pvpEnabled: true,
          stats: { create: { hp: 100, maxHp: 100, mp: 50, maxMp: 50, str: 10, agi: 10, int: 10 } },
          inventory: { create: { size: 40 } },
        },
      });
      console.log("[smoke.test] Step 0.4: Character A created");

      const charB = await prisma.character.create({
        data: {
          accountId: userB.id,
          name: nameB,
          class: "MAGE",
          pvpEnabled: true,
          stats: {
            create: { hp: 1000, maxHp: 1000, mp: 100, maxMp: 100, str: 5, agi: 8, int: 15 },
          },
          inventory: { create: { size: 40 } },
        },
      });
      console.log("[smoke.test] Step 0.5: Character B created");

      console.log("Step 1: Joining rooms...");
      const roomA: Room<GameState> = await joinWithRetry(clientA, tokenA, {
        charId: charA.id,
        classType: "WARRIOR",
        mapName: "arena.test",
      });

      const roomB: Room<GameState> = await joinWithRetry(clientB, tokenB, {
        charId: charB.id,
        classType: "MAGE",
        mapName: "arena.test",
      });
      // Wait until both rooms see 2 players
      await waitForState(roomA, (state) => state?.players?.size >= 2);
      await waitForState(roomB, (state) => state?.players?.size >= 2);

      console.log("Step 2: Checking spawn positions...");
      expect(roomA.state.players.size).toBe(2);
      expect(roomB.state.players.size).toBe(2);

      const pA = getPlayer(roomA, roomA.sessionId);
      const pB = getPlayer(roomA, roomB.sessionId);
      if (!pA || !pB) throw new Error("Players not found in roomA state");

      expect(pA).toBeDefined();
      expect(pB).toBeDefined();
      console.error(`[DEBUG_PLAYER] pA:`, JSON.stringify(pA.toJSON(), null, 2));
      console.error(
        `[DEBUG_PROPS] pA.tileX=${pA.tileX}, pA.tileY=${pA.tileY}, pA.maxXp=${(pA as any).maxXp}, pA.xp=${pA.xp}`,
      );

      // Assert spawn positions
      expect(pA.tileX).toBe(2);
      expect(pA.tileY).toBe(4);
      expect(pB.tileX).toBe(4);
      expect(pB.tileY).toBe(4);

      // ---- Check stats set correctly (with equipment bonuses) ----
      expect(pA.str).toBeGreaterThan(0);
      expect(pA.alive).toBe(true);
      expect(pB.intStat).toBeGreaterThan(0);

      console.log("Step 3: Moving Player A...");
      // ---- Step 2: Move A right -> (3,4) ----
      roomA.send("move", { direction: Direction.RIGHT });
      await waitForState(roomA, (state) => {
        const p = state?.players?.get(roomA.sessionId);
        return p !== undefined && p.tileX === 3;
      });

      const pA2 = getPlayer(roomA, roomA.sessionId);
      if (!pA2) throw new Error("Player A not found");
      expect(pA2.tileX).toBe(3);
      expect(pA2.tileY).toBe(4);
      expect(pA2.facing).toBe(Direction.RIGHT);

      console.log("Step 4: Moving into blocked tile...");
      // ---- Step 3: Move A up -> (3,3) is blocked ----
      await wait(300);
      roomA.send("move", { direction: Direction.UP });
      await wait(200);

      // Position unchanged, facing updated
      const pA3 = expectPlayer(roomA, roomA.sessionId);
      expect(pA3.tileX).toBe(3);
      expect(pA3.tileY).toBe(4);
      expect(pA3.facing).toBe(Direction.UP);

      console.log("Step 5: Facing B...");
      // ---- Step 4: Face A right (toward B) by attempting move into occupied tile ----
      await wait(300);
      roomA.send("move", { direction: Direction.RIGHT });
      await waitForState(roomA, (state) => {
        const p = state?.players?.get(roomA.sessionId);
        return p !== undefined && p.facing === Direction.RIGHT;
      });

      const pA4 = expectPlayer(roomA, roomA.sessionId);
      expect(pA4.tileX).toBe(3);
      expect(pA4.tileY).toBe(4);
      expect(pA4.facing).toBe(Direction.RIGHT);

      console.log("Step 6: Melee attack...");
      // ---- Step 5: A attacks with melee (CTRL) -> hits B at (4,4) ----
      const initialHpB = expectPlayer(roomA, roomB.sessionId).hp;
      expect(initialHpB).toBeGreaterThan(0);

      const attackHitPromise = new Promise<void>((resolve) => {
        roomA.onMessage("attack_hit", () => resolve());
      });

      roomA.send("attack", {});
      await attackHitPromise;
      await wait(150);

      // Because both are at x=3,4 and x=4,4, they are OUTSIDE the safeZone at {x:1, y:1, w:2, h:2}. Both can be attacked.
      const newHpB = expectPlayer(roomA, roomB.sessionId).hp;
      expect(newHpB).toBeLessThan(initialHpB);

      console.log("Step 6.5: Safe Zone protection check...");
      // ---- Step 6.5: A moves into the safe zone (1,1) -> (2,2). Let's move A to (2,2) ----
      roomA.send("move", { direction: Direction.UP }); // A to (3,3) - wait, (3,3) is blocked
      await wait(200);
      roomA.send("move", { direction: Direction.LEFT }); // A to (2,4)
      await wait(200);
      roomA.send("move", { direction: Direction.UP }); // A to (2,3)
      await wait(200);
      roomA.send("move", { direction: Direction.UP }); // A to (2,2) - inside safe zone

      await waitForState(roomA, (state) => {
        const p = state?.players?.get(roomA.sessionId);
        return p !== undefined && p.tileY === 2;
      });

      // B moves towards A to stand near the safe zone
      roomB.send("move", { direction: Direction.LEFT }); // B to (3,4)
      await wait(200);
      roomB.send("move", { direction: Direction.LEFT }); // B to (2,4)
      await waitForState(roomB, (state) => {
        const p = state?.players?.get(roomB.sessionId);
        return p !== undefined && p.tileX === 2 && p.tileY === 4;
      });

      // B attacks A
      const safeHpA = expectPlayer(roomA, roomA.sessionId).hp;
      roomB.send("attack", {});
      await wait(300); // no attack_hit event should fire; just wait

      const afterSafeHpA = expectPlayer(roomA, roomA.sessionId).hp;
      expect(afterSafeHpA).toBe(safeHpA); // HP should be unchanged

      console.log("Step 6.8: Toggle PvP protection check...");
      // ---- Step 6.8: B moves out of the way, A moves out of safe zone, B toggles PvP off, A attacks B ----
      // B goes to 2,4
      roomB.send("move", { direction: Direction.DOWN });
      await wait(250);
      // A goes to 2,3
      roomA.send("move", { direction: Direction.DOWN });
      await wait(250);
      await waitForState(roomA, (state) => {
        const p = state?.players?.get(roomA.sessionId);
        return p !== undefined && p.tileY === 3;
      });

      // A at (2,3) faces B at (2,4)
      roomA.send("move", { direction: Direction.DOWN }); // A faces DOWN
      await wait(200);

      console.log("Step 7: Spell cast...");
      // ---- Step 6: Wizard casts fireball at A's tile (2,3) ----
      await wait(500);

      const initialHpA = expectPlayer(roomB, roomA.sessionId).hp;
      expect(initialHpA).toBeGreaterThan(0);
      const initialManaB = expectPlayer(roomB, roomB.sessionId).mana;
      expect(initialManaB).toBeGreaterThan(0);

      const castHitPromise = new Promise<void>((resolve) => {
        roomB.onMessage("cast_hit", () => resolve());
      });

      roomB.send("cast", {
        abilityId: "fireball",
        targetTileX: 2,
        targetTileY: 4,
      });

      await castHitPromise;
      await wait(150);

      // Mana reduced by 25 (fireball cost)
      const newManaB = expectPlayer(roomB, roomB.sessionId).mana;
      expect(newManaB).toBeLessThan(initialManaB - 5);

      const newHpA = expectPlayer(roomB, roomA.sessionId).hp;
      expect(newHpA).toBeLessThan(initialHpA);

      console.log("Step 8: Progression check (NPC Kill)");
      // ---- Step 8: Spawn NPC and check EXP ----
      roomA.send("gm_spawn", { type: "orc" });

      await waitForState(roomA, (state) => state.npcs.size > 0, 10000);
      const npc = Array.from(roomA.state.npcs.values()).find((n) => !n.ownerId);
      expect(npc).toBeDefined();

      // Teleport to NPC
      roomA.send("gm_teleport", { tileX: npc!.tileX, tileY: npc!.tileY });
      await waitForState(roomA, (state) => {
        const p = state.players.get(roomA.sessionId);
        return p?.tileX === npc!.tileX && p?.tileY === npc!.tileY;
      });

      const initialXpA = expectPlayer(roomA, roomA.sessionId).xp;

      // Attack NPC until dead
      const npcId = npc!.sessionId;
      while (roomA.state.npcs.has(npcId)) {
        const currentNpc = roomA.state.npcs.get(npcId);
        if (currentNpc) {
          roomA.send("attack", { targetTileX: currentNpc.tileX, targetTileY: currentNpc.tileY });
        }
        await wait(200);
      }

      // Verify EXP gain
      const finalXpA = expectPlayer(roomA, roomA.sessionId).xp;
      expect(finalXpA).toBeGreaterThan(initialXpA);

      console.log("Step 9: Leaving...");
      // ---- Step 9: Disconnect cleanly ----
      roomA.leave();
      roomB.leave();
      await wait(300);
    } catch (e: unknown) {
      console.error("[smoke.test] CRITICAL ERROR IN TEST:", e);
      throw e;
    }
  }, 20000);
});
