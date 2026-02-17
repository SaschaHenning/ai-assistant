# ---- Stage 1: Install dependencies ----
FROM oven/bun:1.3 AS deps
WORKDIR /app

# Copy workspace root
COPY package.json bun.lock ./

# Copy all workspace package.json files for dependency resolution
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/skill-runtime/package.json packages/skill-runtime/package.json
COPY skills/telegram/package.json skills/telegram/package.json
COPY skills/web-chat/package.json skills/web-chat/package.json
COPY skills/web-search/package.json skills/web-search/package.json
COPY skills/skill-creator/package.json skills/skill-creator/package.json

RUN bun install --frozen-lockfile

# ---- Stage 2: Build web UI ----
FROM deps AS web-build
WORKDIR /app

COPY . .
RUN cd apps/web && bun run build

# ---- Stage 3: Runtime ----
FROM oven/bun:1.3-debian AS runtime
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ffmpeg \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install Claude CLI globally (pin version for reproducibility)
# Use HOME=/home/bun so files install to bun user's home, not /root
RUN HOME=/home/bun bun add -g @anthropic-ai/claude-code@latest

# Copy dependencies from deps stage (root + workspace-level)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/gateway/node_modules ./apps/gateway/node_modules

# Copy source code (Bun runs TypeScript directly)
COPY package.json tsconfig.json VERSION ./
COPY apps/gateway apps/gateway
COPY packages packages
COPY skills skills

# Copy built web UI from web-build stage
COPY --from=web-build /app/apps/web/dist apps/web/dist

# Copy entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Create data directory and set ownership for non-root user
RUN mkdir -p /app/data && chown -R bun:bun /app /home/bun

# Switch to non-root user
USER bun

# Version label
ARG APP_VERSION=unknown
LABEL org.opencontainers.image.version=${APP_VERSION}

EXPOSE 4300

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4300/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
