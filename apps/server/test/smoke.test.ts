import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Client, Room } from "colyseus.js";
import { resolve } from "path";
import { createGameServer } from "../src/server";
import { TileMap, Direction } from "@abraxas/shared";

const TEST_PORT = 2568;
let server: any;

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
  const map: TileMap = await Bun.file(mapPath).json();
  server = await createGameServer({ port: TEST_PORT, map });
});

afterAll(async () => {
  await server.gracefullyShutdown(false);
});

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForState(
  room: Room,
  predicate: () => boolean,
  timeoutMs = 3000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (predicate()) {
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

function getPlayer(room: Room, sessionId: string): any {
  return (room.state as any).players.get(sessionId);
}

describe("Arena multiplayer smoke test", () => {
  test("full game flow: join, move, blocked move, melee, spell, disconnect", async () => {
    const clientA = new Client(`ws://localhost:${TEST_PORT}`);
    const clientB = new Client(`ws://localhost:${TEST_PORT}`);

    // ---- Step 1: Both clients join ----
    const roomA: Room = await clientA.joinOrCreate("arena", {
      name: "Warrior",
      classType: "warrior",
    });
    const roomB: Room = await clientB.joinOrCreate("arena", {
      name: "Wizard",
      classType: "wizard",
    });

    // Wait until both rooms see 2 players
    await waitForState(roomA, () => (roomA.state as any).players.size >= 2);
    await waitForState(roomB, () => (roomB.state as any).players.size >= 2);

    expect((roomA.state as any).players.size).toBe(2);
    expect((roomB.state as any).players.size).toBe(2);

    const pA = getPlayer(roomA, roomA.sessionId);
    const pB = getPlayer(roomA, roomB.sessionId);
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
    await waitForState(roomA, () => getPlayer(roomA, roomA.sessionId)?.tileX === 3);

    expect(getPlayer(roomA, roomA.sessionId).tileX).toBe(3);
    expect(getPlayer(roomA, roomA.sessionId).tileY).toBe(4);
    expect(getPlayer(roomA, roomA.sessionId).facing).toBe(Direction.RIGHT);

    // ---- Step 3: Move A up -> (3,3) is blocked ----
    await wait(300);
    roomA.send("move", { direction: Direction.UP });
    await wait(200);

    // Position unchanged, facing updated
    expect(getPlayer(roomA, roomA.sessionId).tileX).toBe(3);
    expect(getPlayer(roomA, roomA.sessionId).tileY).toBe(4);
    expect(getPlayer(roomA, roomA.sessionId).facing).toBe(Direction.UP);

    // ---- Step 4: Face A right (toward B) by attempting move into occupied tile ----
    await wait(300);
    roomA.send("move", { direction: Direction.RIGHT });
    await wait(200);

    expect(getPlayer(roomA, roomA.sessionId).tileX).toBe(3);
    expect(getPlayer(roomA, roomA.sessionId).tileY).toBe(4);
    expect(getPlayer(roomA, roomA.sessionId).facing).toBe(Direction.RIGHT);

    // ---- Step 5: A attacks with melee (CTRL) -> hits B at (4,4) ----
    const initialHpB = getPlayer(roomA, roomB.sessionId).hp;
    expect(initialHpB).toBeGreaterThan(0);

    const attackHitPromise = new Promise<void>((resolve) => {
      roomA.onMessage("attack_hit", () => resolve());
    });

    roomA.send("attack", {});
    await attackHitPromise;
    await wait(150);

    // With stat-based combat, damage varies — just check HP decreased
    const newHpB = getPlayer(roomA, roomB.sessionId).hp;
    expect(newHpB).toBeLessThan(initialHpB);

    // ---- Step 6: Wizard casts fireball at A's tile (3,4) ----
    await wait(500);

    const initialHpA = getPlayer(roomB, roomA.sessionId).hp;
    expect(initialHpA).toBeGreaterThan(0);
    const initialManaB = getPlayer(roomB, roomB.sessionId).mana;
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
    const newManaB = getPlayer(roomB, roomB.sessionId).mana;
    expect(newManaB).toBe(initialManaB - 25);

    // A's HP reduced by spell damage (formula-based)
    const newHpA = getPlayer(roomB, roomA.sessionId).hp;
    expect(newHpA).toBeLessThan(initialHpA);

    // ---- Step 7: Disconnect cleanly ----
    roomA.leave();
    roomB.leave();
    await wait(300);
  }, 20000);
});
