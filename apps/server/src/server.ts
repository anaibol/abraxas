import { extname, join } from "node:path";
import type { TileMap } from "@abraxas/shared";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { createRouter, defineRoom, defineServer, type Router, type Server } from "@colyseus/core";
import type { ServerWebSocket } from "bun";
import { logger } from "./logger";
import { GameTransport } from "./GameTransport";
import { ArenaRoom } from "./rooms/ArenaRoom";
import {
  createCharacterEndpoint,
  healthEndpoint,
  loginEndpoint,
  meEndpoint,
  registerEndpoint,
} from "./routes";
import { setMap } from "./services/MapService";

process.on("uncaughtException", (e) => {
  logger.error({
    message: "UNCAUGHT EXCEPTION",
    error: String(e),
    stack: e.stack,
  });
});
process.on("unhandledRejection", (reason) => {
  logger.error({ message: "UNHANDLED REJECTION", reason: String(reason) });
});

export async function createGameServer(options: {
  port: number;
  map: TileMap;
  staticDir?: string;
}): Promise<Server> {
  setMap("arena.test", options.map);
  setMap("arena", options.map);

  const server = defineServer({
    transport: new GameTransport(options.staticDir),
    devMode: process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test",
    rooms: { arena: defineRoom(ArenaRoom), catacombs: defineRoom(ArenaRoom) },
    routes: createRouter({
      healthEndpoint,
      registerEndpoint,
      loginEndpoint,
      meEndpoint,
      createCharacterEndpoint,
    }),
  });

  await server.listen(options.port, "0.0.0.0");
  logger.info({ intent: "server_start", result: "ok", port: options.port });

  return server;
}
