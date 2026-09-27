import './admin.css';
import { createClient } from '@supabase/supabase-js';
import { SECTIONS, FILM_OPTIONS } from './schemas.js';
import { photoSrc } from '../data/site.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
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
  const rows = new Map();
  const user = { email: 'demo@localhost' };
  return {
    auth: {
      getSession: async () => ({ data: { session: { user } } }),
      onAuthStateChange: () => {},
      signOut: async () => location.reload(),
    },
    from: () => ({
      select: async () => ({ data: [...rows.values()], error: null }),
      upsert: async (row) => (rows.set(row.key, row), { error: null }),
    }),
    storage: { from: () => ({ upload: async () => ({ error: new Error('uploads are off in demo mode') }) }) },
  };
}

/* ---------- not configured ---------- */
if (!DEMO && (!URL_ || !KEY)) {
  root.replaceChildren(h('main', { class: 'card card--narrow' },
    h('h1', { text: 'Admin not connected yet' }),
    h('p', { text: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to website/.env (and to the Vercel project settings), then reload. See ADMIN-SETUP.md.' })));
}

const sb = DEMO ? demoClient() : URL_ && KEY ? createClient(URL_, KEY) : null;

/* ---------- state ---------- */
const ctx = {
  user: null,
  data: {}, // section key -> working copy
  saved: {}, // section key -> JSON string as last saved
  updated: {}, // section key -> { at, by }
  section: SECTIONS[0].key,
  index: 0, // selected item in a list section
};
const isDirty = (key) => JSON.stringify(ctx.data[key]) !== ctx.saved[key];
const anyDirty = () => SECTIONS.some((s) => isDirty(s.key));
window.addEventListener('beforeunload', (e) => {
  if (anyDirty()) e.preventDefault();
});

/* ---------- auth ---------- */
function renderLogin(message = '') {
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', required: true, id: 'l-email' });
  const pass = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true, id: 'l-pass' });
  const msg = h('p', { class: 'form-msg', role: 'alert', text: message });
  const btn = h('button', { class: 'btn btn--gold', type: 'submit', text: 'Sign in' });
  root.replaceChildren(h('main', { class: 'card card--narrow login' },
    h('img', { src: '/brand/parineeta_monogram_initial_transparent.png', alt: '', class: 'login__mark', onerror: (e) => e.target.remove() }),
    h('h1', { text: 'Parineeta shop admin' }),
    h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        btn.disabled = true;
        msg.textContent = 'Signing in…';
        const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
        btn.disabled = false;
        if (error) msg.textContent = error.message === 'Invalid login credentials' ? 'That email and password do not match.' : error.message;
      },
    },
    h('label', { class: 'field' }, h('span', { class: 'field__label', text: 'Email' }), email),
    h('label', { class: 'field' }, h('span', { class: 'field__label', text: 'Password' }), pass),
    btn,
    msg,
    h('button', {
      type: 'button', class: 'linkbtn', text: 'Forgot password?',
      onclick: async () => {
        if (!email.value) return (msg.textContent = 'Type your email above first.');
        const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.href.split('#')[0] });
        msg.textContent = error ? error.message : 'Check your email for a link to set a new password.';
      },
    }))));
}

function renderNewPassword() {
  const pass = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', minlength: 8, required: true });
  const msg = h('p', { class: 'form-msg', role: 'alert' });
  root.replaceChildren(h('main', { class: 'card card--narrow' },
    h('h1', { text: 'Set a new password' }),
    h('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.updateUser({ password: pass.value });
        if (error) return (msg.textContent = error.message);
        toast('Password updated.');
        start();
      },
    },
    h('label', { class: 'field' }, h('span', { class: 'field__label', text: 'New password (8+ characters)' }), pass),
    h('button', { class: 'btn btn--gold', type: 'submit', text: 'Save password' }),
    msg)));
}

/* ---------- data ---------- */
async function loadAll() {
  const { data: rows, error } = await sb.from('site_content').select('key,data,updated_at,updated_by');
  if (error) throw error;
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  for (const s of SECTIONS) {
    const row = byKey[s.key];
    ctx.data[s.key] = row ? row.data : s.defaults();
    // Sections never saved start from the site's current built-in content, and count as unsaved.
    ctx.saved[s.key] = row ? JSON.stringify(row.data) : '';
    ctx.updated[s.key] = row ? { at: row.updated_at, by: row.updated_by } : null;
  }
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
  const row = { key: section.key, data: value, updated_at: new Date().toISOString(), updated_by: ctx.user.email };
  const { error } = await sb.from('site_content').upsert(row);
  if (error) {
    toast(error.code === '42501' || /row-level security/i.test(error.message) ? 'This account is not allowed to edit. Ask for it to be added as an admin.' : `Could not save: ${error.message}`, 'err');
    return;
  }
  ctx.data[section.key] = value;
  ctx.saved[section.key] = JSON.stringify(value);
  ctx.updated[section.key] = { at: row.updated_at, by: row.updated_by };
  toast(`${section.title} saved. The website shows the change on next page load.`);
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
        preview.replaceChildren(v && kind === 'photo' ? h('img', { src: /^\//.test(v) ? v : photoSrc(v, 400), alt: '', onerror: (e) => e.target.replaceWith(h('span', { text: 'No preview' })) }) : v ? h('span', { text: `🎬 ${v}` }) : h('span', { text: 'None' }));
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

/* ---------- layout ---------- */
function render() {
  const section = SECTIONS.find((s) => s.key === ctx.section);
  const nav = h('nav', { class: 'side', 'aria-label': 'Sections' },
    ...SECTIONS.map((s) => h('button', {
      type: 'button', class: `side__btn${s.key === ctx.section ? ' is-active' : ''}`, 'aria-current': s.key === ctx.section ? 'page' : null,
      onclick: () => { ctx.section = s.key; ctx.index = 0; render(); },
    }, h('span', { 'aria-hidden': 'true', text: s.icon }), h('span', { text: s.title }), isDirty(s.key) ? h('span', { class: 'dot', title: 'Unsaved changes', text: '●' }) : null)));

  const top = h('header', { class: 'top' },
    h('div', { class: 'top__brand' }, h('strong', { text: 'Parineeta' }), h('span', { text: 'Shop admin' })),
    h('div', { class: 'top__right' },
      h('a', { class: 'btn btn--ghost btn--sm', href: '/', target: '_blank', rel: 'noopener', text: 'View website ↗' }),
      h('span', { class: 'top__user', text: ctx.user.email }),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Sign out', onclick: async () => { if (!anyDirty() || confirm('You have unsaved changes. Sign out anyway?')) await sb.auth.signOut(); } })));

  root.replaceChildren(top, h('div', { class: 'shell' }, nav, h('main', { class: 'main', id: 'main' }, sectionView(section))));
}

function sectionView(section) {
  const dirty = isDirty(section.key);
  const upd = ctx.updated[section.key];
  const saveBar = h('div', { class: `savebar${dirty ? ' is-dirty' : ''}` },
    h('span', { class: 'savebar__state', text: dirty ? (upd ? 'Unsaved changes' : 'Not saved to the live site yet') : `Saved${upd ? ` ${new Date(upd.at).toLocaleString()}${upd.by ? ` by ${upd.by}` : ''}` : ''}` }),
    dirty && upd ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Undo changes', onclick: () => { ctx.data[section.key] = JSON.parse(ctx.saved[section.key]); render(); } }) : null,
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
    refreshListLabels?.();
  };
  let refreshListLabels = null;

  const head = h('div', { class: 'sec-head' }, h('div', {}, h('h1', { text: section.title }), h('p', { class: 'muted', text: section.intro })), saveBar);

  if (section.kind === 'object') {
    const obj = ctx.data[section.key];
    const form = h('div', { class: 'card form' });
    const paint = () => form.replaceChildren(...section.fields.map((f) => field(f, obj, onChange, paint)));
    paint();
    return h('div', {}, head, form);
  }

  const list = ctx.data[section.key];
  ctx.index = Math.min(ctx.index, list.length - 1);
  const items = h('ol', { class: 'items' });
  const paintItems = () => items.replaceChildren(...list.map((it, i) => h('li', {},
    h('button', { type: 'button', class: `item${i === ctx.index ? ' is-active' : ''}${it.hidden ? ' is-hidden' : ''}`, onclick: () => { ctx.index = i; paintForm(); paintItems(); } },
      section.thumbKey && it[section.thumbKey] ? h('img', { class: 'item__thumb', src: photoSrc(it[section.thumbKey], 400), alt: '', loading: 'lazy' }) : null,
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
  const { data: { session } } = await sb.auth.getSession();
  starting = false;
  if (!session) return renderLogin();
  if (ctx.user && root.querySelector('.shell')) return;
  ctx.user = session.user;
  root.replaceChildren(h('p', { class: 'loading', text: 'Loading the shop…' }));
  try {
    await loadAll();
    render();
  } catch (err) {
    root.replaceChildren(h('main', { class: 'card card--narrow' }, h('h1', { text: 'Could not load' }), h('p', { text: err.message }),
      h('p', { class: 'muted', text: 'If this is the first time, run supabase/schema.sql in the Supabase SQL editor.' })));
  }
}

sb?.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') return renderNewPassword();
  if (event === 'SIGNED_IN' && !root.querySelector('.shell')) setTimeout(start);
  if (event === 'SIGNED_OUT') {
    ctx.user = null;
    renderLogin('Signed out.');
  }
});
if (sb) start();
