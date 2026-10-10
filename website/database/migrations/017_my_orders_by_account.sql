-- My orders, refunds and enquiries show only what belongs to the signed-in account (security check, 10 Oct).
-- Until now they also matched on email. submit_order accepts any email from anyone, so a stranger could
-- plant an order, with item text of their choosing, in a real customer's My orders.
-- Now: rows saved with the customer's Clerk id (every order placed while signed in, since 015), plus rows
-- that existed before this migration and were matched by email then, so no customer loses an old order.
-- Enquiries sent later without an account can still be added from their tracking link (claim_enquiry).
-- Run after 001–016. Safe to re-run: the old rows are marked only on the first run.

do $$ begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'orders' and column_name = 'match_by_email') then
    alter table public.orders add column match_by_email boolean not null default false;
    update public.orders set match_by_email = true where customer_id is null;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'enquiries' and column_name = 'match_by_email') then
    alter table public.enquiries add column match_by_email boolean not null default false;
    update public.enquiries set match_by_email = true where customer_id is null;
  end if;
end $$;

-- /account: the signed-in customer's orders.
create or replace function public.my_orders() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'ref', ref, 'createdAt', created_at, 'items', receipt -> 'items', 'total', total, 'paidNow', paid_now,
      'method', method, 'status', status, 'paidAmount', paid_amount, 'paidAt', paid_at, 'token', receipt_token)
      order by created_at desc), '[]')
  from public.orders
  where public.clerk_user_id() is not null and anonymized_at is null and not suspect
    and (customer_id = public.clerk_user_id()
      or (match_by_email and customer_id is null and email is not null and lower(email) = lower(auth.jwt() ->> 'email')));
$$;

-- /account: the signed-in customer's refunds, matched the same way as my_orders.
create or replace function public.my_refunds() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_object_agg(ref, jsonb_build_object(
      'amount', refund_amount, 'ref', refund_ref, 'startedAt', refund_started_at, 'doneAt', refunded_at)), '{}')
  from public.orders
  where refund_amount is not null and public.clerk_user_id() is not null and anonymized_at is null
    and (customer_id = public.clerk_user_id()
      or (match_by_email and customer_id is null and email is not null and lower(email) = lower(auth.jwt() ->> 'email')));
$$;

create or replace function public.my_enquiries() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'createdAt', created_at, 'eventDate', event_date, 'items', items,
    'status', status, 'statusNote', status_note, 'statusUpdatedAt', status_updated_at) order by created_at desc), '[]')
  from public.enquiries
  where public.clerk_user_id() is not null
    and (customer_id = public.clerk_user_id()
      or (match_by_email and customer_id is null and email is not null and lower(email) = lower(auth.jwt() ->> 'email')));
$$;

-- create or replace keeps the existing grants; repeated here so a fresh database ends up the same.
revoke execute on function public.my_orders(), public.my_refunds(), public.my_enquiries() from public, anon;
grant execute on function public.my_orders(), public.my_refunds(), public.my_enquiries() to authenticated;

-- Check: every line should say true.
select exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'match_by_email') as orders_marked,
       position('match_by_email' in pg_get_functiondef('public.my_orders()'::regprocedure)) > 0 as my_orders_by_account,
       position('match_by_email' in pg_get_functiondef('public.my_refunds()'::regprocedure)) > 0 as my_refunds_by_account,
       not has_function_privilege('anon', 'public.my_orders()', 'execute') as my_orders_private;
