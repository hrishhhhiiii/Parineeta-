import { byId, PALETTES } from '../data/products.js';
import { store, lineInfo, MAX } from './store.js';
import { h, icon, inr, $ } from './dom.js';
import { openDialog, closeDialog } from './dialogs.js';
import { openEnquiry } from './enquiry.js';
import { toast } from './toast.js';
import { openLightbox, describeMedia } from './lightbox.js';

let viewer = null;
let viewerLoading = null;
const cur = { p: null, style: null, combo: null, qty: 1 };
const dialog = () => $('#product-dialog');

function ensureViewer() {
  viewerLoading ||= import('../three/viewer.js').then(({ createViewer }) => {
    viewer = createViewer($('#viewer-canvas'));
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

  const media = $('#pp-media');
  media.replaceChildren();
  if (p.media.length) {
    media.append(h('p', { class: 'field__label', text: 'From our studio' }));
    const row = h('div', { class: 'pp__photos' });
    p.media.forEach((ref, i) => {
      const m = describeMedia(ref);
      row.append(h('button', { type: 'button', class: 'pp__photo', 'aria-label': `${ref.type === 'reel' ? 'Play film' : 'View photo'}: ${m.title || p.en}`, onclick: () => openLightbox(p.media, i, { subject: p.en }) },
        h('img', { src: m.thumb, alt: '', loading: 'lazy', width: 360, height: 640 }),
        ref.type === 'reel' ? h('span', { class: 'pp__play' }, icon('play', 'fill')) : null));
    });
    media.append(row);
  }

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
  ensureViewer().then((v) => {
    if (!dialog().open || cur.p !== p) return;
    v.show(p, cur.style);
    v.start();
  });
}

export function setupProductPanel() {
  const d = dialog();
  d.addEventListener('close', () => viewer?.stop());

  $('#pp-styles').addEventListener('change', (e) => {
    cur.style = e.target.value;
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
