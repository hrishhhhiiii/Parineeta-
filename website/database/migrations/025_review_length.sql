-- 025: reviews have no minimum or maximum length the customer can notice.
-- Before: at least 20 characters, cut off at 1,000. Now: any review that isn't empty is accepted.
-- A very high backstop (10,000 characters, about 1,700 words) stays only so one request can't store a huge blob.
-- Safe to run more than once.

alter table public.reviews drop constraint if exists reviews_text_check;
alter table public.reviews add constraint reviews_text_check check (char_length(text) between 1 and 10000);

create or replace function public.submit_review(p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  sus boolean;
  v_text text := left(trim(coalesce(p ->> 'text', '')), 10000);
  v_name text := left(trim(coalesce(p ->> 'name', '')), 60);
  v_rating int;
begin
  begin v_rating := (p ->> 'rating')::int; exception when others then v_rating := 0; end;
  if v_rating not between 1 and 5 then raise exception 'BAD_REVIEW' using hint = 'rating'; end if;
  if char_length(v_name) < 2 then raise exception 'BAD_REVIEW' using hint = 'name'; end if;
  if char_length(v_text) < 1 then raise exception 'BAD_REVIEW' using hint = 'text'; end if;
  if coalesce(p ->> 'product', '') !~ '^[a-z0-9-]{1,80}$' then raise exception 'BAD_REVIEW' using hint = 'product'; end if;
  sus := public._rate('rev', encode(digest(public._client_ip(), 'sha256'), 'hex'));  -- refuses past 20 an hour from one connection
  insert into public.reviews (product, rating, name, place, style, phone, title, text, source, suspect)
  values (p ->> 'product', v_rating, v_name,
          nullif(left(trim(coalesce(p ->> 'place', '')), 60), ''),
          nullif(left(trim(coalesce(p ->> 'style', '')), 40), ''),
          nullif(left(regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9+ ]', '', 'g'), 20), ''),
          nullif(left(trim(coalesce(p ->> 'title', '')), 120), ''),
          v_text, 'website', sus);
end $$;

grant execute on function public.submit_review(jsonb) to anon, authenticated;
