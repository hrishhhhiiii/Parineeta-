-- The server works out each order's total from the published catalogue (security item S5).
-- Until now submit_order saved whatever total the customer's browser sent, so an edited page could record a
-- made-up price. Now the checkout also sends each line as data ({ id, pick, qty }), and the order is priced
-- here with the same rules as frontend/src/data/pricing.js:
--   unit = the exact price for that combination (the row naming the most choice groups wins; first on a tie),
--          else priceFrom + Σ the chosen options' extra price; a missing or unknown choice counts as the
--          group's first option. A bridal set costs its own price.
-- The order keeps the server's total (and per-line amounts on the receipt) and records what the page showed:
--   total_check 'ok'          the page's total matched the catalogue
--               'changed'     it did not (an edited page, or prices published while the customer was ordering):
--                             total = catalogue, client_total = what the page showed. Check before accepting money.
--               'unverified'  a line could not be priced here (no line data from an older page, a product not in
--                             the published catalogue, a choice without a code): the page's total is kept.
-- Orders are never refused for a price difference; the shop sees the note in Admin → Orders.
-- Run after 001–017. Safe to re-run, and independent of 017 (either order works). submit_order is 015's definition plus the pricing step.

alter table public.orders add column if not exists client_total int;
alter table public.orders add column if not exists total_check text
  check (total_check is null or total_check in ('ok', 'changed', 'unverified'));

-- JavaScript Number() for the values the admin saves: a plain number, else 0.
create or replace function public._num(t text) returns numeric
language sql immutable set search_path = public as $$
  select case when t ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then t::numeric else 0 end
$$;

-- One line's unit price from published products and sets, or null when it can't be priced from them.
create or replace function public._unit_price(p_products jsonb, p_sets jsonb, p_line jsonb) returns numeric
language plpgsql immutable set search_path = public as $$
declare
  pid text := p_line ->> 'id';
  pick jsonb := case when jsonb_typeof(p_line -> 'pick') = 'object' then p_line -> 'pick' else '{}'::jsonb end;
  prod jsonb;
  grp jsonb;
  groups jsonb := '[]'::jsonb;  -- usable groups: [{ id, options: [...] }]
  sel jsonb := '{}'::jsonb;     -- group id -> chosen option id
  chosen jsonb;
  unit numeric;
  r jsonb;
  names int;
  best_n int := 0;
  best_price numeric;
  e record;
  ok boolean;
begin
  if coalesce(pid, '') = '' then return null; end if;

  select x into prod from jsonb_array_elements(case when jsonb_typeof(p_products) = 'array' then p_products else '[]' end) x
   where x ->> 'id' = pid and x ->> 'en' is not null and coalesce(x ->> 'hidden', 'false') <> 'true' limit 1;
  if prod is null then
    select x into prod from jsonb_array_elements(case when jsonb_typeof(p_sets) = 'array' then p_sets else '[]' end) x
     where x ->> 'id' = pid and coalesce(x ->> 'hidden', 'false') <> 'true' limit 1;
    if prod is null or (prod ->> 'price') !~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then return null; end if;
    return (prod ->> 'price')::numeric;
  end if;

  -- variantsOf(): the choice groups, else the original option list as one group called "option".
  for grp in select g from jsonb_array_elements(
      case when jsonb_typeof(prod -> 'variants') = 'array' and jsonb_array_length(prod -> 'variants') > 0 then prod -> 'variants'
           when jsonb_typeof(prod -> 'combos') = 'array' and jsonb_array_length(prod -> 'combos') > 0
             then jsonb_build_array(jsonb_build_object('id', 'option', 'options', prod -> 'combos'))
           else '[]'::jsonb end) g
  loop
    if jsonb_typeof(grp) <> 'object' or jsonb_typeof(grp -> 'options') <> 'array' then continue; end if;
    grp := jsonb_build_object('id', grp ->> 'id', 'options',
      coalesce((select jsonb_agg(o) from jsonb_array_elements(grp -> 'options') o where jsonb_typeof(o) = 'object'), '[]'::jsonb));
    if jsonb_array_length(grp -> 'options') = 0 then continue; end if;
    if coalesce(grp ->> 'id', '') = '' then return null; end if;  -- the browser names these itself; can't match safely
    select o into chosen from jsonb_array_elements(grp -> 'options') o where o ->> 'id' = pick ->> (grp ->> 'id') limit 1;
    if chosen is null then chosen := grp -> 'options' -> 0; end if;
    if coalesce(chosen ->> 'id', '') = '' then return null; end if;
    groups := groups || jsonb_build_array(grp);
    sel := sel || jsonb_build_object(grp ->> 'id', chosen ->> 'id');
    chosen := null;
  end loop;

  -- Exact prices: a row applies when every group it names exists with that option and matches the choice.
  for r in select x from jsonb_array_elements(case when jsonb_typeof(prod -> 'prices') = 'array' then prod -> 'prices' else '[]' end) x loop
    if jsonb_typeof(r -> 'pick') <> 'object' or (r ->> 'price') !~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then continue; end if;
    names := 0;
    ok := true;
    for e in select key, value from jsonb_each(r -> 'pick') loop
      if jsonb_typeof(e.value) <> 'string' or e.value #>> '{}' = '' then continue; end if;  -- blank cells don't count
      names := names + 1;
      if sel ->> e.key is distinct from e.value #>> '{}'
         or not exists (select 1 from jsonb_array_elements(groups) g, jsonb_array_elements(g -> 'options') o
                         where g ->> 'id' = e.key and o ->> 'id' = e.value #>> '{}') then
        ok := false;
      end if;
    end loop;
    if ok and names > best_n then best_n := names; best_price := (r ->> 'price')::numeric; end if;
  end loop;
  if best_price is not null then return best_price; end if;

  unit := public._num(prod ->> 'priceFrom');
  for grp in select g from jsonb_array_elements(groups) g loop
    select public._num(o ->> 'add') + unit into unit from jsonb_array_elements(grp -> 'options') o
     where o ->> 'id' = sel ->> (grp ->> 'id') limit 1;
  end loop;
  return unit;
end $$;

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
  v_client int := greatest(0, coalesce(public._num(p ->> 'total'), 0))::int;
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

  v_receipt := (p - 'requestId' - 'lines') || jsonb_build_object('ref', null, 'clientRef', p ->> 'ref');
  if v_check = 'ok' then
    v_total := round(sum_total)::int;
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
    v_total := v_client;
  end if;

  -- The browser makes the order number (it goes in the UPI note); on the rare clash, make a new one.
  if v_ref is null or v_ref !~ '^PRN-[0-9]{6}-[A-Z0-9]{4}$' or exists (select 1 from public.orders where ref = v_ref) then
    v_ref := public._new_ref();
  end if;
  v_receipt := jsonb_set(v_receipt, '{ref}', to_jsonb(v_ref));

  insert into public.orders (ref, name, phone, email, method, total, paid_now, utr, receipt, receipt_token, request_id, suspect, customer_id,
                             client_total, total_check)
  values (v_ref, v_name, v_phone, v_email, v_method,
          v_total,
          greatest(0, coalesce(public._num(p ->> 'paidNow'), 0))::int,  -- what the customer was asked to pay on their page
          nullif(left(regexp_replace(coalesce(p ->> 'utr', ''), '[^A-Za-z0-9-]', '', 'g'), 40), ''),
          v_receipt,
          encode(gen_random_bytes(16), 'hex'), rid, sus,
          nullif(public.clerk_user_id(), ''),  -- null for guests
          v_client, v_check);
  return v_ref;
exception when unique_violation then
  -- The same order arrived twice at once (a double tap): return the first.
  select * into o from public.orders where request_id = rid;
  if found then return o.ref; end if;
  raise;
end $$;

-- Admin → Orders: the orders whose total needs a look, by order number (owner only).
create or replace function public.list_total_checks() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('owner');
  return (select coalesce(jsonb_object_agg(ref, jsonb_build_object('check', total_check, 'clientTotal', client_total)), '{}'::jsonb)
            from (select ref, total_check, client_total from public.orders
                   where total_check in ('changed', 'unverified') order by created_at desc limit 500) o);
end $$;

revoke all on function public._num(text), public._unit_price(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.submit_order(jsonb) to anon, authenticated;
grant execute on function public.list_total_checks() to authenticated;

-- Checks (each returns one row):
select public._unit_price('[{"id":"t","en":"T","priceFrom":100,"variants":[{"id":"size","options":[{"id":"s","add":0},{"id":"l","add":50}]}],"prices":[{"pick":{"size":"l"},"price":120}]}]', null, '{"id":"t","pick":{"size":"l"}}') = 120 as exact_price_wins;
select public._unit_price('[{"id":"t","en":"T","priceFrom":100,"variants":[{"id":"size","options":[{"id":"s","add":0},{"id":"l","add":50}]}]}]', null, '{"id":"t","pick":{"size":"zz"}}') = 100 as unknown_choice_is_first;
select public._unit_price('[]', '[{"id":"set1","price":2500}]', '{"id":"set1"}') = 2500 as set_price;
select public._unit_price('[]', null, '{"id":"nope"}') is null as unknown_product_unverified;
