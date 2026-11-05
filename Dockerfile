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
# Lifecycle scripts stay off. That blocks Clerk's telemetry postinstall and
# also the `bun` npm package's (a peer of bun-plugin-tailwind), which is what
# swaps its bin/bun.exe placeholder for a real binary. The placeholder is
# linked as node_modules/.bin/bun, and `bun run` puts that folder first in
# PATH, so `bun run start` would exec it and exit with "Bun's postinstall
# script was not run". Removing the links leaves the image's own pinned bun.
RUN bun install --frozen-lockfile --ignore-scripts \
  && rm -f node_modules/.bin/bun node_modules/.bin/bunx

# bunfig.toml carries the Tailwind plugin and the PUBLIC_* inlining rule;
# tsconfig.json carries the `@/*` path alias Bun resolves at runtime.
COPY bunfig.toml tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

# The server runs as the image's unprivileged `bun` user, but the container
# starts as root: Railway mounts the volume over /app/data owned by root, so
# the entrypoint hands that folder to `bun` and then drops privileges with
# setpriv before exec'ing the server. A plain `USER bun` cannot do that and
# leaves SQLite with SQLITE_CANTOPEN.
RUN mkdir -p /app/data && chown bun:bun /app /app/data
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/tcp-trip-entrypoint.sh

# Bun reads $PORT (Railway injects it); 3000 is the fallback.
EXPOSE 3000

# The SQLite file lives in /app/data by default (DATABASE_PATH). Mount a volume
# there, or every redeploy starts with an empty database.
ENTRYPOINT ["/usr/local/bin/tcp-trip-entrypoint.sh"]
CMD ["bun", "src/index.ts"]
