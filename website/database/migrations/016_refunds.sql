-- Refunds on website orders. The shop sends the money back by hand (UPI or bank app), then records it
-- here: "Refund initiated" while it is on its way, "Refund completed" once sent, with the amount and the
-- refund's UPI / bank reference. The customer sees both on /account.
-- Run after 001–015. Safe to re-run. Adds columns and new functions; the existing order functions
-- (list_orders, my_orders, set_order_status) are left exactly as they are live.

alter table public.orders add column if not exists refund_amount int check (refund_amount > 0);
alter table public.orders add column if not exists refund_ref text check (char_length(refund_ref) <= 60);
alter table public.orders add column if not exists refund_note text check (char_length(refund_note) <= 300);
alter table public.orders add column if not exists refund_started_at timestamptz;
alter table public.orders add column if not exists refunded_at timestamptz;
alter table public.orders add column if not exists refund_by text;

-- Two more stages after the six from 009.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('placed', 'paid', 'making', 'ready', 'delivered', 'cancelled', 'refund_started', 'refunded'));

-- Owner: record a refund. p_stage is 'refund_started' (initiated) or 'refunded' (completed).
-- The refund can't be more than what was received (or, if no payment was recorded, the order total).
create or replace function public.set_order_refund(p_ref text, p_stage text, p_amount int,
                                                   p_refund_ref text default null, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); o public.orders;
begin
  if p_stage not in ('refund_started', 'refunded') then raise exception 'BAD_STATUS'; end if;
  select * into o from public.orders where ref = p_ref;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'BAD_AMOUNT' using hint = 'Enter the amount you are refunding.';
  end if;
  if p_amount > greatest(coalesce(o.paid_amount, 0), o.total) then
    raise exception 'BAD_AMOUNT' using hint = 'The refund is more than the customer paid.';
  end if;
  update public.orders set
    status = p_stage,
    refund_amount = p_amount,
    refund_ref = nullif(left(trim(coalesce(p_refund_ref, '')), 60), ''),
    refund_note = nullif(left(trim(coalesce(p_note, '')), 300), ''),
    refund_started_at = coalesce(refund_started_at, now()),
    refunded_at = case when p_stage = 'refunded' then coalesce(refunded_at, now()) else null end,
    refund_by = actor,
    updated_at = now()
  where ref = p_ref;
  perform public._log(actor, 'order_refund', null, p_ref, p_stage, jsonb_build_object('amount', p_amount));
end $$;

-- Owner: the refund details for the Orders screen, keyed by order number.
create or replace function public.list_refunds() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public._require('owner');
  return (select coalesce(jsonb_object_agg(ref, jsonb_build_object(
      'amount', refund_amount, 'ref', refund_ref, 'note', refund_note,
      'startedAt', refund_started_at, 'doneAt', refunded_at, 'by', refund_by)), '{}')
    from public.orders where refund_amount is not null);
end $$;

-- /account: the signed-in customer's refunds, matched the same way as my_orders.
create or replace function public.my_refunds() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_object_agg(ref, jsonb_build_object(
      'amount', refund_amount, 'ref', refund_ref, 'startedAt', refund_started_at, 'doneAt', refunded_at)), '{}')
  from public.orders
  where refund_amount is not null and public.clerk_user_id() is not null and anonymized_at is null
    and (customer_id = public.clerk_user_id()
      or (email is not null and lower(email) = lower(auth.jwt() ->> 'email')));
$$;

revoke execute on function public.set_order_refund(text, text, int, text, text), public.list_refunds(), public.my_refunds() from public, anon;
grant execute on function public.set_order_refund(text, text, int, text, text), public.list_refunds(), public.my_refunds() to authenticated;
