// "Send payment screenshot", used by checkout's thank-you step and by My orders.
// The customer picks the screenshot; it is saved privately on the order (024_payment_proofs.sql), then
// "Send on WhatsApp" shares the picture and a note straight into WhatsApp from the phone (on a computer,
// where files can't be shared, WhatsApp opens with the note and the customer attaches the picture).
import './paymentProof.css';
import { SITE, waLink } from '../data/site.js';

const MAX_SIDE = 1600;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
const inr = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const shopNumber = () => {
  const d = String(SITE.whatsapp || '').replace(/\D/g, '');
  return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : `+${d}`;
};

/** The screenshot as a JPEG at most 1600 px on its longer side; the original if the browser can't read it. */
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (blob) return blob;
  } catch {
    /* fall through to the original file */
  }
  if (!ALLOWED.includes(file.type) || file.size > MAX_BYTES) throw new Error('Please choose a photo or screenshot (JPG or PNG, under 5 MB).');
  return file;
}

/**
 * @param {object} o
 * @param {string} o.ref               order number
 * @param {number} o.amount            what the customer was asked to pay
 * @param {() => Promise<object>} o.client  Supabase client acting as the signed-in customer
 * @param {(tag: string, props?: object, ...kids: any[]) => HTMLElement} o.h  the page's element helper
 * @param {(state: 'sent') => void} [o.onSent]  called once the screenshot is saved on the order
 */
export function paymentProof({ ref, amount, client, h, onSent }) {
  let shot = null; // { blob, type }
  const status = h('p', { class: 'field__help proof__status', role: 'status', 'aria-live': 'polite' });
  const say = (text, err = false) => { status.textContent = text; status.classList.toggle('is-error', err); };
  const note = () => `Namaskar Parineeta! Here is my payment screenshot for order ${ref}. I have paid ${inr(amount)}.`;

  const share = h('button', { type: 'button', class: 'btn btn--gold', hidden: true }, 'Send on WhatsApp');
  share.addEventListener('click', async () => {
    const file = shot && new File([shot.blob], `${ref}-payment.${shot.type === 'image/png' ? 'png' : 'jpg'}`, { type: shot.type });
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: note() });
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    // Computers and older phones can't hand a picture to WhatsApp: open the chat with the note instead.
    const win = window.open(waLink(note()), '_blank');
    if (win) win.opener = null; else window.location.href = waLink(note());
    say('WhatsApp opened with your note. Attach the screenshot there before sending.');
  });

  const input = h('input', { type: 'file', accept: 'image/*', class: 'proof__file', 'aria-label': `Payment screenshot for order ${ref}` });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    pick.setAttribute('aria-disabled', 'true');
    say('Saving your screenshot…');
    try {
      const blob = await shrink(file);
      shot = { blob, type: blob.type || file.type };
      const sb = await client();
      const path = `${ref}/${Date.now()}.${shot.type === 'image/png' ? 'png' : shot.type === 'image/webp' ? 'webp' : 'jpg'}`;
      const { error: up } = await sb.storage.from('payment-proofs').upload(path, blob, { contentType: shot.type, upsert: false });
      if (up) throw up;
      const { error } = await sb.rpc('attach_payment_proof', { p_ref: ref, p_path: path });
      if (error) throw error;
      say(`Saved on your order. Now tap Send on WhatsApp: it opens with the screenshot attached. Choose Parineeta (${shopNumber()}) and press send.`);
      onSent?.('sent');
    } catch (err) {
      say(shot
        ? `We couldn't save it on your order${err?.hint ? ` (${err.hint})` : ''}. Please send it to us on WhatsApp instead.`
        : (err?.message || 'Could not read that picture. Please try another.'), true);
    } finally {
      pick.removeAttribute('aria-disabled');
      share.hidden = !shot;
    }
  });
  const pick = h('label', { class: 'btn btn--ghost proof__pick' }, input, 'Choose payment screenshot');

  return h('div', { class: 'proof' },
    h('p', { class: 'proof__title' }, h('strong', { text: 'Paid? Send us the payment screenshot.' }),
      ' We check it against our account and confirm your order on WhatsApp.'),
    h('div', { class: 'proof__actions' }, pick, share),
    status);
}
