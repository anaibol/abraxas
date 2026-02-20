import { extname, join } from "node:path";
import type { TileMap } from "@abraxas/shared";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { createRouter, defineRoom, defineServer, type Router, type Server } from "@colyseus/core";
import type { ServerWebSocket } from "bun";
import { logger } from "./logger";
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

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

const COLYSEUS_PREFIXES = ["/health", "/api", "/matchmake", "/.colyseus", "/__healthcheck"];

async function serveStatic(pathname: string, staticDir: string): Promise<Response> {
  const filePath = join(staticDir, pathname === "/" ? "index.html" : pathname);
  const file = Bun.file(filePath);

  if (await file.exists()) {
    return new Response(await file.arrayBuffer(), {
      headers: {
        "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
      },
    });
  }

  const index = Bun.file(join(staticDir, "index.html"));
  return new Response(await index.arrayBuffer(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Extends BunWebSockets to add SPA static-file fallback for non-API routes,
// and to fix a Linux-specific build of @colyseus/bun-websockets that stores
// `pathname + search` in rawClient.data.url instead of just `pathname`, which
// breaks the roomId regex inside the default onConnection.

interface WebSocketData {
  url: string;
  searchParams: URLSearchParams;
  headers: Headers;
  remoteAddress: string;
}

class GameTransport extends BunWebSockets {
  constructor(private readonly staticDir?: string) {
    super();
  }

  override bindRouter(router: Router): void {
    const origHandler = router.handler.bind(router);
    const staticDir = this.staticDir;

    router.handler = (req: Request) => {
      const { pathname } = new URL(req.url);
      const isApiRoute = COLYSEUS_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
      if (isApiRoute || !staticDir) return origHandler(req);
      return serveStatic(pathname, staticDir);
    };

    super.bindRouter(router);
  }

  override async onConnection(rawClient: ServerWebSocket<WebSocketData>): Promise<void> {
    // Strip query string so the roomId regex in super.onConnection matches.
    rawClient.data.url = rawClient.data.url.split("?")[0];
    return super.onConnection(rawClient);
  }
}

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
