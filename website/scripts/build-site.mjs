// The site's build on the host (Cloudflare Pages, or Vercel until the switch-over), run from
// website/frontend by `npm run build:site`: 1. pull the admin's published content into the build,
// then 2. build the site with Vite. The host only sets VITE_* variables; the content fetch reads the same values.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const env = {
  // Nothing published yet → build with the built-in content. A failed or broken fetch still stops the build.
  CMS_ALLOW_EMPTY: '1',
  ...process.env,
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
};
// Set VITE_SITE_URL on the host (e.g. https://parineeta.pages.dev, later the shop's domain).
// On Vercel, fall back to its production address.
if (!env.VITE_SITE_URL && process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  env.VITE_SITE_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
}

// Catch values pasted with stray characters (e.g. "…" or spaces) before they cause confusing errors.
const SETTINGS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_CLERK_PUBLISHABLE_KEY', 'VITE_SITE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const bad = SETTINGS.filter((k) => env[k] && !/^[\x21-\x7e]+$/.test(env[k]));
if (bad.length) {
  console.error(`[build-site] These build variables contain a space or a character like "…": ${bad.join(', ')}.`);
  console.error('[build-site] Paste the full value again (no "…", no spaces), save, and retry the build.');
  process.exit(1);
}
if (env.VITE_SITE_URL && !/^https:\/\/[^/]+\.[a-z]{2,}$/i.test(env.VITE_SITE_URL)) {
  console.error(`[build-site] VITE_SITE_URL must look like https://parineeta.example.workers.dev (no slash at the end). Remove it, or fix it and retry.`);
  process.exit(1);
}

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
  console.log('[build-site] fetching published admin content');
  run('node', ['scripts/fetch-content.mjs'], root);
} else {
  console.log('[build-site] Supabase not configured: building with the built-in content');
}
run('npx', ['vite', 'build'], resolve(root, 'frontend'));
