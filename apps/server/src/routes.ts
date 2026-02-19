import { createEndpoint } from "@colyseus/core";
import { z } from "zod";
import { CLASS_STATS } from "@abraxas/shared";
import { CharacterClass } from "./generated/prisma";
import { logger } from "./logger";
import { AuthService } from "./database/auth";
import { prisma } from "./database/db";

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export const healthEndpoint = createEndpoint(
  "/health",
  { method: "GET" },
  async (ctx) => ctx.json({ ok: true }),
);

export const registerEndpoint = createEndpoint(
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

      const hashedPassword = await AuthService.hashPassword(password);
      const user = await prisma.account.create({
        data: { email, password: hashedPassword },
      });

      const token = AuthService.generateToken({
        userId: user.id,
        email: user.email,
      });
      return ctx.json({ token, characters: [] });
    } catch (e) {
      logger.error({ message: "Registration error", error: String(e) });
      return ctx.json({ error: "Registration failed" }, { status: 500 });
    }
  },
);

export const loginEndpoint = createEndpoint(
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
      if (!user || !(await AuthService.verifyPassword(password, user.password))) {
        return ctx.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const characters = await prisma.character.findMany({
        where: { accountId: user.id },
        select: { id: true, name: true, class: true, level: true },
        orderBy: { lastLoginAt: "desc" },
      });

      const token = AuthService.generateToken({
        userId: user.id,
        email: user.email,
      });
      return ctx.json({ token, characters });
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
    const token = extractBearerToken(ctx.request);

    if (!token) {
      return ctx.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = AuthService.verifyToken(token);
    if (!payload) {
      return ctx.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const characters = await prisma.character.findMany({
      where: { accountId: payload.userId },
      select: { id: true, name: true, class: true, level: true },
      orderBy: { lastLoginAt: "desc" },
    });

    return ctx.json({ characters });
  },
);

export const createCharacterEndpoint = createEndpoint(
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
    const token = extractBearerToken(ctx.request);

    if (!token) {
      return ctx.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = AuthService.verifyToken(token);
    if (!payload) {
      return ctx.json({ error: "Invalid or expired token" }, { status: 401 });
    }

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
