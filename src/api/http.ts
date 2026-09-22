/**
 * Shared response helpers so every route answers with the same shape.
 *
 * There is no per-handler `try/catch` wrapper any more. `Bun.serve` takes an
 * `error` callback that already covers every route, every method and the SPA
 * fallback, so a throw anywhere in the server produces the same body as
 * `fail` — one place instead of one wrapper per handler, and nothing between
 * the router and the function it dispatches to.
 *
 * The trade-off is that `error` receives the error alone, not the request, so
 * the log line no longer names the method and URL. The stack does.
 */

import type { ErrorLike } from "bun";

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function fail(
  status: number,
  message: string,
  details?: unknown,
): Response {
  return Response.json({ error: { message, details } }, { status });
}

/**
 * `Bun.serve`'s `error` callback, mounted in `src/index.ts`.
 *
 * Returning a `Response` here replaces Bun's built-in development error page,
 * which is the point: that page answers HTML with source code in it, and an
 * API client parsing JSON would choke on it. Outside production the message
 * and stack ride along in `details` so the page is not missed; in production
 * the client gets the status and nothing else, while the full error is logged.
 */
export function onError(error: ErrorLike): Response {
  console.error("[server]", error);

  if (process.env.NODE_ENV === "production") {
    return fail(500, "Internal Server Error");
  }

  return fail(500, "Internal Server Error", {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
}
