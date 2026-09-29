-- Parineeta: full database setup. Paste all of this into Supabase → SQL Editor → New query → Run.
-- Generated from database/schema.sql + migrations 001–007. Safe to re-run.
-- Set up Clerk in Supabase first (ADMIN-SETUP.md → Sign-in).


-- ======== database/schema.sql ========
-- Parineeta shop admin: run this once in Supabase → SQL Editor → New query → Run.
-- Then add the owner's login email in the INSERT at the bottom (and re-run just that line).

-- Every editable part of the site is one JSON document, keyed by name
-- (products, categories, sets, settings, reviews, trust, lookbook, services, story).
create table if not exists public.site_content (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Who may edit. Only emails listed here can save changes or upload photos.
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

alter table public.site_content enable row level security;
alter table public.admins enable row level security;

drop policy if exists "content is public" on public.site_content;
create policy "content is public" on public.site_content for select using (true);

drop policy if exists "admins write content" on public.site_content;
create policy "admins write content" on public.site_content for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins see admin list" on public.admins;
create policy "admins see admin list" on public.admins for select using (public.is_admin());

-- Photo storage: anyone can view, only admins can upload or delete.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media is public" on storage.objects;
create policy "media is public" on storage.objects for select using (bucket_id = 'media');

drop policy if exists "admins upload media" on storage.objects;
create policy "admins upload media" on storage.objects for insert with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "admins change media" on storage.objects;
create policy "admins change media" on storage.objects for update using (bucket_id = 'media' and public.is_admin());

drop policy if exists "admins delete media" on storage.objects;
create policy "admins delete media" on storage.objects for delete using (bucket_id = 'media' and public.is_admin());

-- ▼ Put the shop owner's login email here.
insert into public.admins (email) values ('owner-login@example.com') on conflict do nothing;


-- ======== database/migrations/001_cms.sql ========
-- Parineeta CMS: drafts, revisions, publish pipeline, activity, enquiries.
-- Run after database/schema.sql. Then run 002_schemas.sql and 003_backfill.sql.
-- Before running: enable the pg_net, pg_cron and pg_jsonschema extensions (Database → Extensions),
-- and store the GitHub token in Vault:  select vault.create_secret('<token>', 'github_dispatch_token');

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists pg_jsonschema;

/* ================= roles ================= */
alter table public.admins add column if not exists role text not null default 'owner'
  check (role in ('owner', 'editor'));

create or replace function public.admin_role() returns text
language sql stable security definer set search_path = public, extensions as $$
  select role from public.admins where lower(email) = lower(auth.jwt() ->> 'email');
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$ select public.admin_role() is not null; $$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public, extensions as $$ select public.admin_role() = 'owner'; $$;

create or replace function public._require(role_needed text) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare r text := public.admin_role();
begin
  if r is null or (role_needed = 'owner' and r <> 'owner') then
    raise exception 'NOT_ALLOWED' using errcode = '42501', hint = 'Your account can''t do this.';
  end if;
  return auth.jwt() ->> 'email';
end $$;

/* ================= config (one row) ================= */
create table if not exists public.cms_config (
  id boolean primary key default true check (id),
  github_repo text,                       -- 'owner/repo'
  target text not null default 'production' check (target in ('production', 'staging')),
  pat_expires_on date,                    -- N13: dashboard warns 14 days before
  site_url text
);
insert into public.cms_config (id) values (true) on conflict do nothing;

/* ================= content ================= */
create table if not exists public.content_schemas (key text primary key, schema jsonb not null);

create table if not exists public.content_revisions (
  id bigserial primary key,
  key text not null references public.content_schemas(key),
  data jsonb not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  source text not null check (source in ('save', 'restore', 'reset', 'migration'))
);
create index if not exists content_revisions_key_at on public.content_revisions (key, created_at desc);

create sequence if not exists public.publish_seq;

create table if not exists public.content_heads (
  key text primary key references public.content_schemas(key),
  draft_rev bigint references public.content_revisions(id),
  published_rev bigint references public.content_revisions(id),
  deployed_rev bigint references public.content_revisions(id),   -- N1: what the live site actually has
  published_seq bigint,                                          -- N3
  version int not null default 0,                                -- bumped by save/restore/reset only
  updated_at timestamptz, updated_by text,
  published_at timestamptz, published_by text
);

create table if not exists public.publish_jobs (
  id bigserial primary key,
  seq bigint not null,
  requested_at timestamptz not null default now(),
  requested_by text not null,
  keys text[] not null,
  target text not null default 'production',
  secret_hash text not null,                                     -- N6: sha256 of the per-job secret
  net_request_id bigint,
  status text not null default 'queued' check (status in ('queued', 'building', 'live', 'failed')),
  run_url text, deploy_url text, error text, finished_at timestamptz
);
create index if not exists publish_jobs_requested on public.publish_jobs (requested_at desc);

create table if not exists public.scheduled_publishes (
  id bigserial primary key,
  rev_map jsonb not null,
  publish_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled', 'failed')),
  error text
);

create table if not exists public.activity_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  entity_key text, entity_ref text, entity_label text,
  detail jsonb
);
create index if not exists activity_log_at on public.activity_log (at desc);

create or replace view public.published_content as
  select h.key, r.data, h.published_at, h.published_seq
  from public.content_heads h join public.content_revisions r on r.id = h.published_rev;

/* ================= enquiries ================= */
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  phone text check (phone ~ '^\+?[0-9 ]{8,16}$'),
  email text check (char_length(email) <= 200),
  event_date date,
  place text check (char_length(place) <= 200),
  items jsonb not null default '[]',
  note text check (char_length(note) <= 4000),
  status text not null default 'new'
    check (status in ('new', 'replied', 'ordered', 'painting', 'ready', 'delivered', 'closed')),
  status_note text check (char_length(status_note) <= 500),   -- shown to the customer on the tracking page
  status_updated_at timestamptz,
  track_hash text unique                                       -- sha256 of the customer's tracking token
);
create index if not exists enquiries_created on public.enquiries (created_at desc);
create index if not exists enquiries_status on public.enquiries (status);

create table if not exists public.enquiry_rate (
  ip_hash text not null,
  window_start timestamptz not null,
  count int not null,
  primary key (ip_hash, window_start)
);

/* ================= helpers ================= */
create or replace function public._log(actor text, action text, key text default null, ref text default null,
                                       label text default null, detail jsonb default null) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.activity_log (actor, action, entity_key, entity_ref, entity_label, detail)
  values (actor, action, key, ref, label, detail);
$$;

create or replace function public._validate(p_key text, p_data jsonb) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
declare s jsonb;
begin
  select schema into s from public.content_schemas where key = p_key;
  if s is null then raise exception 'UNKNOWN_KEY' using hint = p_key; end if;
  if not jsonb_matches_schema(s::json, p_data) then
    raise exception 'INVALID_CONTENT' using detail = array_to_string(jsonschema_validation_errors(s::json, p_data), '; ');
  end if;
end $$;

-- Keys whose draft differs from what is published.
create or replace function public._dirty() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_object_agg(key, draft_rev), '{}') from public.content_heads
  where draft_rev is not null and draft_rev is distinct from published_rev;
$$;

/* ================= drafts ================= */
create or replace function public.save_draft(p_key text, p_data jsonb, p_expected_version int,
                                             p_source text default 'save') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('editor'); rev bigint; v int;
begin
  if p_source not in ('save', 'reset') then raise exception 'BAD_SOURCE'; end if;
  perform public._validate(p_key, p_data);
  insert into public.content_heads (key) values (p_key) on conflict do nothing;
  insert into public.content_revisions (key, data, created_by, source) values (p_key, p_data, actor, p_source)
    returning id into rev;
  update public.content_heads set draft_rev = rev, version = version + 1, updated_at = now(), updated_by = actor
    where key = p_key and version = p_expected_version returning version into v;
  if v is null then
    raise exception 'CONTENT_CONFLICT' using hint = 'Someone else saved this section. Reload to see their changes.';
  end if;
  perform public._log(actor, case p_source when 'reset' then 'reset' else 'save' end, p_key, rev::text);
  return jsonb_build_object('rev', rev, 'version', v);
end $$;

create or replace function public.restore_revision(p_rev bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); r public.content_revisions; rev bigint; v int;
begin
  select * into r from public.content_revisions where id = p_rev;
  if r.id is null then raise exception 'NOT_FOUND'; end if;
  perform public._validate(r.key, r.data);
  insert into public.content_revisions (key, data, created_by, source) values (r.key, r.data, actor, 'restore')
    returning id into rev;
  update public.content_heads set draft_rev = rev, version = version + 1, updated_at = now(), updated_by = actor
    where key = r.key returning version into v;
  perform public._log(actor, 'restore', r.key, rev::text, null, jsonb_build_object('from', p_rev));
  return jsonb_build_object('rev', rev, 'version', v);
end $$;

create or replace function public.get_heads() returns table (
  key text, draft jsonb, published jsonb, version int, draft_rev bigint, published_rev bigint,
  deployed_rev bigint, updated_at timestamptz, updated_by text, published_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('editor');
  return query
    select h.key, d.data, p.data, h.version, h.draft_rev, h.published_rev, h.deployed_rev,
           h.updated_at, h.updated_by, h.published_at
    from public.content_heads h
    left join public.content_revisions d on d.id = h.draft_rev
    left join public.content_revisions p on p.id = h.published_rev;
end $$;

create or replace function public.list_revisions(p_key text, p_limit int default 30) returns table (
  id bigint, created_at timestamptz, created_by text, source text)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('editor');
  return query select r.id, r.created_at, r.created_by, r.source from public.content_revisions r
    where r.key = p_key order by r.id desc limit least(p_limit, 200);
end $$;

/* ================= publish ================= */
-- Internal: used by publish(), redeploy() and the schedule cron. Never granted to clients.
create or replace function public._publish(p_rev_map jsonb, p_actor text, p_redeploy_keys text[] default null)
returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  k text; rev bigint; cur bigint; seq bigint; job bigint; secret text; cfg public.cms_config;
  keys text[] := coalesce(p_redeploy_keys, '{}'); skipped text[] := '{}'; token text; req bigint;
begin
  perform pg_advisory_xact_lock(hashtext('cms_publish'));
  seq := nextval('public.publish_seq');                     -- N3: taken after the lock
  for k, rev in select key, value::bigint from jsonb_each_text(p_rev_map) loop
    select published_rev into cur from public.content_heads where key = k;
    if cur is not null and cur >= rev then                   -- N2: never roll a newer publish back
      skipped := skipped || k; continue;
    end if;
    perform public._validate(k, (select data from public.content_revisions where id = rev and key = k));
    update public.content_heads set published_rev = rev, published_seq = seq, published_at = now(),
      published_by = p_actor where key = k;
    -- Write-through to the pre-CMS table until the old loader is gone everywhere.
    insert into public.site_content (key, data, updated_at, updated_by)
      select k, data, now(), p_actor from public.content_revisions where id = rev
      on conflict (key) do update set data = excluded.data, updated_at = now(), updated_by = p_actor;
    keys := keys || k;
  end loop;
  if cardinality(keys) = 0 then
    if cardinality(skipped) > 0 then return null; end if;
    raise exception 'NO_CHANGES' using hint = 'Everything is already live.';
  end if;

  select * into cfg from public.cms_config;
  secret := encode(extensions.gen_random_bytes(24), 'hex');            -- N6: one-job secret instead of service_role
  insert into public.publish_jobs (seq, requested_by, keys, target, secret_hash)
    values (seq, p_actor, keys, cfg.target, encode(extensions.digest(secret, 'sha256'), 'hex')) returning id into job;

  select decrypted_secret into token from vault.decrypted_secrets where name = 'github_dispatch_token';
  if token is null or cfg.github_repo is null then
    update public.publish_jobs set status = 'failed', error = 'Publishing isn''t connected yet (GitHub token or repo missing).',
      finished_at = now() where id = job;
  else
    select net.http_post(
      url := format('https://api.github.com/repos/%s/dispatches', cfg.github_repo),
      body := jsonb_build_object('event_type', 'cms-publish',
        'client_payload', jsonb_build_object('job_id', job, 'secret', secret, 'target', cfg.target)),
      headers := jsonb_build_object('Authorization', 'Bearer ' || token, 'Accept', 'application/vnd.github+json',
        'User-Agent', 'parineeta-cms', 'X-GitHub-Api-Version', '2022-11-28', 'Content-Type', 'application/json'),
      timeout_milliseconds := 10000) into req;
    update public.publish_jobs set net_request_id = req where id = job;
  end if;

  perform public._log(p_actor, case when p_redeploy_keys is not null then 'redeploy' else 'publish' end,
    null, job::text, null, jsonb_build_object('keys', keys, 'skipped', skipped));
  return job;
end $$;

create or replace function public.publish() returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); dirty jsonb := public._dirty();
begin
  if dirty = '{}' then raise exception 'NO_CHANGES' using hint = 'Everything is already live.'; end if;
  return public._publish(dirty, actor);
end $$;

-- N1: rebuild the site for published content that never went live (e.g. after a failed build).
create or replace function public.redeploy() returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); pending text[];
begin
  select coalesce(array_agg(key), '{}') into pending from public.content_heads
    where published_rev is distinct from deployed_rev;
  if cardinality(pending) = 0 then pending := array['(rebuild)']; end if;
  return public._publish('{}', actor, pending);
end $$;

create or replace function public.schedule_publish(p_at timestamptz) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); dirty jsonb := public._dirty(); id bigint;
begin
  if dirty = '{}' then raise exception 'NO_CHANGES'; end if;
  if p_at < now() + interval '5 minutes' then raise exception 'TOO_SOON' using hint = 'Pick a time at least 5 minutes ahead.'; end if;
  insert into public.scheduled_publishes (rev_map, publish_at, created_by) values (dirty, p_at, actor) returning scheduled_publishes.id into id;
  perform public._log(actor, 'schedule', null, id::text, null, jsonb_build_object('at', p_at, 'keys', dirty));
  return id;
end $$;

create or replace function public.cancel_schedule(p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner');
begin
  update public.scheduled_publishes set status = 'cancelled' where id = p_id and status = 'pending';
  perform public._log(actor, 'cancel_schedule', null, p_id::text);
end $$;

-- Cron: every 5 minutes.
create or replace function public._run_schedules() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s public.scheduled_publishes; job bigint;
begin
  for s in select * from public.scheduled_publishes where status = 'pending' and publish_at <= now() order by publish_at loop
    begin
      job := public._publish(s.rev_map, s.created_by || ' (scheduled)');
      update public.scheduled_publishes set status = 'done',
        error = case when job is null then 'Everything in it was already replaced by a newer publish.' end where id = s.id;
    exception when others then
      update public.scheduled_publishes set status = 'failed', error = sqlerrm where id = s.id;
    end;
  end loop;
end $$;

-- Cron: every minute. Fails jobs whose GitHub dispatch didn't get a 204, and jobs stuck > 30 min.
create or replace function public._sweep_dispatches() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.publish_jobs j set status = 'failed', finished_at = now(),
    error = format('Couldn''t start the update (GitHub answered %s).', coalesce(r.status_code::text, r.error_msg))
  from net._http_response r
  where j.status = 'queued' and r.id = j.net_request_id and coalesce(r.status_code, 0) <> 204;

  update public.publish_jobs set status = 'failed', finished_at = now(), error = 'Couldn''t reach GitHub.'
  where status = 'queued' and requested_at < now() - interval '2 minutes'
    and not exists (select 1 from net._http_response r where r.id = net_request_id);

  update public.publish_jobs set status = 'failed', finished_at = now(), error = 'The update took too long and was stopped.'
  where status = 'building' and requested_at < now() - interval '30 minutes';
end $$;

-- Called by the GitHub Action with the job's secret (N6). Granted to anon; the hash is the key.
create or replace function public.mark_job(p_id bigint, p_secret text, p_status text,
                                           p_run_url text default null, p_deploy_url text default null,
                                           p_error text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare j public.publish_jobs;
begin
  select * into j from public.publish_jobs where id = p_id;
  if j.id is null or j.secret_hash <> encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex') then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if p_status not in ('building', 'live', 'failed') then raise exception 'BAD_STATUS'; end if;

  if p_status = 'live' then
    -- This build fetched everything published up to its own seq, so earlier jobs are live too (N3).
    update public.publish_jobs set status = 'live', finished_at = now(), deploy_url = coalesce(p_deploy_url, deploy_url),
      run_url = coalesce(run_url, p_run_url)
      where target = j.target and seq <= j.seq and status in ('queued', 'building', 'failed');
    update public.content_heads set deployed_rev = published_rev where published_seq <= j.seq;
  else
    update public.publish_jobs set status = p_status, run_url = coalesce(p_run_url, run_url), error = p_error,
      finished_at = case when p_status = 'failed' then now() end
      where id = p_id and status <> 'live';
  end if;
  perform public._log('github-action', 'job_' || p_status, null, p_id::text);
end $$;

/* ================= media ================= */
create or replace function public.media_usage(p_url text) returns table (key text, state text)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('editor');
  return query
    with refs as (
      select h.key, 'draft' as state, h.draft_rev as rev from public.content_heads h
      union all select h.key, 'published', h.published_rev from public.content_heads h
      union all select e.key, 'scheduled', e.value::bigint from public.scheduled_publishes s,
        jsonb_each_text(s.rev_map) e where s.status = 'pending')
    select distinct refs.key, refs.state from refs join public.content_revisions r on r.id = refs.rev
    where position(p_url in r.data::text) > 0;
end $$;

/* ================= enquiries ================= */
-- Called only by the submit-enquiry Edge Function (service_role).
create or replace function public._submit_enquiry(p_ip_hash text, p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare w timestamptz := date_trunc('hour', now()); n int; total int; id uuid;
begin
  select coalesce(sum(count), 0) into total from public.enquiry_rate where window_start = w;
  if total >= 60 then raise exception 'RATE_LIMITED'; end if;             -- N9: global backstop
  insert into public.enquiry_rate values (p_ip_hash, w, 1)
    on conflict (ip_hash, window_start) do update set count = enquiry_rate.count + 1 returning count into n;
  if n > 5 then raise exception 'RATE_LIMITED'; end if;
  insert into public.enquiries (name, phone, email, event_date, place, items, note, track_hash)
  values (left(trim(p ->> 'name'), 120), nullif(p ->> 'phone', ''), nullif(left(p ->> 'email', 200), ''),
          nullif(p ->> 'eventDate', '')::date, nullif(left(p ->> 'place', 200), ''),
          coalesce(p -> 'items', '[]'), nullif(left(p ->> 'note', 4000), ''), nullif(p ->> 'trackHash', ''))
  on conflict (track_hash) do nothing
  returning enquiries.id into id;
  return id;
end $$;

create or replace function public.set_enquiry_status(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner');
begin
  update public.enquiries set status = p_status, status_note = nullif(trim(p_note), ''), status_updated_at = now()
    where id = p_id;
  perform public._log(actor, 'enquiry_status', null, p_id::text, p_status);
end $$;

-- Public tracking page. Knowing the 128-bit token is the only credential; returns no contact details.
create or replace function public.track_enquiry(p_token text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'firstName', split_part(name, ' ', 1), 'createdAt', created_at, 'eventDate', event_date,
    'items', items, 'status', status, 'statusNote', status_note, 'statusUpdatedAt', status_updated_at)
  from public.enquiries
  where p_token ~ '^[0-9a-f]{32}$' and track_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.delete_enquiry(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner');
begin
  delete from public.enquiries where id = p_id;
  perform public._log(actor, 'enquiry_delete', null, p_id::text);
end $$;

/* ================= backup ================= */
create or replace function public.export_content() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('owner');
  return jsonb_build_object(
    'exported_at', now(),
    'heads', (select coalesce(jsonb_agg(to_jsonb(h)), '[]') from public.content_heads h),
    'revisions', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]') from (
      select *, row_number() over (partition by key order by id desc) n from public.content_revisions) r
      where r.n <= 20 or r.id in (select draft_rev from public.content_heads union select published_rev from public.content_heads)));
end $$;

/* ================= grants and RLS ================= */
alter table public.cms_config enable row level security;
alter table public.content_schemas enable row level security;
alter table public.content_revisions enable row level security;
alter table public.content_heads enable row level security;
alter table public.publish_jobs enable row level security;
alter table public.scheduled_publishes enable row level security;
alter table public.activity_log enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_rate enable row level security;

revoke all on public.cms_config, public.content_schemas, public.content_revisions, public.content_heads,
  public.publish_jobs, public.scheduled_publishes, public.activity_log, public.enquiries, public.enquiry_rate
  from anon, authenticated;

grant select on public.cms_config, public.content_heads, public.scheduled_publishes, public.activity_log,
  public.content_schemas to authenticated;
grant select (id, seq, requested_at, requested_by, keys, target, status, run_url, deploy_url, error, finished_at)
  on public.publish_jobs to authenticated;
grant select on public.enquiries to authenticated;

drop policy if exists admin_read on public.cms_config;
create policy admin_read on public.cms_config for select to authenticated using (public.is_admin());
drop policy if exists admin_read on public.content_heads;
create policy admin_read on public.content_heads for select to authenticated using (public.is_admin());
drop policy if exists admin_read on public.content_schemas;
create policy admin_read on public.content_schemas for select to authenticated using (public.is_admin());
drop policy if exists admin_read on public.publish_jobs;
create policy admin_read on public.publish_jobs for select to authenticated using (public.is_admin());
drop policy if exists admin_read on public.scheduled_publishes;
create policy admin_read on public.scheduled_publishes for select to authenticated using (public.is_admin());
drop policy if exists admin_read on public.activity_log;
create policy admin_read on public.activity_log for select to authenticated using (public.is_admin());
drop policy if exists owner_read on public.enquiries;
create policy owner_read on public.enquiries for select to authenticated using (public.is_owner());

-- The public view runs with its owner's rights, so anon reads published data without table access.
grant select on public.published_content to anon, authenticated;

-- The pre-CMS table stays readable during cutover but only the publish pipeline writes it.
drop policy if exists "admins write content" on public.site_content;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.save_draft(text, jsonb, int, text), public.restore_revision(bigint),
  public.get_heads(), public.list_revisions(text, int), public.publish(), public.redeploy(),
  public.schedule_publish(timestamptz), public.cancel_schedule(bigint), public.media_usage(text),
  public.set_enquiry_status(uuid, text, text), public.delete_enquiry(uuid), public.export_content(),
  public.is_admin(), public.is_owner(), public.admin_role()
  to authenticated;
grant execute on function public.mark_job(bigint, text, text, text, text, text) to anon, authenticated;
grant execute on function public.track_enquiry(text) to anon, authenticated;
revoke execute on function public._publish(jsonb, text, text[]), public._run_schedules(),
  public._sweep_dispatches(), public._submit_enquiry(text, jsonb), public._validate(text, jsonb),
  public._dirty(), public._log(text, text, text, text, text, jsonb), public._require(text)
  from authenticated;
grant execute on function public._submit_enquiry(text, jsonb) to service_role;
-- _require is called inside the security-definer RPCs, which run as their owner, so no grant is needed.

/* ================= storage ================= */
update storage.buckets set allowed_mime_types = array['image/webp'], file_size_limit = 5242880 where id = 'media';
drop policy if exists "admins change media" on storage.objects;          -- paths are unique per upload
drop policy if exists "admins delete media" on storage.objects;
create policy "owners delete media" on storage.objects for delete using (bucket_id = 'media' and public.is_owner());

/* ================= cron ================= */
select cron.schedule('cms-dispatch-sweep', '* * * * *', 'select public._sweep_dispatches()');
select cron.schedule('cms-scheduled-publish', '*/5 * * * *', 'select public._run_schedules()');
select cron.schedule('cms-enquiry-purge', '0 3 * * *', $$delete from public.enquiries where created_at < now() - interval '18 months'$$);
select cron.schedule('cms-rate-purge', '5 * * * *', $$delete from public.enquiry_rate where window_start < now() - interval '2 hours'$$);
select cron.schedule('cms-revision-prune', '0 4 1 * *', $$
  delete from public.content_revisions r where r.created_at < now() - interval '180 days'
    and r.id not in (select draft_rev from public.content_heads where draft_rev is not null
                     union select published_rev from public.content_heads where published_rev is not null
                     union select deployed_rev from public.content_heads where deployed_rev is not null
                     union select e.value::bigint from public.scheduled_publishes s, jsonb_each_text(s.rev_map) e
                       where s.status = 'pending')
    and r.id not in (select id from (select id, row_number() over (partition by key order by id desc) n
                                     from public.content_revisions) x where x.n <= 20)$$);


-- ======== database/migrations/002_schemas.sql ========
-- Generated by npm run cms:schemas. Do not edit by hand.
insert into public.content_schemas (key, schema) values
  ('products', '{"type":"array","items":{"type":"object","properties":{"en":{"type":"string","maxLength":20000},"bn":{"type":["string","null"],"maxLength":20000},"id":{"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"},"category":{"type":"string","maxLength":20000},"priceFrom":{"type":"number","minimum":0},"line":{"type":["string","null"],"maxLength":20000},"story":{"type":["string","null"],"maxLength":20000},"media":{"type":["array","null"],"items":{"type":"object","properties":{"type":{"type":["string","null"],"maxLength":20000},"id":{"type":"string","maxLength":20000},"title":{"type":["string","null"],"maxLength":20000}},"required":["id"]}},"styles":{"type":"array","items":{"type":"string"}},"combos":{"type":["array","null"],"items":{"type":"object","properties":{"label":{"type":"string","maxLength":20000},"add":{"type":["number","null"],"minimum":0},"id":{"type":["string","null"]}},"required":["label"]}},"leadDays":{"type":["number","null"],"minimum":0},"customizable":{"type":["boolean","null"]},"customHelp":{"type":["string","null"],"maxLength":20000},"model":{"type":["object","null"],"properties":{"kind":{"type":"string","maxLength":20000},"image":{"type":["string","null"],"maxLength":20000}},"required":["kind"]},"hidden":{"type":["boolean","null"]}},"required":["en","id","category","priceFrom","styles","model"]}}'::jsonb),
  ('categories', '{"type":"array","items":{"type":"object","properties":{"label":{"type":"string","maxLength":20000},"bn":{"type":["string","null"],"maxLength":20000},"id":{"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"},"line":{"type":["string","null"],"maxLength":20000}},"required":["label","id"]}}'::jsonb),
  ('sets', '{"type":"array","items":{"type":"object","properties":{"en":{"type":"string","maxLength":20000},"bn":{"type":["string","null"],"maxLength":20000},"id":{"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"},"price":{"type":"number","minimum":0},"line":{"type":["string","null"],"maxLength":20000},"items":{"type":"array","items":{"type":"string"}},"hidden":{"type":["boolean","null"]}},"required":["en","id","price","items"]}}'::jsonb),
  ('reviews', '{"type":"array","items":{"type":"object","properties":{"product":{"type":"string","maxLength":20000},"name":{"type":"string","maxLength":20000},"place":{"type":["string","null"],"maxLength":20000},"date":{"type":"string","maxLength":20000},"rating":{"type":["string","null"],"maxLength":20000},"title":{"type":["string","null"],"maxLength":20000},"text":{"type":"string","maxLength":20000},"style":{"type":["string","null"],"maxLength":20000},"verified":{"type":["boolean","null"]},"hidden":{"type":["boolean","null"]}},"required":["product","name","date","text"]}}'::jsonb),
  ('settings', '{"type":"object","properties":{"site":{"type":["object","null"],"properties":{"whatsapp":{"type":["string","null"],"maxLength":20000},"email":{"type":["string","null"],"maxLength":20000},"web3formsKey":{"type":["string","null"],"maxLength":20000}}},"payments":{"type":["object","null"],"properties":{"advancePercent":{"type":["number","null"],"minimum":0},"upi":{"type":["object","null"],"properties":{"id":{"type":["string","null"],"maxLength":20000},"payeeName":{"type":["string","null"],"maxLength":20000}}},"bank":{"type":["object","null"],"properties":{"accountName":{"type":["string","null"],"maxLength":20000},"accountNumber":{"type":["string","null"],"maxLength":20000},"ifsc":{"type":["string","null"],"maxLength":20000},"bankName":{"type":["string","null"],"maxLength":20000}}},"gatewayLink":{"type":["string","null"],"maxLength":20000},"payAtShop":{"type":["boolean","null"]}}}}}'::jsonb),
  ('lookbook', '{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","maxLength":20000},"title":{"type":"string","maxLength":20000}},"required":["id","title"]}}'::jsonb),
  ('trust', '{"type":"array","items":{"type":"object","properties":{"id":{"type":"string","maxLength":20000},"caption":{"type":"string","maxLength":20000},"guest":{"type":["string","null"],"maxLength":20000}},"required":["id","caption"]}}'::jsonb),
  ('services', '{"type":"array","items":{"type":"object","properties":{"title":{"type":"string","maxLength":20000},"bn":{"type":["string","null"],"maxLength":20000},"id":{"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"},"body":{"type":["string","null"],"maxLength":20000},"photo":{"type":["string","null"],"maxLength":20000},"size":{"type":["string","null"],"maxLength":20000}},"required":["title","id"]}}'::jsonb),
  ('story', '{"type":"array","items":{"type":"object","properties":{"moment":{"type":["string","null"],"maxLength":20000},"title":{"type":"string","maxLength":20000},"body":{"type":"string","maxLength":20000},"product":{"type":"string","maxLength":20000},"photo":{"type":["object","null"],"properties":{"type":{"type":["string","null"],"maxLength":20000},"id":{"type":["string","null"],"maxLength":20000}}}},"required":["title","body","product"]}}'::jsonb),
  ('announcement', '{"type":"object","properties":{"text":{"type":["string","null"],"maxLength":200},"linkText":{"type":["string","null"],"maxLength":60},"linkUrl":{"type":["string","null"],"maxLength":500,"pattern":"^(https://|/|#|$)"},"startsAt":{"type":["string","null"],"maxLength":40},"endsAt":{"type":["string","null"],"maxLength":40},"visible":{"type":["boolean","null"]}}}'::jsonb),
  ('homepage', '{"type":"object","properties":{"hero":{"type":["object","null"],"properties":{"strip":{"type":["string","null"],"maxLength":20000},"stripEn":{"type":["string","null"],"maxLength":20000},"title":{"type":"string","maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"sub":{"type":["string","null"],"maxLength":20000},"ctaText":{"type":["string","null"],"maxLength":20000},"photo":{"type":["string","null"],"maxLength":20000},"photoAlt":{"type":["string","null"],"maxLength":20000},"metaBn":{"type":["string","null"],"maxLength":20000},"meta":{"type":["string","null"],"maxLength":20000}},"required":["title"]},"trust":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}},"story":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}},"filmband":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}},"collection":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}},"sets":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}},"lookbook":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}},"studio":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}},"invitations":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}},"services":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}},"reels":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}},"visit":{"type":["object","null"],"properties":{"title":{"type":["string","null"],"maxLength":20000},"titleEm":{"type":["string","null"],"maxLength":20000},"lede":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}}}},"required":["hero"]}'::jsonb),
  ('stores', '{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","maxLength":20000},"address":{"type":"string","maxLength":20000},"phones":{"type":["string","null"],"maxLength":20000},"hours":{"type":["string","null"],"maxLength":20000},"mapsQuery":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}},"required":["name","address"]}}'::jsonb),
  ('socials', '{"type":"array","items":{"type":"object","properties":{"platform":{"type":"string","maxLength":20000},"url":{"type":"string","maxLength":20000},"handle":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}},"required":["platform","url"]}}'::jsonb),
  ('videos', '{"type":"array","items":{"type":"object","properties":{"youtubeId":{"type":"string","maxLength":20000},"title":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}},"required":["youtubeId"]}}'::jsonb),
  ('seo', '{"type":"object","properties":{"title":{"type":["string","null"],"maxLength":20000},"description":{"type":["string","null"],"maxLength":20000},"ogTitle":{"type":["string","null"],"maxLength":20000},"ogDescription":{"type":["string","null"],"maxLength":20000},"ogImage":{"type":["string","null"],"maxLength":20000}}}'::jsonb)
on conflict (key) do update set schema = excluded.schema;


-- ======== database/migrations/003_backfill.sql ========
-- Copies today's site_content rows into the revision model as both draft and published (and deployed,
-- since the live site already shows them). Safe to re-run: keys that already have a head are skipped.
do $$
declare r record; rev bigint;
begin
  for r in select s.key, s.data from public.site_content s
           join public.content_schemas c on c.key = s.key
           where not exists (select 1 from public.content_heads h where h.key = s.key) loop
    perform public._validate(r.key, r.data);
    insert into public.content_revisions (key, data, created_by, source) values (r.key, r.data, 'migration', 'migration')
      returning id into rev;
    insert into public.content_heads (key, draft_rev, published_rev, deployed_rev, published_seq, version, updated_at, updated_by, published_at, published_by)
      values (r.key, rev, rev, rev, nextval('public.publish_seq'), 1, now(), 'migration', now(), 'migration');
  end loop;
  -- Keys with no row yet start empty; their first save creates the head.
  insert into public.content_heads (key) select key from public.content_schemas on conflict do nothing;
end $$;


-- ======== database/migrations/004_customer_accounts.sql ========
-- Optional customer accounts: email sign-in link, no password. Run after 001–003.
-- A customer sees their own enquiries: ones sent from their verified email, or ones they claimed
-- with a tracking link. Admin data stays closed to them: every admin RPC checks the admins table.
alter table public.enquiries add column if not exists customer_id uuid references auth.users (id) on delete set null;
create index if not exists enquiries_customer on public.enquiries (customer_id);
create index if not exists enquiries_email_lower on public.enquiries (lower(email));

create or replace function public.my_enquiries() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'createdAt', created_at, 'eventDate', event_date, 'items', items,
    'status', status, 'statusNote', status_note, 'statusUpdatedAt', status_updated_at) order by created_at desc), '[]')
  from public.enquiries
  where auth.uid() is not null
    and (customer_id = auth.uid()
      or (email is not null and lower(email) = lower(auth.jwt() ->> 'email')));
$$;

-- Links an enquiry (e.g. one sent by WhatsApp without an email) to the signed-in customer.
create or replace function public.claim_enquiry(p_token text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  update public.enquiries set customer_id = auth.uid()
   where p_token ~ '^[0-9a-f]{32}$' and track_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and (customer_id is null or customer_id = auth.uid());
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- A customer can delete their account and the enquiries tied to it. Admin logins can't use this.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email')) then
    raise exception 'NOT_ALLOWED';
  end if;
  delete from public.enquiries where customer_id = auth.uid()
     or lower(email) = lower(auth.jwt() ->> 'email');
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function public.my_enquiries(), public.claim_enquiry(text), public.delete_my_account() from public, anon;
grant execute on function public.my_enquiries(), public.claim_enquiry(text), public.delete_my_account() to authenticated;


-- Make the owner an 'owner' (can publish).
update public.admins set role = 'owner' where email = 'owner-login@example.com';


-- ======== database/migrations/005_customer_carts.sql ========
-- Signed-in customers' cart and wishlist, so they follow the person to any device. Run after 001–004.
-- Each person can only read and write their own row; deleting the login deletes the row.
create table if not exists public.customer_carts (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  cart jsonb not null default '[]' check (jsonb_typeof(cart) = 'array' and jsonb_array_length(cart) <= 100),
  wish jsonb not null default '[]' check (jsonb_typeof(wish) = 'array' and jsonb_array_length(wish) <= 200),
  updated_at timestamptz not null default now(),
  check (pg_column_size(cart) + pg_column_size(wish) < 64000)
);

alter table public.customer_carts enable row level security;

drop policy if exists own_cart_read on public.customer_carts;
create policy own_cart_read on public.customer_carts for select to authenticated using (user_id = auth.uid());
drop policy if exists own_cart_insert on public.customer_carts;
create policy own_cart_insert on public.customer_carts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists own_cart_update on public.customer_carts;
create policy own_cart_update on public.customer_carts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.customer_carts from anon, authenticated;
grant select, insert, update on public.customer_carts to authenticated;


-- ======== database/migrations/006_clerk.sql ========
-- Sign-in moves from Supabase Auth to Clerk. Run after 001–005, once Clerk is added in
-- Supabase → Authentication → Sign In / Providers → Third-party auth (see ADMIN-SETUP.md).
-- Clerk ids look like 'user_2abc…', not UUIDs, so auth.uid() can't read them: the signed-in
-- person is the token's 'sub' claim. Admin roles and "my enquiries" still match on the token's
-- 'email' claim, which the Clerk session token must include.

create or replace function public.clerk_user_id() returns text
language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '') $$;

/* ---------- enquiries: customer_id holds a Clerk id ---------- */
-- Links to old Supabase logins are dropped. Customers still see those enquiries through their
-- email, and one sent without an email can be claimed again from its tracking link.
alter table public.enquiries drop constraint if exists enquiries_customer_id_fkey;
do $$ begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'enquiries' and column_name = 'customer_id') = 'uuid' then
    alter table public.enquiries alter column customer_id type text using null;
  end if;
end $$;

create or replace function public.my_enquiries() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'createdAt', created_at, 'eventDate', event_date, 'items', items,
    'status', status, 'statusNote', status_note, 'statusUpdatedAt', status_updated_at) order by created_at desc), '[]')
  from public.enquiries
  where public.clerk_user_id() is not null
    and (customer_id = public.clerk_user_id()
      or (email is not null and lower(email) = lower(auth.jwt() ->> 'email')));
$$;

create or replace function public.claim_enquiry(p_token text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  me text := public.clerk_user_id();
  n int;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  update public.enquiries set customer_id = me
   where p_token ~ '^[0-9a-f]{32}$' and track_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and (customer_id is null or customer_id = me);
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Deletes the customer's data. The website then deletes the Clerk login itself.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.clerk_user_id();
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email')) then
    raise exception 'NOT_ALLOWED';
  end if;
  delete from public.enquiries where customer_id = me
     or lower(email) = lower(auth.jwt() ->> 'email');
  delete from public.customer_carts where user_id = me;
end $$;

/* ---------- carts: keyed by Clerk id ---------- */
-- Saved carts belonged to Supabase logins nobody can sign in to any more. Each browser keeps
-- its own copy and uploads it again on the first Clerk sign-in.
drop policy if exists own_cart_read on public.customer_carts;
drop policy if exists own_cart_insert on public.customer_carts;
drop policy if exists own_cart_update on public.customer_carts;
alter table public.customer_carts drop constraint if exists customer_carts_user_id_fkey;
delete from public.customer_carts where user_id::text !~ '^user_';
alter table public.customer_carts alter column user_id drop default;
alter table public.customer_carts alter column user_id type text;
alter table public.customer_carts alter column user_id set default public.clerk_user_id();

create policy own_cart_read on public.customer_carts for select to authenticated using (user_id = public.clerk_user_id());
create policy own_cart_insert on public.customer_carts for insert to authenticated with check (user_id = public.clerk_user_id());
create policy own_cart_update on public.customer_carts for update to authenticated
  using (user_id = public.clerk_user_id()) with check (user_id = public.clerk_user_id());


-- ======== database/migrations/007_orders.sql ========
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
