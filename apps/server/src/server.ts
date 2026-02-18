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
import { CharacterClass } from "./generated/prisma";
import { logger } from "./logger";
import { AuthService } from "./database/auth";
import { prisma } from "./database/db";
import { MapService } from "./services/MapService";
import type { Request, Response, NextFunction } from "express";

// Global error handlers to catch silent crashes in tests
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
      charName: z.string().min(2).max(20),
      classType: z.nativeEnum(CharacterClass),
    }),
  },
  async (ctx) => {
    const { username, password, charName, classType } = ctx.body;
    const stats = CLASS_STATS[classType];

    try {
      const existing = await prisma.account.findUnique({ where: { username } });
      if (existing) {
        return ctx.json({ error: "Username already taken" }, { status: 409 });
      }

      const hashedPassword = await AuthService.hashPassword(password);
      const user = await prisma.account.create({
        data: {
          username,
          password: hashedPassword,
          characters: {
            create: {
              name: charName,
              class: classType,
              stats: {
                create: {
                  hp: stats.hp,
                  maxHp: stats.hp,
                  mp: stats.mana,
                  maxMp: stats.mana,
                  str: stats.str,
                  agi: stats.agi,
                  int: stats.int,
                },
              },
              inventory: {
                create: {
                  size: 40,
                },
              },
            },
          },
        },
        include: { characters: { select: { id: true } } },
      });

      const token = AuthService.generateToken({
        userId: user.id,
        username: user.username,
      });
      return ctx.json({ token, charId: user.characters[0]?.id });
    } catch (e) {
      logger.error({ message: "Registration error", error: String(e) });
      return ctx.json({ error: "Registration failed" }, { status: 500 });
    }
  },
);

const healthEndpoint = createEndpoint(
  "/health",
  { method: "GET" },
  async (ctx) => ctx.json({ ok: true }),
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
      const user = await prisma.account.findUnique({ where: { username } });
      if (!user) {
        return ctx.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const valid = await AuthService.verifyPassword(password, user.password);
      if (!valid) {
        return ctx.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const char = await prisma.character.findFirstOrThrow({
        where: { accountId: user.id },
        select: { id: true, name: true, class: true },
      });

      const token = AuthService.generateToken({
        userId: user.id,
        username: user.username,
      });
      return ctx.json({
        token,
        charId: char.id,
        charName: char.name,
        classType: char.class,
      });
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
    // devMode keeps room state alive across server restarts during local dev.
    // Never enable this in production or during tests.
    devMode:
      process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test",
    rooms: {
      arena: defineRoom(ArenaRoom),
    },
    routes: createRouter({ healthEndpoint, registerEndpoint, loginEndpoint }),
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

  // Bind to "::" (IPv6 wildcard) which on Linux enables dual-stack:
  // accepts both IPv4 and IPv6 connections. Required for Fly.io health
  // checks, which connect via the machine's internal IPv6 address.
  await server.listen(options.port, "0.0.0.0");

  logger.info({ intent: "server_start", result: "ok", port: options.port });

  return server;
}
