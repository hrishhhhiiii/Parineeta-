// Calls a public database function (Supabase RPC) from the website, without loading supabase-js.
// Used by missed searches and "Notify me" (database/migrations/014_shop.sql).

/** Resolves to the function's result; throws an Error whose message is the database's (e.g. BAD_PHONE). */
export async function callRpc(name, body) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('NOT_CONFIGURED');
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `HTTP_${res.status}`);
  return data;
}

/** A 10-digit Indian mobile number from what the customer typed ("+91 98765 43210" → "9876543210"), or ''. */
export function cleanPhone(s) {
  const d = String(s || '').replace(/\D/g, '').slice(-10);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}
