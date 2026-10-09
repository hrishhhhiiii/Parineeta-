// Search-engine text and schema.org data for product and category pages. Shared by the build
// (build/product-pages.js writes it into /p/ and /c/ pages) and the browser (the product page and router
// keep it current when the visitor moves between products), so both always say the same thing.
import { CATEGORIES, categoryPath, parentOf } from './products.js';
import { fromPrice, stockOf, pickOf } from './pricing.js';

const PLACE = 'Patuli, West Bengal';

/** Shortens text to about `max` characters at a word break, for meta descriptions (Google shows ~155). */
export function clip(text, max = 158) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const end = cut.lastIndexOf(' ');
  return `${(end > max * 0.6 ? cut.slice(0, end) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

export const categoryLabel = (p) => CATEGORIES.find((c) => c.id === p.category)?.label || '';

/** "Darpan (দর্পণ), Wedding rituals | Parineeta, Patuli" */
export function productTitle(p) {
  const cat = categoryLabel(p);
  return `${p.en} (${p.bn})${cat ? `, ${cat}` : ''} | Parineeta, Patuli`;
}

/** The product's one-liner and story, ending with where it is made when there is room. */
export function productDescription(p) {
  const base = `${p.line} ${p.story}`.trim();
  const full = `${base} Hand-painted to order in ${PLACE}.`;
  return clip(full.length <= 158 ? full : base);
}

/** A category's own line, padded out with what and where when it is short. */
export function categoryDescription(c, name) {
  const line = String(c.line || '').trim();
  const tail = `Hand-painted Bengali wedding pieces from Parineeta, made to order in ${PLACE}.`;
  if (!line) return clip(`${name}: ${tail}`);
  return clip(line.length < 110 ? `${line.replace(/[.\s]*$/, '.')} ${tail}` : line);
}

const AVAILABILITY = { ready: 'InStock', made: 'MadeToOrder', out: 'OutOfStock' };

/** schema.org Product. `origin` is the site address (no trailing slash); `images` are site paths or URLs. */
export function productSchema(p, { origin = '', images = [] } = {}) {
  const abs = (u) => (origin && !/^https?:\/\//.test(u) ? origin + u : u);
  const url = abs(`/p/${p.id}/`);
  const price = fromPrice(p);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    ...(origin ? { '@id': `${url}#product`, url } : {}),
    name: p.en,
    alternateName: p.bn,
    sku: p.id,
    description: p.story || p.line,
    ...(categoryLabel(p) ? { category: categoryLabel(p) } : {}),
    brand: { '@type': 'Brand', name: 'Parineeta' },
    image: images.length > 1 ? images.map(abs) : abs(images[0] || '/brand/og-image.jpg'),
    ...(price ? {
      offers: {
        '@type': 'Offer',
        priceCurrency: 'INR',
        price,
        availability: `https://schema.org/${AVAILABILITY[stockOf(p, pickOf(p)).status] || 'MadeToOrder'}`,
        seller: origin ? { '@id': `${origin}/#store` } : { '@type': 'Organization', name: 'Parineeta' },
        ...(origin ? { url } : {}),
      },
    } : {}),
  };
}

/** Home › (parent ›) category › product, as schema.org BreadcrumbList. */
export function breadcrumbSchema(origin, { category, product } = {}) {
  const abs = (u) => (origin ? origin + u : u);
  const trail = [{ name: 'Home', url: abs('/') }];
  const cat = category && CATEGORIES.find((c) => c.id === category);
  const parent = cat && CATEGORIES.find((c) => c.id === parentOf(cat.id));
  if (parent) trail.push({ name: parent.label, url: abs(categoryPath(parent)) });
  if (cat) trail.push({ name: cat.label, url: abs(categoryPath(cat)) });
  if (product) trail.push({ name: product.en, url: abs(`/p/${product.id}/`) });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: t.url })),
  };
}
