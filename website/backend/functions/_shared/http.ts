// CORS and small helpers shared by the website's public functions.

// Until ALLOWED_ORIGINS is set, only the local dev servers may call.
export const allowed = (Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173,http://localhost:5180').split(',').map((s) => s.trim()).filter(Boolean);

export function cors(origin: string | null) {
  const ok = origin && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin! : allowed[0] || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
}

// The rightmost x-forwarded-for entry is the one the gateway appended; the left ones are client-supplied.
export function clientIp(req: Request) {
  const xff = (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff.at(-1) || req.headers.get('cf-connecting-ip') || 'unknown';
}

export async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const int = (v: unknown, max = 10_000_000) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : null);

export const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
