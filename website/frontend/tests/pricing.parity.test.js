// The website and the database must price a piece the same way.
//
//   website:  src/data/pricing.js            priceOf(p, pickOf(p, line))
//   database: migrations/018_order_totals.sql  _unit_price(products, sets, line)   (prices every order)
//
// This runs the database's own function (read from the migration file) in an in-memory Postgres and
// compares it with the website for every combination of every product: the built-in catalogue, the
// last published catalogue, and edge cases. If a pricing rule changes on one side only, this fails.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PRODUCTS, SETS, variantsOf } from '../src/data/products.js';
import { priceOf, pickOf } from '../src/data/pricing.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../../database/migrations/018_order_totals.sql');
// The last published catalogue is fetched at build time and is not in the repository, so it may be missing (e.g. on GitHub).
const publishedFile = new URL('../src/data/published.json', import.meta.url);
const published = existsSync(publishedFile) ? JSON.parse(readFileSync(publishedFile, 'utf8')).docs || {} : {};

// Only the two pricing functions: everything from _num up to submit_order.
const start = migration.indexOf('create or replace function public._num');
const end = migration.indexOf('create or replace function public.submit_order');
const pricingSql = migration.slice(start, end);

const edgeCases = [
  { id: 'edge-multi', en: 'Two groups, exact prices', priceFrom: 1000,
    variants: [
      { id: 'size', name: 'Size', options: [{ id: 'small', label: 'Small', add: 0 }, { id: 'large', label: 'Large', add: 300 }] },
      { id: 'paint', name: 'Paint', options: [{ id: 'red', label: 'Red', add: 0 }, { id: 'gold', label: 'Gold', add: 150 }] },
    ],
    prices: [{ pick: { size: 'large' }, price: 1250 }, { pick: { size: 'large', paint: 'gold' }, price: 2200 }] },
  { id: 'edge-tie', en: 'Two rows naming one group each', priceFrom: 500,
    variants: [
      { id: 'a', name: 'A', options: [{ id: 'x', label: 'X', add: 10 }, { id: 'y', label: 'Y', add: 20 }] },
      { id: 'b', name: 'B', options: [{ id: 'p', label: 'P', add: 1 }, { id: 'q', label: 'Q', add: 2 }] },
    ],
    prices: [{ pick: { a: 'y' }, price: 900 }, { pick: { b: 'q' }, price: 800 }] },
  { id: 'edge-blank-cells', en: 'Blank cells and bad rows', priceFrom: '750',
    variants: [{ id: 'size', name: 'Size', options: [{ id: 's', label: 'S', add: '0' }, { id: 'l', label: 'L', add: '120' }] }],
    prices: [{ pick: { size: '' }, price: 1 }, { pick: { size: 'l' }, price: 'abc' }, { pick: { size: 'gone' }, price: 5 }, { pick: { colour: 'red' }, price: 6 }] },
  { id: 'edge-old-list', en: 'Original option list', priceFrom: 1450,
    combos: [{ id: 'single', label: 'Single piece', add: 0 }, { id: 'pair', label: 'Pair', add: 340 }] },
  { id: 'edge-plain', en: 'No choices', priceFrom: 620, variants: [] },
  { id: 'edge-no-price', en: 'No starting price', variants: [{ id: 'size', name: 'Size', options: [{ id: 's', label: 'S' }, { id: 'l', label: 'L', add: 50 }] }] },
];

// A choice saved without a code gets one made up in the browser, which the database can't match:
// it answers "can't price this" (the order is then marked "could not check this total").
const needsBrowserIds = (p) => (Array.isArray(p.variants) && p.variants.length ? p.variants : [])
  .some((g) => g && Array.isArray(g.options) && g.options.length && (!g.id || g.options.some((o) => o && !o.id)));

function everyPick(p) {
  const groups = variantsOf(p);
  let picks = [{}];
  for (const g of groups) picks = picks.flatMap((pk) => g.options.map((o) => ({ ...pk, [g.id]: o.id }))).slice(0, 400);
  // Also: nothing chosen, a choice that no longer exists, and an old cart line that only has `combo`.
  return [...picks.map((pick) => ({ pick })), {}, { pick: Object.fromEntries(groups.map((g) => [g.id, 'no-such-option'])) }, { combo: groups[0]?.options.at(-1)?.id }];
}

let db;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(pricingSql);
});
afterAll(() => db?.close());

async function databasePrices(products, sets, lines) {
  const { rows } = await db.query(
    `select public._unit_price($1::jsonb, $2::jsonb, l)::float8 as price
       from jsonb_array_elements($3::jsonb) with ordinality t(l, n) order by n`,
    [JSON.stringify(products), JSON.stringify(sets), JSON.stringify(lines)]);
  return rows.map((r) => r.price);
}

describe('the database prices orders exactly as the website does', () => {
  it('the migration still contains the pricing functions', () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });

  const catalogues = [
    ['built-in products', PRODUCTS.slice()],
    ['last published products', Array.isArray(published.products) ? published.products : []],
    ['edge cases', edgeCases],
  ];

  it.each(catalogues)('%s: every combination', async (_, products) => {
    let compared = 0;
    for (const p of products.filter((x) => x && x.id && x.en && !x.hidden)) {
      const lines = everyPick(p).map((l) => ({ id: p.id, ...l }));
      // The checkout sends the filled-in choice (pickOf), never the raw cart line.
      const sent = lines.map((l) => ({ id: p.id, pick: pickOf(p, l) }));
      const fromDb = await databasePrices(products, [], sent);
      lines.forEach((l, i) => {
        const website = priceOf(p, pickOf(p, l));
        if (needsBrowserIds(p)) expect(fromDb[i], `${p.id}: a choice without a code can't be priced by the database`).toBeNull();
        else expect(fromDb[i], `${p.id} ${JSON.stringify(sent[i].pick)}`).toBe(website);
        compared += 1;
      });
    }
    if (products.length) expect(compared).toBeGreaterThan(0);
  });

  it('bridal sets cost their own price', async () => {
    const sets = [...SETS, ...(Array.isArray(published.sets) ? published.sets : [])];
    const fromDb = await databasePrices([], sets, sets.map((s) => ({ id: s.id })));
    sets.forEach((s, i) => expect(fromDb[i], s.id).toBe(Number(s.price)));
  });

  it('a hidden or unknown piece is not priced (the order is marked "could not check")', async () => {
    const products = [{ id: 'hidden-one', en: 'Hidden', priceFrom: 100, hidden: true }];
    expect(await databasePrices(products, [], [{ id: 'hidden-one' }, { id: 'not-in-the-catalogue' }, {}])).toEqual([null, null, null]);
  });
});
