/**
 * One access-log line per API request: method, path, status and duration.
 *
 * Applied once, to the whole route map, in `src/index.ts` — route handlers stay
 * plain functions and nothing has to remember to log. It also gives a thrown
 * error the request it happened in, which `onError` never sees.
 *
 * Out of reach by design: ready-made `Response` values (Bun serves them without
 * calling any code) and the HTML bundle behind `"/*"`.
 */

import type { Server } from "bun";

import { errorFields, log } from "@/api/log";

type Handler = (req: Request, server: Server<unknown>) => Response | Promise<Response>;

function logged(handler: Handler): Handler {
  return async (req, server) => {
    const started = performance.now();
    const path = new URL(req.url).pathname;
    const ms = () => Math.round(performance.now() - started);

    try {
      const response = await handler(req, server);
      const status = response.status;
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      log[level]("request", { method: req.method, path, status, ms: ms() });
      return response;
    } catch (error) {
      // Rethrown: `onError` still answers the 500 and logs the full stack.
      log.error("request", { method: req.method, path, status: 500, ms: ms(), ...errorFields(error) });
      throw error;
    }
  };
}

/**
 * Wraps every handler in the map. The return type is the input's, so Bun's
 * per-path `BunRequest<"/api/x/:id">` typing survives the wrapping.
 */
export function withAccessLog<T extends Record<string, unknown>>(routes: T): T {
  const wrapped: Record<string, unknown> = {};

  for (const [path, route] of Object.entries(routes)) {
    if (typeof route === "function") {
      wrapped[path] = logged(route as Handler);
    } else if (route && typeof route === "object" && !(route instanceof Response)) {
      wrapped[path] = Object.fromEntries(
        Object.entries(route).map(([method, handler]) => [
          method,
          typeof handler === "function" ? logged(handler as Handler) : handler,
        ]),
      );
    } else {
      wrapped[path] = route;
    }
  }

  return wrapped as T;
}
