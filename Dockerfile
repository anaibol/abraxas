FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN bun install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY apps/ apps/
COPY tsconfig.json ./

# Build the client
RUN bun run --cwd apps/client build

# Generate Prisma Client
RUN bunx prisma generate --schema apps/server/prisma/schema.prisma

# Production stage
FROM oven/bun:1-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=base /app/package.json /app/bun.lock ./
COPY --from=base /app/packages/ packages/
COPY --from=base /app/apps/server/ apps/server/
COPY --from=base /app/apps/client/dist/ apps/client/dist/
COPY --from=base /app/node_modules/ node_modules/
COPY --from=base /app/tsconfig.json ./

ENV NODE_ENV=production
ENV PORT=8080
ENV STATIC_DIR=/app/apps/client/dist

EXPOSE 8080

CMD ["bun", "run", "apps/server/src/index.ts"]
