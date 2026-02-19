import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use the direct connection (not pooled) for migrations to avoid
    // PgBouncer's transaction-mode limitations with DDL statements.
    url: env("DIRECT_URL"),
  },
});
