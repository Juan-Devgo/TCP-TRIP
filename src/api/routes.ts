import { fail, ok } from "@/api/http";
import { protocolRoutes } from "@/api/protocols";

/**
 * Every API route lives here. Add new modules under `src/api/` and mount them
 * in this map — `src/index.ts` stays untouched.
 *
 * The map is `Bun.serve`'s own router: a path maps either to a function, to an
 * object of per-method functions, or to a ready-made `Response`, which Bun
 * caches and serves with no per-request allocation. A method the object does
 * not list is not an error by itself — the request simply keeps looking, and
 * under `/api/` the wildcard below is what it finds.
 */
export const apiRoutes = {
  "/api/health": {
    // `uptime` changes per request, so this one is a handler and not a static
    // `Response` — those are frozen at boot.
    GET: () => ok({ status: "ok", uptime: process.uptime() }),
  },

  ...protocolRoutes,

  /**
   * Everything under `/api/` that matched nothing above. Without it a typo'd
   * endpoint falls through to the SPA fallback (`"/*"` in `src/index.ts`) and
   * answers `200 text/html`, which a `fetch` client reports as a JSON parse
   * error instead of a 404. Bun matches exact paths before parameters before
   * wildcards, so this cannot shadow the routes above.
   */
  "/api/*": fail(404, "Not Found"),
} as const;
