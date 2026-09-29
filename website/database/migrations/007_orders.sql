-- Checkout orders and payment receipts. Run after 001–006.
-- The place-order function saves each checkout and sends an "awaiting confirmation" receipt;
-- the owner's "Mark as paid" (confirm-payment function) sends the "payment received" receipt.
-- Customers open their receipt at /receipt.html#<token>; the token is the only credential.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique check (ref ~ '^PRN-[0-9]{6}-[A-Z0-9]{4}$'),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  phone text check (phone ~ '^\+?[0-9 ]{8,16}$'),
  email text check (char_length(email) <= 200),
  method text not null check (method in ('upi', 'bank', 'gateway', 'later')),
  total int not null check (total >= 0),
  paid_now int not null check (paid_now >= 0),
  utr text check (char_length(utr) <= 40),
  receipt jsonb not null,                                -- the receipt as the customer saw it
  receipt_token text not null unique check (receipt_token ~ '^[0-9a-f]{32}$'),
  status text not null default 'placed' check (status in ('placed', 'paid')),
  paid_amount int check (paid_amount >= 0),
  paid_at timestamptz,
  paid_by text,
  sent jsonb not null default '[]'                       -- every receipt delivery and its result
);
create index if not exists orders_created on public.orders (created_at desc);

-- Only the security-definer functions below touch the table.
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;

create or replace function public._place_order(p_ip_hash text, p jsonb, p_token text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare w timestamptz := date_trunc('hour', now()); n int; total int; id uuid; k text := 'order:' || p_ip_hash;
begin
  select coalesce(sum(count), 0) into total from public.enquiry_rate where window_start = w and ip_hash like 'order:%';
  if total >= 60 then raise exception 'RATE_LIMITED'; end if;
  insert into public.enquiry_rate values (k, w, 1)
    on conflict (ip_hash, window_start) do update set count = enquiry_rate.count + 1 returning count into n;
  if n > 5 then raise exception 'RATE_LIMITED'; end if;
  insert into public.orders (ref, name, phone, email, method, total, paid_now, utr, receipt, receipt_token)
  values (p ->> 'ref', p ->> 'name', nullif(p ->> 'phone', ''), nullif(p ->> 'email', ''), p -> 'method' ->> 'id',
          (p ->> 'total')::int, (p ->> 'paidNow')::int, nullif(p ->> 'utr', ''), p, p_token)
  returning orders.id into id;
  return id;
end $$;

create or replace function public._log_receipt(p_ref text, p_entries jsonb) returns void
language sql security definer set search_path = public as $$
  update public.orders set sent = sent || p_entries where ref = p_ref;
$$;

-- Public receipt page. Returns only what the receipt shows.
create or replace function public.order_receipt(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select receipt || jsonb_build_object('status', status, 'paidAmount', paid_amount, 'paidAt', paid_at)
  from public.orders where p_token ~ '^[0-9a-f]{32}$' and receipt_token = p_token;
$$;

create or replace function public.list_orders() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('owner');
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'ref', ref, 'created_at', created_at, 'name', name, 'phone', phone, 'email', email, 'method', method,
      'total', total, 'paid_now', paid_now, 'utr', utr, 'items', receipt -> 'items', 'address', receipt ->> 'address',
      'status', status, 'paid_amount', paid_amount, 'paid_at', paid_at, 'paid_by', paid_by, 'sent', sent)
      order by created_at desc), '[]')
    from (select * from public.orders order by created_at desc limit 500) o);
end $$;

create or replace function public.mark_order_paid(p_ref text, p_amount int) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); n int;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'BAD_AMOUNT' using hint = 'Enter the amount you received.'; end if;
  update public.orders set status = 'paid', paid_amount = p_amount, paid_at = now(), paid_by = actor
   where ref = p_ref and status = 'placed';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'ALREADY_PAID' using hint = 'This order is already marked as paid.'; end if;
  perform public._log(actor, 'order_paid', null, p_ref, p_amount::text);
end $$;

revoke execute on function public._place_order(text, jsonb, text), public._log_receipt(text, jsonb) from public, anon, authenticated;
grant execute on function public._place_order(text, jsonb, text), public._log_receipt(text, jsonb) to service_role;
revoke execute on function public.list_orders(), public.mark_order_paid(text, int) from public, anon;
grant execute on function public.list_orders(), public.mark_order_paid(text, int) to authenticated;
grant execute on function public.order_receipt(text) to anon, authenticated;
