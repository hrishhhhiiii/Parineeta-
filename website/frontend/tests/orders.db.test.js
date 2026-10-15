// Order safety rules (payments audit P1–P3), run against the real database functions in 023_order_safety.sql,
// plus a check that the admin's copy of the stage rules (src/admin/orderRules.js) agrees with the database.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { stepOk, canDelete, refundOk } from '../src/admin/orderRules.js';

const migration = (name) => readFileSync(new URL(`../../database/migrations/${name}`, import.meta.url), 'utf8');

const STAND_INS = `
  create schema if not exists extensions;
  create role anon; create role authenticated;
  create table public.orders (
    ref text primary key, total int not null default 2000,
    status text not null default 'placed'
      check (status in ('placed', 'paid', 'making', 'ready', 'delivered', 'cancelled', 'refund_started', 'refunded')),
    paid_amount int, paid_at timestamptz, paid_by text, suspect boolean not null default false, updated_at timestamptz,
    refund_amount int check (refund_amount > 0), refund_ref text, refund_note text,
    refund_started_at timestamptz, refunded_at timestamptz, refund_by text);
  create function public._require(role_needed text) returns text language sql as $$ select 'owner@test'::text $$;
  create function public._log(actor text, action text, key text default null, ref text default null, detail text default null, extra jsonb default null)
    returns void language sql as 'select';
`;

const STAGES = ['placed', 'paid', 'making', 'ready', 'delivered', 'cancelled', 'refund_started', 'refunded'];
let db;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const order = (ref, fields = {}) => db.query(
  'insert into public.orders (ref, status, paid_amount, refund_amount) values ($1, $2, $3, $4)',
  [ref, fields.status || 'placed', fields.paid ?? null, fields.refund ?? null]);
const status = (ref, s, amount = null) => db.query('select public.set_order_status($1, $2, $3)', [ref, s, amount]);
const refund = (ref, stage, amount) => db.query('select public.set_order_refund($1, $2, $3)', [ref, stage, amount]);
const del = (ref) => db.query('select public.delete_order($1)', [ref]);
const row = (ref) => one('select * from public.orders where ref = $1', [ref]);
/** The error a call raised: its message code and the plain-words hint the admin shows. */
const failure = async (p) => p.then(() => ({ message: 'no error' }), (e) => ({ message: e.message, hint: e.hint || '' }));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STAND_INS);
  await db.exec(migration('023_order_safety.sql'));
});
afterAll(() => db?.close());
beforeEach(() => db.exec('delete from public.orders'));

describe('P1: a refund is capped at the payment recorded', () => {
  it('refuses a refund above what was received, even when the order total is higher', async () => {
    await order('A', { status: 'paid', paid: 1000 });
    const f = await failure(refund('A', 'refund_started', 2000));
    expect(f.message).toBe('BAD_AMOUNT');
    expect(f.hint).toMatch(/₹1000 received/);
    expect((await row('A')).refund_amount).toBeNull();
  });
  it('accepts a refund up to the payment and records it', async () => {
    await order('A', { status: 'delivered', paid: 1000 });
    await refund('A', 'refund_started', 1000);
    await refund('A', 'refunded', 1000);
    const r = await row('A');
    expect([r.status, r.refund_amount]).toEqual(['refunded', 1000]);
    expect(r.refunded_at).not.toBeNull();
  });
  it('refuses a refund when no payment is recorded', async () => {
    await order('A', { status: 'placed' });
    const f = await failure(refund('A', 'refund_started', 500));
    expect(f.message).toBe('BAD_AMOUNT');
    expect(f.hint).toMatch(/No payment is recorded/);
  });
  it('a completed refund cannot go back to initiated', async () => {
    await order('A', { status: 'refunded', paid: 1000, refund: 1000 });
    expect((await failure(refund('A', 'refund_started', 1000))).message).toBe('BAD_STEP');
  });
});

describe('P2: orders with money recorded are kept', () => {
  it('refuses to delete a paid order', async () => {
    await order('A', { status: 'paid', paid: 1000 });
    const f = await failure(del('A'));
    expect(f.message).toBe('NOT_ALLOWED');
    expect(f.hint).toMatch(/Set it to Cancelled instead/);
    expect(await row('A')).toBeTruthy();
  });
  it('refuses to delete a cancelled order that had a payment', async () => {
    await order('A', { status: 'cancelled', paid: 500 });
    expect((await failure(del('A'))).message).toBe('NOT_ALLOWED');
  });
  it('refuses to delete an unpaid order already being made, and says to cancel it first', async () => {
    await order('A', { status: 'making' });
    expect((await failure(del('A'))).hint).toMatch(/Cancelled first/);
  });
  it('deletes an unpaid new or cancelled order (test or spam)', async () => {
    await order('A');
    await order('B', { status: 'cancelled' });
    await del('A');
    await del('B');
    expect((await one('select count(*)::int as n from public.orders')).n).toBe(0);
  });
});

describe('P3: stages follow sensible steps', () => {
  it('moves forward, skipping stages', async () => {
    await order('A');
    await status('A', 'making');
    await status('A', 'delivered');
    expect((await row('A')).status).toBe('delivered');
  });
  it('goes back one stage to correct a mistake, but not further', async () => {
    await order('A', { status: 'delivered', paid: 1000 });
    await status('A', 'ready');
    const f = await failure(status('A', 'placed'));
    expect(f.message).toBe('BAD_STEP');
    expect(f.hint).toMatch(/can't go from Ready to New/);
  });
  it('cancels before delivery and reopens a cancelled order as new', async () => {
    await order('A', { status: 'making' });
    await status('A', 'cancelled');
    await status('A', 'placed');
    expect((await row('A')).status).toBe('placed');
    await order('B', { status: 'delivered' });
    expect((await failure(status('B', 'cancelled'))).message).toBe('BAD_STEP');
  });
  it('keeps an order with a refund recorded out of the normal stages', async () => {
    await order('A', { status: 'refund_started', paid: 1000, refund: 1000 });
    const f = await failure(status('A', 'delivered'));
    expect(f.message).toBe('BAD_STEP');
    expect(f.hint).toMatch(/refund is recorded/);
  });
  it('needs an amount to mark an order paid', async () => {
    await order('A');
    expect((await failure(status('A', 'paid'))).message).toBe('BAD_AMOUNT');
    await status('A', 'paid', 1200);
    expect((await row('A')).paid_amount).toBe(1200);
  });
});

describe('the admin offers exactly what the database allows', () => {
  it('agrees on every pair of stages', async () => {
    for (const from of STAGES) {
      for (const to of STAGES.slice(0, 6)) {
        const { ok } = await one('select public._order_step_ok($1, $2) as ok', [from, to]);
        expect(stepOk(from, to), `${from} → ${to}`).toBe(ok);
      }
    }
  });
  it('offers delete and refunds on the same orders the database accepts', () => {
    expect(canDelete({ status: 'placed' })).toBe(true);
    expect(canDelete({ status: 'cancelled', paid_amount: 500 })).toBe(false);
    expect(canDelete({ status: 'making' })).toBe(false);
    expect(refundOk({ status: 'paid', paid_amount: 0 }, 'refund_started')).toBe(false);
    expect(refundOk({ status: 'refunded', paid_amount: 900 }, 'refund_started')).toBe(false);
    expect(refundOk({ status: 'delivered', paid_amount: 900 }, 'refunded')).toBe(true);
  });
});
