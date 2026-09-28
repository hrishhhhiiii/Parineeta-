// CI step: downloads published content, mirrors referenced bucket photos into the build and writes
// frontend/src/data/published.json. Fails loudly so a broken fetch never ships a site full of defaults.
// Run from the repo root (not from inside frontend/) — every path below is relative to it.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
if (!URL_ || !KEY) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  process.exit(1);
}

async function get(path, ms = 20000) {
  const res = await fetch(`${URL_}${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
  return res;
}

const rows = await (await get('/rest/v1/published_content?select=key,data,published_seq')).json();
if (!rows.length && process.env.CMS_ALLOW_EMPTY !== '1') {
  console.error('published_content returned 0 rows. Refusing to build with defaults (set CMS_ALLOW_EMPTY=1 to allow).');
  process.exit(1);
}

// N7: bucket photos become local ids `cms/<uuid>` served at /media/photos/cms/<uuid>-<w>.webp.
const BUCKET = `${URL_}/storage/v1/object/public/media/`;
const SIZES = [400, 800, 1600];
const OUT = 'frontend/public/media/photos/cms';
await mkdir(OUT, { recursive: true });
const mirrored = new Map();
let missing = 0;

async function mirror(url) {
  if (mirrored.has(url)) return mirrored.get(url);
  const m = url.slice(BUCKET.length).match(/^(?:photos\/)?([\w-]+?)(?:-(?:400|800|1600))?\.webp$/);
  if (!m) return url;
  const id = m[1];
  const base = url.replace(/(-(400|800|1600))?\.webp$/, '');
  let ok = true;
  for (const w of SIZES) {
    const file = `${OUT}/${id}-${w}.webp`;
    if (existsSync(file)) continue;
    // Older uploads have one size only; reuse it for every width.
    const res = await fetch(`${base}-${w}.webp`).then((r) => (r.ok ? r : fetch(url)));
    if (!res.ok) { ok = false; break; }
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  if (!ok) {
    missing++;
    console.log(`::warning::Photo missing from storage, left as a link: ${url}`);
  }
  const out = ok ? `cms/${id}` : url;
  mirrored.set(url, out);
  return out;
}

async function rewrite(v) {
  if (typeof v === 'string') return v.startsWith(BUCKET) ? mirror(v) : v;
  if (Array.isArray(v)) return Promise.all(v.map(rewrite));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = await rewrite(x);
    return o;
  }
  return v;
}

const docs = {};
let seq = 0;
for (const r of rows) {
  docs[r.key] = await rewrite(r.data);
  seq = Math.max(seq, Number(r.published_seq) || 0);
}
await writeFile('frontend/src/data/published.json', JSON.stringify({ seq, fetchedAt: new Date().toISOString(), docs }));
await writeFile('frontend/public/content-version.json', JSON.stringify({ seq }));
console.log(`✓ ${rows.length} documents, seq ${seq}, ${mirrored.size} photos mirrored${missing ? `, ${missing} missing` : ''}`);
