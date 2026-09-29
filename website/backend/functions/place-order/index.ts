// Saves a checkout order and, when the customer reports an online payment, sends the
// "awaiting confirmation" receipt to them and to the shop.
// Deploy with: supabase functions deploy place-order --no-verify-jwt
// Secrets: ALLOWED_ORIGINS, IP_SALT, plus the receipt secrets in _shared/receipts.ts.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { allowed, cors, clientIp, sha256, str, int, json } from '../_shared/http.ts';
import { deliver, type Receipt } from '../_shared/receipts.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const METHODS = ['upi', 'bank', 'gateway', 'later'];

function parse(p: Record<string, unknown>): Receipt | null {
  const ref = str(p.ref, 20);
  const name = str(p.name, 120);
  const phone = str(p.phone, 20).replace(/[^\d+ ]/g, '');
  const m = (p.method || {}) as Record<string, unknown>;
  const method = { id: str(m.id, 10), label: str(m.label, 60) };
  const items = Array.isArray(p.items) ? p.items.slice(0, 30).map((i) => {
    const it = (i || {}) as Record<string, unknown>;
    return { title: str(it.title, 120), qty: int(it.qty, 99) ?? 0, amount: int(it.amount) ?? 0, detail: str(it.detail, 300) };
  }).filter((i) => i.title && i.qty) : [];
  const total = int(p.total);
  const paidNow = int(p.paidNow);
  if (!/^PRN-\d{6}-[A-Z0-9]{4}$/.test(ref) || !name || !METHODS.includes(method.id) || !items.length || total == null || paidNow == null) return null;
  const date = (d: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(d, 10)) ? str(d, 10) : '');
  const email = str(p.email, 200);
  return {
    ref, date: new Date().toISOString(), name,
    phone: /^\+?[0-9 ]{8,16}$/.test(phone) ? phone : '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    eventDate: date(p.eventDate), address: str(p.address, 300),
    items, total, paidNow: Math.min(paidNow, total), plan: str(p.plan, 40), method,
    payTo: str(p.payTo, 120), utr: str(p.utr, 40).replace(/[^\w-]/g, ''),
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });
  if (!origin || !allowed.includes(origin)) return new Response('Forbidden', { status: 403, headers });

  let r: Receipt | null;
  try {
    const text = await req.text();
    if (text.length > 24000) return new Response('Too large', { status: 413, headers });
    r = parse(JSON.parse(text));
  } catch {
    return new Response('Bad request', { status: 400, headers });
  }
  if (!r) return new Response('Invalid order', { status: 422, headers });

  const token = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const ipHash = await sha256(`${Deno.env.get('IP_SALT') || ''}:${clientIp(req)}`);
  const { error } = await db.rpc('_place_order', { p_ip_hash: ipHash, p: r, p_token: token });
  if (error) {
    const limited = error.message.includes('RATE_LIMITED');
    const dup = error.code === '23505';
    if (!limited && !dup) console.error('place-order', error.message);
    return new Response(limited ? 'Too many orders' : dup ? 'Order already saved' : 'Error', { status: limited ? 429 : dup ? 409 : 500, headers });
  }

  // Pay-later orders have no payment to report yet; their receipt goes out when the owner marks them paid.
  const sending = r.method.id === 'later' ? null : deliver(r, 'placed', token).then((sent) => db.rpc('_log_receipt', { p_ref: r!.ref, p_entries: sent }));
  // @ts-ignore EdgeRuntime is provided by Supabase Edge Functions
  if (sending) EdgeRuntime.waitUntil(sending);
  return json({ token, receiptSent: !!sending }, 201, headers);
});
