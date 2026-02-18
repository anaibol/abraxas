import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Client, Room } from "@colyseus/sdk";
import { resolve } from "path";
import { createGameServer } from "../src/server";
import { TileMap, Direction } from "@abraxas/shared";
import { GameState } from "../src/schema/GameState";
import { Player } from "../src/schema/Player";
import { AuthService } from "../src/database/auth";
import { prisma } from "../src/database/db";

const TEST_PORT = 2568;
let server: any;
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
  const mapPath = resolve(
    import.meta.dir,
    "../../../packages/shared/src/maps/arena.test.json"
  );
  testMap = await Bun.file(mapPath).json();
  server = await createGameServer({ port: TEST_PORT, map: testMap });
  // Ensure Bun.serve is ready
  await new Promise(r => setTimeout(r, 500));

  clientA = new Client(`ws://127.0.0.1:${TEST_PORT}`);
  clientB = new Client(`ws://127.0.0.1:${TEST_PORT}`);
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
  timeoutMs = 3000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (predicate(room.state)) {
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
    // ---- Step 1: Both clients join ----
    const testSuffix = Date.now().toString();
    const nameA = "Warrior_" + testSuffix;
    const nameB = "Wizard_" + testSuffix;

    // Seed users
    const password = await AuthService.hashPassword("password");
    const userA = await prisma.user.upsert({
      where: { username: nameA },
      update: { password },
      create: { username: nameA, password }
    });
    const userB = await prisma.user.upsert({
      where: { username: nameB },
      update: { password },
      create: { username: nameB, password }
    });

    const tokenA = AuthService.generateToken({ userId: userA.id, username: nameA });
    const tokenB = AuthService.generateToken({ userId: userB.id, username: nameB });

    process.stderr.write("DEBUG: Server is up, waiting 30s for manual probing...\n");
    await new Promise(r => setTimeout(r, 10000));
    const roomA: Room<GameState> = await clientA.joinOrCreate("arena", {
      name: nameA,
      classType: "warrior",
      token: tokenA,
      mapName: "arena.test"
    });

    const roomB: Room<GameState> = await clientB.joinOrCreate("arena", {
      name: nameB,
      classType: "wizard",
      token: tokenB,
      mapName: "arena.test"
    });
    // Wait until both rooms see 2 players
    await waitForState(roomA, (state) => state.players.size >= 2);
    await waitForState(roomB, (state) => state.players.size >= 2);

    expect(roomA.state.players.size).toBe(2);
    expect(roomB.state.players.size).toBe(2);

    const pA = getPlayer(roomA, roomA.sessionId);
    const pB = getPlayer(roomA, roomB.sessionId);
    if (!pA || !pB) throw new Error("Players not found in roomA state");

    expect(pA).toBeDefined();
    expect(pB).toBeDefined();

    // Assert spawn positions
    expect(pA.tileX).toBe(2);
    expect(pA.tileY).toBe(4);
    expect(pB.tileX).toBe(4);
    expect(pB.tileY).toBe(4);

    // ---- Check stats set correctly (with equipment bonuses) ----
    expect(pA.str).toBeGreaterThan(0);
    expect(pA.alive).toBe(true);
    expect(pB.intStat).toBeGreaterThan(0);

    // ---- Step 2: Move A right -> (3,4) ----
    roomA.send("move", { direction: Direction.RIGHT });
    await waitForState(roomA, (state) => {
        const p = state.players.get(roomA.sessionId);
        return p !== undefined && p.tileX === 3;
    });

    const pA2 = getPlayer(roomA, roomA.sessionId);
    if (!pA2) throw new Error("Player A not found");
    expect(pA2.tileX).toBe(3);
    expect(pA2.tileY).toBe(4);
    expect(pA2.facing).toBe(Direction.RIGHT);

    // ---- Step 3: Move A up -> (3,3) is blocked ----
    await wait(300);
    roomA.send("move", { direction: Direction.UP });
    await wait(200);

    // Position unchanged, facing updated
    const pA3 = expectPlayer(roomA, roomA.sessionId);
    expect(pA3.tileX).toBe(3);
    expect(pA3.tileY).toBe(4);
    expect(pA3.facing).toBe(Direction.UP);

    // ---- Step 4: Face A right (toward B) by attempting move into occupied tile ----
    await wait(300);
    roomA.send("move", { direction: Direction.RIGHT });
    await wait(200);

    const pA4 = expectPlayer(roomA, roomA.sessionId);
    expect(pA4.tileX).toBe(3);
    expect(pA4.tileY).toBe(4);
    expect(pA4.facing).toBe(Direction.RIGHT);

    // ---- Step 5: A attacks with melee (CTRL) -> hits B at (4,4) ----
    const initialHpB = expectPlayer(roomA, roomB.sessionId).hp;
    expect(initialHpB).toBeGreaterThan(0);

    const attackHitPromise = new Promise<void>((resolve) => {
      roomA.onMessage("attack_hit", () => resolve());
    });

    roomA.send("attack", {});
    await attackHitPromise;
    await wait(150);

    // With stat-based combat, damage varies — just check HP decreased
    const newHpB = expectPlayer(roomA, roomB.sessionId).hp;
    expect(newHpB).toBeLessThan(initialHpB);

    // ---- Step 6: Wizard casts fireball at A's tile (3,4) ----
    await wait(500);

    const initialHpA = expectPlayer(roomB, roomA.sessionId).hp;
    expect(initialHpA).toBeGreaterThan(0);
    const initialManaB = expectPlayer(roomB, roomB.sessionId).mana;
    expect(initialManaB).toBeGreaterThan(0);

    const castHitPromise = new Promise<void>((resolve) => {
      roomB.onMessage("cast_hit", () => resolve());
    });

    roomB.send("cast", {
      spellId: "fireball",
      targetTileX: 3,
      targetTileY: 4,
    });

    await castHitPromise;
    await wait(150);

    // Mana reduced by 25 (fireball cost)
    const newManaB = expectPlayer(roomB, roomB.sessionId).mana;
    expect(newManaB).toBe(initialManaB - 25);

    // A's HP reduced by spell damage (formula-based)
    const newHpA = expectPlayer(roomB, roomA.sessionId).hp;
    expect(newHpA).toBeLessThan(initialHpA);

    // ---- Step 7: Disconnect cleanly ----
    roomA.leave();
    roomB.leave();
    await wait(300);
  }, 20000);
});
