// Choices, prices, stock, cart lines and order messages (phase 1 of the shop catalogue plan).
//
//   fixtures: the bundled products (old option lists) + two test products pushed into PRODUCTS:
//     multi  – Size (small/large) × Paint (red/gold), exact price for Large+Gold, Gold sold out on one test
//     stocky – no choices, ready with a count
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRODUCTS, variantsOf } from '../src/data/products.js';
import { priceOf, fromPrice, stockOf, pickOf, lineKey, lineInfo, choiceLabel, enquiryLine, orderLine, orderDetail, stockText } from '../src/data/pricing.js';
import { mergeCarts, replaceState, store, onDropped } from '../src/ui/store.js';

const legacy = JSON.parse(readFileSync(new URL('./legacy-messages.json', import.meta.url), 'utf8'));

const multi = {
  id: 'test-multi', en: 'Test Kouto', bn: 'টেস্ট', priceFrom: 1000, leadDays: 5, styles: ['sindoor'], stock: 'made',
  variants: [
    { id: 'size', name: 'Size', options: [{ id: 'small', label: 'Small', add: 0 }, { id: 'large', label: 'Large', add: 300 }] },
    { id: 'paint', name: 'Paint', options: [{ id: 'red', label: 'Red', add: 0 }, { id: 'gold', label: 'Gold', add: 150 }] },
  ],
  prices: [{ pick: { size: 'large' }, price: 1250 }, { pick: { size: 'large', paint: 'gold' }, price: 2200 }],
};
const stocky = { id: 'test-ready', en: 'Ready Piece', bn: 'রেডি', priceFrom: 500, styles: ['sindoor'], stock: 'ready', count: 2, variants: [] };

beforeAll(() => PRODUCTS.push(multi, stocky));
afterAll(() => PRODUCTS.splice(PRODUCTS.indexOf(multi), 2));

describe('variantsOf (one shared conversion)', () => {
  it.each([
    ['old option list only', { combos: [{ id: 'single', label: 'Single piece', add: 0 }, { id: 'pair', label: 'Pair', add: 340 }] }, ['option'], [['single', 'pair']]],
    ['choice groups only', { variants: [{ id: 'size', name: 'Size', options: [{ id: 's', label: 'S' }] }] }, ['size'], [['s']]],
    ['both: choice groups win', { combos: [{ id: 'x', label: 'X' }], variants: [{ id: 'size', name: 'Size', options: [{ id: 's', label: 'S' }] }] }, ['size'], [['s']]],
    ['neither', {}, [], []],
  ])('%s', (_, p, groupIds, optionIds) => {
    const g = variantsOf(p);
    expect(g.map((x) => x.id)).toEqual(groupIds);
    expect(g.map((x) => x.options.map((o) => o.id))).toEqual(optionIds);
  });

  it('fills missing codes from names and keeps them unique', () => {
    const g = variantsOf({ variants: [{ name: 'Size', options: [{ label: 'Big One' }, { label: 'Big One' }] }, { name: 'Size', options: [{ label: 'A' }] }] });
    expect(g.map((x) => x.id)).toEqual(['size', 'size-2']);
    expect(g[0].options.map((o) => o.id)).toEqual(['big-one', 'big-one-2']);
  });
});

describe('prices', () => {
  it('adds each choice to the base price', () => {
    expect(priceOf(multi, { size: 'small', paint: 'gold' })).toBe(1150);
  });
  it('uses an exact price for a matching combination; the most specific row wins', () => {
    expect(priceOf(multi, { size: 'large', paint: 'red' })).toBe(1250);
    expect(priceOf(multi, { size: 'large', paint: 'gold' })).toBe(2200);
  });
  it('falls back to the first option when a chosen option no longer exists', () => {
    const pick = pickOf(multi, { pick: { size: 'gone', paint: 'gold' } });
    expect(pick).toEqual({ size: 'small', paint: 'gold' });
  });
  it('ignores exact prices that point at deleted options', () => {
    expect(priceOf({ ...multi, prices: [{ pick: { size: 'gone' }, price: 1 }] }, { size: 'small', paint: 'red' })).toBe(1000);
  });
  it('"from" price is the cheapest combination, exact prices included', () => {
    expect(fromPrice(multi)).toBe(1000);
    expect(fromPrice({ ...multi, prices: [{ pick: { size: 'small', paint: 'red' }, price: 900 }] })).toBe(900);
  });
  it('"from" price stays fast for huge choice sets (6 groups × 6 options)', () => {
    const big = { id: 'big', priceFrom: 100, variants: Array.from({ length: 6 }, (_, g) => ({ id: `g${g}`, name: `G${g}`, options: Array.from({ length: 6 }, (_, o) => ({ id: `o${o}`, label: `O${o}`, add: o * 10 + 5 })) })) };
    const t = performance.now();
    expect(fromPrice(big)).toBe(100 + 6 * 5);
    expect(performance.now() - t).toBeLessThan(50);
  });
});

describe('stock', () => {
  it('is the worst of the chosen options (sold out < made to order < ready)', () => {
    const p = { ...multi, stock: 'ready', variants: [multi.variants[0], { ...multi.variants[1], options: [{ id: 'red', label: 'Red' }, { id: 'gold', label: 'Gold', stock: 'out' }] }] };
    expect(stockOf(p, { size: 'small', paint: 'red' }).status).toBe('ready');
    expect(stockOf(p, { size: 'small', paint: 'gold' }).status).toBe('out');
  });
  it('says "only a few" at 3 or fewer, never the number', () => {
    expect(stockOf({ ...stocky, count: 3 }, {})).toEqual({ status: 'ready', few: true });
    expect(stockOf({ ...stocky, count: 4 }, {})).toEqual({ status: 'ready', few: false });
    expect(stockText(stocky, stockOf(stocky, {}))).toBe('Ready now. Only a few left.');
  });
});

describe('old carts (saved before choices existed)', () => {
  it.each(legacy.map((g) => [g.line.id, g]))('%s keeps its total', (_, g) => {
    expect(lineInfo(g.line).total).toBe(g.total);
  });
  it('keeps the old cart key for products with only the original option list', () => {
    const p = PRODUCTS.find((x) => x.id === 'kunke');
    expect(lineKey(p, { id: 'kunke', style: 'sindoor', combo: 'pair', custom: '' })).toBe('kunke|sindoor|pair|');
  });
  it('merges an old-format line and a new-format line for the same choice into one line', () => {
    const old = { id: 'kunke', style: 'sindoor', combo: 'pair', custom: '', qty: 2, key: 'kunke|sindoor|pair|' };
    const fresh = { id: 'kunke', style: 'sindoor', pick: { option: 'pair' }, custom: '', qty: 1 };
    const { cart } = mergeCarts({ cart: [old] }, { cart: [fresh] });
    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(2);
    expect(cart[0].combo).toBe('pair'); // still written for pages opened before the update
  });
  it('drops unreadable saved lines and reports them', () => {
    let reported = 0;
    onDropped((n) => { reported += n; });
    replaceState({ cart: [{ id: 'no-such-product', qty: 1 }, { id: 'kunke', style: 'sindoor', combo: 'pair', qty: 1 }], wish: [] });
    expect(store.cart).toHaveLength(1);
    expect(reported).toBe(1);
  });
});

describe('order and WhatsApp messages (eng D4: exact text)', () => {
  afterEach(() => replaceState({ cart: [], wish: [] }));
  it.each(legacy.map((g, i) => [i + 1, g]))('old single-option line %i is byte-identical to before', (_, g) => {
    const i = legacy.indexOf(g);
    expect(enquiryLine(g.line, i)).toBe(g.enquiry);
    expect(orderLine(g.line, i)).toBe(g.order);
    expect(orderDetail(g.line)).toBe(g.detail);
  });
  it('a two-choice line names each choice', () => {
    const line = { id: 'test-multi', style: 'sindoor', pick: { size: 'small', paint: 'gold' }, qty: 1, custom: '' };
    expect(choiceLabel(multi, line.pick)).toBe('Size: Small, Paint: Gold');
    expect(enquiryLine(line, 0)).toBe('1. Test Kouto (টেস্ট) | Colour: Sindoor red | Size: Small, Paint: Gold | Qty: 1 | Est. ₹1,150');
    expect(orderLine(line, 0)).toBe('1. Test Kouto | Sindoor red, Size: Small, Paint: Gold | Qty 1 | ₹1,150');
  });
  it('an exact-price combination uses that price', () => {
    const line = { id: 'test-multi', style: 'sindoor', pick: { size: 'large', paint: 'gold' }, qty: 2, custom: '' };
    expect(orderLine(line, 0)).toBe('1. Test Kouto | Sindoor red, Size: Large, Paint: Gold | Qty 2 | ₹4,400');
  });
  it('a personalised line keeps the personalisation', () => {
    const line = { id: 'test-multi', style: 'sindoor', pick: { size: 'large', paint: 'red' }, qty: 1, custom: 'Riya & Arjun' };
    expect(orderDetail(line)).toBe('Sindoor red, Size: Large, Paint: Red, Personalise: “Riya & Arjun”');
    expect(enquiryLine(line, 2)).toBe('3. Test Kouto (টেস্ট) | Colour: Sindoor red | Size: Large, Paint: Red | Qty: 1 | Personalise: “Riya & Arjun” | Est. ₹1,250');
  });
});
