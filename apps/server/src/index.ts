import { resolve } from "path";
import { defineRoom } from "@colyseus/core";
import { createGameServer } from "./server";
import { ArenaRoom } from "./rooms/ArenaRoom";
import type { TileMap } from "@abraxas/shared";

const mapName = process.env.MAP || "arena";
const mapPath = resolve(
  import.meta.dir,
  "../../../packages/shared/src/maps",
  `${mapName}.json`,
);
const map: TileMap = await Bun.file(mapPath).json();

const port = Number(process.env.PORT) || 2567;

// In production, serve the client build from STATIC_DIR
const staticDir = process.env.STATIC_DIR
  ? resolve(process.env.STATIC_DIR)
  : undefined;

const server = await createGameServer({
	port,
	map,
	staticDir,
	rooms: { arena: defineRoom(ArenaRoom) },
});

console.log(`[Abraxas] Server listening on ws://localhost:${port}`);
if (staticDir) {
  console.log(`[Abraxas] Serving static files from ${staticDir}`);
}
