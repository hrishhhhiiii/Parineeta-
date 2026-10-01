import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
import { productPages } from './build/product-pages.js';

export default defineConfig(({ mode }) => ({
  plugins: [productPages({ site: loadEnv(mode, import.meta.dirname, 'VITE_').VITE_SITE_URL || '' })],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        login: resolve(import.meta.dirname, 'login.html'),
      },
    },
  },
}));
