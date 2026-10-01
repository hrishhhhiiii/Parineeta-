-- Hardening agreed in the 2026-09-29 review (PROJECT_LOG.md, "CEO review"). Run after 001–007.
-- 1.2 admins bound to Clerk user IDs · 2.2 idempotent orders · 3.2 separate rate budgets, suspects
-- 7.1/10.2 owner alert log and throttle · 8.1 order retention · 8.2 weekly backup export
-- 11.1 review of suspect submissions · extra: orders linked to signed-in customers.
-- Before the cron jobs at the end can call the functions, store two secrets in Vault:
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'functions_url');
--   select vault.create_secret('<long random string>', 'cron_secret');   -- same value as the CRON_SECRET function secret

/* ================= admins: bound to one Clerk account ================= */
alter table public.admins add column if not exists clerk_user_id text unique;

-- A bound row matches only its Clerk account. An unbound row matches its email until
-- claim_admin() binds it, so a later account with the same email can never inherit the role.
create or replace function public.admin_role() returns text
language sql stable security definer set search_path = public, extensions as $$
  select a.role from public.admins a
  where public.clerk_user_id() is not null
    and ((a.clerk_user_id is not null and a.clerk_user_id = public.clerk_user_id())
      or (a.clerk_user_id is null and lower(a.email) = lower(auth.jwt() ->> 'email')))
  order by (a.clerk_user_id is not null) desc
  limit 1;
$$;

-- Called by /admin on every sign-in: binds the signed-in Clerk account to its admin row once.
create or replace function public.claim_admin() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me text := public.clerk_user_id(); em text := lower(auth.jwt() ->> 'email'); r text;
begin
  if me is null or em is null then return null; end if;
  if not exists (select 1 from public.admins where clerk_user_id = me) then
    -- The admins_audit trigger records the binding in the activity log.
    update public.admins set clerk_user_id = me
     where clerk_user_id is null and lower(email) = em
    returning role into r;
  end if;
  return public.admin_role();
end $$;

-- Every change to the admins table lands in the activity log, whoever makes it (SQL editor included).
create or replace function public._log_staff_change() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._log(coalesce(auth.jwt() ->> 'email', current_user), 'staff_' || lower(tg_op), null,
    coalesce(new.email, old.email), coalesce(new.role, old.role),
    case when tg_op = 'UPDATE' then jsonb_build_object('before', jsonb_build_object('email', old.email, 'role', old.role, 'bound', old.clerk_user_id is not null),
                                                       'after', jsonb_build_object('email', new.email, 'role', new.role, 'bound', new.clerk_user_id is not null)) end);
  return coalesce(new, old);
end $$;
drop trigger if exists admins_audit on public.admins;
create trigger admins_audit after insert or update or delete on public.admins
  for each row execute function public._log_staff_change();

/* ================= suspect submissions (3.2, 11.1) ================= */
alter table public.enquiries add column if not exists suspect boolean not null default false;
alter table public.orders add column if not exists suspect boolean not null default false;
alter table public.orders add column if not exists request_id uuid unique;
alter table public.orders add column if not exists customer_id text;
alter table public.orders add column if not exists anonymized_at timestamptz;
create index if not exists orders_customer on public.orders (customer_id) where customer_id is not null;

-- Rate budgets, per hour. Per IP: up to 5 normal, 6–20 saved as suspect, more refused.
-- Across everyone: past 60 saved as suspect, past 500 refused (a flood guard, far above real use).
-- Enquiries ('enq:') and orders ('ord:') have separate budgets.
create or replace function public._rate(p_kind text, p_ip_hash text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare w timestamptz := date_trunc('hour', now()); n int; total int;
begin
  select coalesce(sum(count), 0) into total from public.enquiry_rate where window_start = w and ip_hash like p_kind || ':%';
  if total >= 500 then raise exception 'RATE_LIMITED'; end if;
  insert into public.enquiry_rate values (p_kind || ':' || p_ip_hash, w, 1)
    on conflict (ip_hash, window_start) do update set count = enquiry_rate.count + 1 returning count into n;
  if n > 20 then raise exception 'RATE_LIMITED'; end if;
  return n > 5 or total >= 60;   -- true: save it, but as suspect
end $$;

drop function if exists public._submit_enquiry(text, jsonb);
create function public._submit_enquiry(p_ip_hash text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare sus boolean := public._rate('enq', p_ip_hash); id uuid;
begin
  insert into public.enquiries (name, phone, email, event_date, place, items, note, track_hash, suspect)
  values (left(trim(p ->> 'name'), 120), nullif(p ->> 'phone', ''), nullif(left(p ->> 'email', 200), ''),
          nullif(p ->> 'eventDate', '')::date, nullif(left(p ->> 'place', 200), ''),
          coalesce(p -> 'items', '[]'), nullif(left(p ->> 'note', 4000), ''), nullif(p ->> 'trackHash', ''), sus)
  on conflict (track_hash) do nothing
  returning enquiries.id into id;
  return jsonb_build_object('id', id, 'suspect', sus, 'duplicate', id is null);
end $$;

/* ================= orders: idempotent, server-numbered on a clash (2.2) ================= */
create or replace function public._new_ref() returns text
language sql volatile set search_path = public, extensions as $$
  select 'PRN-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' ||
    (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '')
       from (select extensions.gen_random_bytes(4) b) x, generate_series(0, 3) i);
$$;

drop function if exists public._place_order(text, jsonb, text);
-- p is the receipt priced by the place-order function. A repeated request ID returns the saved
-- order; an order number already used by another request gets a fresh number.
create or replace function public._place_order(p_ip_hash text, p jsonb, p_token text, p_request_id uuid, p_customer_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare o public.orders; sus boolean; v_ref text := p ->> 'ref'; tries int := 0;
begin
  select * into o from public.orders where request_id = p_request_id;
  if found then
    return jsonb_build_object('ref', o.ref, 'token', o.receipt_token, 'suspect', o.suspect, 'existing', true, 'total', o.total, 'paidNow', o.paid_now);
  end if;
  sus := public._rate('ord', p_ip_hash);
  while exists (select 1 from public.orders x where x.ref = v_ref) loop
    tries := tries + 1;
    if tries > 5 then raise exception 'REF_EXHAUSTED'; end if;
    v_ref := public._new_ref();
  end loop;
  insert into public.orders (ref, name, phone, email, method, total, paid_now, utr, receipt, receipt_token, request_id, customer_id, suspect)
  values (v_ref, p ->> 'name', nullif(p ->> 'phone', ''), nullif(p ->> 'email', ''), p -> 'method' ->> 'id',
          (p ->> 'total')::int, (p ->> 'paidNow')::int, nullif(p ->> 'utr', ''),
          jsonb_set(p, '{ref}', to_jsonb(v_ref)), p_token, p_request_id, nullif(p_customer_id, ''), sus);
  return jsonb_build_object('ref', v_ref, 'token', p_token, 'suspect', sus, 'existing', false, 'total', (p ->> 'total')::int, 'paidNow', (p ->> 'paidNow')::int);
exception when unique_violation then
  -- The same request arrived twice at once (a double tap on a slow connection): return the first.
  select * into o from public.orders where request_id = p_request_id;
  if not found then raise; end if;
  return jsonb_build_object('ref', o.ref, 'token', o.receipt_token, 'suspect', o.suspect, 'existing', true, 'total', o.total, 'paidNow', o.paid_now);
end $$;

create or replace function public.list_orders() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('owner');
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'ref', ref, 'created_at', created_at, 'name', name, 'phone', phone, 'email', email, 'method', method,
      'total', total, 'paid_now', paid_now, 'utr', utr, 'items', receipt -> 'items', 'address', receipt ->> 'address',
      'plan', receipt ->> 'plan', 'event_date', receipt ->> 'eventDate', 'signed_in', customer_id is not null,
      'status', status, 'paid_amount', paid_amount, 'paid_at', paid_at, 'paid_by', paid_by, 'sent', sent,
      'suspect', suspect, 'anonymized', anonymized_at is not null)
      order by created_at desc), '[]')
    from (select * from public.orders order by created_at desc limit 500) o);
end $$;

-- /account: the signed-in customer's orders, matched by their Clerk account or their email.
create or replace function public.my_orders() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'ref', ref, 'createdAt', created_at, 'items', receipt -> 'items', 'total', total, 'paidNow', paid_now,
      'method', method, 'status', status, 'paidAmount', paid_amount, 'paidAt', paid_at, 'token', receipt_token)
      order by created_at desc), '[]')
  from public.orders
  where public.clerk_user_id() is not null and anonymized_at is null and not suspect
    and (customer_id = public.clerk_user_id()
      or (email is not null and lower(email) = lower(auth.jwt() ->> 'email')));
$$;

/* ================= review of suspect submissions (11.1) ================= */
create or replace function public.review_submission(p_kind text, p_id text, p_keep boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); n int;
begin
  if p_kind = 'enquiry' then
    if p_keep then update public.enquiries set suspect = false where id = p_id::uuid and suspect;
    else delete from public.enquiries where id = p_id::uuid and suspect; end if;
  elsif p_kind = 'order' then
    if p_keep then update public.orders set suspect = false where ref = p_id and suspect;
    else delete from public.orders where ref = p_id and suspect and status = 'placed'; end if;
  else
    raise exception 'BAD_KIND';
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOT_FOUND' using hint = 'It was already reviewed.'; end if;
  perform public._log(actor, case when p_keep then 'suspect_kept' else 'suspect_deleted' end, p_kind, p_id);
end $$;

/* ================= retention: keep the amounts, drop the person (8.1) ================= */
create or replace function public._anonymize_order(o public.orders) returns void
language sql security definer set search_path = public, extensions as $$
  update public.orders set name = 'Removed', phone = null, email = null, utr = null, customer_id = null,
    receipt = (receipt - 'name' - 'phone' - 'email' - 'address' - 'utr' - 'eventDate') || '{"name": "Removed"}',
    anonymized_at = now()
  where id = o.id and anonymized_at is null;
$$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.clerk_user_id(); em text := lower(auth.jwt() ->> 'email'); o public.orders;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if exists (select 1 from public.admins where clerk_user_id = me or lower(email) = em) then
    raise exception 'NOT_ALLOWED';
  end if;
  delete from public.enquiries where customer_id = me or lower(email) = em;
  delete from public.customer_carts where user_id = me;
  for o in select * from public.orders where customer_id = me or lower(email) = em loop
    perform public._anonymize_order(o);
  end loop;
end $$;

create or replace function public._retention() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare o public.orders;
begin
  for o in select * from public.orders where anonymized_at is null and created_at < now() - interval '6 years' loop
    perform public._anonymize_order(o);
  end loop;
end $$;

/* ================= owner alerts: log and budget (7.1, 10.2) ================= */
-- Every email the functions send (alerts, receipts, summaries, backups) is recorded here: the
-- throttle reads it, and queued rows are what the hourly summary sends.
create table if not exists public.alert_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null,            -- enquiry | order | failure | suspect | receipt | summary | backup | budget
  priority int not null default 5, -- lower is more important (orders 1, enquiries 2, failures 3, suspects 9)
  subject text not null check (char_length(subject) <= 300),
  body text check (char_length(body) <= 8000),
  ref text,
  status text not null check (status in ('sent', 'queued', 'summarized', 'failed', 'skipped')),
  error text
);
create index if not exists alert_log_at on public.alert_log (at desc);
create index if not exists alert_log_queued on public.alert_log (status) where status = 'queued';
alter table public.alert_log enable row level security;
revoke all on public.alert_log from anon, authenticated;

create or replace function public._alert_counts() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'hour', count(*) filter (where status = 'sent' and kind <> 'receipt' and at > now() - interval '1 hour'),
    'today', count(*) filter (where status = 'sent' and at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'),
    'warned_today', count(*) filter (where kind = 'budget' and at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') > 0)
  from public.alert_log where at > now() - interval '1 day';
$$;

create or replace function public._alert_record(p jsonb) returns bigint
language sql security definer set search_path = public as $$
  insert into public.alert_log (kind, priority, subject, body, ref, status, error)
  values (p ->> 'kind', coalesce((p ->> 'priority')::int, 5), left(p ->> 'subject', 300), left(p ->> 'body', 8000),
          p ->> 'ref', p ->> 'status', left(p ->> 'error', 500))
  returning id;
$$;

-- The hourly summary takes everything queued, most important first, and marks it summarized.
create or replace function public._alert_take_queued() returns jsonb
language sql security definer set search_path = public as $$
  with q as (
    update public.alert_log set status = 'summarized' where status = 'queued'
    returning id, at, kind, priority, subject, body, ref
  )
  select coalesce(jsonb_agg(to_jsonb(q) order by priority, at), '[]') from q;
$$;

-- If the summary email fails, its alerts go back in the queue for the next hour.
create or replace function public._alert_requeue(p_ids bigint[]) returns void
language sql security definer set search_path = public as $$
  update public.alert_log set status = 'queued' where id = any(p_ids) and status = 'summarized';
$$;

/* ================= weekly backup export (8.2) ================= */
create or replace function public._export_all() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'exportedAt', now(),
    'content', (select coalesce(jsonb_object_agg(h.key, jsonb_build_object('published', p.data, 'draft', d.data)), '{}')
                from public.content_heads h
                left join public.content_revisions p on p.id = h.published_rev
                left join public.content_revisions d on d.id = h.draft_rev),
    'enquiries', (select coalesce(jsonb_agg(to_jsonb(e) - 'track_hash' order by created_at), '[]') from public.enquiries e),
    'orders', (select coalesce(jsonb_agg(to_jsonb(o) - 'receipt_token' order by created_at), '[]') from public.orders o),
    'admins', (select coalesce(jsonb_agg(jsonb_build_object('email', email, 'role', role)), '[]') from public.admins));
$$;

/* ================= grants ================= */
revoke execute on function public._rate(text, text), public._submit_enquiry(text, jsonb), public._new_ref(),
  public._place_order(text, jsonb, text, uuid, text), public._anonymize_order(public.orders), public._retention(),
  public._alert_counts(), public._alert_record(jsonb), public._alert_take_queued(), public._alert_requeue(bigint[]),
  public._export_all(), public._log_staff_change()
  from public, anon, authenticated;
grant execute on function public._submit_enquiry(text, jsonb), public._place_order(text, jsonb, text, uuid, text),
  public._alert_counts(), public._alert_record(jsonb), public._alert_take_queued(), public._alert_requeue(bigint[]),
  public._export_all()
  to service_role;
revoke execute on function public.claim_admin(), public.my_orders(), public.review_submission(text, text, boolean),
  public.delete_my_account() from public, anon;
grant execute on function public.claim_admin(), public.my_orders(), public.review_submission(text, text, boolean),
  public.delete_my_account(), public.admin_role(), public.list_orders() to authenticated;

/* ================= cron ================= */
-- Calls a function with the shared cron secret. Does nothing until both Vault secrets exist.
create or replace function public._cron_call(p_fn text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare base text; secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'functions_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if base is null or secret is null then return; end if;
  perform net.http_post(url := rtrim(base, '/') || '/' || p_fn, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret), timeout_milliseconds := 30000);
end $$;
revoke execute on function public._cron_call(text) from public, anon, authenticated;

select cron.schedule('owner-alert-summary', '0 * * * *', $$select public._cron_call('send-summary')$$);
select cron.schedule('weekly-backup', '30 21 * * 6', $$select public._cron_call('weekly-backup')$$);   -- Sunday 03:00 IST
select cron.schedule('order-retention', '0 5 2 * *', $$select public._retention()$$);
select cron.schedule('alert-log-purge', '15 4 * * *', $$delete from public.alert_log where at < now() - interval '90 days' and status <> 'queued'$$);
