import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import node from "@astrojs/node";
import clerk from "@clerk/astro";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        external: ["bun"],
      },
    },
    ssr: {
      external: ["bun"],
    },
  },

  integrations: [react(), clerk()],

  adapter: node({
    mode: "standalone",
  }),

  output: "server",

  i18n: {
    locales: ["es", "en"],
    defaultLocale: "es",
  },
});
