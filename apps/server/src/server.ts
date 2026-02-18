import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WebSocketClient } from "@colyseus/ws-transport";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { ArenaRoom } from "./rooms/ArenaRoom";
import type { TileMap } from "@abraxas/shared";
import { logger } from "./logger";
import { resolve, extname, join } from "path";
import { existsSync, readFileSync, statSync } from "fs";
import { AuthService } from "./database/auth";
import { prisma } from "./database/db";

// Patch: ws.send(plainArray) sends as text in Bun.
// Colyseus protocol uses number[] for ROOM_STATE and patches.
// Convert to Uint8Array so ws sends binary frames.
const origRaw = WebSocketClient.prototype.raw;
WebSocketClient.prototype.raw = function (data: unknown, options?: unknown, cb?: () => void) {
  if (Array.isArray(data)) {
    data = new Uint8Array(data);
  }
  return (origRaw as any).call(this, data, options, cb);
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

  // API Routes for Authentication
  httpServer.on("request", async (req, res) => {
    if (req.url === "/api/register" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", async () => {
        try {
          const { username, password } = JSON.parse(body);
          if (!username || !password || username.length < 3 || password.length < 6) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid username or password" }));
            return;
          }

          const passwordHash = await AuthService.hashPassword(password);
          // Check if user exists
          try {
             // We use PersistenceService to create/find, but we need strictly create here or handle logic
             // Let's use Prisma directly or add register method to PersistenceService
             // Actually PersistenceService.authenticateUser was a bit mixed.
             // Let's rely on AuthService + Prisma here or refine PersistenceService.
             
             // Simplest: Use AuthService and Prisma directly here or move logic to a Controller.
             // For compactness, inline here.
             
             // Check existing
             const existing = await prisma.user.findUnique({ where: { username } });
             if (existing) {
                res.writeHead(409, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Username already taken" }));
                return;
             }

             const user = await prisma.user.create({
                 data: { username, password: passwordHash }
             });

             const token = AuthService.generateToken({ userId: user.id, username: user.username });
             res.writeHead(200, { "Content-Type": "application/json" });
             res.end(JSON.stringify({ token, username: user.username }));
          } catch (e) {
             console.error(e);
             res.writeHead(500);
             res.end(JSON.stringify({ error: "Server error" }));
          }
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return; // Stop processing other handlers
    }

    if (req.url === "/api/login" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
          try {
            const { username, password } = JSON.parse(body);
            const user = await prisma.user.findUnique({ where: { username } });
            
            if (!user || !user.password || !(await AuthService.verifyPassword(password, user.password))) {
                res.writeHead(401, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Invalid credentials" }));
                return;
            }
  
            const token = AuthService.generateToken({ userId: user.id, username: user.username });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ token, username: user.username }));
          } catch (e) {
             console.error(e);
             res.writeHead(500);
             res.end(JSON.stringify({ error: "Server error" }));
          }
        });
        return;
    }
  });

  await server.listen(options.port);

  logger.info({ intent: "server_start", result: "ok", port: options.port });

  return server;
}
