// Applies published admin content over the bundled defaults in src/data. Runs at build time
// (product pages), on page load (published.json baked into the bundle) and in admin preview.
import { PRODUCTS, CATEGORIES, SETS, STORY, PALETTES, variantsOf, DEFAULT_ALIASES, DEFAULT_CATEGORY_ABOUT } from '../data/products.js';
import { SITE, PAYMENTS, TRUST, LOOKBOOK, SERVICES } from '../data/site.js';
import { WRITTEN_REVIEWS } from '../data/reviews.js';
import { ANNOUNCEMENT } from '../data/announcement.js';
import { HOMEPAGE, SOCIALS, STORES, VIDEOS, SEO, BANNERS } from '../data/homepage.js';
import { MODELS } from '../data/shapes.js';

const hasProduct = (id) => PRODUCTS.some((p) => p.id === id);

const replace = (arr, next) => {
  if (Array.isArray(next)) arr.splice(0, arr.length, ...next);
};

/** Keeps only products the site can render: a name, a code and at least one known colourway (3D is optional). */
function cleanProducts(list) {
  return list
    .filter((p) => p && p.id && p.en && !p.hidden)
    .map((p) => {
      const styles = (p.styles || []).filter((s) => PALETTES[s]);
      return {
        ...p,
        styles: styles.length ? styles : ['sindoor'],
        // Choices: the admin's choice groups, or the original option list as one group (see variantsOf).
        variants: variantsOf(p),
        prices: (Array.isArray(p.prices) ? p.prices : []).filter((r) => r && r.pick && typeof r.pick === 'object' && Number.isFinite(Number(r.price))),
        stock: ['made', 'ready', 'out'].includes(p.stock) ? p.stock : 'made',
        aliases: p.aliases ?? DEFAULT_ALIASES[p.id] ?? '',
        media: (p.media || []).filter((m) => m && m.id),
        priceFrom: Number(p.priceFrom) || 0,
        leadDays: Number(p.leadDays) || 7,
        model: p.model?.kind ? p.model : { kind: 'none' }, // no 3D chosen: photos and films only
      };
    });
}

export const CONTENT_APPLY = {
  models: (d) => {
    replace(MODELS.off, (d?.off || []).filter((k) => typeof k === 'string'));
    replace(MODELS.custom, (d?.custom || []).filter((m) => m && m.id && m.file));
  },
  products: (d) => replace(PRODUCTS, cleanProducts(d)),
  categories: (d) => replace(CATEGORIES, [{ id: 'all', label: 'Everything' }, ...d.filter((c) => c.id && c.id !== 'all')
    .map((c) => (c.about == null && DEFAULT_CATEGORY_ABOUT[c.id] ? { ...c, about: DEFAULT_CATEGORY_ABOUT[c.id] } : c))]),
  sets: (d) => replace(SETS, d.filter((s) => s.id && !s.hidden)
    .map((s) => ({ ...s, price: Number(s.price) || 0, items: (s.items || []).filter(hasProduct) }))
    .filter((s) => s.items.length)),
  story: (d) => replace(STORY, d.filter((c) => hasProduct(c.product))),
  reviews: (d) => replace(WRITTEN_REVIEWS, d.filter((r) => r.product && r.text && !r.hidden)),
  trust: (d) => replace(TRUST, d),
  lookbook: (d) => replace(LOOKBOOK, d),
  services: (d) => replace(SERVICES, d),
  announcement: (d) => Object.assign(ANNOUNCEMENT, d),
  homepage: (d) => {
    for (const [k, v] of Object.entries(d || {})) if (v && typeof v === 'object' && HOMEPAGE[k]) Object.assign(HOMEPAGE[k], v);
  },
  stores: (d) => replace(STORES, d.filter((s) => s && (s.name || s.address))),
  socials: (d) => replace(SOCIALS, d.filter((s) => s && s.platform && s.url)),
  videos: (d) => replace(VIDEOS, d.filter((v) => v && v.youtubeId)),
  // Banners that have ended are dropped here; the start date is checked in the browser (ui/home.js).
  banners: (d) => {
    const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
    replace(BANNERS, d.filter((b) => b && b.photo && b.title && !b.hidden && !(b.end && b.end < today)));
  },
  seo: (d) => Object.assign(SEO, d),
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

/** Applies {key: data} documents over the bundled data. One bad document never blocks the rest. */
export function applyAll(docs) {
  const applied = [];
  // Products first, so documents that point at products see the published list.
  for (const key of Object.keys(CONTENT_APPLY)) {
    if (docs?.[key] == null) continue;
    try {
      CONTENT_APPLY[key](docs[key]);
      applied.push(key);
    } catch (err) {
      console.warn(`[content] kept defaults for "${key}":`, err);
    }
  }
  return applied;
}
