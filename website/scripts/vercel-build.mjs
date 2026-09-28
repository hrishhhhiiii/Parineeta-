// Vercel build (run from website/frontend by `npm run build:vercel`):
// 1. pull the admin's published content into the build, then 2. build the site with Vite.
// Vercel only sets VITE_* variables for the app; the content fetch reads the same values.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const env = {
  ...process.env,
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
};
// Vercel gives every deployment its own URL; use it for canonical links until a domain is set.
if (!env.VITE_SITE_URL && process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  env.VITE_SITE_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
}

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
  console.log('[vercel-build] fetching published admin content');
  run('node', ['scripts/fetch-content.mjs'], root);
} else {
  console.log('[vercel-build] Supabase not configured: building with the built-in content');
}
run('npx', ['vite', 'build'], resolve(root, 'frontend'));
