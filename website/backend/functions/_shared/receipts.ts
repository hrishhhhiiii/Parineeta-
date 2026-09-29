// Sends a receipt to the customer and the shop, by email (Resend) and WhatsApp (Cloud API).
// A channel whose secrets are missing is skipped, so the site works before both are set up.
// Secrets: SITE_URL, RESEND_API_KEY, RECEIPT_FROM, ADMIN_EMAIL, WHATSAPP_TOKEN,
// WHATSAPP_PHONE_NUMBER_ID, ADMIN_WHATSAPP, WHATSAPP_TEMPLATE_LANG (default 'en').

export type Kind = 'placed' | 'paid';
type Item = { title: string; qty: number; amount: number; detail?: string };
export type Receipt = {
  ref: string; date: string; name: string; phone?: string; email?: string; eventDate?: string; address?: string;
  items: Item[]; total: number; paidNow: number; plan: string; method: { id: string; label: string };
  payTo?: string; utr?: string; paidAmount?: number | null; paidAt?: string | null;
};
export type Sent = { at: string; kind: Kind; to: 'customer' | 'shop'; channel: 'email' | 'whatsapp'; ok: boolean; error?: string };

const env = (k: string) => Deno.env.get(k) || '';
const list = (k: string) => env(k).split(',').map((s) => s.trim()).filter(Boolean);

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr = (n: number) => INR.format(Math.round(n));
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const day = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');

export const receiptLink = (token: string) => `${env('SITE_URL').replace(/\/$/, '')}/receipt.html#${token}`;

/** Indian 10-digit numbers get the 91 prefix; anything else is used as written. */
export function waNumber(phone?: string) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  return d.length >= 11 && d.length <= 15 ? d : '';
}

function statusLine(r: Receipt, kind: Kind) {
  if (kind === 'paid') return `Payment of ${inr(r.paidAmount ?? r.paidNow)} received on ${day(r.paidAt)}. Thank you!`;
  return `Payment of ${inr(r.paidNow)} by ${r.method.label} reported by the customer. Awaiting confirmation from Parineeta.`;
}

function email(r: Receipt, kind: Kind, link: string, forShop: boolean) {
  const title = kind === 'paid' ? 'Payment received' : 'Order received, payment awaiting confirmation';
  const balance = r.total - (kind === 'paid' ? (r.paidAmount ?? 0) : r.paidNow);
  const row = (k: string, v: string, bold = false) =>
    `<tr><td style="padding:6px 0;color:#6b4a3f">${esc(k)}</td><td style="padding:6px 0;text-align:right;${bold ? 'font-weight:700' : ''}">${esc(v)}</td></tr>`;
  const items = r.items.map((i) =>
    `<tr><td style="padding:6px 0"><strong>${esc(i.qty)} × ${esc(i.title)}</strong>${i.detail ? `<br><span style="color:#6b4a3f;font-size:13px">${esc(i.detail)}</span>` : ''}</td><td style="padding:6px 0;text-align:right;vertical-align:top">${esc(inr(i.amount))}</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f3e6c8;font-family:Arial,Helvetica,sans-serif;color:#1c0508">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbf4e4;border-radius:12px;padding:28px">
<tr><td style="text-align:center;font-family:Georgia,serif;font-size:30px">Parineeta</td></tr>
<tr><td style="text-align:center;color:#a8761f;font-size:18px;padding:6px 0 18px">${esc(title)}</td></tr>
${forShop ? `<tr><td style="padding:0 0 14px;font-size:14px">New receipt for <strong>${esc(r.name)}</strong>${r.phone ? `, ${esc(r.phone)}` : ''}${r.email ? `, ${esc(r.email)}` : ''}.</td></tr>` : `<tr><td style="padding:0 0 14px">Namaskar ${esc(r.name)},</td></tr>`}
<tr><td style="background:#f3e6c8;border-left:4px solid #a8761f;padding:12px 14px;font-weight:700">${esc(statusLine(r, kind))}</td></tr>
<tr><td><table role="presentation" width="100%" style="margin-top:14px;font-size:15px">
${row('Order number', r.ref, true)}${row('Order date', day(r.date))}${r.eventDate ? row('Event date', day(r.eventDate)) : ''}
</table></td></tr>
<tr><td><table role="presentation" width="100%" style="margin-top:10px;font-size:15px;border-top:1px solid #e2d3b4">${items}</table></td></tr>
<tr><td><table role="presentation" width="100%" style="margin-top:6px;font-size:15px;border-top:1px solid #e2d3b4">
${row('Estimated total', inr(r.total), true)}${kind === 'paid' ? row('Paid', inr(r.paidAmount ?? 0)) : row(`Paying now (${r.plan})`, inr(r.paidNow))}${row('Balance due', inr(Math.max(0, balance)))}
${row('Method', r.method.label)}${r.payTo ? row('Paid to', r.payTo) : ''}${row('Reference (UTR)', r.utr || 'Not given')}
</table></td></tr>
<tr><td style="text-align:center;padding:22px 0 8px"><a href="${esc(link)}" style="background:#a8761f;color:#fbf4e4;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700">View or download the receipt</a></td></tr>
<tr><td style="text-align:center;color:#6b4a3f;font-size:12px;padding-top:10px">Prices are estimates until Parineeta confirms your order.</td></tr>
</table></td></tr></table></body></html>`;
  const text = [`Parineeta: ${title}`, '', statusLine(r, kind), '', `Order ${r.ref}`, ...r.items.map((i) => `${i.qty} x ${i.title}: ${inr(i.amount)}`),
    `Estimated total: ${inr(r.total)}`, `Balance due: ${inr(Math.max(0, balance))}`, '', `Receipt: ${link}`].join('\n');
  const subject = `${kind === 'paid' ? 'Payment received' : 'Order received'}: ${r.ref}${forShop ? ` (${r.name})` : ''}`;
  return { subject, html, text };
}

async function sendEmail(to: string[], msg: { subject: string; html: string; text: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('RECEIPT_FROM'), to, subject: msg.subject, html: msg.html, text: msg.text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Business-initiated WhatsApp messages must use a template approved in Meta's WhatsApp Manager.
async function sendWhatsApp(to: string, template: string, params: string[]) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to, type: 'template',
      template: {
        name: template, language: { code: env('WHATSAPP_TEMPLATE_LANG') || 'en' },
        components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: text.slice(0, 200) })) }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Sends the receipt everywhere it can go. Never throws: each attempt is reported in the result. */
export async function deliver(r: Receipt, kind: Kind, token: string): Promise<Sent[]> {
  const link = receiptLink(token);
  const at = new Date().toISOString();
  const jobs: { to: Sent['to']; channel: Sent['channel']; run: () => Promise<void> }[] = [];

  if (env('RESEND_API_KEY') && env('RECEIPT_FROM')) {
    if (r.email) jobs.push({ to: 'customer', channel: 'email', run: () => sendEmail([r.email!], email(r, kind, link, false)) });
    if (list('ADMIN_EMAIL').length) jobs.push({ to: 'shop', channel: 'email', run: () => sendEmail(list('ADMIN_EMAIL'), email(r, kind, link, true)) });
  }
  if (env('WHATSAPP_TOKEN') && env('WHATSAPP_PHONE_NUMBER_ID')) {
    // parineeta_payment_pending: {{1}} order, {{2}} amount, {{3}} customer, {{4}} receipt link
    // parineeta_payment_received: {{1}} order, {{2}} amount, {{3}} customer, {{4}} date, {{5}} receipt link
    const [template, params] = kind === 'paid'
      ? ['parineeta_payment_received', [r.ref, inr(r.paidAmount ?? 0), r.name, day(r.paidAt), link]]
      : ['parineeta_payment_pending', [r.ref, inr(r.paidNow), r.name, link]];
    const customer = waNumber(r.phone);
    if (customer) jobs.push({ to: 'customer', channel: 'whatsapp', run: () => sendWhatsApp(customer, template as string, params as string[]) });
    for (const shop of list('ADMIN_WHATSAPP').map(waNumber).filter(Boolean)) {
      jobs.push({ to: 'shop', channel: 'whatsapp', run: () => sendWhatsApp(shop, template as string, params as string[]) });
    }
  }

  const results = await Promise.allSettled(jobs.map((j) => j.run()));
  return results.map((res, i) => ({
    at, kind, to: jobs[i].to, channel: jobs[i].channel, ok: res.status === 'fulfilled',
    ...(res.status === 'rejected' ? { error: String(res.reason?.message || res.reason).slice(0, 300) } : {}),
  }));
}
