import { byId, PALETTES, productHref, variantsOf } from '../data/products.js';
import { pickOf, stockLine, todayIso } from '../data/pricing.js';
import { SITE, waLink } from '../data/site.js';
import { store, lineInfo, MAX, weddingDate, setWeddingDate } from './store.js';
import { h, icon, inr, $ } from './dom.js';
import { openDialog, closeDialog } from './dialogs.js';
import { openEnquiry } from './enquiry.js';
import { toast } from './toast.js';
import { mediaStage } from './mediaStage.js';
import { requireSignIn } from './signInGate.js';

let viewer = null;
let viewerLoading = null;
let gallery = null;
// Kept once found: the media stage takes the canvas off the page while a photo or film is showing.
let canvasEl = null;
const canvas = () => (canvasEl ||= $('#viewer-canvas'));
const cur = { p: null, style: null, pick: {}, qty: 1 };
const dialog = () => $('#product-dialog');

function ensureViewer() {
  viewerLoading ||= import('../three/viewer.js').then(({ createViewer }) => {
    viewer = createViewer(canvas());
    return viewer;
  });
  return viewerLoading;
}

function line() {
  return { id: cur.p.id, style: cur.style, pick: { ...cur.pick }, custom: $('#pp-custom').value.trim(), qty: cur.qty };
}

function renderTotal() {
  const { total, unit, stock } = lineInfo(line());
  $('#pp-total').replaceChildren(h('span', { class: 'price__from', text: cur.qty > 1 ? `${cur.qty} × ${inr(unit)} =` : 'from' }), ' ', inr(total));
  $('#pp-qty').textContent = String(cur.qty);
  paintStock($('#pp-lead'), cur.p, stock);
  const out = stock.status === 'out';
  const add = $('#pp-form button[type="submit"]');
  add.disabled = out;
  add.lastChild.textContent = out ? 'Sold out' : 'Add to cart';
  $('#pp-enquire').lastChild.textContent = out ? 'Ask on WhatsApp' : 'Enquire';
}

/** The stock line under the price, with the customer's wedding date: "Order by 12 Nov for your 20 Nov
 *  wedding", "Ready now, in time for…", "Tight for…", "Made to order…" or "Sold out". The date is kept in
 *  this browser and shared with checkout. */
export function paintStock(el, p, stock) {
  const today = todayIso();
  const wedding = weddingDate(today);
  const line = stockLine(p, stock, wedding, today, SITE.deliveryBufferDays);
  el.dataset.stock = line.tone;
  el.classList.toggle('is-few', stock.few);
  if (stock.status === 'out') {
    el.textContent = line.text;
    return;
  }
  const input = h('input', {
    class: 'wedding-date__input', type: 'date', min: today, value: wedding, 'aria-label': 'Your wedding date',
    onchange: (e) => {
      setWeddingDate(e.target.value);
      paintStock(el, p, stock);
    },
  });
  el.replaceChildren(h('span', { class: 'pp__stock-text', text: line.text }), ' ',
    h('label', { class: 'wedding-date' }, h('span', { class: 'wedding-date__label', text: line.prompt ? 'Add your wedding date' : 'Wedding date' }), input));
}

/** One group of radio pills per choice (Size, Type…). Sold-out options can't be picked.
 *  `onPick(groupId, optionId)` runs on every change. Shared with the product page. */
export function choiceFields(p, pick, onPick, name) {
  return variantsOf(p).map((g) => {
    const fs = h('fieldset', { class: 'field' }, h('legend', { class: 'field__label', text: g.name }),
      h('div', { class: 'options' }, ...g.options.map((o) => {
        const out = (o.stock || p.stock) === 'out';
        const id = `${name}-${g.id}-${o.id}`;
        return h('label', { class: `opt${out ? ' is-out' : ''}`, for: id },
          h('input', { type: 'radio', name: `${name}-${g.id}`, value: o.id, id, checked: pick[g.id] === o.id || null, disabled: out || null }),
          h('span', { class: 'opt__label', text: `${o.label}${o.add ? ` (+${inr(o.add)})` : ''}${out ? ' · sold out' : ''}` }));
      })));
    fs.addEventListener('change', (e) => onPick(g.id, e.target.value));
    return fs;
  });
}

/** First choices for a product: each group's first option that isn't sold out. */
export function firstPick(p) {
  const pick = pickOf(p, {});
  for (const g of variantsOf(p)) {
    const ok = g.options.find((o) => (o.stock || p.stock) !== 'out');
    if (ok) pick[g.id] = ok.id;
  }
  return pick;
}

function renderWish() {
  const on = store.hasWish(cur.p.id);
  const btn = $('#pp-wish');
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Save to wishlist');
  btn.replaceChildren(icon('heart', on ? 'fill' : 'light'));
}

function radio(name, value, checked, label, extra) {
  const id = `${name}-${value}`;
  return h('label', { class: 'opt', for: id },
    h('input', { type: 'radio', name, value, id, checked: checked || null }),
    extra || null,
    h('span', { class: 'opt__label', text: label }));
}

function render(p) {
  $('#pp-bn').textContent = p.bn;
  $('#pp-en').textContent = p.en;
  $('#pp-story').textContent = p.story;
  $('#pp-page').href = productHref(p.id);

  // Real photos and films lead the big view; the 3D model is the last thumbnail.
  const cv = canvas();
  gallery?.stop();
  gallery = mediaStage(p, { stage: $('.pp__viewer'), canvas: cv, ensureViewer, viewer: () => viewer, style: () => cur.style, isCurrent: () => cur.p === p && dialog().open });
  $('#pp-media').replaceChildren(...(gallery.thumbs ? [h('p', { class: 'field__label', text: 'Photos and films from our studio' }), gallery.thumbs] : []));

  const styles = $('#pp-styles');
  styles.replaceChildren(...p.styles.map((s) => {
    const pal = PALETTES[s];
    const dot = h('span', { class: 'swatch', style: `--a:${pal.base};--b:${pal.accent};--c:${pal.detail}`, 'aria-hidden': 'true' });
    return radio('pp-style', s, s === cur.style, pal.label, dot);
  }));

  $('#pp-choices').replaceChildren(...choiceFields(p, cur.pick, (g, o) => {
    cur.pick[g] = o;
    const photo = variantsOf(p).find((x) => x.id === g)?.options.find((x) => x.id === o)?.photo;
    if (photo) gallery?.showPhoto(photo);
    renderTotal();
  }, 'pp'));

  const wrap = $('#pp-custom-wrap');
  wrap.hidden = !p.customizable;
  $('#pp-custom').value = '';
  $('#pp-custom-help').textContent = p.customHelp || 'Names, a date, or a line you want painted on it.';
  renderTotal();
  renderWish();
}

export function openProduct(id, styleId) {
  const p = byId(id);
  if (!p || !p.model) return;
  cur.p = p;
  cur.style = styleId && p.styles.includes(styleId) ? styleId : p.styles[0];
  cur.pick = firstPick(p);
  cur.qty = 1;
  render(p);
  openDialog(dialog());
  dialog().querySelector('.sheet__inner').scrollTop = 0;
}

export function setupProductPanel() {
  const d = dialog();
  d.addEventListener('close', () => gallery?.stop());

  $('#pp-styles').addEventListener('change', (e) => {
    cur.style = e.target.value;
    // Colourways are previewed on the 3D model; the photos show the piece as made.
    gallery?.show3d();
    viewer?.show(cur.p, cur.style);
    renderTotal();
  });
  d.querySelectorAll('[data-qty]').forEach((b) =>
    b.addEventListener('click', () => {
      cur.qty = Math.max(1, Math.min(MAX, cur.qty + Number(b.dataset.qty)));
      renderTotal();
    }));
  $('#pp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!requireSignIn('add pieces to your cart')) return;
    store.add(line());
    toast(`${cur.p.en} added to your enquiry cart.`, {
      action: 'View cart',
      onAction: () => {
        closeDialog(d);
        setTimeout(() => document.querySelector('[data-open="cart"]').click(), 260);
      },
    });
  });
  $('#pp-wish').addEventListener('click', () => {
    if (!requireSignIn('save pieces to your wishlist')) return;
    const added = store.toggleWish(cur.p.id);
    renderWish();
    toast(added ? `${cur.p.en} saved to your wishlist.` : `${cur.p.en} removed from your wishlist.`, { iconName: 'heart' });
  });
  $('#pp-enquire').addEventListener('click', () => openEnquiry({ lines: [line()] }));
}
