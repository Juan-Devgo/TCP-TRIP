import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],

  i18n: {
    locales: ['es', 'en'],
    defaultLocale: 'en',
  },
});
