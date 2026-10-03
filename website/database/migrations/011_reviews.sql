-- Every review is kept here: written by customers on the website, added by the shop in the admin,
-- or imported later from Google, Facebook, Instagram or YouTube. The shop switches "Show on website"
-- on for the ones customers should see; the website reads those directly, so changes show at once
-- (no "Put changes live" needed). Run after 001–010. Safe to re-run.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  review_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  product text check (product ~ '^[a-z0-9-]{1,80}$'),        -- null: about the shop in general
  rating int check (rating between 1 and 5),                  -- null: a comment with no stars (e.g. YouTube)
  name text not null check (char_length(name) between 1 and 80),
  place text check (char_length(place) <= 60),
  title text check (char_length(title) <= 120),
  text text not null check (char_length(text) between 1 and 2000),
  style text check (char_length(style) <= 40),
  phone text check (char_length(phone) <= 20),               -- private: only for the shop to check the order
  source text not null default 'website'
    check (source in ('website', 'shop', 'google', 'facebook', 'instagram', 'youtube', 'whatsapp')),
  source_url text check (source_url ~ '^https://' and char_length(source_url) <= 500),
  source_id text unique,                                      -- the review's id on Google etc., so imports never duplicate
  verified boolean not null default false,                    -- the shop confirmed this person ordered
  shown boolean not null default false,                       -- on the website
  checked boolean not null default false,                     -- the shop has looked at it (false: counts as "new")
  suspect boolean not null default false
);
create index if not exists reviews_shown on public.reviews (review_date desc) where shown;
create index if not exists reviews_new on public.reviews (created_at desc) where not checked;

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;

/* ---------- the website ---------- */
-- A customer writes a review on a product page. Kept hidden until the shop shows it.
create or replace function public.submit_review(p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  ip text := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', 'unknown'), ',', 1);
  sus boolean;
  v_text text := left(trim(coalesce(p ->> 'text', '')), 1000);
  v_name text := left(trim(coalesce(p ->> 'name', '')), 60);
  v_rating int;
begin
  begin v_rating := (p ->> 'rating')::int; exception when others then v_rating := 0; end;
  if v_rating not between 1 and 5 then raise exception 'BAD_REVIEW' using hint = 'rating'; end if;
  if char_length(v_name) < 2 then raise exception 'BAD_REVIEW' using hint = 'name'; end if;
  if char_length(v_text) < 20 then raise exception 'BAD_REVIEW' using hint = 'text'; end if;
  if coalesce(p ->> 'product', '') !~ '^[a-z0-9-]{1,80}$' then raise exception 'BAD_REVIEW' using hint = 'product'; end if;
  sus := public._rate('rev', encode(digest(trim(ip), 'sha256'), 'hex'));  -- refuses past 20 an hour from one connection
  insert into public.reviews (product, rating, name, place, style, phone, title, text, source, suspect)
  values (p ->> 'product', v_rating, v_name,
          nullif(left(trim(coalesce(p ->> 'place', '')), 60), ''),
          nullif(left(trim(coalesce(p ->> 'style', '')), 40), ''),
          nullif(left(regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9+ ]', '', 'g'), 20), ''),
          nullif(left(trim(coalesce(p ->> 'title', '')), 120), ''),
          v_text, 'website', sus);
end $$;

-- The reviews the shop chose to show. Never includes phone numbers.
create or replace function public.public_reviews() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'product', product, 'rating', rating, 'name', name, 'place', place, 'title', title, 'text', text,
      'style', style, 'date', review_date, 'source', source, 'sourceUrl', source_url, 'verified', verified)
      order by review_date desc, created_at desc), '[]')
  from (select * from public.reviews where shown order by review_date desc, created_at desc limit 500) r;
$$;

/* ---------- the admin (owner and editors) ---------- */
create or replace function public.admin_reviews() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('editor');
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r.checked, r.created_at desc), '[]')
    from (select * from public.reviews order by created_at desc limit 1000) r);
end $$;

-- Show or hide one review (also marks it as looked at).
create or replace function public.set_review_shown(p_id uuid, p_shown boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('editor'); n int;
begin
  update public.reviews set shown = p_shown, checked = true, updated_at = now() where id = p_id;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'NOT_FOUND'; end if;
  perform public._log(actor, case when p_shown then 'review_shown' else 'review_hidden' end, 'reviews', p_id::text);
end $$;

-- Mark reviews as looked at without showing them (clears the "new" count).
create or replace function public.mark_reviews_checked(p_ids uuid[]) returns void
language sql security definer set search_path = public, extensions as $$
  select public._require('editor');
  update public.reviews set checked = true where id = any(p_ids);
$$;

-- Add a review by hand, or edit one. p.id empty = new.
create or replace function public.save_review(p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('editor'); v_id uuid; v_rating int;
begin
  v_rating := nullif(p ->> 'rating', '')::int;
  if nullif(p ->> 'id', '') is null then
    insert into public.reviews (product, rating, name, place, title, text, style, review_date, source, source_url, verified, shown, checked)
    values (nullif(p ->> 'product', ''), v_rating, left(trim(p ->> 'name'), 80), nullif(left(trim(coalesce(p ->> 'place', '')), 60), ''),
            nullif(left(trim(coalesce(p ->> 'title', '')), 120), ''), left(trim(p ->> 'text'), 2000), nullif(p ->> 'style', ''),
            coalesce(nullif(p ->> 'date', '')::date, (now() at time zone 'Asia/Kolkata')::date),
            coalesce(nullif(p ->> 'source', ''), 'shop'), nullif(trim(coalesce(p ->> 'sourceUrl', '')), ''),
            coalesce((p ->> 'verified')::boolean, false), coalesce((p ->> 'shown')::boolean, true), true)
    returning id into v_id;
    perform public._log(actor, 'review_added', 'reviews', v_id::text);
  else
    v_id := (p ->> 'id')::uuid;
    update public.reviews set
      product = nullif(p ->> 'product', ''), rating = v_rating, name = left(trim(p ->> 'name'), 80),
      place = nullif(left(trim(coalesce(p ->> 'place', '')), 60), ''), title = nullif(left(trim(coalesce(p ->> 'title', '')), 120), ''),
      text = left(trim(p ->> 'text'), 2000), style = nullif(p ->> 'style', ''),
      review_date = coalesce(nullif(p ->> 'date', '')::date, review_date),
      source = coalesce(nullif(p ->> 'source', ''), source), source_url = nullif(trim(coalesce(p ->> 'sourceUrl', '')), ''),
      verified = coalesce((p ->> 'verified')::boolean, verified), shown = coalesce((p ->> 'shown')::boolean, shown),
      checked = true, updated_at = now()
    where id = v_id;
    if not found then raise exception 'NOT_FOUND'; end if;
    perform public._log(actor, 'review_edited', 'reviews', v_id::text);
  end if;
  return v_id;
end $$;

create or replace function public.delete_review(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('editor');
begin
  delete from public.reviews where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public._log(actor, 'review_deleted', 'reviews', p_id::text);
end $$;

revoke execute on function public.submit_review(jsonb), public.public_reviews(), public.admin_reviews(),
  public.set_review_shown(uuid, boolean), public.mark_reviews_checked(uuid[]), public.save_review(jsonb), public.delete_review(uuid)
  from public, anon;
grant execute on function public.submit_review(jsonb), public.public_reviews() to anon, authenticated;
grant execute on function public.admin_reviews(), public.set_review_shown(uuid, boolean), public.mark_reviews_checked(uuid[]),
  public.save_review(jsonb), public.delete_review(uuid) to authenticated;
