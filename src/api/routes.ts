import { handler, ok } from "@/api/http";

/**
 * Every API route lives here. Add new modules under `src/api/` and mount them
 * in this map — `src/index.ts` stays untouched.
 */
export const apiRoutes = {
  "/api/health": {
    GET: handler(() => ok({ status: "ok", uptime: process.uptime() })),
  },
} as const;
