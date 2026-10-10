// Coupon codes and order totals, run against the real database functions.
//
// Loads migrations 018 (order totals) and 019 (coupons) into an in-memory Postgres, with small stand-ins for
// the parts of Supabase they lean on (sign-in, the rate limit, the activity log), then places orders the way
// the checkout does. The discount rule lives only in the database, so this is where it is tested.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migration = (name) => readFileSync(new URL(`../../database/migrations/${name}`, import.meta.url), 'utf8');

const STAND_INS = `
  create schema if not exists extensions;
  create extension if not exists pgcrypto with schema extensions;
  create role anon; create role authenticated;
  create table public.published_content (key text primary key, data jsonb not null);
  create table public.orders (
    id uuid primary key default gen_random_uuid(), ref text not null unique, created_at timestamptz not null default now(),
    name text not null, phone text, email text, method text not null, total int not null, paid_now int not null, utr text,
    receipt jsonb not null, receipt_token text not null unique, status text not null default 'placed',
    request_id uuid unique, customer_id text, suspect boolean not null default false, anonymized_at timestamptz);
  create function public._rate(p_kind text, p_ip_hash text) returns boolean language sql as 'select false';
  create function public._new_ref() returns text language sql as $$ select 'PRN-000000-' || upper(substr(md5(random()::text), 1, 4)) $$;
  create function public.clerk_user_id() returns text language sql as 'select null::text';
  create function public._require(role_needed text) returns text language sql as $$ select 'owner@test'::text $$;
  create function public._log(actor text, action text, key text default null, ref text default null, detail text default null, extra jsonb default null)
    returns void language sql as 'select';
`;

// One product at ₹1,000 (Large +₹300) and one plain piece at ₹450.
const CATALOGUE = [
  { id: 'kouto', en: 'Kouto', priceFrom: 1000, variants: [{ id: 'size', name: 'Size', options: [{ id: 's', label: 'S', add: 0 }, { id: 'l', label: 'L', add: 300 }] }] },
  { id: 'kunke', en: 'Kunke', priceFrom: 450 },
];

let db;
let seq = 0;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const off = async (code, total) => (await one('select public._coupon_off($1, $2) as r', [code, total])).r;
const saveCoupon = (c) => one('select public.save_coupon($1::jsonb) as code', [JSON.stringify(c)]);

/** Places an order as the checkout does. `page` is what the customer's page showed. */
async function order({ lines = [{ id: 'kouto', pick: { size: 's' }, qty: 1 }], page, coupon, requestId, withLines = true }) {
  seq += 1;
  const rid = requestId || `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
  const p = {
    requestId: rid, ref: `PRN-261010-${String(seq).padStart(4, '0')}`, name: 'Riya Sen', phone: '9830012345', method: { id: 'upi', label: 'UPI' },
    items: lines.map((l) => ({ title: l.id, qty: l.qty, amount: 0 })), total: page.total, paidNow: page.total,
    ...(page.subtotal != null ? { subtotal: page.subtotal } : {}), ...(coupon ? { coupon } : {}), ...(withLines ? { lines } : {}),
  };
  const { ref } = await one('select public.submit_order($1::jsonb) as ref', [JSON.stringify(p)]);
  return one('select ref, total, client_total, total_check, coupon_code, discount, receipt from public.orders where ref = $1', [ref]);
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(STAND_INS);
  await db.exec(migration('018_order_totals.sql'));
  await db.exec(migration('019_coupons.sql'));
  await db.query('insert into public.published_content values ($1, $2::jsonb)', ['products', JSON.stringify(CATALOGUE)]);
});
afterAll(() => db?.close());
beforeEach(async () => {
  await db.exec('delete from public.orders; delete from public.coupons;');
});

describe('the discount rule', () => {
  it('percent off, rounded down to whole rupees', async () => {
    await saveCoupon({ code: 'wedding10', kind: 'percent', value: 10 });
    expect(await off('WEDDING10', 1455)).toEqual({ ok: true, code: 'WEDDING10', off: 145, label: '10% off' });
  });

  it('accepts the code in any case, with stray spaces', async () => {
    await saveCoupon({ code: 'WEDDING10', kind: 'percent', value: 10 });
    expect((await off(' wedding 10 ', 1000)).off).toBe(100);
  });

  it('percent off stops at the most-off limit', async () => {
    await saveCoupon({ code: 'BIG50', kind: 'percent', value: 50, maxOff: 300 });
    expect((await off('BIG50', 2000)).off).toBe(300);
  });

  it('rupees off never goes past the order total', async () => {
    await saveCoupon({ code: 'FLAT500', kind: 'amount', value: 500 });
    expect((await off('FLAT500', 1200)).off).toBe(500);
    expect((await off('FLAT500', 300)).off).toBe(300);
  });

  it('needs the smallest order amount', async () => {
    await saveCoupon({ code: 'MIN2000', kind: 'amount', value: 200, minTotal: 2000 });
    expect(await off('MIN2000', 1999)).toEqual({ ok: false, reason: 'This code works on orders of ₹2000 or more.' });
    expect((await off('MIN2000', 2000)).off).toBe(200);
  });

  it.each([
    ['unknown code', 'NOPE', null, 'That code is not valid.'],
    ['switched off', 'OFFNOW', { code: 'OFFNOW', kind: 'percent', value: 10, active: false }, 'That code is not valid.'],
    ['not started yet', 'LATER', { code: 'LATER', kind: 'percent', value: 10, startsOn: '2999-01-01' }, 'That code is not valid.'],
    ['ended', 'OLD', { code: 'OLD', kind: 'percent', value: 10, endsOn: '2000-01-01' }, 'That code has ended.'],
    ['not a code at all', 'x!', null, 'That code is not valid.'],
  ])('refuses: %s', async (_, code, coupon, reason) => {
    if (coupon) await saveCoupon(coupon);
    expect(await off(code, 1000)).toEqual({ ok: false, reason });
  });

  it('the shop cannot save a broken code', async () => {
    await expect(saveCoupon({ code: 'AB', kind: 'percent', value: 10 })).rejects.toThrow('BAD_COUPON');
    await expect(saveCoupon({ code: 'TOOMUCH', kind: 'percent', value: 95 })).rejects.toThrow('BAD_COUPON');
    await expect(saveCoupon({ code: 'ZERO', kind: 'amount', value: 0 })).rejects.toThrow('BAD_COUPON');
  });

  it('saving the same code again changes it and keeps its use count', async () => {
    await saveCoupon({ code: 'WEDDING10', kind: 'percent', value: 10 });
    await order({ page: { total: 900 }, coupon: { code: 'WEDDING10', off: 100 } });
    await saveCoupon({ code: 'WEDDING10', kind: 'percent', value: 20 });
    expect(await one('select value, used from public.coupons')).toEqual({ value: 20, used: 1 });
  });

  it('the coupon box shows only while a usable code exists', async () => {
    const available = async () => (await one('select public.coupons_available() as a')).a;
    expect(await available()).toBe(false);
    await saveCoupon({ code: 'OLD', kind: 'percent', value: 10, endsOn: '2000-01-01' });
    expect(await available()).toBe(false);
    await saveCoupon({ code: 'WEDDING10', kind: 'percent', value: 10 });
    expect(await available()).toBe(true);
  });
});

describe('orders with a coupon', () => {
  beforeEach(() => saveCoupon({ code: 'WEDDING10', kind: 'percent', value: 10 }));

  it('an honest order: catalogue total less the discount', async () => {
    const o = await order({ lines: [{ id: 'kouto', pick: { size: 'l' }, qty: 2 }], page: { total: 2340 }, coupon: { code: 'wedding10', off: 260 } });
    expect(o).toMatchObject({ total: 2340, total_check: 'ok', coupon_code: 'WEDDING10', discount: 260 });
    expect(o.receipt).toMatchObject({ subtotal: 2600, total: 2340, coupon: { code: 'WEDDING10', off: 260 } });
    expect((await one('select used from public.coupons')).used).toBe(1);
  });

  it('a page claiming a bigger discount gets the real one, and the order is flagged', async () => {
    const o = await order({ page: { total: 100 }, coupon: { code: 'WEDDING10', off: 900 } });
    expect(o).toMatchObject({ total: 900, client_total: 100, total_check: 'changed', discount: 100 });
  });

  it('a made-up code gives no discount, and the order is flagged', async () => {
    const o = await order({ page: { total: 500 }, coupon: { code: 'FREE50', off: 500 } });
    expect(o).toMatchObject({ total: 1000, total_check: 'changed', coupon_code: null, discount: null });
    expect(o.receipt.coupon).toBeUndefined();
  });

  it('a code with one use left works once', async () => {
    await saveCoupon({ code: 'ONCE', kind: 'amount', value: 200, maxUses: 1 });
    const first = await order({ page: { total: 800 }, coupon: { code: 'ONCE', off: 200 } });
    const second = await order({ page: { total: 800 }, coupon: { code: 'ONCE', off: 200 } });
    expect(first).toMatchObject({ total: 800, total_check: 'ok', discount: 200 });
    expect(second).toMatchObject({ total: 1000, total_check: 'changed', discount: null });
    expect((await one("select used from public.coupons where code = 'ONCE'")).used).toBe(1);
  });

  it('the same order sent twice (a double tap) uses the code once', async () => {
    const requestId = '11111111-1111-4111-8111-111111111111';
    const a = await order({ requestId, page: { total: 900 }, coupon: { code: 'WEDDING10', off: 100 } });
    const b = await order({ requestId, page: { total: 900 }, coupon: { code: 'WEDDING10', off: 100 } });
    expect(b.ref).toBe(a.ref);
    expect((await one('select used from public.coupons')).used).toBe(1);
  });

  it('an order with no coupon is priced as before', async () => {
    const o = await order({ lines: [{ id: 'kunke', qty: 3 }], page: { total: 1350 } });
    expect(o).toMatchObject({ total: 1350, total_check: 'ok', coupon_code: null, discount: null });
    expect(o.receipt.subtotal).toBeUndefined();
  });

  it('an order the database cannot price keeps the page figures and says so', async () => {
    const o = await order({ withLines: false, page: { total: 900 }, coupon: { code: 'WEDDING10', off: 100 } });
    expect(o).toMatchObject({ total: 900, total_check: 'unverified', coupon_code: 'WEDDING10', discount: 100 });
  });
});
