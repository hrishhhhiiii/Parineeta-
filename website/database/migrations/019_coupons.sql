-- Coupon codes: the shop makes a code in Admin → Coupons, the customer types it at checkout.
--
--   checkout ── coupons_available()        is there any usable code? (shows or hides the coupon box)
--            ── check_coupon(code, total)  "WEDDING10: ₹145 off" or why not (rate-limited, like orders)
--            ── submit_order(p)            works the discount out again from the catalogue total; the page's
--                                          figure is never trusted. An unusable code gives no discount and the
--                                          order is marked "check the price" (018), never refused.
--   admin    ── admin_coupons(), save_coupon(), delete_coupon(), list_order_coupons()   (owner only)
--
-- The discount rule lives only here (_coupon_off), so the website and the database cannot disagree.
-- Codes are kept in this table, not in the published content, so they can't be read from the website.
-- Run after 001–018. Safe to re-run. submit_order is 018's definition plus the coupon step.

create table if not exists public.coupons (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  kind text not null check (kind in ('percent', 'amount')),
  value int not null check (value > 0),
  min_total int not null default 0 check (min_total >= 0),     -- order must be at least this much
  max_off int check (max_off > 0),                             -- percent codes: never more than this many rupees
  starts_on date,                                              -- India dates, both included; null = no limit
  ends_on date,
  max_uses int check (max_uses > 0),                           -- null = no limit
  used int not null default 0,
  active boolean not null default true,
  note text check (char_length(note) <= 200),                  -- only the shop sees it
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (kind <> 'percent' or value <= 90)
);
alter table public.coupons enable row level security;
revoke all on public.coupons from anon, authenticated;

alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount int check (discount >= 0);

/* ---------- the one discount rule ---------- */
-- { ok: true, code, off, label } or { ok: false, reason } (reason is shown to the customer).
create or replace function public._coupon_off(p_code text, p_total int) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  c public.coupons;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  today date := (now() at time zone 'Asia/Kolkata')::date;
  off int;
begin
  if v_code !~ '^[A-Z0-9]{3,20}$' then return jsonb_build_object('ok', false, 'reason', 'That code is not valid.'); end if;
  select * into c from public.coupons where code = v_code;
  if not found or not c.active or (c.starts_on is not null and today < c.starts_on) then
    return jsonb_build_object('ok', false, 'reason', 'That code is not valid.');
  end if;
  if c.ends_on is not null and today > c.ends_on then return jsonb_build_object('ok', false, 'reason', 'That code has ended.'); end if;
  if c.max_uses is not null and c.used >= c.max_uses then return jsonb_build_object('ok', false, 'reason', 'That code has been used up.'); end if;
  if coalesce(p_total, 0) < c.min_total then
    return jsonb_build_object('ok', false, 'reason', format('This code works on orders of ₹%s or more.', c.min_total));
  end if;
  off := case when c.kind = 'percent' then least(floor(p_total::numeric * c.value / 100)::int, coalesce(c.max_off, 2147483647))
              else c.value end;
  off := greatest(0, least(off, p_total));
  if off = 0 then return jsonb_build_object('ok', false, 'reason', 'That code does not apply to this order.'); end if;
  return jsonb_build_object('ok', true, 'code', c.code, 'off', off,
    'label', case when c.kind = 'percent' then c.value || '% off' else '₹' || c.value || ' off' end);
end $$;

/* ---------- the website ---------- */
create or replace function public.coupons_available() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coupons
    where active and (ends_on is null or ends_on >= (now() at time zone 'Asia/Kolkata')::date)
      and (max_uses is null or used < max_uses));
$$;

-- A wrong guess costs one of the 20 tries an hour a connection gets, so codes can't be found by trying thousands.
create or replace function public.check_coupon(p_code text, p_total int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  ip text := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown'), ',', 1);
begin
  perform public._rate('cpn', encode(digest(trim(ip), 'sha256'), 'hex'));
  return public._coupon_off(p_code, greatest(0, coalesce(p_total, 0)));
end $$;

/* ---------- checkout → orders: 018's function plus the coupon ---------- */
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
  v_lines jsonb := p -> 'lines';
  ip text := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown'), ',', 1);
  sus boolean;
  o public.orders;
  v_client int := greatest(0, coalesce(public._num(p ->> 'total'), 0))::int;   -- what the page showed, after any coupon
  v_total int;
  v_check text := 'unverified';
  v_receipt jsonb;
  products jsonb := (select data from public.published_content where key = 'products');
  sets jsonb := (select data from public.published_content where key = 'sets');
  i int;
  ln jsonb;
  qty int;
  unit numeric;
  sum_total numeric := 0;
  amounts jsonb := '[]'::jsonb;
  v_coupon text := nullif(upper(regexp_replace(coalesce(p -> 'coupon' ->> 'code', ''), '\s', '', 'g')), '');
  v_client_off int := greatest(0, coalesce(public._num(p -> 'coupon' ->> 'off'), 0))::int;
  v_subtotal int;
  v_off int := 0;
  c jsonb;
  hit int;
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

  -- Price every line from the published catalogue. Any line that can't be priced leaves the order 'unverified'.
  if jsonb_typeof(v_lines) = 'array' and jsonb_array_length(v_lines) = jsonb_array_length(v_items) then
    v_check := 'ok';
    for i in 0 .. jsonb_array_length(v_lines) - 1 loop
      ln := v_lines -> i;
      unit := case when jsonb_typeof(ln) = 'object' then public._unit_price(products, sets, ln) end;
      if unit is null or unit < 0 then v_check := 'unverified'; exit; end if;
      qty := least(20, greatest(1, floor(coalesce(public._num(ln ->> 'qty'), 1))::int));  -- whole pieces, 1 to 20 (as the cart)
      sum_total := sum_total + unit * qty;
      amounts := amounts || to_jsonb(round(unit * qty)::int);
    end loop;
  end if;

  -- The items' total before any coupon: the catalogue's when it could be priced, else the page's.
  v_subtotal := case when v_check = 'ok' then round(sum_total)::int else v_client + v_client_off end;

  -- The coupon, worked out here from that total. Counted as used only if it is still usable right now.
  if v_coupon is not null then
    c := public._coupon_off(v_coupon, v_subtotal);
    if (c ->> 'ok')::boolean then
      update public.coupons set used = used + 1 where code = c ->> 'code' and (max_uses is null or used < max_uses);
      get diagnostics hit = row_count;
      if hit > 0 then v_off := (c ->> 'off')::int; end if;
    end if;
    if v_off = 0 then v_coupon := null; end if;
  end if;

  v_receipt := (p - 'requestId' - 'lines' - 'coupon' - 'subtotal') || jsonb_build_object('ref', null, 'clientRef', p ->> 'ref');
  if v_off > 0 then
    v_receipt := v_receipt || jsonb_build_object('subtotal', v_subtotal, 'coupon', jsonb_build_object('code', v_coupon, 'off', v_off));
  end if;
  v_total := v_subtotal - v_off;
  if v_check = 'ok' then
    if v_total <> v_client then v_check := 'changed'; end if;
    -- The receipt shows the catalogue's amounts; the page's are kept beside them when they differ.
    v_receipt := jsonb_set(v_receipt, '{items}', (
      select jsonb_agg(case when (it ->> 'amount') is distinct from (amounts ->> (n - 1)::int)
                            then it || jsonb_build_object('amount', (amounts -> (n - 1)::int), 'clientAmount', it -> 'amount')
                            else it end order by n)
        from jsonb_array_elements(v_items) with ordinality t(it, n)));
    v_receipt := v_receipt || jsonb_build_object('total', v_total)
      || case when v_check = 'changed' then jsonb_build_object('clientTotal', v_client) else '{}'::jsonb end;
  else
    v_receipt := v_receipt || jsonb_build_object('total', v_total);
  end if;

  -- The browser makes the order number (it goes in the UPI note); on the rare clash, make a new one.
  if v_ref is null or v_ref !~ '^PRN-[0-9]{6}-[A-Z0-9]{4}$' or exists (select 1 from public.orders where ref = v_ref) then
    v_ref := public._new_ref();
  end if;
  v_receipt := jsonb_set(v_receipt, '{ref}', to_jsonb(v_ref));

  insert into public.orders (ref, name, phone, email, method, total, paid_now, utr, receipt, receipt_token, request_id, suspect, customer_id,
                             client_total, total_check, coupon_code, discount)
  values (v_ref, v_name, v_phone, v_email, v_method,
          v_total,
          greatest(0, coalesce(public._num(p ->> 'paidNow'), 0))::int,  -- what the customer was asked to pay on their page
          nullif(left(regexp_replace(coalesce(p ->> 'utr', ''), '[^A-Za-z0-9-]', '', 'g'), 40), ''),
          v_receipt,
          encode(gen_random_bytes(16), 'hex'), rid, sus,
          nullif(public.clerk_user_id(), ''),  -- null for guests
          v_client, v_check, v_coupon, nullif(v_off, 0));
  return v_ref;
exception when unique_violation then
  -- The same order arrived twice at once (a double tap): return the first.
  select * into o from public.orders where request_id = rid;
  if found then return o.ref; end if;
  raise;
end $$;

/* ---------- the admin (owner only) ---------- */
create or replace function public.admin_coupons() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('owner');
  return (select coalesce(jsonb_agg(to_jsonb(c) order by c.active desc, c.created_at desc), '[]') from public.coupons c);
end $$;

-- Add a code, or change one (the code itself is the key; "used" is never changed here).
create or replace function public.save_coupon(p jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  actor text := public._require('owner');
  v_code text := upper(regexp_replace(coalesce(p ->> 'code', ''), '\s', '', 'g'));
  v_kind text := p ->> 'kind';
  v_value int := coalesce(public._num(p ->> 'value'), 0)::int;
  int_or_null text;
begin
  if v_code !~ '^[A-Z0-9]{3,20}$' then raise exception 'BAD_COUPON' using hint = 'The code needs 3 to 20 letters or numbers, with no spaces.'; end if;
  if v_kind is null or v_kind not in ('percent', 'amount') then raise exception 'BAD_COUPON' using hint = 'Choose percent or rupees.'; end if;
  if v_value <= 0 or (v_kind = 'percent' and v_value > 90) then
    raise exception 'BAD_COUPON' using hint = case when v_kind = 'percent' then 'Enter a percentage from 1 to 90.' else 'Enter how many rupees to take off.' end;
  end if;
  insert into public.coupons as c (code, kind, value, min_total, max_off, starts_on, ends_on, max_uses, active, note)
  values (v_code, v_kind, v_value,
          greatest(0, coalesce(public._num(p ->> 'minTotal'), 0))::int,
          case when v_kind = 'percent' then nullif(greatest(0, coalesce(public._num(p ->> 'maxOff'), 0))::int, 0) end,
          nullif(p ->> 'startsOn', '')::date, nullif(p ->> 'endsOn', '')::date,
          nullif(greatest(0, coalesce(public._num(p ->> 'maxUses'), 0))::int, 0),
          coalesce((p ->> 'active')::boolean, true), nullif(left(trim(coalesce(p ->> 'note', '')), 200), ''))
  on conflict (code) do update set kind = excluded.kind, value = excluded.value, min_total = excluded.min_total,
    max_off = excluded.max_off, starts_on = excluded.starts_on, ends_on = excluded.ends_on, max_uses = excluded.max_uses,
    active = excluded.active, note = excluded.note, updated_at = now();
  perform public._log(actor, 'coupon_saved', 'coupons', v_code);
  return v_code;
end $$;

create or replace function public.delete_coupon(p_code text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner');
begin
  delete from public.coupons where code = p_code;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._log(actor, 'coupon_deleted', 'coupons', p_code);
end $$;

-- Admin → Orders: the coupon on each order, by order number.
create or replace function public.list_order_coupons() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('owner');
  return (select coalesce(jsonb_object_agg(ref, jsonb_build_object('code', coupon_code, 'off', discount)), '{}'::jsonb)
            from (select ref, coupon_code, discount from public.orders
                   where coupon_code is not null order by created_at desc limit 500) o);
end $$;

revoke all on function public._coupon_off(text, int), public.coupons_available(), public.check_coupon(text, int),
  public.admin_coupons(), public.save_coupon(jsonb), public.delete_coupon(text), public.list_order_coupons()
  from public, anon, authenticated;
grant execute on function public.coupons_available(), public.check_coupon(text, int), public.submit_order(jsonb) to anon, authenticated;
grant execute on function public.admin_coupons(), public.save_coupon(jsonb), public.delete_coupon(text), public.list_order_coupons() to authenticated;

-- Check: every line should say true.
select to_regclass('public.coupons') is not null as coupons_table,
       not has_table_privilege('anon', 'public.coupons', 'select') as codes_hidden_from_public,
       has_function_privilege('anon', 'public.check_coupon(text, int)', 'execute') as website_can_check,
       not has_function_privilege('anon', 'public.admin_coupons()', 'execute') as admin_list_private,
       not has_function_privilege('anon', 'public._coupon_off(text, int)', 'execute') as rule_private;
