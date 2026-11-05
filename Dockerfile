# TCP-TRIP — one Bun process serves the API and the SPA (see src/index.ts).
#
# There is no separate frontend build step: `src/index.ts` imports
# `src/index.html`, and Bun bundles that graph (TSX + Tailwind via
# bun-plugin-tailwind, registered in bunfig.toml) when the server starts.
# Two consequences shape this file:
#   - bun-plugin-tailwind is a devDependency but is needed at runtime, so the
#     install keeps devDependencies.
#   - PUBLIC_* variables are inlined into the client bundle at that moment, so
#     they are read from the *runtime* environment (Railway service variables),
#     not from build args.

FROM oven/bun:1.3.8-slim

WORKDIR /app

# Dependencies first, so a source-only change reuses this layer.
COPY package.json bun.lockb ./
# Lifecycle scripts stay off: Bun already skips untrusted ones, and the only
# one blocked here is Clerk's telemetry postinstall.
RUN bun install --frozen-lockfile --ignore-scripts

# bunfig.toml carries the Tailwind plugin and the PUBLIC_* inlining rule;
# tsconfig.json carries the `@/*` path alias Bun resolves at runtime.
COPY bunfig.toml tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

# Run as the image's unprivileged `bun` user. It owns /app/data so the SQLite
# file can be created when no volume is mounted (see docs/deploy/Railway.md for
# the volume's permissions).
RUN mkdir -p /app/data && chown bun:bun /app /app/data
USER bun

# Bun reads $PORT (Railway injects it); 3000 is the fallback.
EXPOSE 3000

# The SQLite file lives in /app/data by default (DATABASE_PATH). Mount a volume
# there, or every redeploy starts with an empty database.
CMD ["bun", "src/index.ts"]
