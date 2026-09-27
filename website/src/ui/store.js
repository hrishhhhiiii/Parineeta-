import { byId, isSet, PALETTES } from '../data/products.js';

const KEY = 'parineeta:v1';
const MAX_QTY = 20;
const state = { cart: [], wish: [] };

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && Array.isArray(saved.cart)) {
    state.cart = saved.cart.filter((l) => l && byId(l.id) && Number.isFinite(l.qty));
  }
  if (saved && Array.isArray(saved.wish)) state.wish = saved.wish.filter((id) => byId(id));
} catch {
  /* storage unavailable: start empty */
}

const subs = new Set();
function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep in memory only */
  }
  subs.forEach((fn) => fn(state));
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
    const key = [line.id, line.style || '', line.combo || '', custom].join('|');
    const existing = state.cart.find((l) => l.key === key);
    if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + line.qty);
    else state.cart.push({ id: line.id, style: line.style || null, combo: line.combo || null, custom, qty: Math.min(MAX_QTY, line.qty), key });
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

export function lineInfo(line) {
  const p = byId(line.id);
  if (isSet(line.id)) return { p, unit: p.price, total: p.price * line.qty, styleLabel: null, comboLabel: null };
  const combo = p.combos.find((c) => c.id === line.combo) || p.combos[0];
  const unit = p.priceFrom + combo.add;
  return { p, unit, total: unit * line.qty, styleLabel: PALETTES[line.style]?.label || null, comboLabel: combo.label };
}

export const cartTotal = (lines) => lines.reduce((s, l) => s + lineInfo(l).total, 0);
