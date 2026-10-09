-- Shop catalogue, phase 4: what customers looked for and didn't find, and "Notify me" for sold-out pieces.
-- Run after 001-013. Safe to re-run.
--
--   website ── log_search_miss(term) ───────────────► search_misses   (words only, no personal data)
--           ── request_restock(product, pick, phone) ► restock_requests (phone kept 90 days)
--   admin   ── admin_demand(), clear_search_miss(), restock_done() (admins and editors only)
--
-- Limits per day (India time): search words 20 per visitor and 300 new words overall; notify-me 5 per phone,
-- 10 per visitor and 200 overall. Calls over a limit are dropped and the day is flagged, so the admin can
-- see spam instead of it hiding silently.

create table if not exists public.search_misses (
  term text primary key check (char_length(term) between 2 and 60),
  count int not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.restock_requests (
  id uuid primary key default gen_random_uuid(),
  product text not null check (product ~ '^[a-z0-9-]{1,80}$'),
  pick jsonb not null default '{}' check (jsonb_typeof(pick) = 'object'),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists restock_requests_once on public.restock_requests (product, pick, phone);
create index if not exists restock_requests_created on public.restock_requests (created_at);

-- Daily counters for the limits above, and "flag:*" rows marking days a limit was hit.
create table if not exists public.demand_rate (
  day date not null,
  key text not null,
  count int not null default 0,
  primary key (day, key)
);

alter table public.search_misses enable row level security;
alter table public.restock_requests enable row level security;
alter table public.demand_rate enable row level security;
revoke all on public.search_misses, public.restock_requests, public.demand_rate from anon, authenticated;

/* ---------- helpers ---------- */
create or replace function public._demand_day() returns date
language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- Adds one to today's counter and returns the new count.
create or replace function public._demand_count(p_key text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  insert into public.demand_rate as r (day, key, count) values (public._demand_day(), p_key, 1)
  on conflict (day, key) do update set count = r.count + 1
  returning r.count into n;
  return n;
end $$;

-- The visitor, as a hash of their IP (same header the reviews use). Null when the header is missing, in which
-- case the per-visitor limit is skipped and only the per-phone and overall limits apply.
create or replace function public._demand_visitor() returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare ip text := trim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1));
begin
  return case when ip = '' then null else encode(digest(ip, 'sha256'), 'hex') end;
end $$;

/* ---------- the website ---------- */
create or replace function public.log_search_miss(p_term text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  t text := lower(regexp_replace(trim(coalesce(p_term, '')), '\s+', ' ', 'g'));
  v text := public._demand_visitor();
begin
  if char_length(t) < 2 or char_length(t) > 60 or t ~* '(https?:|www\.|[<>{}]|\.(com|in|net|org)\M)' then return; end if;
  if v is not null and public._demand_count('miss:v:' || v) > 20 then
    perform public._demand_count('flag:miss');
    return;
  end if;
  if not exists (select 1 from public.search_misses where term = t) and public._demand_count('miss:new') > 300 then
    perform public._demand_count('flag:miss');
    return;
  end if;
  insert into public.search_misses as s (term) values (t)
  on conflict (term) do update set count = s.count + 1, last_seen = now();
end $$;

-- Returns 'ok' or 'duplicate'. A filled-in spam trap (p_website) or an unknown product also says 'ok' and
-- saves nothing, so a script learns nothing. Raises BAD_PHONE or RATE_LIMITED.
create or replace function public.request_restock(p_product text, p_pick jsonb, p_phone text, p_website text default '')
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  ph text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);  -- "+91 98765 43210" → 9876543210
  pk jsonb := case when jsonb_typeof(p_pick) = 'object' and pg_column_size(p_pick) < 600 then p_pick else '{}'::jsonb end;
  v text := public._demand_visitor();
begin
  if coalesce(p_website, '') <> '' then return 'ok'; end if;
  if ph !~ '^[6-9][0-9]{9}$' then raise exception 'BAD_PHONE'; end if;
  if coalesce(p_product, '') !~ '^[a-z0-9-]{1,80}$' or not exists (
    select 1 from public.published_content c, jsonb_array_elements(c.data) x
    where c.key = 'products' and x ->> 'id' = p_product) then
    return 'ok';
  end if;
  if exists (select 1 from public.restock_requests where product = p_product and pick = pk and phone = ph) then
    return 'duplicate';
  end if;
  if public._demand_count('notify:p:' || ph) > 5
     or (v is not null and public._demand_count('notify:v:' || v) > 10)
     or public._demand_count('notify:all') > 200 then
    perform public._demand_count('flag:notify');
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.restock_requests (product, pick, phone) values (p_product, pk, ph)
  on conflict do nothing;
  return 'ok';
end $$;

/* ---------- the admin (owner and editors) ---------- */
create or replace function public.admin_demand() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('editor');
  return jsonb_build_object(
    'misses', (select coalesce(jsonb_agg(to_jsonb(m) order by m.count desc, m.last_seen desc), '[]')
               from (select * from public.search_misses order by count desc, last_seen desc limit 200) m),
    'requests', (select coalesce(jsonb_agg(to_jsonb(r) order by r.product, r.created_at), '[]')
                 from (select * from public.restock_requests order by created_at desc limit 1000) r),
    'flags', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'kind', substr(key, 6)) order by day desc), '[]')
              from public.demand_rate where key like 'flag:%' and day > public._demand_day() - 30));
end $$;

create or replace function public.clear_search_miss(p_term text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._require('editor');
  delete from public.search_misses where term = p_term;
end $$;

-- "Done, clear": the customer has been told; their number is removed.
create or replace function public.restock_done(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._require('editor');
  delete from public.restock_requests where id = any(p_ids);
end $$;

revoke execute on function public._demand_day(), public._demand_count(text), public._demand_visitor(),
  public.log_search_miss(text), public.request_restock(text, jsonb, text, text),
  public.admin_demand(), public.clear_search_miss(text), public.restock_done(uuid[])
  from public, anon, authenticated;
grant execute on function public.log_search_miss(text), public.request_restock(text, jsonb, text, text) to anon, authenticated;
grant execute on function public.admin_demand(), public.clear_search_miss(text), public.restock_done(uuid[]) to authenticated;

/* ---------- clean-up (pg_cron, already enabled in 001) ---------- */
select cron.schedule('shop-miss-purge', '15 3 * * *', $$delete from public.search_misses where last_seen < now() - interval '180 days'$$);
select cron.schedule('shop-restock-purge', '20 3 * * *', $$delete from public.restock_requests where created_at < now() - interval '90 days'$$);
select cron.schedule('shop-demand-rate-purge', '25 3 * * *', $$delete from public.demand_rate where day < (now() at time zone 'Asia/Kolkata')::date - 31$$);

/* ---------- check: every line should say true ---------- */
select to_regclass('public.search_misses') is not null as misses_table,
       to_regclass('public.restock_requests') is not null as restock_table,
       not has_table_privilege('anon', 'public.restock_requests', 'select') as phones_hidden_from_public,
       has_function_privilege('anon', 'public.request_restock(text, jsonb, text, text)', 'execute') as website_can_ask,
       not has_function_privilege('anon', 'public.admin_demand()', 'execute') as admin_list_private,
       (select count(*) from cron.job where jobname in ('shop-miss-purge', 'shop-restock-purge', 'shop-demand-rate-purge')) = 3 as cleanups_scheduled;
