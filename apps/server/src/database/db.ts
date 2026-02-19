import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
    log:
        process.env.NODE_ENV === "production"
            ? ["warn", "error"]
            : ["query", "info", "warn", "error"],
});
