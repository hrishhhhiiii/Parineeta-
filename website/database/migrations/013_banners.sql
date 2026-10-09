-- Promo banners in the admin (shop catalogue, phase 3): registers the new section so it can be saved
-- and published. Run after 001-012. Safe to re-run.

insert into public.content_schemas (key, schema) values
  ('banners', '{"type":"array","items":{"type":"object","properties":{"photo":{"type":"string","maxLength":20000},"title":{"type":"string","maxLength":20000},"line":{"type":["string","null"],"maxLength":20000},"linkType":{"type":["string","null"],"maxLength":20000},"linkProduct":{"type":["string","null"],"maxLength":20000},"linkCategory":{"type":["string","null"],"maxLength":20000},"linkSearch":{"type":["string","null"],"maxLength":20000},"linkUrl":{"type":["string","null"],"maxLength":20000},"start":{"type":["string","null"],"maxLength":20000},"end":{"type":["string","null"],"maxLength":20000},"hidden":{"type":["boolean","null"]}},"required":["photo","title"]}}'::jsonb)
on conflict (key) do update set schema = excluded.schema;

-- Check: one row.
select key from public.content_schemas where key = 'banners';
