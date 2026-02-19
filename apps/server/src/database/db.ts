import { PrismaClient } from "../generated/prisma";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaLibSql({
	url: process.env.DATABASE_URL ?? "",
});

export const prisma = new PrismaClient({
	adapter,
	log:
		process.env.NODE_ENV === "production"
			? ["warn", "error"]
			: ["query", "info", "warn", "error"],
});
