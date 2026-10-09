// Prices, stock and wording for a product's choices. No page code here: the site, the build
// (product pages) and the tests all import it.
//
//   line { id, style, pick: { <groupId>: <optionId> }, combo?, qty, custom }
//     │  pickOf(): fills missing or deleted choices with each group's first option;
//     │            old cart lines that only have `combo` read as { option: combo }
//     ▼
//   priceOf(p, pick)  exact price for that combination (most specific row wins), else priceFrom + Σ add
//   stockOf(p, pick)  worst of the chosen options' stock (out < made < ready); "few" when ready and count ≤ 3
//   choiceLabel()     "Single piece" for products with only the original option list (messages unchanged),
//                     else "Size: Large, Paint: Gold"
import { PALETTES, byId, isSet, variantsOf } from './products.js';
import { inr } from './money.js';

const LEGACY_GROUP = 'option';
const RANK = { out: 0, made: 1, ready: 2 };
const FROM_PRICE_LIMIT = 1000; // combinations listed one by one; above this a quick estimate is used

/** True for products whose only choice group is the original "Option" list. */
export const isLegacyChoices = (groups) => groups.length === 1 && groups[0].id === LEGACY_GROUP;

/** The chosen option per group; missing or unknown choices fall back to each group's first option. */
export function pickOf(p, line = {}) {
  const groups = variantsOf(p);
  const wanted = line.pick && typeof line.pick === 'object' ? line.pick : line.combo ? { [LEGACY_GROUP]: line.combo } : {};
  const pick = {};
  for (const g of groups) pick[g.id] = g.options.some((o) => o.id === wanted[g.id]) ? wanted[g.id] : g.options[0].id;
  return pick;
}

const optionOf = (g, pick) => g.options.find((o) => o.id === pick[g.id]) || g.options[0];

/** Exact price rows that apply to this combination: every group they name matches the pick. */
function exactPrice(p, groups, pick) {
  const rows = (Array.isArray(p.prices) ? p.prices : []).filter((r) => {
    const names = Object.entries(r?.pick || {}).filter(([, v]) => v);
    return names.length && Number.isFinite(Number(r.price))
      && names.every(([g, o]) => groups.some((x) => x.id === g && x.options.some((y) => y.id === o)) && pick[g] === o);
  });
  if (!rows.length) return null;
  // The row naming the most groups wins; on a tie, the first listed.
  const best = rows.reduce((a, r) => (Object.values(r.pick).filter(Boolean).length > Object.values(a.pick).filter(Boolean).length ? r : a));
  return Number(best.price);
}

export function priceOf(p, pick) {
  const groups = variantsOf(p);
  const exact = exactPrice(p, groups, pick);
  if (exact != null) return exact;
  return (Number(p.priceFrom) || 0) + groups.reduce((sum, g) => sum + optionOf(g, pick).add, 0);
}

/** The lowest price of any combination: shown on cards, used by price filters and sorting. */
export function fromPrice(p) {
  if (isSet(p.id)) return Number(p.price) || 0;
  const groups = variantsOf(p);
  const count = groups.reduce((n, g) => n * g.options.length, 1);
  if (count > FROM_PRICE_LIMIT) {
    const additive = (Number(p.priceFrom) || 0) + groups.reduce((s, g) => s + Math.min(...g.options.map((o) => o.add)), 0);
    const exacts = (p.prices || []).map((r) => Number(r?.price)).filter(Number.isFinite);
    return Math.min(additive, ...exacts);
  }
  let best = Infinity;
  const walk = (i, pick) => {
    if (i === groups.length) {
      best = Math.min(best, priceOf(p, pick));
      return;
    }
    for (const o of groups[i].options) walk(i + 1, { ...pick, [groups[i].id]: o.id });
  };
  walk(0, {});
  return best === Infinity ? Number(p.priceFrom) || 0 : best;
}

export function stockOf(p, pick) {
  const statuses = [];
  const counts = [];
  const base = ['made', 'ready', 'out'].includes(p.stock) ? p.stock : 'made';
  const baseCount = p.count == null || p.count === '' ? null : Number(p.count);
  const groups = variantsOf(p);
  if (!groups.length) {
    statuses.push(base);
    counts.push(baseCount);
  }
  for (const g of groups) {
    const o = optionOf(g, pick);
    statuses.push(o.stock || base);
    counts.push(o.stock ? o.count : baseCount);
  }
  const status = statuses.reduce((a, s) => (RANK[s] < RANK[a] ? s : a), 'ready');
  const known = counts.filter((c) => Number.isFinite(c));
  return { status, few: status === 'ready' && known.length > 0 && Math.min(...known) <= 3 };
}

/** The chosen options as shown in the cart, checkout and messages. */
export function choiceLabel(p, pick) {
  const groups = variantsOf(p);
  if (!groups.length) return '';
  if (isLegacyChoices(groups)) return optionOf(groups[0], pick).label;
  return groups.map((g) => `${g.name}: ${optionOf(g, pick).label}`).join(', ');
}

/** The cart key. Products with only the original option list keep the old `id|style|combo|custom` key, so carts
 *  saved before choices existed still merge into one line. */
export function lineKey(p, line) {
  const pick = pickOf(p, line);
  const groups = variantsOf(p);
  const token = isLegacyChoices(groups) ? pick[LEGACY_GROUP] : groups.map((g) => `${g.id}=${pick[g.id]}`).join(',');
  return [line.id, line.style || '', token || '', (line.custom || '').trim()].join('|');
}

export function lineInfo(line) {
  const p = byId(line.id);
  if (isSet(line.id)) return { p, unit: p.price, total: p.price * line.qty, styleLabel: null, choiceLabel: '', legacy: false, stock: { status: 'made', few: false } };
  const pick = pickOf(p, line);
  const unit = priceOf(p, pick);
  const groups = variantsOf(p);
  return {
    p, pick, unit, total: unit * line.qty,
    styleLabel: PALETTES[line.style]?.label || null,
    choiceLabel: choiceLabel(p, pick),
    legacy: isLegacyChoices(groups),
    stock: stockOf(p, pick),
  };
}

/* ---------- message lines (WhatsApp enquiry, order message, saved order detail) ---------- */

/** "1. Gach Kouto (গাছকৌটো) | Colour: Sindoor red | Option: Single piece | Qty: 1 | Est. ₹1,450" */
export function enquiryLine(line, i) {
  const { p, total, styleLabel, choiceLabel: choice, legacy } = lineInfo(line);
  const parts = [`${i + 1}. ${p.en} (${p.bn})`];
  if (styleLabel) parts.push(`Colour: ${styleLabel}`);
  if (choice) parts.push(legacy ? `Option: ${choice}` : choice);
  parts.push(`Qty: ${line.qty}`);
  if (line.custom) parts.push(`Personalise: “${line.custom}”`);
  parts.push(`Est. ${inr(total)}`);
  return parts.join(' | ');
}

/** "1. Gach Kouto | Sindoor red, Single piece | Qty 1 | ₹1,450" */
export function orderLine(line, i) {
  const { p, total, styleLabel, choiceLabel: choice } = lineInfo(line);
  return `${i + 1}. ${p.en} | ${[styleLabel, choice].filter(Boolean).join(', ')} | Qty ${line.qty}${line.custom ? ` | Personalise: “${line.custom}”` : ''} | ${inr(total)}`;
}

/** "Sindoor red, Single piece, Personalise: “Riya”" */
export function orderDetail(line) {
  const { styleLabel, choiceLabel: choice } = lineInfo(line);
  return [styleLabel, choice, line.custom ? `Personalise: “${line.custom}”` : ''].filter(Boolean).join(', ');
}

/** What customers read about availability (D6: no exact counts). */
export function stockText(p, stock) {
  if (stock.status === 'out') return 'Sold out';
  if (stock.status === 'ready') return stock.few ? 'Ready now. Only a few left.' : 'Ready now.';
  return `Made to order in about ${p.leadDays || 7} days.`;
}

/* ---------- order-by date from the customer's wedding date ----------
   orderBy = wedding − leadDays − buffer, counted in whole days on YYYY-MM-DD strings (no time zones). */
const DAY = 86400000;
const dayNum = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY : null);
const isoOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);
/** "20 Nov" */
export const shortDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
/** Today in India as YYYY-MM-DD. */
export const todayIso = (now = new Date()) => new Date(now.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);

/** The availability line, using the wedding date when the customer gave one.
 *  tone: 'ready' | 'made' | 'tight' | 'out'; prompt: true when there is no (future) wedding date yet. */
export function stockLine(p, stock, wedding, today, buffer = 2) {
  if (stock.status === 'out') return { text: 'Sold out', tone: 'out', prompt: false };
  const w = dayNum(wedding);
  const t = dayNum(today);
  if (w == null || t == null || w < t) return { text: stockText(p, stock), tone: stock.status, prompt: true };
  if (stock.status === 'ready') return { text: `Ready now, in time for ${shortDate(wedding)}.${stock.few ? ' Only a few left.' : ''}`, tone: 'ready', prompt: false };
  const by = w - (Number(p.leadDays) || 7) - (Number(buffer) || 0);
  if (t <= by) return { text: `Order by ${shortDate(isoOf(by))} for your ${shortDate(wedding)} wedding.`, tone: 'made', prompt: false };
  return { text: `Tight for ${shortDate(wedding)}: ask us on WhatsApp.`, tone: 'tight', prompt: false };
}
