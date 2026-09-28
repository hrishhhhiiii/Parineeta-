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
