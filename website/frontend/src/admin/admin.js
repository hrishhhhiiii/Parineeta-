import './admin.css';
import { configured, getClerk, getSupabase, userOf } from '../auth/client.js';
import { SECTIONS, FILM_OPTIONS } from './schemas.js';
import { photoSrc } from '../data/site.js';
import { avatar, profileOf } from '../auth/profile.js';
import { ordersView } from './orders.js';

const root = document.getElementById('app');

/* ---------- tiny DOM helper ---------- */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[keys.at(-1)] = value;
}
const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
const opts = (o, ctx) => (typeof o === 'function' ? o(ctx) : o) || [];

function toast(msg, kind = 'ok') {
  const t = h('div', { class: `toast toast--${kind}`, role: 'status', text: msg });
  document.body.append(t);
  setTimeout(() => t.classList.add('is-out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

// Local testing only: /admin.html?demo runs the editor against an in-memory store (never in production builds).
const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('demo');
function demoClient() {
  const heads = new Map();
  let rev = 0;
  const jobs = [];
  const user = { email: 'demo@localhost' };
  const demoOrders = [{ ref: 'PRN-261001-DEMO', created_at: new Date().toISOString(), name: 'Riya Sen', phone: '9830012345', email: 'riya@example.com', method: 'upi',
    total: 1450, paid_now: 725, plan: '50% advance', utr: '426512345678', event_date: '2026-12-02', address: 'Patuli, Kolkata', status: 'placed', suspect: false,
    items: [{ title: 'Gach Kouto', qty: 1, amount: 1450, detail: 'Sindoor red, Single piece' }], paid_amount: null, paid_at: null, paid_by: null }];
  const demoReviews = [{ id: 'rv-1', created_at: new Date().toISOString(), product: 'gach-kouto', rating: 5, name: 'Moumita Ghosh', place: 'Katwa', style: 'sindoor', phone: '9800012345',
    title: 'Beautiful work', text: 'The kouto was painted exactly as we asked, with our names on the lid. Everyone at the wedding asked where it came from.', suspect: false }];
  const rpcs = {
    get_heads: () => [...heads.values()],
    admin_role: () => 'owner',
    save_draft: ({ p_key, p_data, p_expected_version }) => {
      const hd = heads.get(p_key) || { key: p_key, version: 0, published: null, draft: null };
      if (hd.version !== p_expected_version) throw { message: 'CONTENT_CONFLICT' };
      Object.assign(hd, { draft: p_data, draft_rev: ++rev, version: hd.version + 1, updated_at: new Date().toISOString(), updated_by: user.email });
      heads.set(p_key, hd);
      return { rev, version: hd.version };
    },
    publish: () => {
      const dirty = [...heads.values()].filter((x) => x.draft_rev !== x.published_rev);
      if (!dirty.length) throw { message: 'NO_CHANGES' };
      dirty.forEach((x) => Object.assign(x, { published: x.draft, published_rev: x.draft_rev, deployed_rev: x.draft_rev }));
      jobs.unshift({ id: jobs.length + 1, status: 'live', requested_at: new Date().toISOString(), finished_at: new Date().toISOString() });
      return jobs.length;
    },
    redeploy: () => rpcs.publish(),
    list_revisions: () => [],
    list_orders: () => demoOrders,
    list_review_submissions: () => demoReviews,
    decide_review: ({ p_id }) => demoReviews.splice(demoReviews.findIndex((r) => r.id === p_id), 1),
    set_order_status: ({ p_ref, p_status, p_amount }) => Object.assign(demoOrders.find((o) => o.ref === p_ref), { status: p_status, suspect: false, ...(p_amount ? { paid_amount: p_amount, paid_at: new Date().toISOString(), paid_by: user.email } : {}) }),
    delete_order: ({ p_ref }) => demoOrders.splice(demoOrders.findIndex((o) => o.ref === p_ref), 1),
  };
  return {
    rpc: async (name, args) => {
      try { return { data: rpcs[name](args || {}), error: null }; } catch (error) { return { data: null, error }; }
    },
    from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: jobs.slice(0, 1), error: null }) }) }) }),
    storage: { from: () => ({ upload: async () => ({ error: new Error('uploads are off in demo mode') }) }) },
  };
}

/* ---------- not configured ---------- */
if (!DEMO && !configured) {
  root.replaceChildren(h('main', { class: 'card card--narrow' },
    h('h1', { text: 'Admin not connected yet' }),
    h('p', { text: 'Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_CLERK_PUBLISHABLE_KEY to website/frontend/.env (and to the Vercel project settings), then reload. See website/README.md.' })));
}

// Set in start(): the demo store, or a Supabase client that acts as the signed-in Clerk user.
let sb = DEMO ? demoClient() : null;
let clerk = null; // set in start(); null in demo mode

/* ---------- state ---------- */
const ctx = {
  user: null,
  data: {}, // section key -> working copy
  saved: {}, // section key -> JSON string as last saved
  updated: {}, // section key -> { at, by }
  version: {}, // section key -> head version (conflict check)
  published: {}, // section key -> JSON string of the published document
  notLive: new Set(), // keys published but not yet on the live site (failed or running build)
  role: 'editor',
  job: null, // latest publish job
  newReviews: 0, // customer reviews waiting in Customer reviews
  section: 'home', // the Home screen; otherwise a section key or 'orders'
  index: 0, // selected item in a list section
};
const isDirty = (key) => JSON.stringify(ctx.data[key]) !== ctx.saved[key];
// Real edits only: a section never saved counts as edited once it differs from the built-in content.
const edits = () => SECTIONS.filter((x) => (ctx.saved[x.key] ? isDirty(x.key) : JSON.stringify(ctx.data[x.key]) !== JSON.stringify(x.defaults())));
const anyDirty = () => edits().length > 0;
window.addEventListener('beforeunload', (e) => {
  if (ctx.user && anyDirty()) e.preventDefault();
});

/* ---------- auth: the shared sign-in page at /login.html (Clerk) handles sign-in, sign-out and passwords ---------- */
const toLogin = (q = '') => location.replace(`/login.html${q}`);

/* ---------- data ---------- */
async function loadAll() {
  const [{ data: rows, error }, { data: role }] = await Promise.all([sb.rpc('get_heads'), sb.rpc('admin_role')]);
  if (error) throw error;
  ctx.role = role || 'editor';
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  ctx.notLive = new Set(rows.filter((r) => r.published_rev != null && r.published_rev !== r.deployed_rev).map((r) => r.key));
  for (const s of SECTIONS) {
    const row = byKey[s.key];
    // Sections never saved start from the site's current built-in content, and count as unsaved.
    ctx.data[s.key] = row?.draft ?? s.defaults();
    ctx.saved[s.key] = row?.draft ? JSON.stringify(row.draft) : '';
    ctx.published[s.key] = row?.published ? JSON.stringify(row.published) : '';
    ctx.version[s.key] = row?.version ?? 0;
    ctx.updated[s.key] = row?.draft ? { at: row.updated_at, by: row.updated_by } : null;
    const backup = readBackup(s.key);
    if (backup && backup.base === ctx.version[s.key] && JSON.stringify(backup.data) !== ctx.saved[s.key]) {
      ctx.data[s.key] = backup.data;
      ctx.recovered = true;
    }
  }
  await refreshJob();
}

/* Unsaved edits survive a closed tab: a local copy per section, tied to the version it was based on. */
const backupKey = (key) => `parineeta-admin:${key}`;
function readBackup(key) {
  try { return JSON.parse(localStorage.getItem(backupKey(key))); } catch { return null; }
}
function writeBackup(key) {
  try {
    if (isDirty(key)) localStorage.setItem(backupKey(key), JSON.stringify({ base: ctx.version[key], data: ctx.data[key] }));
    else localStorage.removeItem(backupKey(key));
  } catch {}
}

// Saved drafts that differ from what's published.
const unpublished = () => SECTIONS.filter((s) => ctx.saved[s.key] && ctx.saved[s.key] !== ctx.published[s.key]);

const ERRORS = {
  CONTENT_CONFLICT: 'Someone else saved this section while you were editing. Copy anything you need, then reload to see their version.',
  NO_CHANGES: 'Everything is already live.',
  NOT_ALLOWED: "Your account can't do this. Ask the owner.",
  INVALID_CONTENT: 'Some values are not allowed.',
};
const explain = (error) => {
  const code = Object.keys(ERRORS).find((c) => error?.message?.includes(c));
  return code ? `${ERRORS[code]}${code === 'INVALID_CONTENT' && error.details ? ` (${error.details})` : ''}` : error?.message || 'Something went wrong.';
};

/* ---------- publishing ---------- */
let jobTimer = null;
async function refreshJob() {
  const { data } = await sb.from('publish_jobs').select('id,status,requested_at,finished_at,error,run_url,deploy_url').order('id', { ascending: false }).limit(1);
  ctx.job = data?.[0] || null;
  clearTimeout(jobTimer);
  if (ctx.job && ['queued', 'building'].includes(ctx.job.status)) {
    jobTimer = setTimeout(async () => {
      await refreshJob();
      if (ctx.job?.status === 'live') ctx.notLive.clear();
      paintPublishBar();
    }, 5000);
  }
}

function jobText(j) {
  if (!j) return '';
  const t = (x) => new Date(x).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (j.status === 'live') return `Live ✓ ${t(j.finished_at || j.requested_at)}`;
  if (j.status === 'failed') return `Update failed: ${j.error || 'see the run log'}`;
  const mins = (Date.now() - new Date(j.requested_at)) / 60000;
  return mins > 15 ? 'Taking longer than usual…' : 'Updating the website… (about 2 minutes)';
}

async function publishAll() {
  // Sections never saved show the built-in content; they only block publishing once someone edits them.
  const edited = edits();
  if (edited.length) return toast(`Save or undo your changes first (${edited.map((x) => x.title).join(', ')}).`, 'err');
  const n = unpublished().length;
  if (!confirm(`Put your ${n} saved change${n === 1 ? '' : 's'} on the live website now?`)) return;
  const { error } = await sb.rpc('publish');
  if (error) return toast(explain(error), 'err');
  toast('Done! The website will show your changes in about 2 minutes.');
  await loadAll();
  render();
}

async function retryDeploy() {
  const { error } = await sb.rpc('redeploy');
  if (error) return toast(explain(error), 'err');
  await refreshJob();
  paintPublishBar();
}

function paintPublishBar() {
  const bar = document.getElementById('publishbar');
  if (!bar) return;
  const n = unpublished().length;
  const j = ctx.job;
  const busy = Boolean(j && ['queued', 'building'].includes(j.status));
  const state = busy || j?.status === 'failed' ? jobText(j)
    : n ? `${n} change${n === 1 ? '' : 's'} saved but not live yet`
    : ctx.notLive.size ? 'Some published changes are not live yet'
    : 'Your website is up to date ✓';
  bar.replaceChildren(...[
    h('span', { class: `pub__state${j?.status === 'failed' ? ' is-err' : ''}`, role: 'status', text: state }),
    j?.run_url && (j.status === 'failed' || busy) ? h('a', { href: j.run_url, target: '_blank', rel: 'noopener', class: 'linkbtn', text: 'Run log' }) : null,
    h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Preview', onclick: openPreview }),
    ctx.role === 'owner' && !busy && (j?.status === 'failed' || (!n && ctx.notLive.size)) ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Retry update', onclick: retryDeploy }) : null,
    ctx.role === 'owner'
      ? h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: 'Put changes live', disabled: !n || busy, onclick: publishAll })
      : h('span', { class: 'muted', text: 'The owner publishes changes.' }),
  ].filter(Boolean));
}

/* ---------- preview ---------- */
function openPreview() {
  const docs = Object.fromEntries(SECTIONS.map((s) => [s.key, clone(ctx.data[s.key])]));
  const frame = h('iframe', { src: '/?preview=1', title: 'Website preview', class: 'preview__frame' });
  const sizes = [['Desktop', 1280], ['Tablet', 768], ['Mobile', 375]];
  const onMsg = (e) => {
    if (e.origin !== location.origin || e.source !== frame.contentWindow || e.data?.type !== 'cms-preview-ready') return;
    frame.contentWindow.postMessage({ type: 'cms-preview', docs, at: Date.now() }, location.origin);
  };
  window.addEventListener('message', onMsg);
  const dlg = h('dialog', { class: 'preview', onclose: () => { window.removeEventListener('message', onMsg); dlg.remove(); } },
    h('div', { class: 'preview__bar' },
      h('strong', { text: 'Preview, including changes that are not published' }),
      ...sizes.map(([t, w]) => h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: t, onclick: () => { frame.style.width = `${w}px`; } })),
      h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: 'Close', onclick: () => dlg.close() })),
    frame);
  document.body.append(dlg);
  dlg.showModal();
}

function validate(section, value) {
  const problems = [];
  const check = (item, fields, where) => {
    for (const f of fields) {
      if (!f.key) continue;
      const v = getPath(item, f.key);
      const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
      if (f.required && empty) problems.push(`${where}: "${f.label}" is required.`);
      if (f.pattern && !empty && !new RegExp(f.pattern).test(String(v))) problems.push(`${where}: "${f.label}" looks wrong.`);
      if (f.type === 'list' && Array.isArray(v)) v.forEach((sub, i) => check(sub, f.of, `${where} → ${f.label} ${i + 1}`));
    }
  };
  if (section.kind === 'list') {
    const ids = new Map();
    value.forEach((item, i) => {
      const where = section.itemTitle(item) || `Item ${i + 1}`;
      check(item, section.fields, where);
      if (item.id) {
        if (ids.has(item.id)) problems.push(`"${where}" and "${ids.get(item.id)}" share the same code "${item.id}".`);
        ids.set(item.id, where);
      }
    });
  } else check(value, section.fields, section.title);
  return problems;
}

// Codes like the web address name are folded under "More options", so fill any empty ones from the name.
function fillCodes(section, value) {
  const items = section.kind === 'list' ? value : [value];
  for (const it of items) {
    for (const f of section.fields) {
      if (f.type !== 'slug' || !f.from || getPath(it, f.key)) continue;
      const s = slugify(getPath(it, f.from));
      if (s) setPath(it, f.key, f.prefix && !s.startsWith(f.prefix) ? f.prefix + s : s);
    }
  }
}

async function save(section) {
  fillCodes(section, ctx.data[section.key]);
  let value = clone(ctx.data[section.key]);
  const problems = validate(section, value);
  if (problems.length) {
    moreOpen = true; // a problem may be in a folded field
    render();
    alert(`Please fix these before saving:\n\n• ${problems.slice(0, 12).join('\n• ')}`);
    return;
  }
  if (section.normalize && section.kind === 'list') value = value.map(section.normalize);
  const { data, error } = await sb.rpc('save_draft', { p_key: section.key, p_data: value, p_expected_version: ctx.version[section.key] });
  if (error) return toast(`Could not save: ${explain(error)}`, 'err');
  ctx.data[section.key] = value;
  ctx.saved[section.key] = JSON.stringify(value);
  ctx.version[section.key] = data.version;
  ctx.updated[section.key] = { at: new Date().toISOString(), by: ctx.user.email };
  writeBackup(section.key);
  toast(`${section.title} saved. Press “Put changes live” at the top when you are ready.`);
  render();
}

/** Resizes a photo in the browser (max 1600px, WebP) and uploads it to Supabase storage. */
async function uploadPhoto(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const hgt = Math.round(bmp.height * scale);
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: hgt });
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.85));
  const path = `photos/${Date.now()}-${slugify(file.name.replace(/\.\w+$/, '')) || 'photo'}.webp`;
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' });
  if (error) throw error;
  return { url: sb.storage.from('media').getPublicUrl(path).data.publicUrl, w, h: hgt };
}

/* ---------- fields ---------- */
function field(f, item, onChange, rerender) {
  if (f.heading) return h('h3', { class: 'form-heading', text: f.heading });
  const id = `f-${Math.random().toString(36).slice(2, 8)}`;
  const value = getPath(item, f.key);
  const set = (v) => {
    setPath(item, f.key, v);
    onChange();
  };
  const label = h('label', { class: 'field__label', for: id }, f.label, f.required ? h('span', { class: 'req', text: ' *' }) : null);
  const help = f.help ? h('p', { class: 'field__help', text: f.help }) : null;
  let control;

  switch (f.type) {
    case 'textarea':
      control = h('textarea', { class: 'input', id, rows: 5, value: value ?? '', oninput: (e) => set(e.target.value) });
      break;
    case 'number':
      control = h('input', { class: 'input', id, type: 'number', inputmode: 'numeric', min: f.min, max: f.max, value: value ?? '', oninput: (e) => set(e.target.value === '' ? null : Number(e.target.value)) });
      break;
    case 'date':
      control = h('input', { class: 'input', id, type: 'date', value: value ?? '', oninput: (e) => set(e.target.value) });
      break;
    case 'bool':
      return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: Boolean(value), onchange: (e) => set(e.target.checked) }), h('span', { text: f.label }));
    case 'select': {
      const list = opts(f.options, ctx);
      control = h('select', { class: 'input', id, onchange: (e) => set(f.number ? Number(e.target.value) : e.target.value) },
        !list.some(([v]) => String(v) === String(value ?? '')) ? h('option', { value: '', text: '— choose —' }) : null,
        ...list.map(([v, t]) => h('option', { value: v, text: t, selected: String(v) === String(value ?? '') })));
      if (value == null && f.default) setPath(item, f.key, f.default);
      break;
    }
    case 'multi': {
      const list = opts(f.options, ctx);
      const chosen = Array.isArray(value) ? value : [];
      control = h('div', { class: 'multi', id },
        ...list.map(([v, t]) => h('label', { class: `pill${chosen.includes(v) ? ' is-on' : ''}` },
          h('input', {
            type: 'checkbox', checked: chosen.includes(v),
            onchange: (e) => {
              const next = e.target.checked ? [...chosen, v] : chosen.filter((x) => x !== v);
              set(next);
              rerender();
            },
          }), t)));
      if (chosen.length > 1) control.append(h('p', { class: 'field__help', text: `Order: ${chosen.map((v) => (list.find(([x]) => x === v) || [v, v])[1]).join(' → ')}` }));
      break;
    }
    case 'slug': {
      const input = h('input', { class: 'input mono', id, value: value ?? '', oninput: (e) => set(slugify(e.target.value)), onblur: (e) => (e.target.value = getPath(item, f.key) || '') });
      const auto = h('button', {
        type: 'button', class: 'btn btn--ghost btn--sm', text: 'Make from name',
        onclick: () => {
          const s = slugify(getPath(item, f.from));
          const v = s && f.prefix && !s.startsWith(f.prefix) ? f.prefix + s : s;
          input.value = v;
          set(v);
        },
      });
      control = h('div', { class: 'row' }, input, auto);
      break;
    }
    case 'media': {
      const kind = f.photoOnly ? 'photo' : getPath(item, f.key.replace(/[^.]+$/, 'type')) || 'photo';
      const preview = h('div', { class: 'media-prev' });
      const paint = () => {
        const v = getPath(item, f.key);
        preview.replaceChildren(v && kind === 'photo' ? h('img', { src: /^\//.test(v) ? v : photoSrc(v, 400), alt: '', width: 120, height: 120, onerror: (e) => e.target.replaceWith(h('span', { text: 'No preview' })) }) : v ? h('span', { text: `🎬 ${v}` }) : h('span', { text: 'None' }));
      };
      const input = h('input', { class: 'input mono', id, value: value ?? '', list: kind === 'reel' ? 'film-ids' : null, placeholder: kind === 'reel' ? 'Pick a film' : 'Upload, or paste a photo address', oninput: (e) => { set(e.target.value.trim()); paint(); } });
      const file = h('input', {
        type: 'file', accept: 'image/*', hidden: true,
        onchange: async (e) => {
          const fl = e.target.files[0];
          if (!fl) return;
          up.disabled = true;
          up.textContent = 'Uploading…';
          try {
            const r = await uploadPhoto(fl);
            input.value = r.url;
            if (f.sizeKeys) {
              setPath(item, f.sizeKeys[0], r.w);
              setPath(item, f.sizeKeys[1], r.h);
            }
            set(r.url);
            paint();
            toast('Photo uploaded. Remember to save.');
          } catch (err) {
            toast(`Upload failed: ${err.message}`, 'err');
          } finally {
            up.disabled = false;
            up.textContent = 'Upload photo';
            e.target.value = '';
          }
        },
      });
      const up = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Upload photo', onclick: () => file.click() });
      paint();
      control = h('div', { class: 'media' }, preview, h('div', { class: 'media__side' }, input, kind === 'photo' ? h('div', { class: 'row' }, up, file) : null));
      break;
    }
    case 'list':
      return h('div', { class: 'field' }, label, help, listEditor(f, getPath(item, f.key) || (setPath(item, f.key, []), getPath(item, f.key)), onChange, rerender));
    default:
      control = h('input', { class: 'input', id, value: value ?? '', lang: f.lang, oninput: (e) => set(e.target.value) });
  }
  return h('div', { class: 'field' }, label, control, help);
}

/** An inline, reorderable list of small sub-forms (photos of a product, add-on options). */
function listEditor(f, arr, onChange, rerender) {
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange();
    rerender();
  };
  return h('div', { class: 'sublist' },
    ...arr.map((sub, i) => h('details', { class: 'subitem', open: !f.itemTitle(sub) || null },
      h('summary', {},
        h('span', { class: 'subitem__title', text: `${i + 1}. ${f.itemTitle(sub)}` }),
        h('span', { class: 'subitem__tools' },
          h('button', { type: 'button', class: 'iconbtn', title: 'Move up', 'aria-label': 'Move up', text: '↑', onclick: (e) => { e.preventDefault(); move(i, -1); } }),
          h('button', { type: 'button', class: 'iconbtn', title: 'Move down', 'aria-label': 'Move down', text: '↓', onclick: (e) => { e.preventDefault(); move(i, 1); } }),
          h('button', { type: 'button', class: 'iconbtn iconbtn--danger', title: 'Remove', 'aria-label': 'Remove', text: '✕', onclick: (e) => { e.preventDefault(); arr.splice(i, 1); onChange(); rerender(); } }))),
      h('div', { class: 'subitem__body' }, ...f.of.map((sf) => field(sf, sub, onChange, rerender))))),
    h('button', {
      type: 'button', class: 'btn btn--ghost btn--sm', text: `+ Add ${f.label.toLowerCase().replace(/s$/, '')}`,
      onclick: () => {
        const blank = {};
        for (const sf of f.of) if (sf.default != null) setPath(blank, sf.key, sf.default);
        arr.push(blank);
        onChange();
        rerender();
      },
    }));
}

/* ---------- set to default, history ---------- */
function setToDefault(section) {
  const def = section.defaults();
  const cur = ctx.data[section.key];
  const count = section.kind === 'list'
    ? `${cur.length} item${cur.length === 1 ? '' : 's'} now → ${def.length} built-in`
    : `${section.fields.filter((f) => f.key && JSON.stringify(getPath(cur, f.key) ?? '') !== JSON.stringify(getPath(def, f.key) ?? '')).length} field(s) differ from the built-in content`;
  if (!confirm(`Put "${section.title}" back to the website's original built-in content?\n\n${count}.\n\nThis only changes your draft: press Save changes, then “Put changes live”. Undo changes brings your version back until you save.`)) return;
  ctx.data[section.key] = def;
  ctx.index = 0;
  writeBackup(section.key);
  render();
}

async function openHistory(section) {
  const { data: revs, error } = await sb.rpc('list_revisions', { p_key: section.key, p_limit: 30 });
  if (error) return toast(explain(error), 'err');
  const SRC = { save: 'Saved', restore: 'Restored', reset: 'Set to default', migration: 'Original' };
  const dlg = h('dialog', { class: 'history', onclose: () => dlg.remove() },
    h('h2', { text: `${section.title}: saved versions` }),
    h('p', { class: 'muted', text: ctx.role === 'owner' ? 'Restoring makes that version your draft. Save is not needed; press “Put changes live” at the top.' : 'Only the owner can restore a version.' }),
    revs?.length ? h('ol', { class: 'history__list' }, ...revs.map((r) => h('li', {},
      h('span', { text: `${new Date(r.created_at).toLocaleString()} · ${SRC[r.source] || r.source} · ${r.created_by}` }),
      ctx.role === 'owner' ? h('button', {
        type: 'button', class: 'btn btn--ghost btn--sm', text: 'Restore',
        onclick: async () => {
          if (isDirty(section.key) && !confirm('You have unsaved changes in this section. Restoring replaces them. Continue?')) return;
          const { error: e } = await sb.rpc('restore_revision', { p_rev: r.id });
          if (e) return toast(explain(e), 'err');
          dlg.close();
          try { localStorage.removeItem(backupKey(section.key)); } catch {}
          await loadAll();
          render();
          toast('Old version brought back. Press “Put changes live” at the top.');
        },
      }) : null))) : h('p', { text: 'No saved versions yet.' }),
    h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: 'Close', onclick: () => dlg.close() }));
  document.body.append(dlg);
  dlg.showModal();
}

/* ---------- layout ---------- */
// Owner only: orders from the website's checkout. /admin#orders opens it directly.
const ORDERS = 'orders';
const HOME = 'home';

// The menu, grouped by how often each part is used. Anything not listed falls under "More".
const GROUPS = [
  { title: 'Every day', keys: [ORDERS, 'products'] },
  { title: 'Your website', keys: ['sets', 'reviews', 'lookbook', 'announcement', 'homepage'] },
  { title: 'Shop details', keys: ['settings', 'stores', 'socials'] },
];
GROUPS.push({ title: 'More', keys: SECTIONS.map((s) => s.key).filter((k) => !GROUPS.some((g) => g.keys.includes(k))) });

// What each tile on the Home screen says, in plain words.
const TILE_TEXT = {
  [ORDERS]: 'See new orders and mark them paid, made or delivered.',
  products: 'Add a product, change a price or a photo, or hide one.',
  sets: 'Bundles sold together at one price.',
  reviews: 'Add a review a customer sent you.',
  lookbook: 'The photo gallery on the website.',
  announcement: 'A one-line message across the top of the website.',
  homepage: 'The big headline and photo at the top of the home page.',
  settings: 'Your WhatsApp number, UPI ID and bank details.',
  stores: 'Shop addresses, phone numbers and opening hours.',
  socials: 'Your Instagram and Facebook links.',
};

function go(key) {
  ctx.section = key;
  ctx.index = 0;
  history.replaceState(null, '', key === ORDERS ? '#orders' : location.pathname + location.search);
  render();
  window.scrollTo(0, 0);
}

/** The first screen: big tiles for the common jobs, plus a 3-step reminder of how changes go live. */
function homeView() {
  const tile = (key) => {
    const s = SECTIONS.find((x) => x.key === key);
    const title = key === ORDERS ? 'Orders' : s.title;
    return h('button', { type: 'button', class: 'tile', 'data-key': key, onclick: () => go(key) },
      h('span', { class: 'tile__icon', 'aria-hidden': 'true', text: key === ORDERS ? '🧾' : s.icon }),
      h('span', { class: 'tile__title' }, title, key === 'reviews' && ctx.newReviews ? h('span', { class: 'count', text: `${ctx.newReviews} new` }) : null),
      h('span', { class: 'tile__text', text: TILE_TEXT[key] || s.intro || '' }));
  };
  const name = (profileOf(ctx.user).name || '').split(' ')[0];
  return h('div', { class: 'home' },
    h('h1', { text: `Namaskar${name ? `, ${name}` : ''}! What would you like to do?` }),
    h('ol', { class: 'howto' },
      h('li', {}, h('strong', { text: 'Change' }), ' something below.'),
      h('li', {}, h('strong', { text: 'Save' }), ' it (the gold button on each page).'),
      h('li', {}, h('strong', { text: 'Put changes live' }), ' (top of the screen). The website updates in about 2 minutes.')),
    ...GROUPS.slice(0, 3).map((g) => {
      const keys = g.keys.filter((k) => (k === ORDERS ? ctx.role === 'owner' : SECTIONS.some((s) => s.key === k)));
      return keys.length ? h('section', { class: 'home__group' }, h('h2', { text: g.title }), h('div', { class: 'tiles' }, ...keys.map(tile))) : null;
    }),
    h('p', { class: 'muted home__more', text: 'Other parts of the website are under “More” in the menu.' }));
}

function render() {
  if (ctx.section === ORDERS && ctx.role !== 'owner') ctx.section = HOME;
  const section = SECTIONS.find((s) => s.key === ctx.section);
  if (!section && ctx.section !== ORDERS) ctx.section = HOME;
  const navBtn = (key, icon, title, extra = null) => h('button', {
    type: 'button', 'data-key': key, class: `side__btn${key === ctx.section ? ' is-active' : ''}`, 'aria-current': key === ctx.section ? 'page' : null,
    onclick: () => go(key),
  }, h('span', { 'aria-hidden': 'true', text: icon }), h('span', { text: title }), extra);
  const dirtyDot = (key) => (isDirty(key) ? h('span', { class: 'dot', title: 'Not saved yet', text: '●' }) : null);
  const nav = h('nav', { class: 'side', 'aria-label': 'Sections' },
    navBtn(HOME, '🏠', 'Home'),
    ...GROUPS.flatMap((g) => {
      const keys = g.keys.filter((k) => (k === ORDERS ? ctx.role === 'owner' : SECTIONS.some((s) => s.key === k)));
      if (!keys.length) return [];
      return [h('p', { class: 'side__group', text: g.title }),
        ...keys.map((k) => (k === ORDERS ? navBtn(ORDERS, '🧾', 'Orders') : (() => { const s = SECTIONS.find((x) => x.key === k); return navBtn(s.key, s.icon, s.title, s.key === 'reviews' && ctx.newReviews ? h('span', { class: 'count', 'aria-label': `${ctx.newReviews} new`, text: String(ctx.newReviews) }) : dirtyDot(s.key)); })()))];
    }));

  // Clerk's UserButton: Manage account and Sign out (the browser warns first if there are unsaved changes).
  const userBtn = clerk ? h('div', { class: 'top__user' }) : null;
  const top = h('header', { class: 'top' },
    h('div', { class: 'top__brand' }, h('strong', { text: 'Parineeta' }), h('span', { text: ctx.role === 'owner' ? 'Admin panel' : 'Editor panel' })),
    h('div', { class: 'top__right' },
      h('div', { class: 'pub', id: 'publishbar' }),
      h('a', { class: 'btn btn--ghost btn--sm', href: '/', target: '_blank', rel: 'noopener', text: 'View website ↗' }),
      clerk ? userBtn : h('span', { class: 'top__user', title: ctx.user.email }, avatar(ctx.user, 30), h('span', { class: 'top__name', text: profileOf(ctx.user).name || ctx.user.email })),
      clerk ? null : h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Sign out', onclick: async () => { if (!anyDirty() || confirm('You have unsaved changes. Sign out anyway?')) toLogin('?signout'); } })));

  root.replaceChildren(top, h('div', { class: 'shell' }, nav, h('main', { class: 'main', id: 'main' }, ctx.section === HOME ? homeView() : ctx.section === ORDERS ? ordersView(sb, { h, toast, explain }) : sectionView(section))));
  if (clerk) {
    if (ctx.userBtn) clerk.unmountUserButton(ctx.userBtn);
    clerk.mountUserButton((ctx.userBtn = userBtn), { showName: true });
  }
  paintPublishBar();
  if (ctx.recovered) {
    ctx.recovered = false;
    toast('Restored unsaved changes from your last visit. Save them or press Undo changes.');
  }
}

/** Renders the everyday fields, with the rarely needed ones folded under "More options". */
let moreOpen = false;
const onMore = (e) => { moreOpen = e.target.open; };
function withMore(fields, render, toggle) {
  const basic = fields.filter((f) => !f.advanced).map(render);
  const extra = fields.filter((f) => f.advanced);
  if (!extra.length) return basic;
  return [...basic, h('details', { class: 'more', open: moreOpen || null, ontoggle: toggle },
    h('summary', { text: 'More options (you rarely need these)' }), ...extra.map(render))];
}

/* ---------- reviews customers wrote on the website, waiting for the shop (011_review_inbox.sql) ---------- */
const handledReviews = new Set(); // accepted/rejected in this visit, so a re-render never shows them again

// Updates the "N new" badges on the menu and the Home tile without redrawing the page.
function setReviewCount(n) {
  ctx.newReviews = n;
  const btn = [...document.querySelectorAll('.side__btn')].find((b) => b.dataset.key === 'reviews');
  if (btn) {
    btn.querySelector('.count')?.remove();
    if (n) btn.append(h('span', { class: 'count', 'aria-label': `${n} new`, text: String(n) }));
  }
  const tile = document.querySelector('.tile[data-key="reviews"] .tile__title');
  if (tile) {
    tile.querySelector('.count')?.remove();
    if (n) tile.append(h('span', { class: 'count', text: `${n} new` }));
  }
}

async function refreshReviewCount() {
  const { data, error } = await sb.rpc('list_review_submissions');
  if (error) return; // the database isn't updated yet (011): no inbox
  setReviewCount((data || []).filter((r) => !handledReviews.has(r.id)).length);
}

function reviewInbox(section) {
  const box = h('section', { class: 'card inbox-reviews', 'aria-labelledby': 'rv-inbox-title' }, h('p', { class: 'loading', text: 'Looking for new reviews…' }));
  const productName = (id) => (ctx.data.products || []).find((p) => p.id === id)?.en || id;
  const paint = (rows) => {
    setReviewCount(rows.length);
    const title = h('h2', { id: 'rv-inbox-title', text: rows.length ? `New reviews from customers (${rows.length})` : 'New reviews from customers' });
    if (!rows.length) return box.replaceChildren(title, h('p', { class: 'muted', text: 'None waiting. When a customer writes a review on a product page, it appears here for you to accept or reject.' }));
    box.replaceChildren(title,
      h('p', { class: 'muted', text: 'Accept adds the review to the list below. Then press “Put changes live” at the top.' }),
      ...rows.map((r) => {
        const digits = String(r.phone || '').replace(/\D/g, '');
        const accept = h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: 'Accept and add' });
        const reject = h('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Reject' });
        const card = h('article', { class: 'rv-card' },
          h('div', { class: 'rv-card__head' },
            h('span', { class: 'rv-card__stars', 'aria-label': `${r.rating} out of 5 stars`, text: '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) }),
            h('strong', { text: productName(r.product) }),
            h('span', { class: 'muted', text: new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) })),
          r.title ? h('p', { class: 'rv-card__title', text: r.title }) : null,
          h('p', { class: 'rv-card__text', text: r.text }),
          h('p', { class: 'muted' }, [r.name, r.place].filter(Boolean).join(', '),
            digits.length >= 10 ? [' · ', h('a', { href: `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`, target: '_blank', rel: 'noopener', text: 'WhatsApp them to check the order' })] : null),
          r.suspect ? h('p', { class: 'form-msg', text: 'Many reviews came from the same connection. Check this one is real.' }) : null,
          h('div', { class: 'row' }, accept, reject));
        accept.addEventListener('click', async () => {
          accept.disabled = reject.disabled = true;
          handledReviews.add(r.id);
          const list = ctx.data.reviews;
          list.unshift({ product: r.product, name: r.name, place: r.place || '', date: String(r.created_at).slice(0, 10), rating: r.rating,
            title: r.title || '', text: r.text, style: r.style || '', verified: false, hidden: false });
          await save(section);
          if (isDirty(section.key)) { // the save didn't go through: undo
            list.shift();
            handledReviews.delete(r.id);
            accept.disabled = reject.disabled = false;
            return;
          }
          const { error } = await sb.rpc('decide_review', { p_id: r.id, p_accept: true });
          if (error) toast(explain(error), 'err');
          else toast('Review added. Press “Put changes live” at the top to show it on the website.');
          refreshReviewCount();
        });
        reject.addEventListener('click', async () => {
          if (!confirm(`Reject the review from ${r.name}? It will not appear on the website.`)) return;
          accept.disabled = reject.disabled = true;
          const { error } = await sb.rpc('decide_review', { p_id: r.id, p_accept: false });
          if (error) { accept.disabled = reject.disabled = false; return toast(explain(error), 'err'); }
          handledReviews.add(r.id);
          card.remove();
          paint(rows.filter((x) => x !== r));
        });
        return card;
      }));
  };
  sb.rpc('list_review_submissions').then(({ data, error }) => {
    if (error) return box.remove(); // the database isn't updated yet (011)
    paint((data || []).filter((r) => !handledReviews.has(r.id)));
  });
  return box;
}

function sectionView(section) {
  const dirty = isDirty(section.key);
  const upd = ctx.updated[section.key];
  const saveBar = h('div', { class: `savebar${dirty ? ' is-dirty' : ''}` },
    h('span', { class: 'savebar__state', text: dirty ? 'You have changes. Press Save.' : upd ? 'Saved. Press “Put changes live” at the top when ready.' : '' }),
    dirty && upd ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Undo changes', onclick: () => { ctx.data[section.key] = JSON.parse(ctx.saved[section.key]); writeBackup(section.key); render(); } }) : null,
    h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Set to default', onclick: () => setToDefault(section) }),
    ctx.saved[section.key] ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'History', onclick: () => openHistory(section) }) : null,
    h('button', { type: 'button', class: 'btn btn--gold', text: 'Save changes', disabled: !dirty, onclick: () => save(section) }));
  const onChange = () => {
    const d = isDirty(section.key);
    saveBar.classList.toggle('is-dirty', d);
    saveBar.querySelector('.btn--gold').disabled = !d;
    saveBar.querySelector('.savebar__state').textContent = d ? 'You have changes. Press Save.' : 'Saved.';
    const navBtn = document.querySelector('.side__btn.is-active');
    const dot = navBtn?.querySelector('.dot');
    if (d && navBtn && !dot) navBtn.append(h('span', { class: 'dot', title: 'Unsaved changes', text: '●' }));
    if (!d && dot) dot.remove();
    writeBackup(section.key);
    refreshListLabels?.();
  };
  let refreshListLabels = null;

  const head = h('div', { class: 'sec-head' }, h('div', {}, h('h1', { text: section.title }), h('p', { class: 'muted', text: section.intro })), saveBar);

  if (section.kind === 'object') {
    const obj = ctx.data[section.key];
    const form = h('div', { class: 'card form' });
    const defs = section.defaults();
    const paint = () => form.replaceChildren(...withMore(section.fields, (f) => {
      const node = field(f, obj, onChange, paint);
      if (!f.key || f.type === 'list') return node;
      const dv = getPath(defs, f.key);
      const show = (v) => (typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v ?? '') || '(empty)').slice(0, 80);
      const same = () => { const cur = getPath(obj, f.key); return JSON.stringify(cur ?? '') === JSON.stringify(dv ?? '') || (!cur && !dv); };
      const btn = h('button', {
        type: 'button', class: 'linkbtn field__reset', text: '↺ Default', title: `Default: ${show(dv)}`,
        onclick: () => {
          if (!confirm(`Change "${f.label}" back to its default?

Now: ${show(getPath(obj, f.key))}
Default: ${show(dv)}

This changes your draft only.`)) return;
          setPath(obj, f.key, clone(dv ?? null));
          onChange();
          paint();
        },
      });
      btn.hidden = same();
      const sync = () => { btn.hidden = same(); };
      node.addEventListener('input', sync);
      node.addEventListener('change', sync);
      node.append(btn);
      return node;
    }, onMore));
    paint();
    return h('div', {}, head, form);
  }

  const list = ctx.data[section.key];
  ctx.index = Math.min(ctx.index, list.length - 1);
  const items = h('ol', { class: 'items' });
  // Thumbnail: the section's photo field, or the first photo of a product; otherwise the section's icon.
  const thumbOf = (it) => (section.thumb ? section.thumb(it) : section.thumbKey ? it[section.thumbKey] : null);
  const thumb = (it, size) => {
    const id = thumbOf(it);
    const icon = () => h('span', { class: 'item__thumb item__thumb--icon', 'aria-hidden': 'true', text: section.icon });
    return id ? h('img', { class: 'item__thumb', width: size, height: size, src: /^\//.test(id) ? id : photoSrc(id, 400), alt: '', loading: 'lazy', onerror: (e) => e.target.replaceWith(icon()) }) : icon();
  };
  const subOf = (it) => (section.itemSub ? section.itemSub(it).replace(/ · hidden$/, '') : '');
  const paintItems = () => items.replaceChildren(...list.map((it, i) => h('li', {},
    h('button', { type: 'button', class: `item${i === ctx.index ? ' is-active' : ''}${it.hidden ? ' is-hidden' : ''}`, 'aria-current': i === ctx.index ? 'true' : null, onclick: () => select(i) },
      thumb(it, 44),
      h('span', { class: 'item__text' }, h('span', { class: 'item__title', text: section.itemTitle(it) }), subOf(it) ? h('span', { class: 'item__sub', text: subOf(it) }) : null),
      it.hidden ? h('span', { class: 'pill', text: 'Hidden' }) : null))));
  refreshListLabels = () => { paintItems(); paintFormHead(); };

  const form = h('div', { class: 'card form' });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Switching items: the editor slides in from the side you are moving towards, and fades in.
  const select = (i) => {
    if (i === ctx.index || i < 0 || i >= list.length) return;
    const dir = i > ctx.index ? 'next' : 'prev';
    ctx.index = i;
    paintItems();
    paintForm(dir);
    items.querySelector('.is-active')?.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    // On a phone the editor is below the list: bring it into view.
    if (form.getBoundingClientRect().top < 0 || form.getBoundingClientRect().top > window.innerHeight * 0.6) {
      form.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
  };
  let formHead = null;
  const paintFormHead = () => {
    const it = list[ctx.index];
    if (!formHead || !it) return;
    formHead.replaceChildren(
      thumb(it, 64),
      h('div', { class: 'form__heading' },
        h('h2', { text: section.itemTitle(it) }),
        h('span', { class: 'muted', text: `${ctx.index + 1} of ${list.length}${it.hidden ? ' · hidden from the website' : ''}` })),
      h('div', { class: 'form__step' },
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '← Previous', disabled: ctx.index === 0, onclick: () => select(ctx.index - 1) }),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Next →', disabled: ctx.index === list.length - 1, onclick: () => select(ctx.index + 1) })));
  };
  const paintForm = (dir = '') => {
    const it = list[ctx.index];
    if (!it) return form.replaceChildren(h('div', { class: 'empty-state' }, h('span', { class: 'empty-state__icon', 'aria-hidden': 'true', text: section.icon }),
      h('p', { text: 'Nothing here yet.' }), h('p', { class: 'muted', text: 'Press “+ Add new” to make the first one.' })));
    formHead = h('div', { class: 'form__head' });
    paintFormHead();
    const tools = h('div', { class: 'form__tools' },
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '↑ Move up', disabled: ctx.index === 0, onclick: () => move(-1) }),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '↓ Move down', disabled: ctx.index === list.length - 1, onclick: () => move(1) }),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Duplicate', onclick: () => { const c = clone(it); if (c.id) c.id = `${c.id}-copy`; list.splice(ctx.index + 1, 0, c); ctx.index += 1; onChange(); paintAll('next'); } }),
      h('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Delete', onclick: () => { if (!confirm(`Delete “${section.itemTitle(it)}”? You can undo until you save.`)) return; list.splice(ctx.index, 1); ctx.index = Math.max(0, ctx.index - 1); onChange(); paintAll('prev'); } }));
    const body = h('div', { class: 'form__body' }, ...withMore(section.fields, (f) => field(f, it, onChange, () => paintForm()), onMore));
    form.replaceChildren(formHead, tools, body);
    if (dir && !reduceMotion.matches) {
      form.classList.remove('is-next', 'is-prev');
      void form.offsetWidth; // restart the animation
      form.classList.add(dir === 'next' ? 'is-next' : 'is-prev');
    }
  };
  form.addEventListener('animationend', () => form.classList.remove('is-next', 'is-prev'));
  const move = (d) => {
    const j = ctx.index + d;
    [list[ctx.index], list[j]] = [list[j], list[ctx.index]];
    ctx.index = j;
    onChange();
    paintAll();
  };
  const paintAll = (dir) => { paintItems(); paintForm(dir); };
  paintAll();

  const add = h('button', {
    type: 'button', class: 'btn btn--gold btn--sm', text: '+ Add new',
    onclick: () => {
      const blank = section.blank();
      if (section.newFirst) { list.unshift(blank); ctx.index = 0; } else { list.push(blank); ctx.index = list.length - 1; }
      onChange();
      paintAll('next');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  });

  return h('div', {}, head, section.key === 'reviews' ? reviewInbox(section) : null, h('div', { class: 'split' },
    h('aside', { class: 'card items-card' }, h('div', { class: 'items-head' }, h('strong', { text: `${list.length} ${section.title.toLowerCase()}` }), h('span', { class: 'muted items-hint', text: 'Tap one to change it' }), add), items),
    form));
}

/* ---------- start ---------- */
document.body.append(h('datalist', { id: 'film-ids' }, ...FILM_OPTIONS().map(([v, t]) => h('option', { value: v, text: t }))));

let starting = false;
async function start() {
  if (starting) return;
  starting = true;
  let user = { email: 'demo@localhost' };
  if (!DEMO) {
    clerk = await getClerk();
    user = userOf(clerk.user);
    if (user) sb = await getSupabase();
    // Signing out in another tab closes this one's session too.
    clerk.addListener(({ user: now }) => { if (!now && ctx.user) toLogin(); });
  }
  starting = false;
  if (!user) return toLogin('?signin');
  if (ctx.user && root.querySelector('.shell')) return;
  ctx.user = user;
  // Someone signed in who isn't on the staff list: the sign-in page explains.
  const { data: role } = await sb.rpc('admin_role');
  if (!role) return toLogin();
  if (location.hash === '#orders') ctx.section = ORDERS;
  root.replaceChildren(h('p', { class: 'loading', text: 'Loading the shop…' }));
  try {
    await loadAll();
    render();
    refreshReviewCount();
  } catch (err) {
    root.replaceChildren(h('main', { class: 'card card--narrow' }, h('h1', { text: 'Could not load' }), h('p', { text: err.message }),
      h('p', { class: 'muted', text: 'If this is the first time, run database/schema.sql and then the files in database/migrations in the Supabase SQL editor.' })));
  }
}

if (DEMO || configured) start();
