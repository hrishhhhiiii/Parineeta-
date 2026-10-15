-- Safer order records (payments audit P1–P3, 14 Oct). Owner actions only; nothing changes for customers.
--   P1  A refund can't be more than the payment recorded for the order. Before, the limit was the larger of the
--       payment and the order total, so ₹2,000 could be "refunded" on an order that had received ₹1,000.
--       An order with no payment recorded can't be refunded until the payment is recorded.
--   P2  Only orders with no payment and no refund recorded can be deleted (test or spam orders). An order with
--       money recorded is a financial record: it is kept, and can be set to Cancelled instead.
--   P3  Stages follow sensible steps instead of jumping anywhere:
--         - forward along New → Payment received → Being made → Ready → Delivered (skipping stages is fine,
--           e.g. a pay-at-the-shop order goes straight to Being made);
--         - back one stage, to correct a mistake;
--         - Cancelled from any stage before Delivered, and a cancelled order can be reopened as New;
--         - once a refund is recorded, only Refund completed can follow (set_order_refund).
-- The admin (frontend/src/admin/orderRules.js) offers the same moves; these functions are what enforce them.
-- Run after 009 and 016. Does not depend on 017–022 and they do not depend on it. Safe to re-run.

-- Which stages may follow `from` through set_order_status (refund stages go through set_order_refund).
create or replace function public._order_step_ok(p_from text, p_to text) returns boolean
language sql immutable set search_path = public as $$
  with flow(stage, n) as (values ('placed', 1), ('paid', 2), ('making', 3), ('ready', 4), ('delivered', 5))
  select case
    when p_from = p_to then p_from not in ('refund_started', 'refunded')                 -- re-saving, e.g. a corrected amount
    when p_from in ('refund_started', 'refunded') then false                            -- a refund is recorded
    when p_to = 'cancelled' then p_from in ('placed', 'paid', 'making', 'ready')
    when p_from = 'cancelled' then p_to = 'placed'                                      -- reopen
    else coalesce((select t.n > f.n or t.n = f.n - 1
                     from flow f, flow t where f.stage = p_from and t.stage = p_to), false)
  end
$$;

-- Plain words for a refused step, shown in the admin.
create or replace function public._stage_name(p_stage text) returns text
language sql immutable set search_path = public as $$
  select case p_stage when 'placed' then 'New' when 'paid' then 'Payment received' when 'making' then 'Being made'
    when 'ready' then 'Ready' when 'delivered' then 'Delivered' when 'cancelled' then 'Cancelled'
    when 'refund_started' then 'Refund initiated' when 'refunded' then 'Refund completed' else p_stage end
$$;

create or replace function public.set_order_status(p_ref text, p_status text, p_amount int default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); o public.orders;
begin
  if p_status not in ('placed', 'paid', 'making', 'ready', 'delivered', 'cancelled') then raise exception 'BAD_STATUS'; end if;
  select * into o from public.orders where ref = p_ref for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not public._order_step_ok(o.status, p_status) then
    raise exception 'BAD_STEP' using hint = case
      when o.status in ('refund_started', 'refunded') then 'A refund is recorded on this order, so its stage can only move to Refund completed.'
      else format('An order can''t go from %s to %s. Orders move forward; to correct a mistake, go back one stage.',
                  public._stage_name(o.status), public._stage_name(p_status)) end;
  end if;
  if p_amount is not null and p_amount < 0 then raise exception 'BAD_AMOUNT' using hint = 'The amount received can''t be below zero.'; end if;
  if p_status = 'paid' and coalesce(p_amount, o.paid_amount, 0) <= 0 then
    raise exception 'BAD_AMOUNT' using hint = 'Enter the amount you received.';
  end if;
  update public.orders set
    status = p_status,
    suspect = false,
    paid_amount = case when p_amount is not null and p_amount > 0 then p_amount else paid_amount end,
    paid_at = case when p_amount is not null and p_amount > 0 then coalesce(paid_at, now()) else paid_at end,
    paid_by = case when p_amount is not null and p_amount > 0 then actor else paid_by end,
    updated_at = now()
  where ref = p_ref;
  perform public._log(actor, 'order_status', null, p_ref, p_status, case when p_amount is not null then jsonb_build_object('amount', p_amount) end);
end $$;

-- p_stage is 'refund_started' (initiated) or 'refunded' (completed).
create or replace function public.set_order_refund(p_ref text, p_stage text, p_amount int,
                                                   p_refund_ref text default null, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); o public.orders;
begin
  if p_stage not in ('refund_started', 'refunded') then raise exception 'BAD_STATUS'; end if;
  select * into o from public.orders where ref = p_ref for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if o.status = 'refunded' and p_stage = 'refund_started' then
    raise exception 'BAD_STEP' using hint = 'This refund is already recorded as completed.';
  end if;
  if coalesce(o.paid_amount, 0) <= 0 then
    raise exception 'BAD_AMOUNT' using hint = 'No payment is recorded on this order. Record the payment you received first (stage Payment received, with the amount), then the refund.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'BAD_AMOUNT' using hint = 'Enter the amount you are refunding.';
  end if;
  if p_amount > o.paid_amount then
    raise exception 'BAD_AMOUNT' using hint = format('The refund can''t be more than the ₹%s received for this order.', o.paid_amount);
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

create or replace function public.delete_order(p_ref text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare actor text := public._require('owner'); o public.orders;
begin
  select * into o from public.orders where ref = p_ref for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if coalesce(o.paid_amount, 0) > 0 or o.refund_amount is not null then
    raise exception 'NOT_ALLOWED' using hint = 'This order has a payment or a refund recorded, so it is kept as a record. Set it to Cancelled instead.';
  end if;
  if o.status not in ('placed', 'cancelled') then
    raise exception 'NOT_ALLOWED' using hint = 'This order is already being worked on. Set it to Cancelled first, then delete it.';
  end if;
  delete from public.orders where ref = p_ref;
  perform public._log(actor, 'order_deleted', null, p_ref);
end $$;

revoke all on function public._order_step_ok(text, text), public._stage_name(text) from public, anon, authenticated;
revoke execute on function public.set_order_status(text, text, int), public.set_order_refund(text, text, int, text, text),
  public.delete_order(text) from public, anon;
grant execute on function public.set_order_status(text, text, int), public.set_order_refund(text, text, int, text, text),
  public.delete_order(text) to authenticated;

-- Check (one row, four "true"):
select public._order_step_ok('placed', 'making') as forward_skip_ok,
       not public._order_step_ok('delivered', 'placed') as jump_back_refused,
       public._order_step_ok('ready', 'making') as one_step_back_ok,
       not public._order_step_ok('refunded', 'paid') as refunded_is_final;
