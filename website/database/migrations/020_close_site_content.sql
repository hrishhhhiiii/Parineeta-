-- Close the pre-CMS content table to visitors (security item S6, 10 Oct).
-- site_content is the table the website read before the admin's draft and publish system existed. Nothing
-- reads it any more: the website is built from published_content, and the admin loads drafts with get_heads().
-- Publish still copies each published section into it, with the email of the owner who published (001_cms.sql).
-- Its original rule, "content is public", let anyone holding the website's public key read those rows, so the
-- owners' sign-in email addresses were readable by any visitor.
-- Now no rule lets visitors or signed-in customers read the table. Publish keeps working, because it runs with
-- the database owner's rights. published_content, which the website needs, stays public.
-- Does not depend on 017–019 and they do not depend on it: run it at any time. Safe to re-run.

drop policy if exists "content is public" on public.site_content;
revoke all on public.site_content from anon, authenticated;

-- Check (one row, three "true"):
select not has_table_privilege('anon', 'public.site_content', 'select') as visitors_cannot_read,
       not has_table_privilege('authenticated', 'public.site_content', 'select') as customers_cannot_read,
       has_table_privilege('anon', 'public.published_content', 'select') as website_content_still_public;
