// Search, filters and the address (shop catalogue, phase 2). Uses the bundled products and categories,
// plus a sub-category added for the category tests.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PRODUCTS, CATEGORIES, parentOf, inCategory } from '../src/data/products.js';
import { normalise, fold, near, buildIndex, search, readState, writeState, applyFilters, emptyState, readyAny, isRefined, filterCount, subOptions } from '../src/ui/catalogue.js';

const ids = (list) => list.map((p) => p.id);
let index;
beforeAll(() => { index = buildIndex(PRODUCTS); });

describe('search', () => {
  it.each(['topar', 'টোপর', 'topr', 'TOPOR ', 'groom crown'])('"%s" finds the Topor', (q) => {
    expect(ids(search(index, q))[0]).toBe('topor');
  });
  it.each([['mukoot', 'shola-mukut'], ['kauto', 'gach-kouto'], ['panjabi', 'punjabi'], ['kunki', 'kunke'], ['dorpon', 'darpan'], ['পিঁড়ি', 'biyer-piri']])('"%s" finds %s', (q, id) => {
    expect(ids(search(index, q))).toContain(id);
  });
  it('matches a word as it is being typed', () => {
    expect(ids(search(index, 'mir'))).toContain('darpan'); // "mirror"
  });
  it('needs every word to match', () => {
    expect(search(index, 'topor zzzzzz')).toEqual([]);
  });
  it('puts an exact name first', () => {
    expect(ids(search(index, 'kunke'))[0]).toBe('kunke');
  });
  it('treats code-like input as plain words and finds nothing', () => {
    expect(search(index, '<img src=x onerror=alert(1)>')).toEqual([]);
    expect(normalise('<b>Topor</b>')).toBe('b topor b');
  });
  it('folds common spellings together', () => {
    expect(fold('kouto')).toBe(fold('kauto'));
    expect(fold('mukoot')).toBe('mukut');
    expect(near('topar', 'topor', 1)).toBe(true);
    expect(near('topor', 'kunke', 1)).toBe(false);
  });
  it('ignores zero-width joiners in Bengali', () => {
    expect(normalise('টো‍পর')).toBe(normalise('টোপর'));
  });
});

describe('address state', () => {
  it('round-trips every filter and keeps other parameters', () => {
    const st = { ...emptyState(), q: 'topor', cat: 'crown', min: 500, max: 3000, ready: true, sort: 'price-asc' };
    const qs = writeState(st, 'view=3d');
    expect(qs).toContain('view=3d');
    expect(readState(`?${qs}`)).toEqual(st);
  });
  it('ignores unknown categories, bad numbers and unknown sorts', () => {
    expect(readState('?cat=nope&min=abc&max=-5&sort=random')).toEqual(emptyState());
  });
  it('swaps a reversed price range', () => {
    const st = readState('?min=3000&max=500');
    expect([st.min, st.max]).toEqual([500, 3000]);
  });
  it('knows when the flat results list is needed', () => {
    expect(isRefined({ ...emptyState(), cat: 'crown' })).toBe(false);
    expect(isRefined({ ...emptyState(), sort: 'new' })).toBe(true);
    expect(filterCount({ ...emptyState(), min: 1, ready: true })).toBe(2);
  });
});

describe('sub-categories and filters', () => {
  const sub = { id: 'test-bride-crowns', label: 'Bridal crowns', parent: 'crown' };
  beforeAll(() => {
    CATEGORIES.push(sub);
    PRODUCTS.find((p) => p.id === 'shola-mukut').category = sub.id;
  });
  afterAll(() => {
    CATEGORIES.splice(CATEGORIES.indexOf(sub), 1);
    PRODUCTS.find((p) => p.id === 'shola-mukut').category = 'crown';
  });

  it('a main category includes its sub-categories', () => {
    expect(parentOf(sub.id)).toBe('crown');
    const crowns = ids(applyFilters({ ...emptyState(), cat: 'crown' }, index));
    expect(crowns).toEqual(expect.arrayContaining(['topor', 'shola-mukut']));
    expect(inCategory(PRODUCTS.find((p) => p.id === 'shola-mukut'), 'crown')).toBe(true);
  });
  it('a sub-category shows only its own products', () => {
    expect(ids(applyFilters({ ...emptyState(), cat: 'crown', sub: sub.id }, index))).toEqual(['shola-mukut']);
    expect(readState(`?sub=${sub.id}`).cat).toBe('crown');
    expect(subOptions('crown').map((c) => c.id)).toEqual([sub.id]);
  });
  it('a sub-category nested two deep is ignored (one level only)', () => {
    const deep = { id: 'test-deep', label: 'Deep', parent: sub.id };
    CATEGORIES.push(deep);
    expect(parentOf('test-deep')).toBe(null);
    CATEGORIES.splice(CATEGORIES.indexOf(deep), 1);
  });
  it('filters by "from" price and sorts', () => {
    const cheap = applyFilters({ ...emptyState(), max: 500 }, index);
    expect(cheap.length).toBeGreaterThan(0);
    const asc = applyFilters({ ...emptyState(), sort: 'price-asc' }, index);
    expect(asc.length).toBe(PRODUCTS.length);
  });
  it('"Ready now" needs a ready combination', () => {
    expect(readyAny({ stock: 'ready', variants: [] })).toBe(true);
    expect(readyAny({ stock: 'made', variants: [{ id: 'size', name: 'Size', options: [{ id: 's', label: 'S', stock: 'ready' }, { id: 'l', label: 'L' }] }] })).toBe(true);
    expect(readyAny({ stock: 'ready', variants: [{ id: 'size', name: 'Size', options: [{ id: 's', label: 'S', stock: 'out' }] }] })).toBe(false);
  });
});

describe('published products without "Other names"', () => {
  it('use the built-in search words, unless cleared on purpose', async () => {
    const { CONTENT_APPLY } = await import('../src/cms/apply.js');
    const saved = PRODUCTS.map((p) => ({ ...p }));
    const published = saved.map(({ aliases, ...p }) => p);
    published.find((p) => p.id === 'kunke').aliases = '';
    CONTENT_APPLY.products(published);
    expect(PRODUCTS.find((p) => p.id === 'topor').aliases).toContain('topar');
    expect(PRODUCTS.find((p) => p.id === 'kunke').aliases).toBe('');
    PRODUCTS.splice(0, PRODUCTS.length, ...saved);
  });
});

describe('category pages', () => {
  it('use the English name in the address, never the internal code', async () => {
    const { CATEGORIES: cats, categoryPath, categoryBySlug } = await import('../src/data/products.js');
    const thala = cats.find((c) => c.id === 'clay');
    expect(categoryPath(thala)).toBe('/c/thala-sets/');
    expect(categoryBySlug('thala-sets').id).toBe('clay');
    expect(cats.filter((c) => c.id !== 'all').map(categoryPath).join(' ')).not.toMatch(/clay/i);
  });

  it('keep their address when the shop renames a category, and the newer name still opens it', async () => {
    const { CATEGORIES: cats, categoryPath, categoryBySlug, categoryAliasSlug } = await import('../src/data/products.js');
    const ritual = cats.find((c) => c.id === 'ritual');
    const was = ritual.label;
    ritual.label = 'Gach kouto';
    expect(categoryPath(ritual)).toBe('/c/wedding-rituals/');
    expect(categoryBySlug('wedding-rituals').id).toBe('ritual');
    expect(categoryAliasSlug(ritual)).toBe('gach-kouto');
    expect(categoryBySlug('gach-kouto').id).toBe('ritual');
    ritual.label = was;
    expect(categoryAliasSlug(ritual)).toBe(null);
  });

  it('a category added in the admin gets its address from its code, not its name', async () => {
    const { CATEGORIES: cats, categoryPath, categoryBySlug, categoryAliasSlug } = await import('../src/data/products.js');
    const added = { id: 'darpan', label: 'Mirrors and trays' };
    cats.push(added);
    expect(categoryPath(added)).toBe('/c/darpan/');
    expect(categoryBySlug('darpan')).toBe(added);
    expect(categoryBySlug('mirrors-and-trays')).toBe(added);
    // A name that would collide with another category's address is not used as a second address.
    added.label = 'Crowns';
    expect(categoryAliasSlug(added)).toBe(null);
    expect(categoryBySlug('crowns').id).toBe('crown');
    cats.pop();
  });
});
