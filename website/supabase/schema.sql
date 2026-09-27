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
