// /receipt.html#<token>: one order's receipt, no sign-in. The link comes by email or WhatsApp.
import '../styles/fonts.css';
import '../account/account.css';
import { applyPublished } from '../cms/published.js';
import { receiptBlob, downloadReceipt, shareReceipt, canShareFiles } from '../ui/receipt.js';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('demo');
const app = document.getElementById('app');

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'text') el.textContent = v;
    else if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat().filter((c) => c != null && c !== false));
  return el;
}
const back = () => h('p', {}, h('a', { href: '/', text: '← Back to Parineeta' }));

const demo = {
  ref: 'PRN-260929-DEMO', date: new Date().toISOString(), name: 'Riya Sen', phone: '9830012345', email: 'riya@example.com',
  items: [{ title: 'Gach Kouto', qty: 1, amount: 1450, detail: 'Sindoor red, Single piece' }],
  total: 1450, paidNow: 725, plan: '50% advance', method: { id: 'upi', label: 'UPI' }, payTo: 'UPI 9734241918@axl', utr: '426512345678',
  status: 'paid', paidAmount: 725, paidAt: new Date().toISOString(),
};

async function fetchReceipt(token) {
  if (DEMO) return demo;
  const res = await fetch(`${URL_}/rest/v1/rpc/order_receipt`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function show() {
  applyPublished();
  const token = location.hash.slice(1);
  let r = null;
  if (DEMO || /^[0-9a-f]{32}$/.test(token)) {
    try { r = await fetchReceipt(token); } catch {}
  }
  if (!r) {
    app.replaceChildren(h('h1', { text: 'Receipt not found' }),
      h('p', { class: 'muted', text: 'The link may be incomplete. Message us on WhatsApp with your order number and we will send it again.' }),
      back());
    return;
  }
  const paid = r.status === 'paid';
  const img = h('img', { class: 'receipt-img', alt: `Receipt for order ${r.ref}` });
  const act = (text, fn, ghost = false) => {
    const b = h('button', { type: 'button', class: ghost ? 'ghost' : '', text });
    b.addEventListener('click', async () => {
      b.disabled = true;
      try { await fn(r); } catch (err) { if (err?.name !== 'AbortError') alert('Could not do that. Take a screenshot of the receipt instead.'); }
      b.disabled = false;
    });
    return b;
  };
  app.replaceChildren(
    h('h1', { text: paid ? 'Payment received' : 'Your order receipt' }),
    h('p', { class: 'muted', text: paid
      ? `Thank you, ${r.name}. Parineeta has confirmed your payment for order ${r.ref}.`
      : `Order ${r.ref}. Your payment is awaiting confirmation from Parineeta; you get a new receipt once it is confirmed.` }),
    h('p', { class: 'row receipt-actions' }, act('Download receipt', downloadReceipt), canShareFiles() ? act('Share', shareReceipt, true) : ''),
    img,
    h('p', { class: 'muted', text: 'Keep this link private: anyone with it can see this receipt.' }),
    back());
  img.src = URL.createObjectURL(await receiptBlob(r));
}

if (!DEMO && (!URL_ || !KEY)) {
  app.replaceChildren(h('h1', { text: 'Receipts are being set up' }), h('p', { class: 'muted', text: 'Message us on WhatsApp for a copy of your receipt.' }), back());
} else show();
