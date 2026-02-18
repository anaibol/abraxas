import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WebSocketClient } from "@colyseus/ws-transport";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { ArenaRoom } from "./rooms/ArenaRoom";
import type { TileMap } from "@abraxas/shared";
import { logger } from "./logger";
import { resolve, extname, join } from "path";
import { existsSync, readFileSync, statSync } from "fs";

// Patch: ws.send(plainArray) sends as text in Bun.
// Colyseus protocol uses number[] for ROOM_STATE and patches.
// Convert to Uint8Array so ws sends binary frames.
const origRaw = WebSocketClient.prototype.raw;
WebSocketClient.prototype.raw = function (data: unknown, options?: unknown, cb?: () => void) {
  if (Array.isArray(data)) {
    data = new Uint8Array(data);
  }
  return origRaw.call(this, data as any, options, cb);
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

function serveStatic(staticDir: string) {
  return (req: IncomingMessage, res: ServerResponse) => {
    let urlPath = req.url?.split("?")[0] || "/";
    if (urlPath === "/") urlPath = "/index.html";

    const filePath = join(staticDir, urlPath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(staticDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] || "application/octet-stream";
      const content = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": mime });
      res.end(content);
    } else {
      // SPA fallback: serve index.html for non-file routes
      const indexPath = join(staticDir, "index.html");
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    }
  };
}

export async function createGameServer(options: {
  port: number;
  map: TileMap;
  staticDir?: string;
}): Promise<Server> {
  ArenaRoom.mapData = options.map;

  const handler = options.staticDir ? serveStatic(options.staticDir) : undefined;
  const httpServer = createServer(handler);

  const server = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
  });

  server.define("arena", ArenaRoom);

  await server.listen(options.port);

  logger.info({ intent: "server_start", result: "ok", port: options.port });

  return server;
}
