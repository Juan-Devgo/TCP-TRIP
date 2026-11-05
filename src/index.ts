import { serve, type TLSOptions } from "bun";

import index from "@/index.html";
import { withAccessLog } from "@/api/accessLog";
import { onError } from "@/api/http";
import { errorFields, log, memoryFields } from "@/api/log";
import { apiRoutes } from "@/api/routes";
import { closeDb } from "@/db/client";

const isProduction = process.env.NODE_ENV === "production";

/**
 * TLS: wired, dormant until the certificate exists.
 *
 * `tls` wants the *contents* of the key and the certificate, not paths, which
 * is what `Bun.file` gives it — lazily, so nothing is read until the handshake
 * needs it. Point `TLS_KEY_PATH` and `TLS_CERT_PATH` at the PEM files and the
 * same server speaks HTTPS on the same port; leave them unset and it stays on
 * plain HTTP, which is what local development wants.
 *
 * Both are unprefixed on purpose: only `PUBLIC_*` literals are inlined into
 * the client bundle, and a private key has no business in a browser.
 *
 * Optional companions: `TLS_CA_PATH` (replaces Mozilla's root list),
 * `TLS_PASSPHRASE` (for an encrypted key), `TLS_SERVER_NAME` (SNI).
 */
async function readTls(): Promise<TLSOptions | undefined> {
  const keyPath = process.env.TLS_KEY_PATH;
  const certPath = process.env.TLS_CERT_PATH;
  if (!keyPath || !certPath) return undefined;

  const key = Bun.file(keyPath);
  const cert = Bun.file(certPath);

  // Half a TLS config is worse than none: fail loudly here rather than at the
  // first handshake, but keep serving so a missing file is not a dead server.
  if (!(await key.exists()) || !(await cert.exists())) {
    log.warn("TLS is configured but unreadable — serving plain HTTP", { keyPath, certPath });
    return undefined;
  }

  const caPath = process.env.TLS_CA_PATH;
  const passphrase = process.env.TLS_PASSPHRASE;
  const serverName = process.env.TLS_SERVER_NAME;

  // Spread rather than assign: `exactOptionalPropertyTypes` refuses an
  // explicit `undefined` where the field is merely optional.
  return {
    key,
    cert,
    ...(caPath ? { ca: Bun.file(caPath) } : {}),
    ...(passphrase ? { passphrase } : {}),
    ...(serverName ? { serverName } : {}),
  };
}

const tls = await readTls();

const server = serve({
  // No `port`: Bun already reads $BUN_PORT, then $PORT, then $NODE_PORT, and
  // falls back to 3000.
  ...(tls ? { tls } : {}),

  routes: {
    ...withAccessLog(apiRoutes),
    // SPA fallback: anything not matched above renders the React app. `/api/*`
    // is claimed in `apiRoutes`, so a wrong endpoint gets a JSON 404 instead
    // of this HTML.
    "/*": index,
  },

  // One place for every uncaught throw, in a route or in the fallback.
  error: onError,

  development: !isProduction && {
    hmr: true,
    console: true,
  },
});

/**
 * Lifecycle logging. On a platform the process log is the only window into the
 * container, and the questions it has to answer are: did it start with the
 * right settings, is it still the same process, and why did it stop?
 */

// `server.url` and `server.hostname` both say `localhost`, but with no
// `hostname` option Bun listens on `[::]` (every IPv4 and IPv6 interface): the
// port is what matters. Env vars are reported as set or not — never their
// values.
log.info("server started", {
  url: server.url.href,
  port: server.port,
  nodeEnv: process.env.NODE_ENV ?? null,
  bun: Bun.version,
  pid: process.pid,
  tls: Boolean(tls),
  databasePath: process.env.DATABASE_PATH ?? "data/tcp-trip.sqlite",
  appOrigin: process.env.APP_ORIGIN ?? null,
  clerkSecretKey: Boolean(process.env.CLERK_SECRET_KEY),
  deployment: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
  commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  ...memoryFields(),
});

if (isProduction && !process.env.CLERK_SECRET_KEY) {
  log.error("CLERK_SECRET_KEY is not set — every authenticated API call will answer 500");
}

// Process-wide hooks, registered once: `bun --hot` re-evaluates this module on
// every edit, and each pass would otherwise stack another set.
const processHooks = globalThis as { __tcpTripProcessHooks?: true };
if (!processHooks.__tcpTripProcessHooks) {
  processHooks.__tcpTripProcessHooks = true;

  // A heartbeat: if `uptime` resets between two of these, the container was
  // restarted (an OOM kill, for one, writes nothing of its own).
  setInterval(() => log.info("heartbeat", { uptime: Math.round(process.uptime()), ...memoryFields() }), 10 * 60_000).unref();

  // The platform stops a container with SIGTERM (redeploy, restart, sleep).
  // Handling it means the log says so, and SQLite checkpoints its WAL on the way
  // out instead of being killed mid-write.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      log.info("shutting down", { signal, uptime: Math.round(process.uptime()) });
      void server.stop();
      closeDb();
      process.exit(0);
    });
  }

  // Same outcome as Bun's default (exit 1, so the restart policy applies), but
  // as one log line with the stack instead of loose stderr.
  process.on("uncaughtException", (error) => {
    log.error("uncaught exception", errorFields(error));
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    log.error("unhandled rejection", errorFields(reason));
    process.exit(1);
  });
  process.on("exit", (code) => log.info("process exit", { code }));
}
