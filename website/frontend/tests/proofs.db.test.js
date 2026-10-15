// Payment screenshots (024_payment_proofs.sql), run against the real database functions and storage rules in an
// in-memory Postgres, with small stand-ins for Supabase's storage tables and sign-in.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = (name) => readFileSync(new URL(`../../database/migrations/${name}`, import.meta.url), 'utf8');

const STAND_INS = `
  create schema if not exists extensions;
  create role anon; create role authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (bucket_id text, name text, primary key (bucket_id, name));
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage, public to authenticated, anon;
  grant select, insert on storage.objects to authenticated;
  create table public.orders (
    ref text primary key, status text not null default 'placed', customer_id text, updated_at timestamptz);
  create function public.clerk_user_id() returns text language sql stable as $$ select nullif(current_setting('test.user', true), '') $$;
  create function public.is_owner() returns boolean language sql stable as $$ select current_setting('test.user', true) = 'owner' $$;
  create function public._require(role_needed text) returns text language sql as $$ select 'owner@test'::text $$;
  create function public._log(actor text, action text, key text default null, ref text default null, detail text default null, extra jsonb default null)
    returns void language sql as 'select';
`;

let db;
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const as = async (user, role = 'authenticated') => {
  await db.query("select set_config('test.user', $1, false)", [user || '']);
  await db.exec(role ? `set role ${role}` : 'reset role');
};
const asAdmin = () => as('', null);
const failure = async (p) => p.then(() => ({ message: 'no error' }), (e) => ({ message: e.message, hint: e.hint || '' }));
const upload = (path) => db.query("insert into storage.objects (bucket_id, name) values ('payment-proofs', $1)", [path]);
const attach = (ref, path) => db.query('select public.attach_payment_proof($1, $2)', [ref, path]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STAND_INS);
  await db.exec(migration('024_payment_proofs.sql'));
});
afterAll(() => db?.close());
beforeEach(async () => {
  await asAdmin();
  await db.exec(`delete from storage.objects; delete from public.orders;
    insert into public.orders (ref, status, customer_id) values
      ('PRN-1', 'placed', 'user_a'), ('PRN-2', 'placed', 'user_b'), ('PRN-3', 'paid', 'user_a'), ('PRN-4', 'placed', null);`);
});

describe('setup', () => {
  it('makes a private bucket and the two storage rules', async () => {
    const r = await one(`select (select not public from storage.buckets where id = 'payment-proofs') as private,
      (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects') as rules`);
    expect(r).toEqual({ private: true, rules: 2 });
  });
});

describe('who can upload a screenshot', () => {
  it('the customer, into their own order that awaits payment', async () => {
    await as('user_a');
    await upload('PRN-1/shot.jpg');
    await asAdmin();
    expect((await one('select count(*)::int as n from storage.objects')).n).toBe(1);
  });
  it('not into someone else\'s order, a paid order, or a guest order', async () => {
    await as('user_a');
    for (const path of ['PRN-2/shot.jpg', 'PRN-3/shot.jpg', 'PRN-4/shot.jpg', 'shot.jpg']) {
      expect((await failure(upload(path))).message, path).toMatch(/row-level security/);
    }
  });
  it('only an owner can see screenshots', async () => {
    await as('user_a');
    await upload('PRN-1/shot.jpg');
    expect((await one('select count(*)::int as n from storage.objects')).n).toBe(0);
    await as('owner');
    expect((await one('select count(*)::int as n from storage.objects')).n).toBe(1);
  });
});

describe('linking the screenshot to the order', () => {
  it('records it on the customer\'s own order', async () => {
    await as('user_a');
    await upload('PRN-1/shot.jpg');
    await attach('PRN-1', 'PRN-1/shot.jpg');
    const mine = (await one('select public.my_payment_proofs() as p')).p;
    expect(mine['PRN-1'].status).toBe('sent');
    expect(mine['PRN-2']).toBeUndefined();
  });
  it('refuses another customer\'s order, a path outside the order, or a file that was never uploaded', async () => {
    await as('user_a');
    await upload('PRN-1/shot.jpg');
    expect((await failure(attach('PRN-2', 'PRN-2/shot.jpg'))).message).toBe('NOT_ALLOWED');
    expect((await failure(attach('PRN-1', 'PRN-2/shot.jpg'))).message).toBe('BAD_PATH');
    expect((await failure(attach('PRN-1', 'PRN-1/../x.jpg'))).message).toBe('BAD_PATH');
    const f = await failure(attach('PRN-1', 'PRN-1/missing.jpg'));
    expect([f.message, f.hint]).toEqual(['NOT_FOUND', 'The screenshot did not upload. Please try again.']);
  });
  it('a visitor who is not signed in can\'t call it at all', async () => {
    await as('', 'anon');
    expect((await failure(attach('PRN-1', 'PRN-1/shot.jpg'))).message).toMatch(/permission denied/);
  });
});

describe('accept or decline', () => {
  it('declining keeps the order waiting, with the reason for the customer; a new screenshot replaces it', async () => {
    await as('user_a');
    await upload('PRN-1/one.jpg');
    await attach('PRN-1', 'PRN-1/one.jpg');
    await as('owner');
    await db.query('select public.decline_payment($1, $2)', ['PRN-1', '  ']);
    let p = (await one('select public.list_payment_proofs() as p')).p['PRN-1'];
    expect([p.status, p.note]).toEqual(['declined', 'We could not find this payment in our account.']);
    await asAdmin(); // owners reach orders only through the admin functions; read the row directly here
    expect((await one("select status from public.orders where ref = 'PRN-1'")).status).toBe('placed');
    await as('user_a');
    await upload('PRN-1/two.jpg');
    await attach('PRN-1', 'PRN-1/two.jpg');
    await as('owner');
    p = (await one('select public.list_payment_proofs() as p')).p['PRN-1'];
    expect([p.status, p.note, p.path]).toEqual(['sent', null, 'PRN-1/two.jpg']);
  });
  it('can\'t decline an order that is already paid', async () => {
    await as('owner');
    const f = await failure(db.query('select public.decline_payment($1)', ['PRN-3']));
    expect(f.message).toBe('NOT_ALLOWED');
  });
});
