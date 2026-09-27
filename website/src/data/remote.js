// Live content from the shop's admin panel (Supabase). The bundled data files stay as the
// fallback: if Supabase is not configured, slow or unreachable, the site uses them unchanged.
import { PRODUCTS, CATEGORIES, SETS, STORY, PALETTES } from './products.js';
import { SITE, PAYMENTS, TRUST, LOOKBOOK, SERVICES } from './site.js';
import { WRITTEN_REVIEWS } from './reviews.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const REMOTE_ENABLED = Boolean(URL_ && KEY);

const hasProduct = (id) => PRODUCTS.some((p) => p.id === id);

const replace = (arr, next) => {
  if (Array.isArray(next)) arr.splice(0, arr.length, ...next);
};

/** Keeps only products the site can render: a known 3D shape and at least one known colourway. */
function cleanProducts(list) {
  return list
    .filter((p) => p && p.id && p.en && !p.hidden)
    .map((p) => {
      const styles = (p.styles || []).filter((s) => PALETTES[s]);
      return {
        ...p,
        styles: styles.length ? styles : ['sindoor'],
        combos: p.combos?.length ? p.combos : [{ id: 'single', label: 'Single piece', add: 0 }],
        media: (p.media || []).filter((m) => m && m.id),
        priceFrom: Number(p.priceFrom) || 0,
        leadDays: Number(p.leadDays) || 7,
        model: p.model?.kind ? p.model : { kind: 'kunke' },
      };
    });
}

export const CONTENT_APPLY = {
  products: (d) => replace(PRODUCTS, cleanProducts(d)),
  categories: (d) => replace(CATEGORIES, [{ id: 'all', label: 'Everything' }, ...d.filter((c) => c.id && c.id !== 'all')]),
  sets: (d) => replace(SETS, d.filter((s) => s.id && !s.hidden)
    .map((s) => ({ ...s, price: Number(s.price) || 0, items: (s.items || []).filter(hasProduct) }))
    .filter((s) => s.items.length)),
  story: (d) => replace(STORY, d.filter((c) => hasProduct(c.product))),
  reviews: (d) => replace(WRITTEN_REVIEWS, d.filter((r) => r.product && r.text && !r.hidden)),
  trust: (d) => replace(TRUST, d),
  lookbook: (d) => replace(LOOKBOOK, d),
  services: (d) => replace(SERVICES, d),
  settings: (d) => {
    if (d.site) Object.assign(SITE, d.site);
    if (d.payments) {
      const { upi, bank, ...rest } = d.payments;
      Object.assign(PAYMENTS, rest);
      if (upi) Object.assign(PAYMENTS.upi, upi);
      if (bank) Object.assign(PAYMENTS.bank, bank);
    }
  },
};

/** Fetches every content document and applies it over the bundled data. Never throws. */
export async function loadRemoteContent(timeoutMs = 3500) {
  if (!REMOTE_ENABLED) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${URL_}/rest/v1/site_content?select=key,data`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    // Products first, so later documents that point at products see the live list.
    const order = Object.keys(CONTENT_APPLY);
    rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    for (const { key, data } of rows) {
      try {
        CONTENT_APPLY[key]?.(data);
      } catch (err) {
        console.warn(`[content] skipped "${key}":`, err);
      }
    }
    return true;
  } catch (err) {
    console.warn('[content] using built-in data:', err.message || err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
