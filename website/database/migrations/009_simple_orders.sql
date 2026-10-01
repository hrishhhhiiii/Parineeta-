-- Orders from the website's checkout, saved straight from the browser (no server functions).
-- Run after 001–008. Safe to re-run.
-- Customers pay an advance by UPI or bank transfer and send the order on WhatsApp; the same order
-- is saved here, and the owner tracks it in /admin → Orders. Prices are estimates the shop
-- confirms on WhatsApp, so the amounts are recorded as the customer saw them.

/* ---------- order stages ---------- */
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('placed', 'paid', 'making', 'ready', 'delivered', 'cancelled'));
alter table public.orders add column if not exists updated_at timestamptz;

/* ---------- checkout → orders (anyone may call; rate-limited) ---------- */
-- p: the receipt the customer saw at checkout:
--   { requestId, ref, name, phone, email, eventDate, address, items[], total, paidNow, plan, method{id,label}, payTo, utr }
-- Returns the order number. Sending the same requestId twice saves one order.
create or replace function public.submit_order(p jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  rid uuid;
  v_ref text := p ->> 'ref';
  v_name text := left(trim(coalesce(p ->> 'name', '')), 120);
  v_phone text := nullif(trim(regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9+ ]', '', 'g')), '');
  v_email text := nullif(left(trim(coalesce(p ->> 'email', '')), 200), '');
  v_method text := p -> 'method' ->> 'id';
  v_items jsonb := p -> 'items';
  ip text := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown'), ',', 1);
  sus boolean;
  o public.orders;
begin
  begin rid := (p ->> 'requestId')::uuid; exception when others then raise exception 'BAD_ORDER' using hint = 'requestId'; end;
  select * into o from public.orders where request_id = rid;
  if found then return o.ref; end if;

  if char_length(v_name) < 2 then raise exception 'BAD_ORDER' using hint = 'name'; end if;
  if v_method is null or v_method not in ('upi', 'bank', 'gateway', 'later') then raise exception 'BAD_ORDER' using hint = 'method'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) not between 1 and 30 then raise exception 'BAD_ORDER' using hint = 'items'; end if;
  if pg_column_size(p) > 20000 then raise exception 'BAD_ORDER' using hint = 'size'; end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9 ]{8,16}$' then v_phone := null; end if;  -- kept in the receipt as typed

  sus := public._rate('ord', encode(digest(trim(ip), 'sha256'), 'hex'));  -- raises RATE_LIMITED past 20/hour from one connection

  -- The browser makes the order number (it goes in the UPI note); on the rare clash, make a new one.
  if v_ref is null or v_ref !~ '^PRN-[0-9]{6}-[A-Z0-9]{4}$' or exists (select 1 from public.orders where ref = v_ref) then
    v_ref := public._new_ref();
  end if;

  insert into public.orders (ref, name, phone, email, method, total, paid_now, utr, receipt, receipt_token, request_id, suspect)
  values (v_ref, v_name, v_phone, v_email, v_method,
          greatest(0, coalesce((p ->> 'total')::numeric, 0))::int,
          greatest(0, coalesce((p ->> 'paidNow')::numeric, 0))::int,
          nullif(left(regexp_replace(coalesce(p ->> 'utr', ''), '[^A-Za-z0-9-]', '', 'g'), 40), ''),
          (p - 'requestId') || jsonb_build_object('ref', v_ref, 'clientRef', p ->> 'ref'),
          encode(gen_random_bytes(16), 'hex'), rid, sus);
  return v_ref;
exception when unique_violation then
  -- The same order arrived twice at once (a double tap): return the first.
  select * into o from public.orders where request_id = rid;
  if found then return o.ref; end if;
  raise;
end $$;

/* ---------- owner: move an order along ---------- */
-- p_amount: the amount received, when marking it paid.
create or replace function public.set_order_status(p_ref text, p_status text, p_amount int default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); n int;
begin
  if p_status not in ('placed', 'paid', 'making', 'ready', 'delivered', 'cancelled') then raise exception 'BAD_STATUS'; end if;
  update public.orders set
    status = p_status,
    suspect = false,
    paid_amount = case when p_amount is not null and p_amount > 0 then p_amount else paid_amount end,
    paid_at = case when p_amount is not null and p_amount > 0 then coalesce(paid_at, now()) else paid_at end,
    paid_by = case when p_amount is not null and p_amount > 0 then actor else paid_by end,
    updated_at = now()
  where ref = p_ref;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOT_FOUND'; end if;
  perform public._log(actor, 'order_status', null, p_ref, p_status, case when p_amount is not null then jsonb_build_object('amount', p_amount) end);
end $$;

-- Owner: delete a test or spam order.
create or replace function public.delete_order(p_ref text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); n int;
begin
  delete from public.orders where ref = p_ref;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOT_FOUND'; end if;
  perform public._log(actor, 'order_deleted', null, p_ref);
end $$;

revoke execute on function public.submit_order(jsonb), public.set_order_status(text, text, int), public.delete_order(text) from public, anon;
grant execute on function public.submit_order(jsonb) to anon, authenticated;
grant execute on function public.set_order_status(text, text, int), public.delete_order(text) to authenticated;
