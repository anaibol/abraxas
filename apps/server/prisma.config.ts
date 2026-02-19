import { defineConfig } from "prisma/config";

// Use the direct (non-pooled) connection for migrations to avoid
// PgBouncer's transaction-mode limitations with DDL statements.
// Falls back to DATABASE_URL so `prisma generate` works in Docker
// without DIRECT_URL being set at build time.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!migrationUrl) {
  throw new Error(
    "Missing database URL: set DIRECT_URL or DATABASE_URL before running migrations.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
