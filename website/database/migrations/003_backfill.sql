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
