// Search and filters for the collection (shop catalogue, phase 2).
//
//   address (?q=&cat=&sub=&min=&max=&ready=1&sort=)  ⇄  state  ──► applyFilters() ──► results grid
//        ▲ readState / writeState                        │
//        └──────── search panel (nav icon) ◄──────────────┤
//                  filter sheet ("Filters")  ◄────────────┘
//
// The top half has no page code (the tests call it directly); the panels are at the bottom.
import { PRODUCTS, CATEGORIES, categoryOf, parentOf, childrenOf, topCategories, inCategory, variantsOf } from '../data/products.js';
import { fromPrice } from '../data/pricing.js';
import { waLink, photoSrc, reelStill } from '../data/site.js';
import { callRpc } from '../data/rpc.js';
import { h, icon, inr, $, $$ } from './dom.js';
import { openDialog, closeDialog, scrollToHash } from './dialogs.js';

/* ---------- matching ---------- */

/** Lower case, no accents or zero-width joiners, punctuation to spaces. Bengali is kept as written
 *  (nukta letters end up in one form, so a query and a name always compare the same way). */
export function normalise(s) {
  return String(s ?? '')
    .replace(/[​-‍﻿]/g, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

/** English spellings of Bengali words vary (kouto/kauto, mukoot/mukut, pidi/piri): fold them together. */
export function fold(tok) {
  if (!/^[a-z0-9]+$/.test(tok)) return tok;
  return tok
    .replace(/ph/g, 'f')
    .replace(/([bcdgjkpt])h/g, '$1')
    .replace(/sh/g, 's')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/[ao]u/g, 'o')
    .replace(/z/g, 'j')
    .replace(/y$/, 'i')
    .replace(/(.)\1+/g, '$1');
}

const tokens = (...parts) => [...new Set(parts.flatMap((x) => normalise(x).split(' ')).filter(Boolean).map(fold))];

/** Edit distance (with swapped neighbours) of at most `max`, stopping early. */
export function near(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return false;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** Search words for each product: names, other names, summary, category, choices. Built once per page. */
export function buildIndex(products = PRODUCTS) {
  return products.map((p, order) => {
    const cat = categoryOf(p.category);
    const par = categoryOf(parentOf(p.category));
    return {
      p,
      order,
      full: normalise(p.en),
      fields: {
        name: tokens(p.en, p.bn),
        alias: tokens(...String(p.aliases || '').split(',')),
        other: tokens(p.line, cat?.label, cat?.bn, par?.label, par?.bn, ...variantsOf(p).flatMap((g) => [g.name, ...g.options.map((o) => o.label)])),
      },
    };
  });
}

const WEIGHT = { name: 5, alias: 3, other: 2 };

function wordScore(q, last, entry) {
  let best = 0;
  // Words of 4+ letters allow one slip, 8+ letters two (Bengali counts characters the same way).
  const slips = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
  for (const [field, list] of Object.entries(entry.fields)) {
    for (const t of list) {
      let s = 0;
      if (t === q) s = WEIGHT[field] + 1;
      else if (last && q.length >= 2 && t.startsWith(q)) s = WEIGHT[field];
      else if (slips && near(q, t, slips)) s = WEIGHT[field] - 1;
      if (s > best) best = s;
    }
  }
  return best;
}

/** Products matching every word of the query, best first; ties keep the shop's own order. */
export function search(index, query) {
  const words = normalise(query).split(' ').filter(Boolean).map(fold);
  if (!words.length) return [];
  const whole = normalise(query);
  const hits = [];
  for (const e of index) {
    let total = 0;
    for (let i = 0; i < words.length; i++) {
      const s = wordScore(words[i], i === words.length - 1, e);
      if (!s) {
        total = 0;
        break;
      }
      total += s;
    }
    if (total) hits.push({ p: e.p, score: total + (whole === e.full ? 10 : 0), order: e.order });
  }
  return hits.sort((a, b) => b.score - a.score || a.order - b.order).map((x) => x.p);
}

/* ---------- filters and the address ---------- */

export const SORTS = [['pick', 'Our pick'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['new', 'Newest first']];
export const PRICE_PRESETS = [[null, 500, 'Under ₹500'], [500, 1500, '₹500 to ₹1,500'], [1500, 3000, '₹1,500 to ₹3,000'], [3000, null, 'Over ₹3,000']];
export const emptyState = () => ({ q: '', cat: 'all', sub: '', min: null, max: null, ready: false, sort: 'pick' });

const numOrNull = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Math.round(Number(v)));

/** State from the address. Unknown categories, bad numbers and unknown sorts are ignored. */
export function readState(searchString) {
  const u = new URLSearchParams(searchString);
  const st = emptyState();
  st.q = (u.get('q') || '').slice(0, 80);
  const cat = u.get('cat');
  if (cat && categoryOf(cat) && !parentOf(cat)) st.cat = cat;
  const sub = u.get('sub');
  if (sub && parentOf(sub)) {
    st.sub = sub;
    st.cat = parentOf(sub);
  }
  st.min = numOrNull(u.get('min'));
  st.max = numOrNull(u.get('max'));
  if (st.min != null && st.max != null && st.min > st.max) [st.min, st.max] = [st.max, st.min];
  st.ready = u.get('ready') === '1';
  if (SORTS.some(([k]) => k === u.get('sort'))) st.sort = u.get('sort');
  return st;
}

/** The address query for a state, keeping other parameters (such as view). */
export function writeState(st, searchString = '') {
  const u = new URLSearchParams(searchString);
  for (const k of ['q', 'cat', 'sub', 'min', 'max', 'ready', 'sort']) u.delete(k);
  if (st.q) u.set('q', st.q);
  if (st.cat && st.cat !== 'all') u.set('cat', st.cat);
  if (st.sub) u.set('sub', st.sub);
  if (st.min != null) u.set('min', String(st.min));
  if (st.max != null) u.set('max', String(st.max));
  if (st.ready) u.set('ready', '1');
  if (st.sort !== 'pick') u.set('sort', st.sort);
  return u.toString();
}

/** True if some combination of choices is "Ready now". */
export function readyAny(p) {
  const base = ['made', 'ready', 'out'].includes(p.stock) ? p.stock : 'made';
  const groups = variantsOf(p);
  if (!groups.length) return base === 'ready';
  return groups.every((g) => g.options.some((o) => (o.stock || base) === 'ready'));
}

/** Anything beyond the category chips (search, sub-category, price, ready, sort) shows one flat list. */
export const isRefined = (st) => !!(st.q || st.sub || st.min != null || st.max != null || st.ready || st.sort !== 'pick');
/** How many filters are on inside the Filters sheet (the button shows this number). */
export const filterCount = (st) => [st.sub, st.min != null || st.max != null, st.ready, st.sort !== 'pick'].filter(Boolean).length;

export function applyFilters(st, index, products = PRODUCTS) {
  let list = st.q ? search(index, st.q) : [...products];
  list = list.filter((p) => {
    if (!inCategory(p, st.cat)) return false;
    if (st.sub && p.category !== st.sub) return false;
    const price = fromPrice(p);
    if (st.min != null && price < st.min) return false;
    if (st.max != null && price > st.max) return false;
    if (st.ready && !readyAny(p)) return false;
    return true;
  });
  const order = new Map(products.map((p, i) => [p.id, i]));
  if (st.sort === 'price-asc') list.sort((a, b) => fromPrice(a) - fromPrice(b) || order.get(a.id) - order.get(b.id));
  else if (st.sort === 'price-desc') list.sort((a, b) => fromPrice(b) - fromPrice(a) || order.get(a.id) - order.get(b.id));
  else if (st.sort === 'new') list.sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')) || order.get(a.id) - order.get(b.id));
  return list;
}

/** All sub-categories that have products, for the Filters sheet (under the chosen main category). */
export function subOptions(cat) {
  const subs = cat && cat !== 'all' ? childrenOf(cat) : topCategories().flatMap((c) => childrenOf(c.id));
  return subs.filter((s) => PRODUCTS.some((p) => p.category === s.id));
}

/* ---------- panels: collection bar, search panel, filter sheet, results ---------- */

let state = emptyState();
let index = null;
// Set by main.js (initCatalogue): the product card comes from sections.js, which needs the page.
let hooks = { onChange: () => {}, getView: () => 'grid', showResults: () => {}, card: null };
const idx = () => (index ||= buildIndex(PRODUCTS));
const onLanding = () => !/^\/(p|c)\//.test(location.pathname);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const catalogueState = () => state;

/** Changes the collection's search/filters. `push` adds a Back step (a new search does; small tweaks don't). */
export function setCatalogue(patch, { push = false } = {}) {
  state = { ...state, ...patch };
  syncUrl(push);
  paint();
  hooks.onChange(state);
}

/** Writes the state (and the view) into the address. Product pages keep their own address. */
export function syncUrl(push = false) {
  if (!onLanding()) return;
  const u = new URLSearchParams(writeState(state, location.search));
  if (hooks.getView() === 'grid') u.delete('view');
  else u.set('view', hooks.getView());
  const qs = u.toString();
  const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`;
  if (push) history.pushState(history.state, '', url);
  else history.replaceState(history.state, '', url);
}

const priceText = (min, max) => (min != null && max != null ? `${inr(min)} to ${inr(max)}` : min != null ? `Over ${inr(min)}` : `Under ${inr(max)}`);

function paint() {
  $('#catalogue-q').textContent = state.q ? `“${state.q}”` : 'Search';
  const n = filterCount(state);
  const badge = $('#filters-count');
  badge.hidden = !n;
  badge.textContent = String(n);
  for (const chip of $$('#chips .chip')) {
    const on = chip.dataset.cat === state.cat;
    chip.classList.toggle('is-active', on);
    chip.setAttribute('aria-pressed', String(on));
  }
  // What's on, each removable on its own.
  const pills = [];
  const pill = (text, patch) => pills.push(h('button', { type: 'button', class: 'chip chip--on', 'aria-label': `Remove ${text}`, onclick: () => setCatalogue(patch) }, text, ' ', icon('x')));
  if (state.q) pill(`Search: ${state.q}`, { q: '' });
  if (state.sub) pill(categoryOf(state.sub)?.label || state.sub, { sub: '' });
  if (state.min != null || state.max != null) pill(priceText(state.min, state.max), { min: null, max: null });
  if (state.ready) pill('Ready now', { ready: false });
  if (state.sort !== 'pick') pill(SORTS.find(([k]) => k === state.sort)[1], { sort: 'pick' });
  if (pills.length > 1) pills.push(h('button', { type: 'button', class: 'catalogue-clear', text: 'Clear all', onclick: () => setCatalogue({ ...emptyState(), cat: state.cat }) }));
  $('#catalogue-active').replaceChildren(...pills);
}

const askOnWhatsApp = (q) => h('a', { class: 'btn btn--gold', href: waLink(`Namaskar Parineeta! I searched your website for "${q}". Do you make it?`), target: '_blank', rel: 'noopener' }, icon('whatsapp-logo', 'fill'), 'Ask us on WhatsApp');

/* Searches that found nothing go to the admin's "What customers want" list (014_shop.sql): words only,
   once per term per visit. A failure here never bothers the customer. */
const logged = new Set();
let missTimer = 0;
function logMiss(q) {
  const key = normalise(q);
  if (key.length < 2 || logged.has(key)) return;
  logged.add(key);
  callRpc('log_search_miss', { p_term: q }).catch((err) => console.warn('[search] missed search not recorded:', err.message));
}

/** The flat list shown when searching, filtering below a category, or sorting. */
export function renderResults(box) {
  const list = applyFilters(state, idx());
  // Only a search with no match anywhere counts as missed (not one emptied by filters).
  if (state.q && !search(idx(), state.q).length) logMiss(state.q);
  if (!list.length) {
    box.replaceChildren(h('div', { class: 'results-empty' },
      h('p', { class: 'results-empty__title', text: state.q ? `Nothing matches “${state.q}” yet.` : 'Nothing matches these filters.' }),
      h('p', { class: 'results-empty__body', text: 'We make pieces to order, so ask us anyway, or loosen the filters.' }),
      h('div', { class: 'results-empty__btns' },
        h('button', { type: 'button', class: 'btn btn--ghost', text: 'Clear filters', onclick: () => setCatalogue({ ...emptyState() }) }),
        askOnWhatsApp(state.q || 'something custom'))));
    return;
  }
  box.replaceChildren(
    h('p', { class: 'results-count', text: plural(list.length, 'piece', 'pieces') }),
    h('div', { class: 'cat-group__grid' }, ...list.map(hooks.card)));
}

/* ----- search panel ----- */
function hitThumb(p) {
  const photo = p.media?.find((m) => m.type === 'photo');
  const reel = p.media?.find((m) => m.type === 'reel');
  const src = photo ? photoSrc(photo.id, 400) : reel ? reelStill(reel.id) : '/brand/favicon-192x192.png';
  return h('img', { class: 'search-hit__img', src, alt: '', loading: 'lazy', width: 64, height: 64 });
}

let searchTimer = 0;
function paintSearch() {
  const q = $('#search-input').value.trim();
  const body = $('#search-body');
  const foot = $('#search-foot');
  clearTimeout(missTimer);
  if (!q) {
    foot.hidden = true;
    body.replaceChildren(h('p', { class: 'search__hint', text: 'Search in English or Bengali. Try “topor”, “mukut” or “কৌটো”.' }),
      h('p', { class: 'field__label', text: 'Browse' }),
      h('div', { class: 'chips' }, ...topCategories().filter((c) => PRODUCTS.some((p) => inCategory(p, c.id))).map((c) =>
        h('button', { type: 'button', class: 'chip', text: c.label, onclick: () => showCollection({ ...emptyState(), cat: c.id }) }))));
    return;
  }
  const hits = search(idx(), q);
  if (!hits.length) {
    foot.hidden = true;
    missTimer = setTimeout(() => logMiss(q), 1500); // recorded once they stop typing
    body.replaceChildren(h('div', { class: 'results-empty' },
      h('p', { class: 'results-empty__title', text: `Nothing matches “${q}” yet.` }),
      h('p', { class: 'results-empty__body', text: 'We make pieces to order, so ask us on WhatsApp.' }),
      askOnWhatsApp(q)));
    return;
  }
  body.replaceChildren(h('ul', { class: 'search-hits' }, ...hits.slice(0, 8).map((p) => h('li', {},
    h('a', { class: 'search-hit', href: `/p/${p.id}/` },
      hitThumb(p),
      h('span', { class: 'search-hit__names' },
        h('span', { class: 'search-hit__title', text: p.en }),
        h('span', { class: 'search-hit__bn bn', lang: 'bn', text: p.bn })),
      h('span', { class: 'search-hit__price', text: `from ${inr(fromPrice(p))}` }))))));
  foot.hidden = false;
  $('#search-all').textContent = hits.length > 8 ? `See all ${hits.length} results` : `Show ${plural(hits.length, 'result', 'results')} in the collection`;
}

/** Applies a search/filter state and shows the collection (also used by banners and category tiles). */
export function showCollection(next) {
  closeDialog($('#search-dialog'));
  closeDialog($('#filters-dialog'));
  setCatalogue(next, { push: true });
  hooks.showResults();
  setTimeout(() => scrollToHash('#collection'), 260);
}

export function openSearch() {
  $('#search-input').value = state.q;
  paintSearch();
  openDialog($('#search-dialog'));
  setTimeout(() => $('#search-input').focus(), 60);
}

/* ----- filter sheet ----- */
let draft = emptyState();
function paintFilters() {
  const body = $('#filters-body');
  const subs = subOptions(draft.cat);
  const set = (patch) => {
    draft = { ...draft, ...patch };
    paintFilters();
  };
  const radio = (name, value, label, checked, onPick) => h('label', { class: 'opt' },
    h('input', { type: 'radio', name, value, checked: checked || null, onchange: onPick }), h('span', { class: 'opt__label', text: label }));
  const minIn = h('input', { class: 'input', type: 'number', min: 0, inputmode: 'numeric', placeholder: 'Min ₹', 'aria-label': 'Lowest price', value: draft.min ?? '', onchange: (e) => set({ min: numOrNull(e.target.value) }) });
  const maxIn = h('input', { class: 'input', type: 'number', min: 0, inputmode: 'numeric', placeholder: 'Max ₹', 'aria-label': 'Highest price', value: draft.max ?? '', onchange: (e) => set({ max: numOrNull(e.target.value) }) });
  body.replaceChildren(...[
    subs.length ? h('fieldset', { class: 'field' }, h('legend', { class: 'field__label', text: 'Type' }),
      h('div', { class: 'options' },
        radio('f-sub', '', 'All', !draft.sub, () => set({ sub: '' })),
        ...subs.map((c) => radio('f-sub', c.id, draft.cat === 'all' ? `${categoryOf(parentOf(c.id))?.label} › ${c.label}` : c.label, draft.sub === c.id, () => set({ sub: c.id, cat: parentOf(c.id) }))))) : null,
    h('fieldset', { class: 'field' }, h('legend', { class: 'field__label', text: 'Price' }),
      h('div', { class: 'filters__range' }, minIn, h('span', { 'aria-hidden': 'true', text: 'to' }), maxIn),
      h('div', { class: 'options' },
        radio('f-price', 'any', 'Any price', draft.min == null && draft.max == null, () => set({ min: null, max: null })),
        ...PRICE_PRESETS.map(([min, max, label], i) => radio('f-price', String(i), label, draft.min === min && draft.max === max, () => set({ min, max }))))),
    h('fieldset', { class: 'field' }, h('legend', { class: 'field__label', text: 'Availability' }),
      h('div', { class: 'options' }, h('label', { class: 'opt' },
        h('input', { type: 'checkbox', checked: draft.ready || null, onchange: (e) => set({ ready: e.target.checked }) }),
        h('span', { class: 'opt__label', text: 'Ready now only' })))),
    h('fieldset', { class: 'field' }, h('legend', { class: 'field__label', text: 'Sort' }),
      h('div', { class: 'options' }, ...SORTS.map(([k, label]) => radio('f-sort', k, label, draft.sort === k, () => set({ sort: k }))))),
  ].filter(Boolean));
  const n = applyFilters(draft, idx()).length;
  $('#filters-apply').textContent = n ? `Show ${plural(n, 'piece', 'pieces')}` : 'No pieces match';
  $('#filters-apply').disabled = !n;
}

export function openFilters() {
  draft = { ...state };
  paintFilters();
  openDialog($('#filters-dialog'));
}

/** Wires the bar and both panels. Returns the state read from the address. */
export function initCatalogue(opts) {
  hooks = { ...hooks, ...opts };
  state = readState(location.search);
  for (const b of $$('[data-open-search]')) {
    b.addEventListener('click', () => {
      const menu = b.closest('#menu-dialog');
      if (menu) closeDialog(menu);
      openSearch();
    });
  }
  $('#search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(paintSearch, 120);
  });
  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#search-input').value.trim();
    if (q) showCollection({ ...emptyState(), q });
  });
  $('#search-all').addEventListener('click', () => showCollection({ ...emptyState(), q: $('#search-input').value.trim() }));
  $('#filters-open').addEventListener('click', openFilters);
  $('#filters-clear').addEventListener('click', () => {
    draft = { ...emptyState(), q: draft.q, cat: draft.cat };
    paintFilters();
  });
  $('#filters-apply').addEventListener('click', () => showCollection(draft));
  // Back and Forward between searches.
  addEventListener('popstate', () => {
    if (!onLanding()) return;
    state = readState(location.search);
    paint();
    hooks.onChange(state);
  });
  paint();
  return state;
}

export { CATEGORIES };
