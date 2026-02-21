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
RUN cd apps/server && bunx prisma generate

# Bundle the server into a single file (excludes Prisma native binaries)
RUN bun build apps/server/src/index.ts \
    --outfile apps/server/dist/server.js \
    --target bun \
    --external prisma \
    --external @prisma/client

# Production stage
FROM oven/bun:1-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Only what's needed at runtime
COPY --from=base /app/apps/server/dist/server.js ./server.js
COPY --from=base /app/apps/client/dist/ apps/client/dist/
COPY --from=base /app/apps/server/prisma/ prisma/

ENV NODE_ENV=production
ENV PORT=8080
ENV STATIC_DIR=/app/apps/client/dist

EXPOSE 8080

CMD ["bun", "server.js"]
