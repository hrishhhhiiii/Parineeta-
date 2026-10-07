-- "3D models" in the admin: switch built-in shapes on or off, and upload the shop's own 3D models
-- (.glb files, up to 20 MB each). Run after 001–011. Safe to re-run.

-- 1. The new admin section, so it can be saved and published like the others.
insert into public.content_schemas (key, schema) values
  ('models', '{"type":"object","properties":{"off":{"type":["array","null"],"items":{"type":"string"}},"custom":{"type":["array","null"],"items":{"type":"object","properties":{"id":{"type":"string","pattern":"^[a-z0-9][a-z0-9-]*$"},"name":{"type":"string","maxLength":20000},"file":{"type":"string","maxLength":20000},"hidden":{"type":["boolean","null"]}},"required":["id","name","file"]}}}}'::jsonb)
on conflict (key) do update set schema = excluded.schema;

-- 2. The media storage also accepts .glb 3D models. Photos are still shrunk in the browser before upload,
--    so the larger limit only matters for models. 20 MB keeps each file under the hosts' per-file limit.
update storage.buckets
set allowed_mime_types = array['image/webp', 'model/gltf-binary'],
    file_size_limit = 20971520
where id = 'media';

-- 3. Admins and editors can upload into the models/ folder (photos keep their existing upload rule).
drop policy if exists "admins upload models" on storage.objects;
create policy "admins upload models" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'models' and public.is_admin());

-- Check: both lines should show the new values.
select key from public.content_schemas where key = 'models';
select allowed_mime_types, file_size_limit from storage.buckets where id = 'media';
