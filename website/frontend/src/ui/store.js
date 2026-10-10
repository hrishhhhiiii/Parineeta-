import { byId, isSet, variantsOf } from '../data/products.js';
import { lineInfo, lineKey, pickOf, isLegacyChoices } from '../data/pricing.js';

const KEY = 'parineeta:v1';
const MAX_QTY = 20;
const state = { cart: [], wish: [] };
// Saved cart lines that could not be read (a product that no longer exists, a damaged entry).
// main.js tells the customer once, instead of the items vanishing silently.
let dropped = 0;
const droppedSubs = new Set();
export const droppedLines = () => dropped;
/** Runs with the number of lines just dropped (e.g. when a signed-in cart arrives from the account). */
export const onDropped = (fn) => droppedSubs.add(fn);

/** A saved line in today's shape: `pick` for the choices, and (for one release, while older pages may still be
 *  open) `combo` for products that only have the original option list. Unreadable lines return null. */
function readLine(l) {
  if (!l || typeof l !== 'object' || !byId(l.id) || !Number.isFinite(l.qty)) return null;
  // Saved carts can be edited in the browser: whole pieces only, 1 to MAX_QTY, so a total can't go negative.
  const qty = Math.min(MAX_QTY, Math.floor(l.qty));
  if (qty < 1) return null;
  if (isSet(l.id)) return { ...l, qty, key: l.key || [l.id, '', '', ''].join('|') };
  const p = byId(l.id);
  const pick = pickOf(p, { ...l, qty });
  const legacy = isLegacyChoices(variantsOf(p));
  return { ...l, qty, pick, combo: legacy ? pick.option : null, key: lineKey(p, { ...l, pick }) };
}
const readLines = (lines) => {
  const out = [];
  let lost = 0;
  for (const l of Array.isArray(lines) ? lines : []) {
    const r = readLine(l);
    if (r) out.push(r);
    else lost++;
  }
  if (lost) {
    dropped += lost;
    droppedSubs.forEach((fn) => fn(lost));
  }
  return out;
};

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && Array.isArray(saved.cart)) state.cart = readLines(saved.cart);
  if (saved && Array.isArray(saved.wish)) state.wish = saved.wish.filter((id) => byId(id));
} catch {
  /* storage unavailable: start empty */
}

const subs = new Set();
const localChange = new Set(); // cart sync listens here; not called for changes that came from the server
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep in memory only */
  }
  subs.forEach((fn) => fn(state));
}
function commit() {
  save();
  localChange.forEach((fn) => fn(state));
}

const validWish = (ids) => [...new Set((Array.isArray(ids) ? ids : []).filter((id) => byId(id)))];

/** Signed-in cart sync: replace the contents without counting it as a local edit. */
export function replaceState(next) {
  state.cart = readLines(next.cart).map((l) => ({ ...l, qty: Math.max(1, Math.min(MAX_QTY, l.qty)) }));
  state.wish = validWish(next.wish);
  save();
}
export const onLocalChange = (fn) => localChange.add(fn);

/** Items from both carts; the same line keeps the larger quantity. Wishlists are combined. */
export function mergeCarts(a, b) {
  const lines = new Map();
  for (const l of [...readLines(a.cart), ...readLines(b.cart)]) {
    const seen = lines.get(l.key);
    lines.set(l.key, seen ? { ...seen, qty: Math.max(seen.qty, l.qty) } : { ...l });
  }
  return { cart: [...lines.values()], wish: [...new Set([...(a.wish || []), ...(b.wish || [])])] };
}

export const store = {
  get cart() {
    return state.cart;
  },
  get wish() {
    return state.wish;
  },
  subscribe(fn) {
    subs.add(fn);
    fn(state);
    return () => subs.delete(fn);
  },
  add(line) {
    const custom = (line.custom || '').trim();
    const r = readLine({ ...line, custom, style: line.style || null });
    if (!r) return;
    const existing = state.cart.find((l) => l.key === r.key);
    if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + line.qty);
    else state.cart.push({ id: r.id, style: r.style, pick: r.pick || null, combo: r.combo || null, custom, qty: Math.min(MAX_QTY, line.qty), key: r.key });
    commit();
  },
  setQty(key, qty) {
    const l = state.cart.find((x) => x.key === key);
    if (!l) return;
    l.qty = Math.max(1, Math.min(MAX_QTY, qty));
    commit();
  },
  remove(key) {
    state.cart = state.cart.filter((l) => l.key !== key);
    commit();
  },
  clear() {
    state.cart = [];
    commit();
  },
  toggleWish(id) {
    const i = state.wish.indexOf(id);
    if (i >= 0) state.wish.splice(i, 1);
    else state.wish.push(id);
    commit();
    return i < 0;
  },
  hasWish: (id) => state.wish.includes(id),
};

export const MAX = MAX_QTY;

/* The customer's wedding date, kept in this browser for "Order by …" and checkout. A date that has
   passed is forgotten. */
const WEDDING_KEY = 'parineeta:wedding';
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export function weddingDate(today) {
  try {
    const v = localStorage.getItem(WEDDING_KEY) || '';
    if (!ISO_DAY.test(v) || (today && v < today)) {
      if (v) localStorage.removeItem(WEDDING_KEY);
      return '';
    }
    return v;
  } catch {
    return '';
  }
}
export function setWeddingDate(v) {
  try {
    if (ISO_DAY.test(v || '')) localStorage.setItem(WEDDING_KEY, v);
    else localStorage.removeItem(WEDDING_KEY);
  } catch {
    /* private mode: not kept */
  }
}

export { lineInfo };

export const cartTotal = (lines) => lines.reduce((s, l) => s + lineInfo(l).total, 0);
