import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/web',
  publicDir: false,
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { outDir: '../../dist/web', emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:4100' } },
});
