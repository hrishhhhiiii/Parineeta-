-- Payment screenshots (14 Oct). After placing an order and paying by UPI or bank, the customer sends the
-- payment screenshot from checkout (or My orders): it is saved privately on the order and shared to the shop's
-- WhatsApp from their phone. The owner sees it in Admin → Orders and accepts it (Received ₹X, which is
-- set_order_status 'paid') or declines it with a reason; the customer sees the outcome on My orders.
--   - Screenshots live in a PRIVATE storage bucket, "payment-proofs", as <order number>/<file>.
--   - Only the signed-in customer who placed the order can add one, and only while it awaits payment.
--   - Only owners can see them (through a short-lived link in the admin). Nobody can change or delete one
--     from the website.
-- Run after 009 and 015 (orders linked to accounts). Independent of 016–023. Safe to re-run.
-- (The Cashfree payments plan's database step is 025_payments.sql.)

alter table public.orders add column if not exists proof_path text check (char_length(proof_path) <= 200);
alter table public.orders add column if not exists proof_at timestamptz;
alter table public.orders add column if not exists proof_status text check (proof_status in ('sent', 'declined'));
alter table public.orders add column if not exists proof_note text check (char_length(proof_note) <= 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- True when the signed-in customer placed this order and it is still waiting for payment.
-- Security definer: storage rules run as the customer, who can't read the orders table directly.
create or replace function public._my_unpaid_order(p_ref text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders
                  where ref = p_ref and status = 'placed' and customer_id is not null
                    and customer_id = public.clerk_user_id())
$$;

drop policy if exists "customers add payment proof" on storage.objects;
create policy "customers add payment proof" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and public._my_unpaid_order((storage.foldername(name))[1]));
drop policy if exists "owners see payment proofs" on storage.objects;
create policy "owners see payment proofs" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and public.is_owner());

-- Customer: link the uploaded screenshot to their order. Sending a new one replaces a declined one.
create or replace function public.attach_payment_proof(p_ref text, p_path text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if public.clerk_user_id() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not public._my_unpaid_order(p_ref) then
    raise exception 'NOT_ALLOWED' using hint = 'This order is not waiting for a payment from your account.';
  end if;
  if p_path is null or left(p_path, char_length(p_ref) + 1) <> p_ref || '/'
     or substr(p_path, char_length(p_ref) + 2) !~ '^[A-Za-z0-9._-]{1,80}$' then
    raise exception 'BAD_PATH';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'payment-proofs' and name = p_path) then
    raise exception 'NOT_FOUND' using hint = 'The screenshot did not upload. Please try again.';
  end if;
  update public.orders set proof_path = p_path, proof_at = now(), proof_status = 'sent', proof_note = null, updated_at = now()
   where ref = p_ref;
end $$;

-- Owner: the payment is not in the account. The order keeps waiting; the customer can pay and send again.
create or replace function public.decline_payment(p_ref text, p_reason text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); o public.orders;
begin
  select * into o from public.orders where ref = p_ref for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status <> 'placed' then
    raise exception 'NOT_ALLOWED' using hint = 'Only an order waiting for payment can have its payment declined.';
  end if;
  update public.orders set proof_status = 'declined',
    proof_note = coalesce(nullif(left(trim(coalesce(p_reason, '')), 300), ''), 'We could not find this payment in our account.'),
    updated_at = now()
   where ref = p_ref;
  perform public._log(actor, 'payment_declined', null, p_ref);
end $$;

-- Owner: screenshots for the Orders screen, keyed by order number.
create or replace function public.list_payment_proofs() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('owner');
  return (select coalesce(jsonb_object_agg(ref, jsonb_build_object('path', proof_path, 'at', proof_at, 'status', proof_status, 'note', proof_note)), '{}')
            from public.orders where proof_status is not null);
end $$;

-- Customer: the state of their own screenshots, for My orders.
create or replace function public.my_payment_proofs() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_object_agg(ref, jsonb_build_object('at', proof_at, 'status', proof_status, 'note', proof_note)), '{}')
    from public.orders
   where proof_status is not null and public.clerk_user_id() is not null and customer_id = public.clerk_user_id();
$$;

revoke all on function public._my_unpaid_order(text) from public, anon;
grant execute on function public._my_unpaid_order(text) to authenticated;   -- used inside the storage rule
revoke execute on function public.attach_payment_proof(text, text), public.decline_payment(text, text),
  public.list_payment_proofs(), public.my_payment_proofs() from public, anon;
grant execute on function public.attach_payment_proof(text, text), public.decline_payment(text, text),
  public.list_payment_proofs(), public.my_payment_proofs() to authenticated;

-- Check (one row, three "true"):
select (select not public from storage.buckets where id = 'payment-proofs') as screenshots_private,
       (select count(*) = 2 from pg_policies where schemaname = 'storage' and tablename = 'objects'
          and policyname in ('customers add payment proof', 'owners see payment proofs')) as rules_in_place,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders'
                 and column_name = 'proof_status') as orders_ready;
