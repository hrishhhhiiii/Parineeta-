-- A Publish that GitHub accepted but whose build never reported back (for example because the
-- build couldn't reach Supabase) used to stay "queued" for ever. That kept the admin on
-- "Taking longer than usual…" and blocked the next Publish. Run after 001–009. Safe to re-run.
-- The cron job from 001 calls this every minute, so a stuck job clears within a minute.
create or replace function public._sweep_dispatches() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.publish_jobs j set status = 'failed', finished_at = now(),
    error = format('Couldn''t start the update (the build service answered %s).', coalesce(r.status_code::text, r.error_msg))
  from net._http_response r
  where j.status = 'queued' and r.id = j.net_request_id and coalesce(r.status_code, 0) not between 200 and 299;

  update public.publish_jobs set status = 'failed', finished_at = now(), error = 'Couldn''t reach the build service.'
  where status = 'queued' and requested_at < now() - interval '2 minutes'
    and not exists (select 1 from net._http_response r where r.id = net_request_id);

  -- Accepted but the build never said it started: it couldn't reach Supabase, or never ran.
  update public.publish_jobs set status = 'failed', finished_at = now(),
    error = 'The update never started. Check the run log, then press Retry update.'
  where status = 'queued' and requested_at < now() - interval '15 minutes';

  update public.publish_jobs set status = 'failed', finished_at = now(), error = 'The update took too long and was stopped.'
  where status = 'building' and requested_at < now() - interval '30 minutes';
end $$;

revoke all on function public._sweep_dispatches() from public, anon, authenticated;

-- Clear any job already stuck (the cron would do it within a minute; this does it now).
select public._sweep_dispatches();
