// Public enquiry intake. Deploy with: supabase functions deploy submit-enquiry --no-verify-jwt
// Secrets: ALLOWED_ORIGINS (comma-separated), IP_SALT. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Until ALLOWED_ORIGINS is set, only the local dev server may post.
const allowed = (Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function cors(origin: string | null) {
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : allowed[0] || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

// N9: the rightmost x-forwarded-for entry is the one the gateway appended; the left ones are client-supplied.
function clientIp(req: Request) {
  const xff = (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff.at(-1) || req.headers.get('cf-connecting-ip') || 'unknown';
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = cors(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers });
  if (!origin || !allowed.includes(origin)) return new Response('Forbidden', { status: 403, headers });

  let p: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 16000) return new Response('Too large', { status: 413, headers });
    p = JSON.parse(text);
  } catch {
    return new Response('Bad request', { status: 400, headers });
  }
  const phone = str(p.phone, 20).replace(/[^\d+ ]/g, '');
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(str(p.eventDate, 10)) ? str(p.eventDate, 10) : '';
  const items = Array.isArray(p.items) ? p.items.slice(0, 30).map((i) => str(i, 300)).filter(Boolean) : [];
  const token = typeof p.token === 'string' && /^[0-9a-f]{32}$/.test(p.token) ? p.token : '';
  const payload = {
    name: str(p.name, 120), phone: /^\+?[0-9 ]{8,16}$/.test(phone) ? phone : '', email: str(p.email, 200),
    eventDate, place: str(p.place, 200), note: str(p.note, 4000), items,
    trackHash: token ? await sha256(token) : '',
  };
  if (!payload.name) return new Response('Name required', { status: 422, headers });

  const ipHash = await sha256(`${Deno.env.get('IP_SALT') || ''}:${clientIp(req)}`);
  const { error } = await db.rpc('_submit_enquiry', { p_ip_hash: ipHash, p: payload });
  if (error) {
    const limited = error.message.includes('RATE_LIMITED');
    if (!limited) console.error('submit-enquiry', error.message);
    return new Response(limited ? 'Too many enquiries' : 'Error', { status: limited ? 429 : 500, headers });
  }
  return new Response(null, { status: 204, headers });
});
