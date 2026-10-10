-- Closing the remaining gaps from the 10 Oct security check.
--   1. The limits on orders, reviews and coupon tries counted the first address in X-Forwarded-For, which the
--      sender can make up (checked on the live project: a made-up value arrives first). They now count
--      CF-Connecting-IP, which Cloudflare sets itself and refuses to accept from the sender.
--   2. Coupons need a signed-in customer (the checkout already does), tries are counted per account as well as
--      per connection, and a code can be limited to one use per customer (the default for new codes).
--   3. Unused table permissions and unused public functions are taken away.
-- Run after 001–020. Safe to re-run. submit_order is 019's definition with points 1 and 2.

/* ---------- 1. the caller's real address ---------- */
create or replace function public._client_ip() returns text
language sql stable set search_path = public as $$
  select coalesce(
    nullif(trim(current_setting('request.headers', true)::json ->> 'cf-connecting-ip'), ''),
    -- No Cloudflare header (a direct call): the address added last, by Supabase's own gateway.
    nullif(trim(regexp_replace(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), '^.*,', '')), ''),
    'unknown');
$$;

/* ---------- 2. coupons: signed-in customers, once each ---------- */
alter table public.coupons add column if not exists once_per_customer boolean not null default true;
create index if not exists orders_customer_coupon on public.orders (customer_id, coupon_code) where coupon_code is not null;

drop function if exists public._coupon_off(text, int);
-- { ok: true, code, off, label } or { ok: false, reason } (reason is shown to the customer). p_customer: Clerk id.
create or replace function public._coupon_off(p_code text, p_total int, p_customer text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  c public.coupons;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  today date := (now() at time zone 'Asia/Kolkata')::date;
  off int;
begin
  if nullif(p_customer, '') is null then return jsonb_build_object('ok', false, 'reason', 'Please sign in to use a coupon code.'); end if;
  if v_code !~ '^[A-Z0-9]{3,20}$' then return jsonb_build_object('ok', false, 'reason', 'That code is not valid.'); end if;
  select * into c from public.coupons where code = v_code;
  if not found or not c.active or (c.starts_on is not null and today < c.starts_on) then
    return jsonb_build_object('ok', false, 'reason', 'That code is not valid.');
  end if;
  if c.ends_on is not null and today > c.ends_on then return jsonb_build_object('ok', false, 'reason', 'That code has ended.'); end if;
  if c.max_uses is not null and c.used >= c.max_uses then return jsonb_build_object('ok', false, 'reason', 'That code has been used up.'); end if;
  if c.once_per_customer and exists (select 1 from public.orders where customer_id = p_customer and coupon_code = c.code) then
    return jsonb_build_object('ok', false, 'reason', 'You have already used this code.');
  end if;
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

-- Signed-in customers only. 20 tries an hour per account and per connection, so codes can't be found by guessing.
create or replace function public.check_coupon(p_code text, p_total int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me text := nullif(public.clerk_user_id(), '');
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'Please sign in to use a coupon code.'); end if;
  perform public._rate('cpu', encode(digest(me, 'sha256'), 'hex'));
  perform public._rate('cpn', encode(digest(public._client_ip(), 'sha256'), 'hex'));
  return public._coupon_off(p_code, greatest(0, coalesce(p_total, 0)), me);
end $$;

/* ---------- checkout → orders ---------- */
create or replace function public.submit_order(p jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  rid uuid;
  me text := nullif(public.clerk_user_id(), '');  -- null when the order came without a signed-in account
  v_ref text := p ->> 'ref';
  v_name text := left(trim(coalesce(p ->> 'name', '')), 120);
  v_phone text := nullif(trim(regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9+ ]', '', 'g')), '');
  v_email text := nullif(left(trim(coalesce(p ->> 'email', '')), 200), '');
  v_method text := p -> 'method' ->> 'id';
  v_items jsonb := p -> 'items';
  v_lines jsonb := p -> 'lines';
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

  sus := public._rate('ord', encode(digest(public._client_ip(), 'sha256'), 'hex'));  -- raises RATE_LIMITED past 20/hour from one connection

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

  -- The coupon, worked out here from that total, for a signed-in customer. Counted as used only if still usable now.
  if v_coupon is not null then
    c := public._coupon_off(v_coupon, v_subtotal, me);
    if (c ->> 'ok')::boolean then
      update public.coupons set used = used + 1 where code = c ->> 'code' and (max_uses is null or used < max_uses);
      get diagnostics hit = row_count;
      if hit > 0 then v_off := (c ->> 'off')::int; end if;
    end if;
    if v_off = 0 then
      v_coupon := null;
      if v_check = 'unverified' then v_subtotal := v_client + v_client_off; end if;  -- the refused discount goes back on
    end if;
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
          me,
          v_client, v_check, v_coupon, nullif(v_off, 0));
  return v_ref;
exception when unique_violation then
  -- The same order arrived twice at once (a double tap): return the first.
  select * into o from public.orders where request_id = rid;
  if found then return o.ref; end if;
  raise;
end $$;

/* ---------- the admin: coupons ---------- */
create or replace function public.save_coupon(p jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  actor text := public._require('owner');
  v_code text := upper(regexp_replace(coalesce(p ->> 'code', ''), '\s', '', 'g'));
  v_kind text := p ->> 'kind';
  v_value int := coalesce(public._num(p ->> 'value'), 0)::int;
begin
  if v_code !~ '^[A-Z0-9]{3,20}$' then raise exception 'BAD_COUPON' using hint = 'The code needs 3 to 20 letters or numbers, with no spaces.'; end if;
  if v_kind is null or v_kind not in ('percent', 'amount') then raise exception 'BAD_COUPON' using hint = 'Choose percent or rupees.'; end if;
  if v_value <= 0 or (v_kind = 'percent' and v_value > 90) then
    raise exception 'BAD_COUPON' using hint = case when v_kind = 'percent' then 'Enter a percentage from 1 to 90.' else 'Enter how many rupees to take off.' end;
  end if;
  insert into public.coupons as c (code, kind, value, min_total, max_off, starts_on, ends_on, max_uses, active, note, once_per_customer)
  values (v_code, v_kind, v_value,
          greatest(0, coalesce(public._num(p ->> 'minTotal'), 0))::int,
          case when v_kind = 'percent' then nullif(greatest(0, coalesce(public._num(p ->> 'maxOff'), 0))::int, 0) end,
          nullif(p ->> 'startsOn', '')::date, nullif(p ->> 'endsOn', '')::date,
          nullif(greatest(0, coalesce(public._num(p ->> 'maxUses'), 0))::int, 0),
          coalesce((p ->> 'active')::boolean, true), nullif(left(trim(coalesce(p ->> 'note', '')), 200), ''),
          coalesce((p ->> 'oncePerCustomer')::boolean, true))
  on conflict (code) do update set kind = excluded.kind, value = excluded.value, min_total = excluded.min_total,
    max_off = excluded.max_off, starts_on = excluded.starts_on, ends_on = excluded.ends_on, max_uses = excluded.max_uses,
    active = excluded.active, note = excluded.note, once_per_customer = excluded.once_per_customer, updated_at = now();
  perform public._log(actor, 'coupon_saved', 'coupons', v_code);
  return v_code;
end $$;

/* ---------- reviews and the older "notify me" counters: the real address ---------- */
create or replace function public.submit_review(p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  sus boolean;
  v_text text := left(trim(coalesce(p ->> 'text', '')), 1000);
  v_name text := left(trim(coalesce(p ->> 'name', '')), 60);
  v_rating int;
begin
  begin v_rating := (p ->> 'rating')::int; exception when others then v_rating := 0; end;
  if v_rating not between 1 and 5 then raise exception 'BAD_REVIEW' using hint = 'rating'; end if;
  if char_length(v_name) < 2 then raise exception 'BAD_REVIEW' using hint = 'name'; end if;
  if char_length(v_text) < 20 then raise exception 'BAD_REVIEW' using hint = 'text'; end if;
  if coalesce(p ->> 'product', '') !~ '^[a-z0-9-]{1,80}$' then raise exception 'BAD_REVIEW' using hint = 'product'; end if;
  sus := public._rate('rev', encode(digest(public._client_ip(), 'sha256'), 'hex'));  -- refuses past 20 an hour from one connection
  insert into public.reviews (product, rating, name, place, style, phone, title, text, source, suspect)
  values (p ->> 'product', v_rating, v_name,
          nullif(left(trim(coalesce(p ->> 'place', '')), 60), ''),
          nullif(left(trim(coalesce(p ->> 'style', '')), 40), ''),
          nullif(left(regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9+ ]', '', 'g'), 20), ''),
          nullif(left(trim(coalesce(p ->> 'title', '')), 120), ''),
          v_text, 'website', sus);
end $$;

/* ---------- 3. permissions nobody needs ---------- */
revoke all on function public._client_ip(), public._coupon_off(text, int, text), public.check_coupon(text, int) from public, anon, authenticated;
grant execute on function public.check_coupon(text, int) to authenticated;
grant execute on function public.submit_order(jsonb), public.submit_review(jsonb) to anon, authenticated;
grant execute on function public.save_coupon(jsonb) to authenticated;

do $$
declare f regprocedure; t text;
begin
  -- "Notify me" and "searches that found nothing" left the website on 10 Oct; their public functions go too.
  -- pg_jsonschema's helpers are only used inside the content-saving functions, which run as their owner.
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('log_search_miss', 'request_restock', '_demand_visitor',
              'json_matches_schema', 'jsonb_matches_schema', 'jsonschema_is_valid', 'jsonschema_validation_errors')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  -- A fixed search path for the two functions Supabase's checker flags.
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('clerk_user_id', '_demand_day')
  loop
    execute format('alter function %s set search_path = public', f);
  end loop;
  -- These three are only ever read from the website. Row-level security already blocked writes; now the
  -- permission is gone as well.
  foreach t in array array['published_content', 'admins', 'site_content'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
revoke select on public.admins from anon;

-- Check: every line should say true.
select not has_function_privilege('anon', 'public.check_coupon(text, int)', 'execute') as coupons_need_sign_in,
       has_function_privilege('authenticated', 'public.check_coupon(text, int)', 'execute') as customers_can_check,
       has_function_privilege('anon', 'public.submit_order(jsonb)', 'execute') as orders_still_arrive,
       not has_table_privilege('anon', 'public.published_content', 'insert') as published_read_only,
       has_table_privilege('anon', 'public.published_content', 'select') as website_reads_published,
       position('_client_ip' in pg_get_functiondef('public.submit_order(jsonb)'::regprocedure)) > 0 as real_address_counted;
