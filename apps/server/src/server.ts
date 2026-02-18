import {
  defineServer,
  defineRoom,
  createEndpoint,
  createRouter,
  type Server,
} from "@colyseus/core";
import { BunWebSockets } from "@colyseus/bun-websockets";
import { z } from "zod";
import { join, extname } from "path";
import { ArenaRoom } from "./rooms/ArenaRoom";
import type { TileMap } from "@abraxas/shared";
import { CLASS_STATS } from "@abraxas/shared";
import { logger } from "./logger";
import { AuthService } from "./database/auth";
import { prisma } from "./database/db";
import { MapService } from "./services/MapService";
import type { Request, Response, NextFunction } from "express";

// Minimal MIME-type map for the built client assets
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

// --- Colyseus 0.17 typed HTTP endpoints ---

const registerEndpoint = createEndpoint(
  "/api/register",
  {
    method: "POST",
    body: z.object({
      username: z.string().min(3).max(20),
      password: z.string().min(6),
      playerName: z.string().min(2).max(20),
      classType: z.string(),
    }),
  },
  async (ctx) => {
    const { username, password, playerName, classType } = ctx.body;

    const stats = CLASS_STATS[classType];
    if (!stats) {
      return ctx.json({ error: "Invalid class type" }, { status: 400 });
    }

    try {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) {
        return ctx.json({ error: "Username already taken" }, { status: 409 });
      }

      const hashedPassword = await AuthService.hashPassword(password);
      const user = await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          players: {
            create: {
              name: playerName,
              classType,
              hp: stats.hp,
              maxHp: stats.hp,
              mana: stats.mana ?? 0,
              maxMana: stats.mana ?? 0,
              str: stats.str,
              agi: stats.agi,
              intStat: stats.int,
            },
          },
        },
      });

      const token = AuthService.generateToken({
        userId: user.id,
        username: user.username,
      });
      return ctx.json({ token });
    } catch (e) {
      logger.error({ message: "Registration error", error: String(e) });
      return ctx.json({ error: "Registration failed" }, { status: 500 });
    }
  },
);

const loginEndpoint = createEndpoint(
  "/api/login",
  {
    method: "POST",
    body: z.object({
      username: z.string(),
      password: z.string(),
    }),
  },
  async (ctx) => {
    const { username, password } = ctx.body;

    try {
      const user = await prisma.user.findUnique({ where: { username } });
      if (!user) {
        return ctx.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const valid = await AuthService.verifyPassword(password, user.password);
      if (!valid) {
        return ctx.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const token = AuthService.generateToken({
        userId: user.id,
        username: user.username,
      });
      return ctx.json({ token });
    } catch (e) {
      logger.error({ message: "Login error", error: String(e) });
      return ctx.json({ error: "Login failed" }, { status: 500 });
    }
  },
);

export async function createGameServer(options: {
  port: number;
  map: TileMap;
  staticDir?: string;
}): Promise<Server> {
  MapService.setMap("arena.test", options.map);
  MapService.setMap("arena", options.map);

  const server = defineServer({
    transport: new BunWebSockets(),
    rooms: {
      arena: defineRoom(ArenaRoom),
    },
    routes: createRouter({ registerEndpoint, loginEndpoint }),
    express: (app) => {
      // Serve the built client via Bun.file() — no Express needed
      if (options.staticDir) {
        const staticDir = options.staticDir;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.use(async (req: Request, res: Response, next: NextFunction) => {
          const pathname: string = req.path || "/";

          // Let Colyseus handle its own routes
          if (
            pathname.startsWith("/api") ||
            pathname.startsWith("/matchmake") ||
            pathname.startsWith("/.colyseus")
          ) {
            return next();
          }

          const filePath = join(
            staticDir,
            pathname === "/" ? "index.html" : pathname,
          );
          const file = Bun.file(filePath);

          if (await file.exists()) {
            const ext = extname(filePath);
            const bytes = await file.arrayBuffer();
            res.setHeader(
              "Content-Type",
              MIME[ext] ?? "application/octet-stream",
            );
            res.end(Buffer.from(bytes));
            return;
          }

          // SPA fallback — all unmatched paths get index.html
          const index = Bun.file(join(staticDir, "index.html"));
          const bytes = await index.arrayBuffer();
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(Buffer.from(bytes));
        });
      }
    },
  });

  await server.listen(options.port, "0.0.0.0");

  logger.info({ intent: "server_start", result: "ok", port: options.port });

  return server;
}
