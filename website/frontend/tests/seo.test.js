import { describe, it, expect } from 'vitest';
import { clip, productTitle, productDescription, categoryDescription, productSchema, breadcrumbSchema } from '../src/data/seo.js';
import { PRODUCTS, CATEGORIES, categoryPath } from '../src/data/products.js';

const p = PRODUCTS.find((x) => x.category) || PRODUCTS[0];
const cat = CATEGORIES.find((c) => c.id === p.category);

describe('clip', () => {
  it('leaves short text alone and tidies spaces', () => {
    expect(clip('  a   short   line ')).toBe('a short line');
  });
  it('cuts long text at a word break with an ellipsis, within the limit', () => {
    const out = clip('word '.repeat(80), 158);
    expect(out.length).toBeLessThanOrEqual(158);
    expect(out.endsWith('word…')).toBe(true);
  });
});

describe('product text', () => {
  it('title has the English and Bengali names, the category and the shop', () => {
    const t = productTitle(p);
    expect(t).toContain(p.en);
    expect(t).toContain(p.bn);
    if (cat) expect(t).toContain(cat.label);
    expect(t.endsWith('| Parineeta, Patuli')).toBe(true);
  });
  it('every product description fits a search result (158 characters or fewer)', () => {
    for (const x of PRODUCTS) expect(productDescription(x).length).toBeLessThanOrEqual(158);
  });
  it('a short category line is padded with what and where', () => {
    const d = categoryDescription({ line: 'Shola crowns.' }, 'Crowns');
    expect(d).toMatch(/^Shola crowns\. Hand-painted Bengali wedding pieces/);
    expect(d.length).toBeLessThanOrEqual(158);
  });
  it('a category with no line still gets a description', () => {
    expect(categoryDescription({}, 'Decor')).toMatch(/^Decor: /);
  });
});

describe('schema.org data', () => {
  it('Product has absolute URLs, a price and an availability from the stock setting', () => {
    const ld = productSchema({ ...p, stock: 'ready' }, { origin: 'https://example.com', images: ['/a.webp', '/b.webp'] });
    expect(ld['@type']).toBe('Product');
    expect(ld.url).toBe(`https://example.com/p/${p.id}/`);
    expect(ld.image).toEqual(['https://example.com/a.webp', 'https://example.com/b.webp']);
    expect(ld.offers.availability).toBe('https://schema.org/InStock');
    expect(ld.offers.seller).toEqual({ '@id': 'https://example.com/#store' });
    expect(productSchema({ ...p, stock: 'out' }).offers.availability).toBe('https://schema.org/OutOfStock');
    expect(productSchema({ ...p, stock: 'made' }).offers.availability).toBe('https://schema.org/MadeToOrder');
  });
  it('breadcrumbs run Home, category, product', () => {
    const b = breadcrumbSchema('https://example.com', { category: p.category, product: p });
    const names = b.itemListElement.map((i) => i.name);
    expect(names[0]).toBe('Home');
    expect(names.at(-1)).toBe(p.en);
    if (cat) expect(b.itemListElement.some((i) => i.item === `https://example.com${categoryPath(cat)}`)).toBe(true);
    expect(b.itemListElement.map((i) => i.position)).toEqual(names.map((_, i) => i + 1));
  });
});

describe('blank Bengali names and saved categories', () => {
  it('no empty brackets when the Bengali name is blank, and spaces are tidied', async () => {
    const { bothNames } = await import('../src/data/seo.js');
    expect(bothNames({ en: 'gach   kouto 2', bn: '' })).toBe('gach kouto 2');
    expect(productTitle({ ...p, bn: '' })).not.toContain('()');
    expect(productSchema({ ...p, bn: '' }).alternateName).toBeUndefined();
  });
  it('a category saved before "About" existed gets the built-in paragraph; a written one is kept', async () => {
    const { DEFAULT_CATEGORY_ABOUT } = await import('../src/data/products.js');
    const { applyAll } = await import('../src/cms/apply.js');
    const id = Object.keys(DEFAULT_CATEGORY_ABOUT)[0];
    applyAll({ categories: [{ id, label: 'Renamed' }, { id: 'x-new', label: 'New', about: 'Ours.' }] });
    expect(CATEGORIES.find((c) => c.id === id).about).toBe(DEFAULT_CATEGORY_ABOUT[id]);
    expect(CATEGORIES.find((c) => c.id === 'x-new').about).toBe('Ours.');
  });
});
