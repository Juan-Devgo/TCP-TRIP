import { serve, type TLSOptions } from "bun";

import index from "@/index.html";
import { onError } from "@/api/http";
import { apiRoutes } from "@/api/routes";

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
    console.warn(
      `[server] TLS is configured but unreadable (${keyPath}, ${certPath}) — serving plain HTTP`,
    );
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
    ...apiRoutes,
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

console.log(`Server running at ${server.url}`);
