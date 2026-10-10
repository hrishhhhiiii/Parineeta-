-- Visitors can no longer list the files in photo storage (security item S10b, 10 Oct).
-- The "media is public" rule from schema.sql let anyone holding the website's public key ask the storage
-- service for every file name, upload date and size. The photos and 3D models themselves stay public:
-- a public bucket serves a file to anyone who has its address, without any rule. Only listing needed the
-- rule, and nothing on the website or in the admin lists files (they upload, then use the returned address).
-- Admins keep the right to see the file rows, which the storage service needs when an owner deletes a file.
-- Run after 001–021. Safe to re-run.

drop policy if exists "media is public" on storage.objects;
drop policy if exists "admins list media" on storage.objects;
create policy "admins list media" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- Check (one row, three "true"):
select (select public from storage.buckets where id = 'media') as files_still_public_by_address,
       not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'media is public') as public_listing_rule_gone,
       exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'admins list media') as admins_can_still_see_rows;
