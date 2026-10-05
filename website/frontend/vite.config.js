import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
import { productPages } from './build/product-pages.js';

// Fails the build if a shared bundle imports a page's own bundle. That happened once: sign-in ended up
// importing the admin bundle, so /account ran the whole admin panel ("Leave site?" prompts, a loop to /login).
const noPageBundleImports = () => ({
  name: 'no-page-bundle-imports',
  generateBundle(_, bundle) {
    const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
    const pages = new Set(chunks.filter((c) => c.isEntry).map((c) => c.fileName));
    for (const c of chunks) {
      const bad = [...c.imports, ...c.dynamicImports].find((f) => pages.has(f) && f !== c.fileName);
      if (!bad) continue;
      const msg = `${c.fileName} imports the page bundle ${bad}. A module shared with that page is being bundled into it; import shared modules directly instead of re-exporting them.`;
      console.error(`\n[no-page-bundle-imports] ${msg}\n`); // printed too: a later plugin's error can hide this one
      this.error(msg);
    }
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [productPages({ site: loadEnv(mode, import.meta.dirname, 'VITE_').VITE_SITE_URL || '' }), noPageBundleImports()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
        account: resolve(import.meta.dirname, 'account.html'),
        login: resolve(import.meta.dirname, 'login.html'),
      },
    },
  },
}));
