import { byId, PALETTES } from '../data/products.js';
import { store, lineInfo, MAX } from './store.js';
import { h, icon, inr, $ } from './dom.js';
import { openDialog, closeDialog } from './dialogs.js';
import { openEnquiry } from './enquiry.js';
import { toast } from './toast.js';
import { mediaStage } from './mediaStage.js';

let viewer = null;
let viewerLoading = null;
let gallery = null;
// Kept once found: the media stage takes the canvas off the page while a photo or film is showing.
let canvasEl = null;
const canvas = () => (canvasEl ||= $('#viewer-canvas'));
const cur = { p: null, style: null, combo: null, qty: 1 };
const dialog = () => $('#product-dialog');

function ensureViewer() {
  viewerLoading ||= import('../three/viewer.js').then(({ createViewer }) => {
    viewer = createViewer(canvas());
    return viewer;
  });
  return viewerLoading;
}

function line() {
  return { id: cur.p.id, style: cur.style, combo: cur.combo, custom: $('#pp-custom').value.trim(), qty: cur.qty };
}

function renderTotal() {
  const { total, unit } = lineInfo(line());
  $('#pp-total').replaceChildren(h('span', { class: 'price__from', text: cur.qty > 1 ? `${cur.qty} × ${inr(unit)} =` : 'from' }), ' ', inr(total));
  $('#pp-qty').textContent = String(cur.qty);
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
  $('#pp-page').href = `#/p/${p.id}`;

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

  const combos = $('#pp-combos');
  combos.replaceChildren(...p.combos.map((c) =>
    radio('pp-combo', c.id, c.id === cur.combo, c.add ? `${c.label} (+${inr(c.add)})` : c.label)));

  const wrap = $('#pp-custom-wrap');
  wrap.hidden = !p.customizable;
  $('#pp-custom').value = '';
  $('#pp-custom-help').textContent = p.customHelp || 'Names, a date, or a line you want painted on it.';
  $('#pp-lead').textContent = `Made to order in about ${p.leadDays} days.`;
  renderTotal();
  renderWish();
}

export function openProduct(id, styleId) {
  const p = byId(id);
  if (!p || !p.model) return;
  cur.p = p;
  cur.style = styleId && p.styles.includes(styleId) ? styleId : p.styles[0];
  cur.combo = p.combos[0].id;
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
  $('#pp-combos').addEventListener('change', (e) => {
    cur.combo = e.target.value;
    renderTotal();
  });
  d.querySelectorAll('[data-qty]').forEach((b) =>
    b.addEventListener('click', () => {
      cur.qty = Math.max(1, Math.min(MAX, cur.qty + Number(b.dataset.qty)));
      renderTotal();
    }));
  $('#pp-form').addEventListener('submit', (e) => {
    e.preventDefault();
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
    const added = store.toggleWish(cur.p.id);
    renderWish();
    toast(added ? `${cur.p.en} saved to your wishlist.` : `${cur.p.en} removed from your wishlist.`, { iconName: 'heart' });
  });
  $('#pp-enquire').addEventListener('click', () => openEnquiry({ lines: [line()] }));
}
