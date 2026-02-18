import { Server } from "@colyseus/core";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { ArenaRoom } from "./rooms/ArenaRoom";
import type { TileMap } from "@abraxas/shared";
import { logger } from "./logger";
import { AuthService } from "./database/auth";
import { prisma } from "./database/db";

import { MapService } from "./services/MapService";

export async function createGameServer(options: {
  port: number;
  map: TileMap;
  staticDir?: string;
}): Promise<Server> {
  // Inject map into MapService so rooms can find it without passing huge objects in options
  MapService.setMap("arena.test", options.map);
  MapService.setMap("arena", options.map);

  const transport = new BunWebSockets();
  const server = new Server({
    transport,
  });

  const handler = server.define("arena", ArenaRoom);
  console.error(`[server.ts] Registered 'arena' room handler: ${!!handler}`);

  const app = transport.getExpressApp();

  app.use((req: any, res: any, next: any) => {
    console.error(`[DEBUG server.ts] Request: ${req.method} ${req.url}`);
    if (req.url.startsWith("/api/") && req.method === "POST" && req.headers["content-type"]?.includes("application/json")) {
      let body = "";
      req.on("data", (chunk: any) => body += chunk);
      req.on("end", () => {
        try {
          req.body = JSON.parse(body);
        } catch (e) {}
        next();
      });
    } else {
      next();
    }
  });

  // API Routes for Authentication
  app.post("/api/register", async (req: any, res: any) => {
    try {
      const { username, password } = req.body;
      if (!username || !password || username.length < 3 || password.length < 6) {
        return res.status(400).json({ error: "Invalid username or password" });
      }

      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return res.status(409).json({ error: "Username already taken" });
      }

      const passwordHash = await AuthService.hashPassword(password);
      const user = await prisma.user.create({
        data: { username, password: passwordHash }
      });

      const token = AuthService.generateToken({ userId: user.id, username: user.username });
      res.status(200).json({ token, username: user.username });
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/login", async (req: any, res: any) => {
    try {
      const { username, password } = req.body;
      const user = await prisma.user.findUnique({ where: { username } });

      if (!user || !user.password || !(await AuthService.verifyPassword(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = AuthService.generateToken({ userId: user.id, username: user.username });
      res.status(200).json({ token, username: user.username });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  if (options.staticDir) {
    const { resolve, join, extname } = await import("path");
    const { existsSync, readFileSync, statSync } = await import("fs");

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

    app.use((req: any, res: any, next: any) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      let urlPath = url.pathname;
      if (urlPath === "/") urlPath = "/index.html";
      
      const filePath = join(options.staticDir!, urlPath);
      
      if (filePath.startsWith(options.staticDir!) && existsSync(filePath) && statSync(filePath).isFile()) {
          const ext = extname(filePath);
          const mime = MIME_TYPES[ext] || "application/octet-stream";
          res.status(200).header("Content-Type", mime).send(readFileSync(filePath));
      } else {
          next();
      }
    });

    // SPA fallback
    app.use((req: any, res: any) => {
        const indexPath = join(options.staticDir!, "index.html");
        if (existsSync(indexPath)) {
            res.status(200).header("Content-Type", "text/html").send(readFileSync(indexPath));
        } else {
            res.status(404).send("Not Found");
        }
    });
  }

  console.error(`[server.ts] Starting listen on port ${options.port}...`);
  await server.listen(options.port);

  console.error({ intent: "server_start", result: "ok", port: options.port });

  return server;
}
