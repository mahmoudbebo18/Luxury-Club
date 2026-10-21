import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const pages = ['index', 'index-en', 'services', 'services-en', 'app'];

// Dev-server mirror of Cloudflare Pages: platform routes are served by app.html (public/_redirects),
// and pages are reachable without ".html" like in production.
const appRoutes = /^\/(login|forgot|reset|account|m|admin)(\/|$|\?)/;
const prettyPages = /^\/(index-en|services|services-en)(?=$|[?#])/;
function spaFallback(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url && appRoutes.test(req.url)) req.url = '/app.html';
    else if (req.url && prettyPages.test(req.url)) req.url = req.url.replace(prettyPages, '/$1.html');
    next();
  };
  return {
    name: 'dasman-spa-fallback',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
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
