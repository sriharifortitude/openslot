import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import { buildApp } from './app.js';

const port = Number(process.env['PORT'] ?? 4100);
const app = buildApp();

// In production the built UI sits next to the API: one process, one port,
// no CORS. In development Vite serves the UI and proxies /api here.
if (existsSync('dist/web/index.html')) {
  app.use('/*', serveStatic({ root: 'dist/web' }));
  app.get('*', serveStatic({ root: 'dist/web', path: 'index.html' }));
}

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  process.stdout.write(`openslot api on :${port}\n`);
});
