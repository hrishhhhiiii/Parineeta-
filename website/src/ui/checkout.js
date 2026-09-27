import { PAYMENTS, SITE, waLink } from '../data/site.js';
import { store, lineInfo, cartTotal } from './store.js';
import { h, icon, inr, $ } from './dom.js';
import { openDialog, closeDialog } from './dialogs.js';
import { postForm } from './enquiry.js';
import { toast } from './toast.js';

const dialog = () => $('#checkout-dialog');
let ctx = { lines: [], fromCart: false, ref: '' };

const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

function methods() {
  const list = [];
  if (PAYMENTS.upi.id) list.push({ id: 'upi', label: 'UPI', note: 'Any UPI app. Free and instant.' });
  if (PAYMENTS.bank.accountNumber && PAYMENTS.bank.ifsc) list.push({ id: 'bank', label: 'Bank transfer', note: 'NEFT or IMPS. Free.' });
  if (PAYMENTS.gatewayLink) list.push({ id: 'gateway', label: 'Card, net banking or wallet', note: 'Secure payment page.' });
  if (PAYMENTS.payAtShop || !list.length) list.push({ id: 'later', label: 'Pay at the shop or on delivery', note: 'Cash or UPI when you collect.' });
  return list;
}

function newRef() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRN-${ymd}-${rand}`;
}

const total = () => cartTotal(ctx.lines);
const advance = () => Math.ceil((total() * PAYMENTS.advancePercent) / 100);

function amountNow() {
  const choice = dialog().querySelector('input[name="co-amount"]:checked')?.value || 'advance';
  return choice === 'full' ? total() : advance();
}

function upiUrl(amount) {
  const params = new URLSearchParams({ pa: PAYMENTS.upi.id, pn: PAYMENTS.upi.payeeName, am: amount.toFixed(2), cu: 'INR', tn: `Parineeta order ${ctx.ref}` });
  return `upi://pay?${params.toString()}`;
}

function copyButton(value, label) {
  return h('button', { type: 'button', class: 'copy-btn', 'aria-label': `Copy ${label}`, onclick: async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied.`, { iconName: 'check-circle' });
    } catch {
      toast(`Could not copy. Please note it down: ${value}`, { iconName: 'x' });
    }
  } }, icon('link-simple'), 'Copy');
}

function renderMethodDetail() {
  const box = $('#co-method-detail');
  const m = dialog().querySelector('input[name="co-method"]:checked')?.value;
  const amt = amountNow();
  box.replaceChildren();
  const ref = () => h('div', { class: 'field' },
    h('label', { class: 'field__label', for: 'co-utr' }, 'Payment reference ', h('span', { class: 'field__opt', text: '(UTR or transaction ID, optional)' })),
    h('input', { class: 'input', id: 'co-utr', maxlength: 40, autocomplete: 'off', spellcheck: 'false' }));
  if (m === 'upi') {
    const qr = h('canvas', { class: 'co-qr', width: 220, height: 220, role: 'img', 'aria-label': `UPI QR code to pay ${inr(amt)}` });
    import('qrcode').then(({ default: QR }) => QR.toCanvas(qr, upiUrl(amt), { width: 220, margin: 1, color: { dark: '#1c0508', light: '#fbf4e4' } })).catch(() => qr.remove());
    box.append(h('div', { class: 'co-pay' },
      h('div', { class: 'co-pay__qr' }, qr, h('p', { class: 'field__help', text: 'Scan with any UPI app' })),
      h('div', { class: 'co-pay__info' },
        h('p', { class: 'co-pay__amount' }, 'Pay ', h('strong', { text: inr(amt) })),
        isTouch() ? h('a', { class: 'btn btn--gold', href: upiUrl(amt) }, 'Open my UPI app') : null,
        h('p', { class: 'co-pay__line' }, h('span', { text: `UPI ID: ${PAYMENTS.upi.id}` }), copyButton(PAYMENTS.upi.id, 'UPI ID')),
        h('p', { class: 'field__help', text: `Add the note ${ctx.ref} so we can match your payment.` }))),
    ref());
  } else if (m === 'bank') {
    const b = PAYMENTS.bank;
    const row = (k, v) => h('div', { class: 'co-bank__row' }, h('dt', { text: k }), h('dd', {}, h('span', { text: v }), copyButton(v, k)));
    box.append(h('p', { class: 'co-pay__amount' }, 'Transfer ', h('strong', { text: inr(amt) })),
      h('dl', { class: 'co-bank' }, row('Account name', b.accountName), row('Account number', b.accountNumber), row('IFSC', b.ifsc), b.bankName ? row('Bank', b.bankName) : null),
      h('p', { class: 'field__help', text: `Use ${ctx.ref} as the payment remark.` }),
      ref());
  } else if (m === 'gateway') {
    box.append(h('p', { class: 'co-pay__amount' }, 'Pay ', h('strong', { text: inr(amt) })),
      h('a', { class: 'btn btn--gold', href: PAYMENTS.gatewayLink, target: '_blank', rel: 'noopener' }, 'Open secure payment page'),
      h('p', { class: 'field__help', text: `Enter ${inr(amt)} and mention ${ctx.ref}. The payment page opens in a new tab.` }),
      ref());
  } else {
    box.append(h('p', { class: 'field__help', text: 'No payment needed now. We confirm your order and the final price on WhatsApp, and you pay when you collect or on delivery.' }));
  }
}

function render() {
  const body = $('#co-body');
  body.replaceChildren();
  const list = h('ul', { class: 'enq__list' }, ...ctx.lines.map((l) => {
    const { p, total: t, styleLabel, comboLabel } = lineInfo(l);
    return h('li', {}, h('span', { class: 'enq__item' }, `${l.qty} × ${p.en}`, h('small', { text: [styleLabel, comboLabel].filter(Boolean).join(', ') })), h('span', { class: 'enq__price', text: inr(t) }));
  }));
  const amountChoice = h('div', { class: 'options co-amounts' },
    h('label', { class: 'opt', for: 'co-amount-advance' }, h('input', { type: 'radio', name: 'co-amount', value: 'advance', id: 'co-amount-advance', checked: true }), h('span', { class: 'opt__label', text: `${PAYMENTS.advancePercent}% booking advance, ${inr(advance())}` })),
    h('label', { class: 'opt', for: 'co-amount-full' }, h('input', { type: 'radio', name: 'co-amount', value: 'full', id: 'co-amount-full' }), h('span', { class: 'opt__label', text: `Full estimate, ${inr(total())}` })));
  const ms = methods();
  const online = ms.some((m) => m.id !== 'later');
  const methodChoice = h('div', { class: 'co-methods' }, ...ms.map((m, i) => h('label', { class: 'co-method', for: `co-method-${m.id}` },
    h('input', { type: 'radio', name: 'co-method', value: m.id, id: `co-method-${m.id}`, checked: i === 0 || null }),
    h('span', { class: 'co-method__text' }, h('strong', { text: m.label }), h('small', { text: m.note })))));
  const field = (id, label, attrs, opt = false) => h('div', { class: 'field' },
    h('label', { class: 'field__label', for: id }, label, opt ? h('span', { class: 'field__opt', text: ' (optional)' }) : null),
    h(attrs.tag || 'input', { class: `input${attrs.tag === 'textarea' ? ' input--area' : ''}`, id, ...attrs, tag: null }),
    h('p', { class: 'field__error', id: `${id}-err` }));

  body.append(
    h('section', { class: 'co-step' }, h('h3', { class: 'co-step__title', text: 'Your order' }), list,
      h('p', { class: 'enq__total' }, h('span', { text: 'Estimated total' }), h('strong', { text: inr(total()) })),
      h('p', { class: 'field__help', text: 'Prices are estimates until we confirm your order. Any difference is settled on delivery.' })),
    h('section', { class: 'co-step' }, h('h3', { class: 'co-step__title', text: 'How much would you like to pay now?' }), amountChoice),
    h('section', { class: 'co-step' }, h('h3', { class: 'co-step__title', text: 'Your details' }),
      h('div', { class: 'enq__row' }, field('co-name', 'Your name', { maxlength: 80, autocomplete: 'name', required: true }), field('co-phone', 'Phone or WhatsApp', { type: 'tel', inputmode: 'tel', maxlength: 20, autocomplete: 'tel', required: true })),
      h('div', { class: 'enq__row' }, field('co-email', 'Email', { type: 'email', maxlength: 120, autocomplete: 'email', spellcheck: 'false' }, true), field('co-date', 'Wedding or event date', { type: 'date' }, true)),
      field('co-address', 'Delivery address or town', { tag: 'textarea', rows: 2, maxlength: 300, autocomplete: 'street-address' }, true)),
    h('section', { class: 'co-step' }, h('h3', { class: 'co-step__title', text: 'Payment method' }),
      online ? null : h('p', { class: 'field__help', text: 'Online payment options will appear here once the shop adds them. You can still place your order now.' }),
      methodChoice, h('div', { class: 'co-method-detail', id: 'co-method-detail' })));
  body.querySelectorAll('input[name="co-amount"], input[name="co-method"]').forEach((r) => r.addEventListener('change', renderMethodDetail));
  renderMethodDetail();
  $('#co-status').textContent = '';
  $('#co-mail').disabled = !SITE.web3formsKey;
  $('#co-actions').hidden = false;
  $('#co-done').hidden = true;
}

function values() {
  const get = (id) => ($(`#${id}`)?.value || '').trim();
  const err = (id, msg) => {
    const out = $(`#${id}-err`);
    const input = $(`#${id}`);
    out.textContent = msg;
    if (msg) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `${id}-err`);
    } else {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  };
  const v = { name: get('co-name'), phone: get('co-phone'), email: get('co-email'), date: get('co-date'), address: get('co-address'), utr: get('co-utr') };
  err('co-name', v.name.length >= 2 ? '' : 'Please tell us your name.');
  err('co-phone', v.phone.replace(/\D/g, '').length >= 10 ? '' : 'Please enter a phone number with at least 10 digits.');
  err('co-email', !v.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) ? '' : 'That email address does not look right.');
  const ok = v.name.length >= 2 && v.phone.replace(/\D/g, '').length >= 10 && (!v.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email));
  if (!ok) dialog().querySelector('[aria-invalid="true"]')?.focus();
  return ok ? v : null;
}

function orderMessage(v) {
  const method = methods().find((m) => m.id === dialog().querySelector('input[name="co-method"]:checked')?.value);
  const full = dialog().querySelector('input[name="co-amount"]:checked')?.value === 'full';
  const out = ['Namaskar Parineeta! I would like to place an order.', '', `Order: ${ctx.ref}`];
  ctx.lines.forEach((l, i) => {
    const { p, total: t, styleLabel, comboLabel } = lineInfo(l);
    out.push(`${i + 1}. ${p.en} | ${[styleLabel, comboLabel].filter(Boolean).join(', ')} | Qty ${l.qty}${l.custom ? ` | Personalise: “${l.custom}”` : ''} | ${inr(t)}`);
  });
  out.push('', `Estimated total: ${inr(total())}`, `Paying now: ${full ? 'full estimate' : `${PAYMENTS.advancePercent}% advance`}, ${inr(amountNow())}`, `Method: ${method?.label || ''}`);
  if (v.utr) out.push(`Payment reference: ${v.utr}`);
  out.push('', `Name: ${v.name}`, `Phone: ${v.phone}`);
  if (v.email) out.push(`Email: ${v.email}`);
  if (v.date) out.push(`Event date: ${v.date}`);
  if (v.address) out.push(`Deliver to: ${v.address}`);
  return out.join('\n');
}

function done(v) {
  try {
    const orders = JSON.parse(localStorage.getItem('parineeta:orders') || '[]');
    orders.unshift({ ref: ctx.ref, date: new Date().toISOString(), lines: ctx.lines, amount: amountNow(), name: v.name });
    localStorage.setItem('parineeta:orders', JSON.stringify(orders.slice(0, 20)));
  } catch {
    /* storage unavailable */
  }
  if (ctx.fromCart) store.clear();
  $('#co-actions').hidden = true;
  $('#co-done-ref').textContent = ctx.ref;
  $('#co-done').hidden = false;
  $('#co-done').scrollIntoView({ block: 'nearest' });
}

export function openCheckout({ lines, fromCart = false }) {
  if (!lines.length) return;
  ctx = { lines: lines.map((l) => ({ ...l })), fromCart, ref: newRef() };
  $('#co-title-ref').textContent = ctx.ref;
  render();
  openDialog(dialog());
}

export function setupCheckout() {
  $('#co-wa').addEventListener('click', () => {
    const v = values();
    if (!v) return;
    const url = waLink(orderMessage(v));
    if (!window.open(url, '_blank', 'noopener')) window.location.href = url;
    done(v);
  });
  $('#co-mail').addEventListener('click', async () => {
    const v = values();
    if (!v) return;
    const btn = $('#co-mail');
    const status = $('#co-status');
    btn.disabled = true;
    status.className = 'enq__status is-busy';
    status.textContent = 'Sending your order…';
    try {
      await postForm({ subject: `Order ${ctx.ref} from ${v.name}`, name: v.name, phone: v.phone, email: v.email || undefined, message: orderMessage(v) });
      status.textContent = '';
      done(v);
    } catch {
      status.className = 'enq__status is-error';
      status.textContent = 'We could not send that just now. Please use WhatsApp instead.';
    } finally {
      btn.disabled = !SITE.web3formsKey;
    }
  });
  $('#co-close').addEventListener('click', () => closeDialog(dialog()));
}
