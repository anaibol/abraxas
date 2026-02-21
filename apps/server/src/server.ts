import type { TileMap } from "@abraxas/shared";
import { createRouter, defineRoom, defineServer, type Server } from "@colyseus/core";
import { GameTransport } from "./GameTransport";
import { logger } from "./logger";
import { ArenaRoom } from "./rooms/ArenaRoom";
import {
  adminCharactersEndpoint,
  createCharacterEndpoint,
  deleteCharacterEndpoint,
  healthEndpoint,
  leaderboardEndpoint,
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
      deleteCharacterEndpoint,
      leaderboardEndpoint,
      adminCharactersEndpoint,
    }),
  });

  await server.listen(options.port, "0.0.0.0");
  logger.info({ intent: "server_start", result: "ok", port: options.port });

  return server;
}
