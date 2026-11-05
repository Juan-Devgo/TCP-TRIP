# TCP-TRIP — one Bun process serves the API and the SPA (see src/index.ts).
#
# Two stages:
#   - build: installs every dependency (bun-plugin-tailwind is a
#     devDependency) and runs `bun run build`, which bundles the server *and*
#     the SPA it imports into a self-contained dist/ (see build.ts).
#   - runtime: dist/ alone. No node_modules, no bundling at startup.
#
# Bundling at runtime was the old way: the health check passed before the SPA
# was ever bundled, and the first page view then spiked memory by ~500 MB.
#
# PUBLIC_* variables are inlined into the client bundle during the build, so
# they must exist at *build* time. Railway passes service variables to the
# build as build args, but only those declared with ARG below.

FROM oven/bun:1.3.8-slim AS build

WORKDIR /app

# Dependencies first, so a source-only change reuses this layer.
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# bunfig.toml carries the Tailwind plugin and the PUBLIC_* inlining rule;
# tsconfig.json carries the `@/*` path alias.
COPY bunfig.toml tsconfig.json build.ts ./
COPY src ./src

ARG PUBLIC_CLERK_PUBLISHABLE_KEY
RUN bun run build

FROM oven/bun:1.3.8-slim

# The bundle resolves its assets against the working directory, so dist/ is
# copied straight into it. The SQLite file defaults to /app/data (DATABASE_PATH):
# mount a volume there, or every redeploy starts with an empty database.
WORKDIR /app
COPY --from=build /app/dist ./

ENV NODE_ENV=production

# Railway injects PORT (8080 unless the service sets its own). The public
# domain's target port must be this same number, or the edge answers 502 while
# the health check — which uses PORT — still passes.
ENV PORT=8080
EXPOSE 8080

CMD ["bun", "index.js"]
