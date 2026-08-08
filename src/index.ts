import { serve } from "bun";

import index from "@/index.html";
import { apiRoutes } from "@/api/routes";

const isProduction = process.env.NODE_ENV === "production";

const server = serve({
  port: Number(process.env.PORT ?? 3000),

  routes: {
    ...apiRoutes,
    // SPA fallback: anything not matched above renders the React app.
    "/*": index,
  },

  development: !isProduction && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
