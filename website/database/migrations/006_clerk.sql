-- Sign-in moves from Supabase Auth to Clerk. Run after 001–005, once Clerk is added in
-- Supabase → Authentication → Sign In / Providers → Third-party auth (see ADMIN-SETUP.md).
-- Clerk ids look like 'user_2abc…', not UUIDs, so auth.uid() can't read them: the signed-in
-- person is the token's 'sub' claim. Admin roles and "my enquiries" still match on the token's
-- 'email' claim, which the Clerk session token must include.

create or replace function public.clerk_user_id() returns text
language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '') $$;

/* ---------- enquiries: customer_id holds a Clerk id ---------- */
-- Links to old Supabase logins are dropped. Customers still see those enquiries through their
-- email, and one sent without an email can be claimed again from its tracking link.
alter table public.enquiries drop constraint if exists enquiries_customer_id_fkey;
do $$ begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'enquiries' and column_name = 'customer_id') = 'uuid' then
    alter table public.enquiries alter column customer_id type text using null;
  end if;
end $$;

create or replace function public.my_enquiries() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'createdAt', created_at, 'eventDate', event_date, 'items', items,
    'status', status, 'statusNote', status_note, 'statusUpdatedAt', status_updated_at) order by created_at desc), '[]')
  from public.enquiries
  where public.clerk_user_id() is not null
    and (customer_id = public.clerk_user_id()
      or (email is not null and lower(email) = lower(auth.jwt() ->> 'email')));
$$;

create or replace function public.claim_enquiry(p_token text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  me text := public.clerk_user_id();
  n int;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  update public.enquiries set customer_id = me
   where p_token ~ '^[0-9a-f]{32}$' and track_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and (customer_id is null or customer_id = me);
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Deletes the customer's data. The website then deletes the Clerk login itself.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.clerk_user_id();
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email')) then
    raise exception 'NOT_ALLOWED';
  end if;
  delete from public.enquiries where customer_id = me
     or lower(email) = lower(auth.jwt() ->> 'email');
  delete from public.customer_carts where user_id = me;
end $$;

/* ---------- carts: keyed by Clerk id ---------- */
-- Saved carts belonged to Supabase logins nobody can sign in to any more. Each browser keeps
-- its own copy and uploads it again on the first Clerk sign-in.
drop policy if exists own_cart_read on public.customer_carts;
drop policy if exists own_cart_insert on public.customer_carts;
drop policy if exists own_cart_update on public.customer_carts;
alter table public.customer_carts drop constraint if exists customer_carts_user_id_fkey;
delete from public.customer_carts where user_id::text !~ '^user_';
alter table public.customer_carts alter column user_id drop default;
alter table public.customer_carts alter column user_id type text;
alter table public.customer_carts alter column user_id set default public.clerk_user_id();

create policy own_cart_read on public.customer_carts for select to authenticated using (user_id = public.clerk_user_id());
create policy own_cart_insert on public.customer_carts for insert to authenticated with check (user_id = public.clerk_user_id());
create policy own_cart_update on public.customer_carts for update to authenticated
  using (user_id = public.clerk_user_id()) with check (user_id = public.clerk_user_id());
