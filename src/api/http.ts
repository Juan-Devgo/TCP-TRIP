/**
 * Shared response helpers so every route answers with the same shape.
 *
 * There is no per-handler `try/catch` wrapper any more. `Bun.serve` takes an
 * `error` callback that already covers every route, every method and the SPA
 * fallback, so a throw anywhere in the server produces the same body as
 * `fail` — one place instead of one wrapper per handler, and nothing between
 * the router and the function it dispatches to.
 *
 * `error` receives the error alone, not the request; the access log
 * (`src/api/accessLog.ts`) is what names the method and path of a failed API
 * call.
 */

import type { ErrorLike } from "bun";

import { errorFields, log } from "@/api/log";

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
  log.error("uncaught error", errorFields(error));

  if (process.env.NODE_ENV === "production") {
    return fail(500, "Internal Server Error");
  }

  return fail(500, "Internal Server Error", {
    name: error.name,
    message: error.message,
    stack: error.stack,
  });
}
