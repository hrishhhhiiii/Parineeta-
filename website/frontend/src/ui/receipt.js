// Order receipt drawn as a PNG the customer can save or share on WhatsApp.
// It records the order and the payment the customer reported; Parineeta verifies payments itself,
// so an online payment is always shown as awaiting confirmation.
import { SITE } from '../data/site.js';
import { inr } from './dom.js';

const W = 1080;
const PAD = 80;
const C = { paper: '#fbf4e4', ink: '#1c0508', muted: '#6b4a3f', gold: '#a8761f', rule: '#e2d3b4', note: '#f3e6c8' };
const SERIF = "'Cormorant Garamond', 'Cormorant Fallback', Georgia, serif";
const SANS = "'Plus Jakarta Sans', 'Jakarta Fallback', system-ui, sans-serif";

const phone = (n) => (/^91\d{10}$/.test(n) ? `+91 ${n.slice(2, 7)} ${n.slice(7)}` : `+${n}`);
const loadImage = (src) => new Promise((res) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => res(null);
  img.src = src;
});

/**
 * r: { ref, date, name, phone, email, eventDate, address, items: [{ title, detail, qty, amount }],
 *      total, paidNow, plan, method: { id, label }, payTo, utr, status?: 'placed' | 'paid', paidAmount?, paidAt? }
 */
export async function receiptBlob(r) {
  const paid = r.status === 'paid';
  // Canvas text only uses fonts that are already loaded, so load the two receipt faces first.
  await Promise.all([`600 64px ${SERIF}`, `400 30px ${SANS}`, `700 30px ${SANS}`].map((f) => document.fonts?.load(f).catch(() => null)));
  const logo = await loadImage('/brand/parineeta_monogram_initial_transparent.png');
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 5000;
  const g = canvas.getContext('2d');
  g.fillStyle = C.paper;
  g.fillRect(0, 0, W, canvas.height);
  g.textBaseline = 'alphabetic';
  let y = PAD;

  const set = (size, weight = 400, fam = SANS, color = C.ink, align = 'left') => {
    g.font = `${weight} ${size}px ${fam}`;
    g.fillStyle = color;
    g.textAlign = align;
  };
  const wrap = (text, max) => {
    const out = [];
    let line = '';
    for (const word of String(text).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && g.measureText(next).width > max) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  const rule = (gap = 30) => {
    y += gap;
    g.fillStyle = C.rule;
    g.fillRect(PAD, y, W - 2 * PAD, 2);
    y += gap;
  };
  const heading = (s) => {
    y += 72;
    set(24, 700, SANS, C.gold);
    g.fillText(s.toUpperCase(), PAD, y);
    y += 16;
  };
  // A label on the left, its value on the right (wrapped).
  const pair = (label, value, { bold = false, size = 30 } = {}) => {
    y += size + 16;
    set(size, 400, SANS, C.muted);
    g.fillText(label, PAD, y);
    set(size, bold ? 700 : 500, SANS, C.ink, 'right');
    wrap(value, W / 2 - PAD).forEach((line, i) => {
      if (i) y += size + 10;
      g.fillText(line, W - PAD, y);
    });
  };

  if (logo) {
    const s = 120;
    g.drawImage(logo, (W - s) / 2, y, s, (s * logo.height) / logo.width);
    y += (s * logo.height) / logo.width + 20;
  }
  y += 56;
  set(64, 600, SERIF, C.ink, 'center');
  g.fillText('Parineeta', W / 2, y);
  y += 40;
  set(24, 500, SANS, C.muted, 'center');
  g.fillText('HAND-PAINTED BENGALI WEDDING HEIRLOOMS', W / 2, y);
  y += 70;
  set(40, 600, SERIF, C.gold, 'center');
  g.fillText(paid ? 'Payment receipt' : 'Order receipt', W / 2, y);
  rule(36);

  y -= 30;
  pair('Order number', r.ref, { bold: true });
  pair('Date', new Date(r.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }));

  heading('Customer');
  pair('Name', r.name);
  pair('Phone', r.phone);
  if (r.email) pair('Email', r.email);
  if (r.eventDate) pair('Event date', new Date(r.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
  if (r.address) pair('Deliver to', r.address);

  heading('Items');
  for (const it of r.items) {
    y += 46;
    set(30, 600, SANS, C.ink);
    const lines = wrap(`${it.qty} × ${it.title}`, W - 2 * PAD - 220);
    lines.forEach((line, i) => {
      if (i) y += 40;
      g.fillText(line, PAD, y);
    });
    set(30, 600, SANS, C.ink, 'right');
    g.fillText(inr(it.amount), W - PAD, y - (lines.length - 1) * 40);
    if (it.detail) {
      set(24, 400, SANS, C.muted);
      wrap(it.detail, W - 2 * PAD - 220).forEach((line) => {
        y += 34;
        g.fillText(line, PAD, y);
      });
    }
  }
  rule(30);
  y -= 30;
  pair('Estimated total', inr(r.total), { bold: true, size: 32 });
  const settled = paid ? r.paidAmount : r.method.id === 'later' ? 0 : r.paidNow;
  if (paid) pair('Paid', inr(settled), { bold: true });
  else if (r.method.id === 'later') pair('Paying now', 'Nothing, pay at the shop');
  else pair(`Paying now (${r.plan})`, inr(settled));
  pair('Balance due', inr(Math.max(0, r.total - settled)));

  heading('Payment');
  pair('Method', r.method.label);
  if (r.payTo) pair('Paid to', r.payTo);
  if (r.method.id !== 'later' || paid) pair('Reference (UTR)', r.utr || 'Not given');

  // Status box: this receipt is not proof that money arrived until the shop confirms it.
  const status = paid
    ? `Payment of ${inr(r.paidAmount)} received on ${new Date(r.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Thank you!`
    : r.method.id === 'later'
    ? 'Nothing paid yet. You pay at the shop or on delivery.'
    : `Payment of ${inr(r.paidNow)} reported by the customer. Awaiting confirmation from Parineeta.`;
  y += 50;
  set(28, 600, SANS, C.ink);
  const sLines = wrap(status, W - 2 * PAD - 60);
  const boxH = sLines.length * 40 + 44;
  g.fillStyle = C.note;
  g.fillRect(PAD, y, W - 2 * PAD, boxH);
  g.fillStyle = C.gold;
  g.fillRect(PAD, y, 8, boxH);
  set(28, 600, SANS, C.ink);
  sLines.forEach((line, i) => g.fillText(line, PAD + 36, y + 50 + i * 40));
  y += boxH;

  rule(40);
  set(24, 400, SANS, C.muted, 'center');
  for (const line of [
    'Prices are estimates until Parineeta confirms your order.',
    `WhatsApp ${phone(SITE.whatsapp)}${SITE.email ? ` · ${SITE.email}` : ''}`,
  ]) {
    y += 36;
    g.fillText(line, W / 2, y);
  }
  y += PAD;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = Math.ceil(y);
  out.getContext('2d').drawImage(canvas, 0, 0);
  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('Could not draw the receipt'))), 'image/png'));
}

const fileName = (r) => `Parineeta-receipt-${r.ref}.png`;

export async function downloadReceipt(r) {
  const url = URL.createObjectURL(await receiptBlob(r));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName(r) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const canShareFiles = () => {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'x.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
};

export async function shareReceipt(r) {
  const file = new File([await receiptBlob(r)], fileName(r), { type: 'image/png' });
  await navigator.share({ files: [file], title: `Parineeta order ${r.ref}` });
}
