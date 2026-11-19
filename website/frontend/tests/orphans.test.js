// A product whose collection was deleted in the admin must still reach the storefront.
import { describe, it, expect } from 'vitest';
import { applyAll } from '../src/cms/apply.js';
import { PRODUCTS, CATEGORIES } from '../src/data/products.js';

describe('products in a deleted collection', () => {
  it('show under "More pieces" instead of vanishing', () => {
    applyAll({
      categories: [{ id: 'decor', label: 'Decor' }],
      products: [
        { id: 'veil', en: 'Wedding Veil', category: 'ritual', priceFrom: 4499, styles: ['sindoor'] },
        { id: 'kajol', en: 'Kajollota', category: 'decor', priceFrom: 399, styles: ['sindoor'] },
      ],
    });
    expect(PRODUCTS.map((p) => [p.id, p.category])).toEqual([['veil', 'more'], ['kajol', 'decor']]);
    expect(CATEGORIES.map((c) => c.id)).toEqual(['all', 'decor', 'more']);
  });
  it('adds nothing when every product has a collection', () => {
    applyAll({ categories: [{ id: 'decor', label: 'Decor' }], products: [{ id: 'kajol', en: 'Kajollota', category: 'decor', priceFrom: 399, styles: ['sindoor'] }] });
    expect(CATEGORIES.map((c) => c.id)).toEqual(['all', 'decor']);
  });
});
