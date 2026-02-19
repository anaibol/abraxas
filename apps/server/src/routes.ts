import { createEndpoint } from "@colyseus/core";
import { z } from "zod";
import { CLASS_STATS } from "@abraxas/shared";
import { CharacterClass } from "./generated/prisma";
import { logger } from "./logger";
import { AuthService } from "./database/auth";
import { prisma } from "./database/db";

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
              inventory: { create: { size: 40 } },
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

export const loginEndpoint = createEndpoint(
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
      if (!user || !(await AuthService.verifyPassword(password, user.password))) {
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
