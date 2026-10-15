// Which moves the Orders screen offers for an order. The database enforces the same rules
// (database/migrations/023_order_safety.sql: _order_step_ok, set_order_refund, delete_order);
// tests/orders.db.test.js checks the two agree for every pair of stages.

const FLOW = ['placed', 'paid', 'making', 'ready', 'delivered'];
export const REFUND_STAGES = ['refund_started', 'refunded'];

/** True when an order may go from stage `from` to `to` with set_order_status. */
export function stepOk(from, to) {
  if (from === to) return !REFUND_STAGES.includes(from);
  if (REFUND_STAGES.includes(from)) return false;
  if (to === 'cancelled') return ['placed', 'paid', 'making', 'ready'].includes(from);
  if (from === 'cancelled') return to === 'placed';
  const f = FLOW.indexOf(from);
  const t = FLOW.indexOf(to);
  return f >= 0 && t >= 0 && (t > f || t === f - 1);
}

/** True when a refund may be recorded at `stage`: there must be a payment, and a completed refund can't go back. */
export function refundOk(order, stage) {
  if (!((order.paid_amount || 0) > 0)) return false;
  return !(order.status === 'refunded' && stage === 'refund_started');
}

/** True when the order may be deleted: no money recorded and no work started (a test or spam order). */
export const canDelete = (order) => !((order.paid_amount || 0) > 0) && !order.refund && ['placed', 'cancelled'].includes(order.status);

/** The stages to offer in the order's dropdown, current stage included. */
export function stagesFor(order, all) {
  return all.filter(([stage]) => (REFUND_STAGES.includes(stage) ? refundOk(order, stage) : stepOk(order.status, stage)) || stage === order.status);
}
