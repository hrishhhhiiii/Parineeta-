import './admin.css';
import { configured, getClerk, getSupabase, userOf } from '../auth/client.js';
import { SECTIONS, FILM_OPTIONS } from './schemas.js';
import { photoSrc } from '../data/site.js';
import { avatar, profileOf } from '../auth/profile.js';

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
  const demoEnquiries = [{ id: 'demo-1', created_at: new Date().toISOString(), name: 'Riya Sen', phone: '+91 98300 00000', email: 'riya@example.com', event_date: '2026-12-02', place: 'Kolkata', items: ['Shola mukut (sindoor)'], note: 'Can you add our names?', status: 'new', status_note: null }];
  const user = { email: 'demo@localhost' };
  const demoOrders = [{ ref: 'PRN-260929-DEMO', created_at: new Date().toISOString(), name: 'Riya Sen', phone: '9830012345', email: 'riya@example.com', method: 'upi', total: 1450, paid_now: 725, utr: '426512345678',
    items: [{ title: 'Gach Kouto', qty: 1, amount: 1450, detail: 'Sindoor red, Single piece' }], address: 'Patuli, Kolkata', status: 'placed', paid_amount: null, paid_at: null, paid_by: null,
    sent: [{ at: new Date().toISOString(), kind: 'placed', to: 'customer', channel: 'email', ok: true }, { at: new Date().toISOString(), kind: 'placed', to: 'customer', channel: 'whatsapp', ok: false, error: 'WhatsApp 400: template not approved' }] }];
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
    set_enquiry_status: ({ p_id, p_status, p_note }) => Object.assign(demoEnquiries.find((e) => e.id === p_id), { status: p_status, status_note: p_note }),
    delete_enquiry: ({ p_id }) => demoEnquiries.splice(demoEnquiries.findIndex((e) => e.id === p_id), 1),
    list_orders: () => demoOrders,
  };
  return {
    rpc: async (name, args) => {
      try { return { data: rpcs[name](args || {}), error: null }; } catch (error) { return { data: null, error }; }
    },
    from: (t) => ({ select: () => ({ order: () => ({ limit: async () => ({ data: t === 'enquiries' ? demoEnquiries : jobs.slice(0, 1), error: null }) }) }) }),
    storage: { from: () => ({ upload: async () => ({ error: new Error('uploads are off in demo mode') }) }) },
    functions: { invoke: async (_name, { body }) => {
      const o = demoOrders.find((x) => x.ref === body.ref);
      if (!body.resend) Object.assign(o, { status: 'paid', paid_amount: body.amount, paid_at: new Date().toISOString(), paid_by: user.email });
      const at = new Date().toISOString();
      const sent = ['customer', 'shop'].flatMap((to) => ['email', 'whatsapp'].map((channel) => ({ at, kind: o.status, to, channel, ok: true })));
      return { data: { status: o.status, paid_amount: o.paid_amount, paid_at: o.paid_at, sent }, error: null };
    } },
  };
}

/* ---------- not configured ---------- */
if (!DEMO && !configured) {
  root.replaceChildren(h('main', { class: 'card card--narrow' },
    h('h1', { text: 'Admin not connected yet' }),
    h('p', { text: 'Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_CLERK_PUBLISHABLE_KEY to website/frontend/.env (and to the Vercel project settings), then reload. See ADMIN-SETUP.md.' })));
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
  section: SECTIONS[0].key,
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
  if (!confirm(`Publish ${n} section${n === 1 ? '' : 's'} to the live website?`)) return;
  const { error } = await sb.rpc('publish');
  if (error) return toast(explain(error), 'err');
  toast('Publishing. The website updates in about 2 minutes.');
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
    : n ? `${n} section${n === 1 ? '' : 's'} not published yet`
    : ctx.notLive.size ? 'Some published changes are not live yet'
    : jobText(j) || 'Everything is live';
  bar.replaceChildren(...[
    h('span', { class: `pub__state${j?.status === 'failed' ? ' is-err' : ''}`, role: 'status', text: state }),
    j?.run_url && (j.status === 'failed' || busy) ? h('a', { href: j.run_url, target: '_blank', rel: 'noopener', class: 'linkbtn', text: 'Run log' }) : null,
    h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Preview', onclick: openPreview }),
    ctx.role === 'owner' && !busy && (j?.status === 'failed' || (!n && ctx.notLive.size)) ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Retry update', onclick: retryDeploy }) : null,
    ctx.role === 'owner'
      ? h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: 'Publish', disabled: !n || busy, onclick: publishAll })
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

async function save(section) {
  let value = clone(ctx.data[section.key]);
  const problems = validate(section, value);
  if (problems.length) {
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
  toast(`${section.title} saved as a draft. Press Publish when you're ready for it to go live.`);
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
  if (!confirm(`Put "${section.title}" back to the website's original built-in content?\n\n${count}.\n\nThis only changes your draft: press Save changes, then Publish, to make it live. Undo changes brings your version back until you save.`)) return;
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
    h('p', { class: 'muted', text: ctx.role === 'owner' ? 'Restoring makes that version your draft. Save is not needed; press Publish to make it live.' : 'Only the owner can restore a version.' }),
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
          toast('Version restored as your draft. Press Publish to make it live.');
        },
      }) : null))) : h('p', { text: 'No saved versions yet.' }),
    h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: 'Close', onclick: () => dlg.close() }));
  document.body.append(dlg);
  dlg.showModal();
}

/* ---------- enquiry inbox (owner) ---------- */
const INBOX = '__inbox';
const ENQ_STATUS = [['new', 'New'], ['replied', 'Replied'], ['ordered', 'Order confirmed'], ['painting', 'Being painted'], ['ready', 'Ready'], ['delivered', 'Delivered'], ['closed', 'Closed']];

function csvCell(v) {
  let s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheets running it as a formula
  return `"${s.replace(/"/g, '""')}"`;
}

function inboxView() {
  const body = h('div', {}, h('p', { class: 'loading', text: 'Loading enquiries…' }));
  let filter = 'open';
  let rows = [];
  const paint = () => {
    const list = rows.filter((e) => (filter === 'all' ? true : filter === 'open' ? !['delivered', 'closed'].includes(e.status) : e.status === filter));
    body.replaceChildren(
      h('div', { class: 'inbox__tools' },
        h('select', { class: 'input', 'aria-label': 'Show', onchange: (e) => { filter = e.target.value; paint(); } },
          ...[['open', 'Open enquiries'], ['all', 'All'], ...ENQ_STATUS].map(([v, t]) => h('option', { value: v, text: t, selected: v === filter }))),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Download CSV', onclick: () => {
          const cols = ['created_at', 'name', 'phone', 'email', 'event_date', 'place', 'items', 'note', 'status', 'status_note'];
          const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n');
          const a = h('a', { href: URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })), download: `enquiries-${new Date().toISOString().slice(0, 10)}.csv` });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } })),
      list.length ? h('div', { class: 'inbox' }, ...list.map(enquiryCard)) : h('p', { class: 'muted', text: 'No enquiries here.' }));
  };
  const enquiryCard = (e) => {
    const status = h('select', { class: 'input', name: 'status', 'aria-label': `Status of the enquiry from ${e.name}` }, ...ENQ_STATUS.map(([v, t]) => h('option', { value: v, text: t, selected: v === e.status })));
    const note = h('input', { class: 'input', name: 'status_note', autocomplete: 'off', value: e.status_note || '', maxlength: 500, 'aria-label': 'Note the customer sees on their tracking page', placeholder: 'e.g. Ready by 20 Nov…' });
    const phone = String(e.phone || '').replace(/[^\d]/g, '');
    return h('article', { class: 'card inbox__item' },
      h('div', { class: 'inbox__head' }, h('strong', { text: e.name }), h('span', { class: 'muted', text: new Date(e.created_at).toLocaleString() })),
      h('p', {}, ...[
        e.phone ? h('a', { href: `tel:${e.phone}`, text: e.phone }) : null,
        phone.length >= 10 ? h('a', { href: `https://wa.me/${phone.length === 10 ? `91${phone}` : phone}`, target: '_blank', rel: 'noopener', text: 'WhatsApp' }) : null,
        e.email ? h('a', { href: `mailto:${e.email}`, text: e.email }) : null,
      ].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]))),
      e.event_date || e.place ? h('p', { class: 'muted', text: [e.event_date && `Event: ${e.event_date}`, e.place && `Place: ${e.place}`].filter(Boolean).join(' · ') }) : null,
      e.items?.length ? h('ul', {}, ...e.items.map((i) => h('li', { text: i }))) : null,
      e.note ? h('p', { class: 'inbox__note', text: e.note }) : null,
      h('div', { class: 'row' }, status, note,
        h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: 'Update', onclick: async () => {
          const { error } = await sb.rpc('set_enquiry_status', { p_id: e.id, p_status: status.value, p_note: note.value });
          if (error) return toast(explain(error), 'err');
          Object.assign(e, { status: status.value, status_note: note.value });
          toast('Updated. The customer sees it on their tracking page.');
          paint();
        } }),
        h('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Delete', onclick: async () => {
          if (!confirm(`Delete the enquiry from ${e.name}? This cannot be undone.`)) return;
          const { error } = await sb.rpc('delete_enquiry', { p_id: e.id });
          if (error) return toast(explain(error), 'err');
          rows = rows.filter((x) => x !== e);
          paint();
        } })));
  };
  sb.from('enquiries').select('*').order('created_at', { ascending: false }).limit(500).then(({ data, error }) => {
    if (error) return body.replaceChildren(h('p', { class: 'form-msg', text: `Could not load enquiries: ${explain(error)}` }));
    rows = data || [];
    paint();
  });
  return h('div', {}, h('div', { class: 'sec-head' }, h('div', {}, h('h1', { text: 'Enquiries' }),
    h('p', { class: 'muted', text: 'Enquiries sent from the website. Change the status as the order progresses: the customer sees it on their tracking page. Enquiries are deleted automatically after 18 months.' }))), body);
}

/* ---------- orders and payment receipts (owner) ---------- */
const ORDERS = '__orders';
const METHOD = { upi: 'UPI', bank: 'Bank transfer', gateway: 'Payment page', later: 'Pay at shop / on delivery' };
const rupees = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

/** "Customer: email ✓, whatsapp ✗ · Shop: email ✓" for the latest receipt that went out. */
function sentLine(sent = []) {
  if (!sent.length) return 'No receipt sent yet.';
  const last = sent.at(-1).at;
  const batch = sent.filter((s) => s.at === last);
  const part = (to) => {
    const xs = batch.filter((s) => s.to === to);
    return xs.length ? `${to === 'customer' ? 'Customer' : 'Shop'}: ${xs.map((s) => `${s.channel} ${s.ok ? '✓' : '✗'}`).join(', ')}` : '';
  };
  const failed = batch.filter((s) => !s.ok).map((s) => s.error).filter(Boolean);
  return `${batch[0].kind === 'paid' ? 'Payment receipt' : 'Order receipt'} sent ${new Date(last).toLocaleString()}. ${[part('customer'), part('shop')].filter(Boolean).join(' · ')}${failed.length ? ` (${failed[0]})` : ''}`;
}

async function confirmPayment(body) {
  const { data, error } = await sb.functions.invoke('confirm-payment', { body });
  if (!error) return data;
  const detail = await error.context?.json?.().catch(() => null);
  throw new Error(detail?.error || error.message);
}

function ordersView() {
  const body = h('div', {}, h('p', { class: 'loading', text: 'Loading orders…' }));
  let filter = 'placed';
  let rows = [];
  const paint = () => {
    const list = rows.filter((o) => filter === 'all' || o.status === filter);
    body.replaceChildren(
      h('div', { class: 'inbox__tools' },
        h('select', { class: 'input', 'aria-label': 'Show', onchange: (e) => { filter = e.target.value; paint(); } },
          ...[['placed', 'Awaiting payment confirmation'], ['paid', 'Paid'], ['all', 'All orders']].map(([v, t]) => h('option', { value: v, text: t, selected: v === filter })))),
      list.length ? h('div', { class: 'inbox' }, ...list.map(orderCard)) : h('p', { class: 'muted', text: 'No orders here.' }));
  };
  const orderCard = (o) => {
    const digits = String(o.phone || '').replace(/[^\d]/g, '');
    const apply = (data) => {
      Object.assign(o, { status: data.status, paid_amount: data.paid_amount, paid_at: data.paid_at, sent: [...(o.sent || []), ...data.sent] });
      const failed = data.sent.filter((s) => !s.ok).length;
      if (!data.sent.length) toast('Saved. No receipt was sent: email and WhatsApp are not set up yet.', 'err');
      else if (failed) toast(`Saved, but ${failed} of ${data.sent.length} receipt messages failed. See the order for details.`, 'err');
      else toast('Receipt sent to the customer and the shop.');
      paint();
    };
    let actions;
    if (o.status === 'placed') {
      const amount = h('input', { class: 'input', type: 'number', min: 1, step: 1, value: o.paid_now || o.total, 'aria-label': `Amount received for ${o.ref}` });
      const btn = h('button', { type: 'button', class: 'btn btn--gold btn--sm', text: 'Mark as paid and send receipt', onclick: async () => {
        const amt = Math.round(Number(amount.value));
        if (!(amt > 0)) return toast('Enter the amount you received.', 'err');
        if (!confirm(`Only continue if ${rupees(amt)} is in your bank account.\n\nMark ${o.ref} as paid and send the payment receipt to ${o.name} and the shop?`)) return;
        btn.disabled = true;
        try { apply(await confirmPayment({ ref: o.ref, amount: amt })); } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
      } });
      actions = h('div', { class: 'row' }, h('span', { class: 'muted', text: 'Received ₹' }), amount, btn);
    } else {
      const again = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Send receipt again', onclick: async () => {
        again.disabled = true;
        try { apply(await confirmPayment({ ref: o.ref, resend: true })); } catch (err) { toast(err.message, 'err'); again.disabled = false; }
      } });
      actions = h('div', { class: 'row' }, h('strong', { text: `Paid ${rupees(o.paid_amount)} on ${new Date(o.paid_at).toLocaleDateString()}` }), o.paid_by ? h('span', { class: 'muted', text: `by ${o.paid_by}` }) : null, again);
    }
    return h('article', { class: 'card inbox__item' },
      h('div', { class: 'inbox__head' }, h('strong', { text: `${o.ref} · ${o.name}` }), h('span', { class: 'muted', text: new Date(o.created_at).toLocaleString() })),
      h('p', {}, ...[
        o.phone ? h('a', { href: `tel:${o.phone}`, text: o.phone }) : null,
        digits.length >= 10 ? h('a', { href: `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`, target: '_blank', rel: 'noopener', text: 'WhatsApp' }) : null,
        o.email ? h('a', { href: `mailto:${o.email}`, text: o.email }) : null,
      ].filter(Boolean).flatMap((x, i) => (i ? [' · ', x] : [x]))),
      h('ul', {}, ...(o.items || []).map((i) => h('li', { text: `${i.qty} × ${i.title}${i.detail ? ` (${i.detail})` : ''}: ${rupees(i.amount)}` }))),
      h('p', { text: `Total ${rupees(o.total)} · Customer says they paid ${o.method === 'later' ? 'nothing yet' : rupees(o.paid_now)} by ${METHOD[o.method] || o.method}${o.utr ? ` · UTR ${o.utr}` : ''}` }),
      o.address ? h('p', { class: 'muted', text: `Deliver to: ${o.address}` }) : null,
      actions,
      h('p', { class: 'muted', text: sentLine(o.sent) }));
  };
  sb.rpc('list_orders').then(({ data, error }) => {
    if (error) return body.replaceChildren(h('p', { class: 'form-msg', text: `Could not load orders: ${explain(error)}` }));
    rows = data || [];
    paint();
  });
  return h('div', {}, h('div', { class: 'sec-head' }, h('div', {}, h('h1', { text: 'Orders' }),
    h('p', { class: 'muted', text: 'Orders placed at checkout. When the money is in your bank account, press Mark as paid: the customer and the shop get a payment receipt by email and WhatsApp.' }))), body);
}

/* ---------- layout ---------- */
function render() {
  if ((ctx.section === INBOX || ctx.section === ORDERS) && ctx.role !== 'owner') ctx.section = SECTIONS[0].key;
  const section = SECTIONS.find((s) => s.key === ctx.section);
  const nav = h('nav', { class: 'side', 'aria-label': 'Sections' },
    ...SECTIONS.map((s) => h('button', {
      type: 'button', class: `side__btn${s.key === ctx.section ? ' is-active' : ''}`, 'aria-current': s.key === ctx.section ? 'page' : null,
      onclick: () => { ctx.section = s.key; ctx.index = 0; render(); },
    }, h('span', { 'aria-hidden': 'true', text: s.icon }), h('span', { text: s.title }), isDirty(s.key) ? h('span', { class: 'dot', title: 'Unsaved changes', text: '●' }) : null)),
    ctx.role === 'owner' ? h('button', {
      type: 'button', class: `side__btn side__btn--inbox${ctx.section === INBOX ? ' is-active' : ''}`, 'aria-current': ctx.section === INBOX ? 'page' : null,
      onclick: () => { ctx.section = INBOX; render(); },
    }, h('span', { 'aria-hidden': 'true', text: '📥' }), h('span', { text: 'Enquiries' })) : null,
    ctx.role === 'owner' ? h('button', {
      type: 'button', class: `side__btn side__btn--inbox${ctx.section === ORDERS ? ' is-active' : ''}`, 'aria-current': ctx.section === ORDERS ? 'page' : null,
      onclick: () => { ctx.section = ORDERS; render(); },
    }, h('span', { 'aria-hidden': 'true', text: '🧾' }), h('span', { text: 'Orders' })) : null);

  // Clerk's UserButton: Manage account and Sign out (the browser warns first if there are unsaved changes).
  const userBtn = clerk ? h('div', { class: 'top__user' }) : null;
  const top = h('header', { class: 'top' },
    h('div', { class: 'top__brand' }, h('strong', { text: 'Parineeta' }), h('span', { text: ctx.role === 'owner' ? 'Admin panel' : 'Editor panel' })),
    h('div', { class: 'top__right' },
      h('div', { class: 'pub', id: 'publishbar' }),
      h('a', { class: 'btn btn--ghost btn--sm', href: '/', target: '_blank', rel: 'noopener', text: 'View website ↗' }),
      clerk ? userBtn : h('span', { class: 'top__user', title: ctx.user.email }, avatar(ctx.user, 30), h('span', { class: 'top__name', text: profileOf(ctx.user).name || ctx.user.email })),
      clerk ? null : h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Sign out', onclick: async () => { if (!anyDirty() || confirm('You have unsaved changes. Sign out anyway?')) toLogin('?signout'); } })));

  root.replaceChildren(top, h('div', { class: 'shell' }, nav, h('main', { class: 'main', id: 'main' }, ctx.section === INBOX ? inboxView() : ctx.section === ORDERS ? ordersView() : sectionView(section))));
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

function sectionView(section) {
  const dirty = isDirty(section.key);
  const upd = ctx.updated[section.key];
  const saveBar = h('div', { class: `savebar${dirty ? ' is-dirty' : ''}` },
    h('span', { class: 'savebar__state', text: dirty ? (upd ? 'Unsaved changes' : 'Not saved yet') : `Draft saved${upd ? ` ${new Date(upd.at).toLocaleString()}${upd.by ? ` by ${upd.by}` : ''}` : ''}` }),
    dirty && upd ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Undo changes', onclick: () => { ctx.data[section.key] = JSON.parse(ctx.saved[section.key]); writeBackup(section.key); render(); } }) : null,
    h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Set to default', onclick: () => setToDefault(section) }),
    ctx.saved[section.key] ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'History', onclick: () => openHistory(section) }) : null,
    h('button', { type: 'button', class: 'btn btn--gold', text: 'Save changes', disabled: !dirty, onclick: () => save(section) }));
  const onChange = () => {
    const d = isDirty(section.key);
    saveBar.classList.toggle('is-dirty', d);
    saveBar.querySelector('.btn--gold').disabled = !d;
    saveBar.querySelector('.savebar__state').textContent = d ? 'Unsaved changes' : 'Saved';
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
    const paint = () => form.replaceChildren(...section.fields.map((f) => {
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
    }));
    paint();
    return h('div', {}, head, form);
  }

  const list = ctx.data[section.key];
  ctx.index = Math.min(ctx.index, list.length - 1);
  const items = h('ol', { class: 'items' });
  const paintItems = () => items.replaceChildren(...list.map((it, i) => h('li', {},
    h('button', { type: 'button', class: `item${i === ctx.index ? ' is-active' : ''}${it.hidden ? ' is-hidden' : ''}`, onclick: () => { ctx.index = i; paintForm(); paintItems(); } },
      section.thumbKey && it[section.thumbKey] ? h('img', { class: 'item__thumb', width: 38, height: 38, src: photoSrc(it[section.thumbKey], 400), alt: '', loading: 'lazy' }) : null,
      h('span', { class: 'item__text' }, h('span', { class: 'item__title', text: section.itemTitle(it) }), section.itemSub ? h('span', { class: 'item__sub', text: section.itemSub(it) }) : null)))));
  refreshListLabels = paintItems;

  const form = h('div', { class: 'card form' });
  const paintForm = () => {
    const it = list[ctx.index];
    if (!it) return form.replaceChildren(h('p', { class: 'muted', text: 'Nothing here yet. Use “Add” to create the first one.' }));
    const tools = h('div', { class: 'form__tools' },
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '↑ Move up', disabled: ctx.index === 0, onclick: () => move(-1) }),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '↓ Move down', disabled: ctx.index === list.length - 1, onclick: () => move(1) }),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Duplicate', onclick: () => { const c = clone(it); if (c.id) c.id = `${c.id}-copy`; list.splice(ctx.index + 1, 0, c); ctx.index += 1; onChange(); paintAll(); } }),
      h('button', { type: 'button', class: 'btn btn--danger btn--sm', text: 'Delete', onclick: () => { if (!confirm(`Delete “${section.itemTitle(it)}”? You can undo until you save.`)) return; list.splice(ctx.index, 1); ctx.index = Math.max(0, ctx.index - 1); onChange(); paintAll(); } }));
    form.replaceChildren(tools, ...section.fields.map((f) => field(f, it, onChange, paintForm)));
  };
  const move = (d) => {
    const j = ctx.index + d;
    [list[ctx.index], list[j]] = [list[j], list[ctx.index]];
    ctx.index = j;
    onChange();
    paintAll();
  };
  const paintAll = () => { paintItems(); paintForm(); };
  paintAll();

  const add = h('button', {
    type: 'button', class: 'btn btn--gold btn--sm', text: '+ Add',
    onclick: () => {
      const blank = section.blank();
      if (section.newFirst) { list.unshift(blank); ctx.index = 0; } else { list.push(blank); ctx.index = list.length - 1; }
      onChange();
      paintAll();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  });

  return h('div', {}, head, h('div', { class: 'split' },
    h('aside', { class: 'card items-card' }, h('div', { class: 'items-head' }, h('strong', { text: `${list.length} ${section.title.toLowerCase()}` }), add), items),
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
  // Customers who open /admin go to their own page instead.
  const { data: role } = await sb.rpc('admin_role');
  if (!role) return location.replace('/account.html');
  root.replaceChildren(h('p', { class: 'loading', text: 'Loading the shop…' }));
  try {
    await loadAll();
    render();
  } catch (err) {
    root.replaceChildren(h('main', { class: 'card card--narrow' }, h('h1', { text: 'Could not load' }), h('p', { text: err.message }),
      h('p', { class: 'muted', text: 'If this is the first time, run database/schema.sql and then the files in database/migrations in the Supabase SQL editor.' })));
  }
}

if (DEMO || configured) start();
