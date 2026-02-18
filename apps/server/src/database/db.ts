import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import "dotenv/config";
import { resolve } from "path";

const DEFAULT_DB_PATH = "file:../../dev.db";
const dbPath = process.env.DATABASE_URL || DEFAULT_DB_PATH;

let url = dbPath;
if (dbPath === DEFAULT_DB_PATH) {
   // Resolve default path relative to this file to ensure it hits apps/server/dev.db
   // regardless of where the script is run from (CWD)
   const relativePath = dbPath.replace("file:", "");
   url = `file://${resolve(import.meta.dir, "..", "..", relativePath)}`;
}

const adapter = new PrismaLibSql({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const prisma = new PrismaClient({ 
    adapter,
    log: ["query", "info", "warn", "error"]
});
