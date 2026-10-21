import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const pages = ['index', 'index-en', 'services', 'services-en', 'app'];

// Dev-server mirror of public/_redirects: platform routes are served by app.html.
const appRoutes = /^\/(login|forgot|reset|account|m|admin)(\/|$|\?)/;
function spaFallback(): Plugin {
  return {
    name: 'dasman-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && appRoutes.test(req.url)) req.url = '/app.html';
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), spaFallback()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(import.meta.dirname, `${p}.html`)])),
    },
  },
});
