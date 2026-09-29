-- Signed-in customers' cart and wishlist, so they follow the person to any device. Run after 001–004.
-- Each person can only read and write their own row; deleting the login deletes the row.
create table if not exists public.customer_carts (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  cart jsonb not null default '[]' check (jsonb_typeof(cart) = 'array' and jsonb_array_length(cart) <= 100),
  wish jsonb not null default '[]' check (jsonb_typeof(wish) = 'array' and jsonb_array_length(wish) <= 200),
  updated_at timestamptz not null default now(),
  check (pg_column_size(cart) + pg_column_size(wish) < 64000)
);

alter table public.customer_carts enable row level security;

drop policy if exists own_cart_read on public.customer_carts;
create policy own_cart_read on public.customer_carts for select to authenticated using (user_id = auth.uid());
drop policy if exists own_cart_insert on public.customer_carts;
create policy own_cart_insert on public.customer_carts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists own_cart_update on public.customer_carts;
create policy own_cart_update on public.customer_carts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.customer_carts from anon, authenticated;
grant select, insert, update on public.customer_carts to authenticated;
