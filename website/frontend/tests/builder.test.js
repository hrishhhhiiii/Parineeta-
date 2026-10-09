// The product builder's grid: which products sit next to the active one, and in what order.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CATEGORIES } from '../src/data/products.js';
import { builderProducts, defaultLine } from '../src/data/builder.js';

const P = (id, category, extra = {}) => ({ id, en: id, category, styles: ['sindoor'], ...extra });

// A parent (Rituals) with a sub-category (Biyer Piri), plus an unrelated category (Crowns).
const cats = [
  { id: 'rituals-t', label: 'Wedding rituals' },
  { id: 'piri-t', label: 'Biyer Piri', parent: 'rituals-t' },
  { id: 'crowns-t', label: 'Crowns' },
];
const list = [
  P('kouto', 'rituals-t'),
  P('piri-lotus', 'piri-t'),
  P('mukut', 'crowns-t'),
  P('piri-peacock', 'piri-t'),
  P('piri-old', 'piri-t', { hidden: true }),
  P('darpan', 'rituals-t'),
  P('topor', 'crowns-t'),
];

beforeAll(() => CATEGORIES.push(...cats));
afterAll(() => cats.forEach(() => CATEGORIES.pop()));

describe('builderProducts', () => {
  it('puts the active product first, then its sub-category, then the parent category, then the rest', () => {
    const { items, family, title } = builderProducts(list[3], list); // piri-peacock
    expect(items.map((x) => x.id)).toEqual(['piri-peacock', 'piri-lotus', 'kouto', 'darpan', 'mukut', 'topor']);
    expect(family).toBe(4);
    expect(title).toBe('Biyer Piri');
  });

  it('a product in a parent category includes its sub-categories in the family', () => {
    const { items, family, title } = builderProducts(list[0], list); // kouto, in Rituals
    expect(items.map((x) => x.id)).toEqual(['kouto', 'darpan', 'piri-lotus', 'piri-peacock', 'mukut', 'topor']);
    expect(family).toBe(4);
    expect(title).toBe('Wedding rituals');
  });

  it('leaves out hidden products', () => {
    const ids = builderProducts(list[1], list).items.map((x) => x.id);
    expect(ids).not.toContain('piri-old');
  });

  it('caps the grid at 12', () => {
    const many = Array.from({ length: 20 }, (_, i) => P(`x${i}`, 'crowns-t'));
    const { items, family } = builderProducts(many[5], many);
    expect(items).toHaveLength(12);
    expect(items[0].id).toBe('x5');
    expect(family).toBe(12);
  });

  it('a product whose category no longer exists still opens, with the collection after it', () => {
    const lost = P('lost', 'gone');
    const { items, family, title } = builderProducts(lost, [lost, ...list]);
    expect(items[0].id).toBe('lost');
    expect(family).toBe(1);
    expect(title).toBe('');
    expect(items.map((x) => x.id)).toEqual(['lost', 'kouto', 'piri-lotus', 'mukut', 'piri-peacock', 'darpan', 'topor']);
  });
});

describe('defaultLine', () => {
  it('uses the first colourway and the first available choices, quantity 1, nothing personalised', () => {
    const p = P('piri-lotus', 'piri-t', { styles: ['haldi', 'sindoor'] });
    expect(defaultLine(p, () => ({ size: 'small' }))).toEqual({ id: 'piri-lotus', style: 'haldi', pick: { size: 'small' }, custom: '', qty: 1 });
  });
});
