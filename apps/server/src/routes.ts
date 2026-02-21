import { CLASS_STATS } from "@abraxas/shared";
import { createEndpoint } from "@colyseus/core";
import { z } from "zod";
import { generateToken, hashPassword, verifyPassword, verifyToken } from "./database/auth";
import { prisma } from "./database/db";
import { CharacterClass } from "./generated/prisma";
import { logger } from "./logger";

const LEADERBOARD_SELECT = {
  name: true,
  class: true,
  level: true,
  pvpKills: true,
  npcKills: true,
  gold: true,
} as const;

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/** Verifies the bearer token on a request. Returns `{ payload }` on success or `{ response }` with the error to send. */
function requireAuth(ctx: { request?: Request }, requiredRole?: string) {
  const token = ctx.request ? extractBearerToken(ctx.request) : null;
  if (!token) return { payload: null, response: { body: { error: "Unauthorized" }, status: 401 } as const };
  const payload = verifyToken(token);
  if (!payload) return { payload: null, response: { body: { error: "Invalid or expired token" }, status: 401 } as const };
  if (requiredRole && payload.role !== requiredRole)
    return { payload: null, response: { body: { error: "Forbidden" }, status: 403 } as const };
  return { payload, response: null };
}

export const healthEndpoint = createEndpoint(
  "/health",
  { method: "GET" },
  async (ctx) => ctx.json({ ok: true }),
);

export const registerEndpoint: ReturnType<typeof createEndpoint> = createEndpoint(
  "/api/register",
  {
    method: "POST",
    body: z.object({
      email: z.string().email(),
      password: z.string().min(6),
    }),
  },
  async (ctx) => {
    const { email, password } = ctx.body;

    try {
      const existing = await prisma.account.findUnique({ where: { email } });
      if (existing) {
        return ctx.json({ error: "Email already registered" }, { status: 409 });
      }

      const hashedPassword = await hashPassword(password);
      const user = await prisma.account.create({
        data: { email, password: hashedPassword },
      });

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      return ctx.json({ token, characters: [] });
    } catch (e) {
      logger.error({ message: "Registration error", error: String(e) });
      return ctx.json({ error: "Registration failed" }, { status: 500 });
    }
  },
);

export const loginEndpoint: ReturnType<typeof createEndpoint> = createEndpoint(
  "/api/login",
  {
    method: "POST",
    body: z.object({
      email: z.string().email(),
      password: z.string(),
    }),
  },
  async (ctx) => {
    const { email, password } = ctx.body;

    try {
      const user = await prisma.account.findUnique({ where: { email } });
      if (!user || !(await verifyPassword(password, user.password))) {
        return ctx.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const characters = await prisma.character.findMany({
        where: { accountId: user.id },
        select: { id: true, name: true, class: true, level: true },
        orderBy: { lastLoginAt: "desc" },
      });

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      return ctx.json({ token, characters, role: user.role });
    } catch (e) {
      logger.error({ message: "Login error", error: String(e) });
      return ctx.json({ error: "Login failed" }, { status: 500 });
    }
  },
);

export const meEndpoint = createEndpoint(
  "/api/me",
  { method: "GET" },
  async (ctx) => {
    if (!ctx.request) return ctx.json({ error: "Missing request" }, { status: 400 });
    const auth = requireAuth(ctx);
    if (!auth.payload) return ctx.json(auth.response!.body, { status: auth.response!.status });
    const { payload } = auth;

    const characters = await prisma.character.findMany({
      where: { accountId: payload.userId },
      select: { id: true, name: true, class: true, level: true },
      orderBy: { lastLoginAt: "desc" },
    });

    return ctx.json({ characters, role: payload.role });
  },
);

export const createCharacterEndpoint: ReturnType<typeof createEndpoint> = createEndpoint(
  "/api/characters",
  {
    method: "POST",
    body: z.object({
      charName: z
        .string()
        .min(2)
        .max(20)
        .regex(
          /^[A-Z][a-z]*( [A-Z][a-z]*)*$/,
          "Each word must start with a capital letter and contain only letters",
        ),
      classType: z.nativeEnum(CharacterClass),
    }),
  },
  async (ctx) => {
    if (!ctx.request) return ctx.json({ error: "Missing request" }, { status: 400 });
    const auth = requireAuth(ctx);
    if (!auth.payload) return ctx.json(auth.response!.body, { status: auth.response!.status });
    const { payload } = auth;

    const { charName, classType } = ctx.body;
    const stats = CLASS_STATS[classType];

    try {
      const existingChar = await prisma.character.findUnique({ where: { name: charName } });
      if (existingChar) {
        return ctx.json({ error: "Character name already taken" }, { status: 409 });
      }

      const charCount = await prisma.character.count({ where: { accountId: payload.userId } });
      if (charCount >= 5) {
        return ctx.json({ error: "Character limit reached (max 5)" }, { status: 400 });
      }

      const character = await prisma.character.create({
        data: {
          accountId: payload.userId,
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
          inventory: { create: { size: 40 } },
          bank: { create: {} },
        },
        select: { id: true, name: true, class: true, level: true },
      });

      return ctx.json(character);
    } catch (e) {
      logger.error({ message: "Character creation error", error: String(e) });
      return ctx.json({ error: "Character creation failed" }, { status: 500 });
    }
  },
);

export const adminCharactersEndpoint = createEndpoint(
  "/api/admin/characters",
  { method: "GET" },
  async (ctx) => {
    if (!ctx.request) return ctx.json({ error: "Missing request" }, { status: 400 });
    const auth = requireAuth(ctx, "ADMIN");
    if (!auth.payload) return ctx.json(auth.response!.body, { status: auth.response!.status });

    try {
      const characters = await prisma.character.findMany({
        select: {
          id: true,
          name: true,
          class: true,
          level: true,
          account: { select: { email: true } },
        },
        orderBy: { name: "asc" },
      });
      return ctx.json({ characters });
    } catch (e) {
      logger.error({ message: "Admin characters error", error: String(e) });
      return ctx.json({ error: "Failed to load characters" }, { status: 500 });
    }
  },
);

export const leaderboardEndpoint = createEndpoint(
  "/api/leaderboard",
  { method: "GET" },
  async (ctx) => {
    try {
      const [byLevel, byNpcKills, byPvpKills, byGold] = await Promise.all([
        prisma.character.findMany({
          select: LEADERBOARD_SELECT,
          orderBy: { level: "desc" },
          take: 10,
        }),
        prisma.character.findMany({
          select: LEADERBOARD_SELECT,
          orderBy: { npcKills: "desc" },
          where: { npcKills: { gt: 0 } },
          take: 10,
        }),
        prisma.character.findMany({
          select: LEADERBOARD_SELECT,
          orderBy: { pvpKills: "desc" },
          where: { pvpKills: { gt: 0 } },
          take: 10,
        }),
        prisma.character.findMany({
          select: LEADERBOARD_SELECT,
          orderBy: { gold: "desc" },
          where: { gold: { gt: 0 } },
          take: 10,
        }),
      ]);

      return ctx.json({ byLevel, byNpcKills, byPvpKills, byGold });
    } catch (e) {
      logger.error({ message: "Leaderboard error", error: String(e) });
      return ctx.json({ error: "Failed to load leaderboard" }, { status: 500 });
    }
  },
);
