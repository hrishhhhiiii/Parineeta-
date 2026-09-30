import { SITE, waLink } from '../data/site.js';
import { store, lineInfo, cartTotal } from './store.js';
import { h, inr, $ } from './dom.js';
import { openDialog, closeDialog } from './dialogs.js';
import { toast } from './toast.js';

const dialog = () => $('#enquiry-dialog');
let ctx = { lines: [], subject: '', fromCart: false };

function describe(line, i) {
  const { p, total, styleLabel, comboLabel } = lineInfo(line);
  const parts = [`${i + 1}. ${p.en} (${p.bn})`];
  if (styleLabel) parts.push(`Colour: ${styleLabel}`);
  if (comboLabel) parts.push(`Option: ${comboLabel}`);
  parts.push(`Qty: ${line.qty}`);
  if (line.custom) parts.push(`Personalise: “${line.custom}”`);
  parts.push(`Est. ${inr(total)}`);
  return parts.join(' | ');
}

function formValues() {
  const f = $('#enq-form');
  const get = (n) => (f.elements[n]?.value || '').trim();
  return { name: get('name'), phone: get('phone'), email: get('email'), date: get('event_date'), place: get('location'), note: get('note'), bot: f.elements.botcheck?.checked };
}

// Copies the enquiry into the admin inbox. Fire-and-forget: a CORS "simple" request with keepalive,
// so it survives the page opening WhatsApp and never delays the customer.
// The customer's private tracking link: a random token only they get; the database stores its hash.
const INBOX_URL = import.meta.env.VITE_ENQUIRY_URL;
function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
/** Returns the tracking link, or '' when the inbox isn't connected. */
function logEnquiry(v) {
  if (!INBOX_URL || v.bot || !v.name) return '';
  const token = newToken();
  const body = JSON.stringify({ token, name: v.name, phone: v.phone, email: v.email, eventDate: v.date, place: v.place, note: v.note,
    items: ctx.lines.map((l, i) => describe(l, i)).concat(ctx.subject && !ctx.lines.length ? [ctx.subject] : []) });
  try {
    fetch(INBOX_URL, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch {
    return '';
  }
  // In the hash, so the token never reaches server logs or other sites' Referer headers.
  return `${location.origin}/track#${token}`;
}

function buildMessage(v, trackUrl = '') {
  const lines = ['Namaskar Parineeta! I found you on your website.'];
  if (ctx.lines.length) {
    lines.push('', 'I would like to enquire about:');
    ctx.lines.forEach((l, i) => lines.push(describe(l, i)));
    lines.push(`Estimated total: ${inr(cartTotal(ctx.lines))} (indicative)`);
  } else if (ctx.subject) {
    lines.push('', `I would like to ask about: ${ctx.subject}`);
  }
  const extra = [
    v.name && `Name: ${v.name}`,
    v.phone && `Phone: ${v.phone}`,
    v.email && `Email: ${v.email}`,
    v.date && `Event date: ${v.date}`,
    v.place && `Delivery to: ${v.place}`,
    v.note && `Note: ${v.note}`,
  ].filter(Boolean);
  if (extra.length) lines.push('', ...extra);
  if (trackUrl) lines.push('', `Track this enquiry: ${trackUrl}`);
  return lines.join('\n');
}

function setError(id, msg) {
  const input = document.getElementById(id);
  const out = document.querySelector(`[data-error-for="${id}"]`);
  if (!out || !input) return;
  out.id ||= `${id}-err`;
  out.textContent = msg || '';
  if (msg) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', out.id);
  } else {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }
}

function validate(v) {
  let ok = true;
  setError('enq-name', '');
  setError('enq-phone', '');
  setError('enq-email', '');
  if (v.name.length < 2) {
    setError('enq-name', 'Please tell us your name.');
    ok = false;
  }
  if (v.phone.replace(/\D/g, '').length < 10) {
    setError('enq-phone', 'Please enter a phone number with at least 10 digits.');
    ok = false;
  }
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) {
    setError('enq-email', 'That email address does not look right.');
    ok = false;
  }
  return ok;
}

function status(msg, kind = '') {
  const el = $('#enq-status');
  el.className = `enq__status ${kind ? `is-${kind}` : ''}`;
  el.textContent = msg;
}

function renderSummary() {
  const box = $('#enq-summary');
  box.replaceChildren();
  if (ctx.lines.length) {
    const list = h('ul', { class: 'enq__list' });
    for (const l of ctx.lines) {
      const { p, total, styleLabel, comboLabel } = lineInfo(l);
      list.append(h('li', {},
        h('span', { class: 'enq__item' }, `${l.qty} × ${p.en}`, h('small', { text: [styleLabel, comboLabel].filter(Boolean).join(', ') })),
        h('span', { class: 'enq__price', text: inr(total) })));
    }
    box.append(list, h('p', { class: 'enq__total' }, h('span', { text: 'Estimated total' }), h('strong', { text: inr(cartTotal(ctx.lines)) })));
  } else if (ctx.subject) {
    box.append(h('p', { class: 'enq__subject' }, 'About: ', h('strong', { text: ctx.subject })));
  }
}

/** Sends a message to the shop's inbox through Web3Forms. Throws if not configured or on failure. */
export async function postForm(fields) {
  if (!SITE.web3formsKey) throw new Error('Email sending is not configured');
  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ access_key: SITE.web3formsKey, from_name: 'Parineeta website', ...fields }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.message || 'Request failed');
  return data;
}

export function openEnquiry({ lines = [], subject = '', fromCart = false } = {}) {
  ctx = { lines: lines.map((l) => ({ ...l })), subject, fromCart };
  renderSummary();
  status('');
  ['enq-name', 'enq-phone', 'enq-email'].forEach((id) => setError(id, ''));
  const mailNote = $('#enq-mail-note');
  mailNote.textContent = SITE.web3formsKey
    ? 'We reply within a day, usually on WhatsApp.'
    : 'Email sending is being set up. WhatsApp is the fastest way to reach us.';
  $('#enq-mail').disabled = !SITE.web3formsKey;
  openDialog(dialog());
  if (window.matchMedia('(pointer: fine)').matches) setTimeout(() => $('#enq-name').focus(), 60);
}

export function setupEnquiry() {
  $('#enq-wa').addEventListener('click', () => {
    const v = formValues();
    const url = waLink(buildMessage(v, logEnquiry(v)));
    // 'noopener' would make window.open return null, and this tab would follow to WhatsApp too.
    const win = window.open(url, '_blank');
    if (win) win.opener = null;
    else window.location.href = url;
    toast('WhatsApp opened with your enquiry. Just press send.', { iconName: 'whatsapp-logo' });
  });

  $('#enq-mail').addEventListener('click', async () => {
    const v = formValues();
    if (!SITE.web3formsKey) return;
    if (!validate(v)) {
      status('Please check the highlighted fields.', 'error');
      $('#enq-form [aria-invalid="true"]')?.focus();
      return;
    }
    if (v.bot) return;
    const trackUrl = logEnquiry(v);
    const btn = $('#enq-mail');
    btn.disabled = true;
    status('Sending your enquiry…', 'busy');
    try {
      await postForm({
        subject: `Website enquiry from ${v.name}`,
        name: v.name,
        phone: v.phone,
        email: v.email || undefined,
        event_date: v.date,
        location: v.place,
        message: buildMessage(v, trackUrl),
      });
      if (ctx.fromCart) store.clear();
      $('#enq-form').reset();
      if (trackUrl) {
        status('Thank you. Your enquiry has reached us and we will reply within a day. Keep this link to follow its progress:', 'ok');
        $('#enq-status').append(' ', h('a', { href: trackUrl, target: '_blank', rel: 'noopener', text: 'Track my enquiry' }));
      } else {
        status('Thank you. Your enquiry has reached us and we will reply within a day.', 'ok');
        setTimeout(() => closeDialog(dialog()), 2200);
      }
    } catch {
      status('We could not send that just now. Please try WhatsApp, or call +91 97342 41918.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}
