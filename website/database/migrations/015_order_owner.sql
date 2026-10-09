-- Link website orders to the customer who placed them. submit_order (009) saved every order with no
-- customer id, so a signed-in customer's order never appeared on /account. Now a signed-in customer's
-- request carries their Clerk token, and the order records clerk_user_id(). Guests are unchanged (null).
-- Run after 001–014. Safe to re-run. Uses the live function definition, plus one column.

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

  insert into public.orders (ref, name, phone, email, method, total, paid_now, utr, receipt, receipt_token, request_id, suspect, customer_id)
  values (v_ref, v_name, v_phone, v_email, v_method,
          greatest(0, coalesce((p ->> 'total')::numeric, 0))::int,
          greatest(0, coalesce((p ->> 'paidNow')::numeric, 0))::int,
          nullif(left(regexp_replace(coalesce(p ->> 'utr', ''), '[^A-Za-z0-9-]', '', 'g'), 40), ''),
          (p - 'requestId') || jsonb_build_object('ref', v_ref, 'clientRef', p ->> 'ref'),
          encode(gen_random_bytes(16), 'hex'), rid, sus,
          nullif(public.clerk_user_id(), ''));  -- null for guests
  return v_ref;
exception when unique_violation then
  -- The same order arrived twice at once (a double tap): return the first.
  select * into o from public.orders where request_id = rid;
  if found then return o.ref; end if;
  raise;
end $$;

-- Check: the function now names the customer column (one row).
select proname from pg_proc where proname = 'submit_order';
