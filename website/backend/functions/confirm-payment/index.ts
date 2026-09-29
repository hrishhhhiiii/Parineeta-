// Owner-only: marks an order paid and sends the "payment received" receipt to the customer and the shop.
// With { resend: true } it only sends the receipt for its current state again.
// Deploy with: supabase functions deploy confirm-payment --no-verify-jwt
// (The caller's Clerk token is checked by the database: mark_order_paid and admin_role read it.)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { allowed, cors, str, int, json } from '../_shared/http.ts';
import { deliver, type Receipt } from '../_shared/receipts.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const service = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });
  if (!origin || !allowed.includes(origin)) return new Response('Forbidden', { status: 403, headers });
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer .+/.test(auth)) return json({ error: 'Sign in again.' }, 401, headers);

  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return json({ error: 'Bad request' }, 400, headers); }
  const ref = str(p.ref, 20);
  const amount = int(p.amount);
  const resend = p.resend === true;

  // Acts as the signed-in person, so the database decides whether they are the owner.
  const asUser = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: role, error: roleErr } = await asUser.rpc('admin_role');
  if (roleErr || role !== 'owner') return json({ error: 'Only the owner can confirm payments.' }, 403, headers);
  if (!resend) {
    const { error } = await asUser.rpc('mark_order_paid', { p_ref: ref, p_amount: amount });
    if (error) return json({ error: error.hint || error.message }, 409, headers);
  }

  const { data: o, error } = await service.from('orders').select('receipt, receipt_token, status, paid_amount, paid_at').eq('ref', ref).single();
  if (error || !o) return json({ error: 'Order not found.' }, 404, headers);
  const r: Receipt = { ...o.receipt, paidAmount: o.paid_amount, paidAt: o.paid_at };
  const sent = await deliver(r, o.status === 'paid' ? 'paid' : 'placed', o.receipt_token);
  await service.rpc('_log_receipt', { p_ref: ref, p_entries: sent });
  return json({ status: o.status, paid_amount: o.paid_amount, paid_at: o.paid_at, sent }, 200, headers);
});
