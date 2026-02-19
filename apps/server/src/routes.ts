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
      email: z.string().email(),
      password: z.string().min(6),
      charName: z
        .string()
        .min(2)
        .max(20)
        .regex(/^[A-Z][a-z]*( [A-Z][a-z]*)*$/, "Each word must start with a capital letter and contain only letters"),
      classType: z.nativeEnum(CharacterClass),
    }),
  },
  async (ctx) => {
    const { email, password, charName, classType } = ctx.body;
    const stats = CLASS_STATS[classType];

    try {
      const existing = await prisma.account.findUnique({ where: { email } });
      if (existing) {
        return ctx.json({ error: "Email already registered" }, { status: 409 });
      }

      const existingChar = await prisma.character.findUnique({ where: { name: charName } });
      if (existingChar) {
        return ctx.json({ error: "Character name already taken" }, { status: 409 });
      }

      const hashedPassword = await AuthService.hashPassword(password);
      const user = await prisma.account.create({
        data: {
          email,
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
        email: user.email,
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

      const char = await prisma.character.findFirstOrThrow({
        where: { accountId: user.id },
        select: { id: true, name: true, class: true },
      });

      const token = AuthService.generateToken({
        userId: user.id,
        email: user.email,
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
