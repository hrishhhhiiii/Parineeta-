import { byId, isSet, productHref, has3d } from '../data/products.js';
import { photoSrc, reelStill } from '../data/site.js';
import { store, lineInfo, cartTotal, MAX } from './store.js';
import { h, icon, inr, $, $$ } from './dom.js';
import { openDialog, closeDialog, scrollToHash } from './dialogs.js';
import { openEnquiry } from './enquiry.js';
import { openCheckout } from './checkout.js';
import { toast } from './toast.js';

let thumbs = null;
const loadThumbs = () => (thumbs ||= import('../three/thumbs.js'));

/** Fills an <img> with a 3D render (or a composite for sets). */
const pending = new WeakMap();
const thumbObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    thumbObserver.unobserve(e.target);
    const job = pending.get(e.target);
    pending.delete(e.target);
    job?.();
  }
}, { rootMargin: '1000px 600px' });

export function thumbImg(product, style, cls = 'thumb') {
  const img = h('img', { class: cls, alt: '', width: 360, height: 440, decoding: 'async' });
  const id = isSet(product.id) ? product.items[0] : product.id;
  const p = byId(id);
  if (!has3d(p)) {
    // No 3D model: the shop's own photo (or film still), else the brand mark.
    const photo = p?.media?.find((m) => m.type === 'photo');
    const reel = p?.media?.find((m) => m.type === 'reel');
    img.src = photo ? photoSrc(photo.id, 400) : reel ? reelStill(reel.id) : '/brand/favicon-192x192.png';
    img.loading = 'lazy';
    img.classList.add('thumb--photo');
    return img;
  }
  pending.set(img, () => loadThumbs()
    .then(({ getThumb }) => getThumb(p, isSet(product.id) ? undefined : style))
    .then((url) => {
      if (url) img.src = url;
    }));
  thumbObserver.observe(img);
  return img;
}

function emptyState(title, body, cta) {
  return h('div', { class: 'empty' },
    h('span', { class: 'empty__mark brand-mask', 'aria-hidden': 'true' }),
    h('p', { class: 'empty__title', text: title }),
    h('p', { class: 'empty__body', text: body }),
    h('a', { class: 'btn btn--gold', href: '#collection', 'data-close': '', text: cta }));
}

function renderCart() {
  const body = $('#cart-body');
  const foot = $('#cart-foot');
  const lines = store.cart;
  body.replaceChildren();
  foot.hidden = !lines.length;
  if (!lines.length) {
    body.append(emptyState('Your cart is empty', 'Add pieces from the collection and send them to us as one enquiry.', 'Explore the collection'));
    return;
  }
  const list = h('ul', { class: 'lines' });
  for (const l of lines) {
    const { p, total, styleLabel, comboLabel } = lineInfo(l);
    const meta = [styleLabel, comboLabel].filter(Boolean).join(', ');
    list.append(h('li', { class: 'line' },
      h('div', { class: 'line__thumb' }, thumbImg(p, l.style)),
      h('div', { class: 'line__info' },
        h('p', { class: 'line__name' }, isSet(p.id) ? p.en : h('a', { href: productHref(p.id), text: p.en }), h('span', { class: 'bn', lang: 'bn', translate: 'no', text: p.bn })),
        meta ? h('p', { class: 'line__meta', text: meta }) : null,
        l.custom ? h('p', { class: 'line__meta', text: `Personalise: “${l.custom}”` }) : null,
        h('div', { class: 'line__row' },
          h('div', { class: 'qty qty--sm', 'aria-label': `Quantity of ${p.en}` },
            h('button', { type: 'button', class: 'qty__btn', 'aria-label': 'Decrease quantity', disabled: l.qty <= 1 || null, onclick: () => store.setQty(l.key, l.qty - 1) }, icon('minus')),
            h('output', { class: 'qty__val', text: String(l.qty) }),
            h('button', { type: 'button', class: 'qty__btn', 'aria-label': 'Increase quantity', disabled: l.qty >= MAX || null, onclick: () => store.setQty(l.key, l.qty + 1) }, icon('plus'))),
          h('span', { class: 'line__price', text: inr(total) }))),
      h('button', { type: 'button', class: 'icon-btn line__remove', 'aria-label': `Remove ${p.en}`, onclick: () => {
        const saved = { ...l };
        store.remove(l.key);
        toast(`${p.en} removed from your cart.`, { iconName: 'trash', action: 'Undo', onAction: () => store.add(saved) });
      } }, icon('trash'))));
  }
  body.append(list);
  $('#cart-total').textContent = inr(cartTotal(lines));
}

function renderWish() {
  const body = $('#wish-body');
  body.replaceChildren();
  const ids = store.wish;
  if (!ids.length) {
    body.append(emptyState('Nothing saved yet', 'Tap the heart on any piece to keep it here while you decide.', 'Explore the collection'));
    return;
  }
  const list = h('ul', { class: 'lines' });
  for (const id of ids) {
    const p = byId(id);
    const set = isSet(id);
    list.append(h('li', { class: 'line' },
      h('div', { class: 'line__thumb' }, thumbImg(p)),
      h('div', { class: 'line__info' },
        h('p', { class: 'line__name' }, p.en, h('span', { class: 'bn', lang: 'bn', translate: 'no', text: p.bn })),
        h('p', { class: 'line__meta', text: `from ${inr(set ? p.price : p.priceFrom)}` }),
        h('div', { class: 'line__row' },
          set
            ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => { store.add({ id, qty: 1 }); toast(`${p.en} added to your enquiry cart.`); } }, 'Add to cart')
            : h('a', { class: 'btn btn--ghost btn--sm', href: productHref(id) }, 'View details'))),
      h('button', { type: 'button', class: 'icon-btn line__remove', 'aria-label': `Remove ${p.en} from wishlist`, onclick: () => {
        store.toggleWish(id);
        toast(`${p.en} removed from your wishlist.`, { iconName: 'heart', action: 'Undo', onAction: () => { if (!store.hasWish(id)) store.toggleWish(id); } });
      } }, icon('x'))));
  }
  body.append(list);
}

function renderBadges() {
  const counts = { cart: store.cart.reduce((s, l) => s + l.qty, 0), wish: store.wish.length };
  for (const b of $$('[data-count]')) {
    const n = counts[b.dataset.count];
    b.textContent = String(n);
    b.hidden = n === 0;
  }
  const cartBtn = $('[data-open="cart"]');
  cartBtn.setAttribute('aria-label', counts.cart ? `Open enquiry cart, ${counts.cart} items` : 'Open enquiry cart');
  const wishBtn = $('[data-open="wishlist"]');
  wishBtn.setAttribute('aria-label', counts.wish ? `Open wishlist, ${counts.wish} saved` : 'Open wishlist');
}

export function setupDrawers() {
  store.subscribe(() => {
    renderCart();
    renderWish();
    renderBadges();
  });
  const map = { cart: '#cart-dialog', wishlist: '#wishlist-dialog', menu: '#menu-dialog' };
  for (const btn of $$('[data-open]')) {
    btn.addEventListener('click', () => openDialog($(map[btn.dataset.open])));
  }
  $('#cart-send').addEventListener('click', () => openEnquiry({ lines: store.cart, fromCart: true }));
  $('#cart-checkout').addEventListener('click', () => openCheckout({ lines: store.cart, fromCart: true }));
  // Links inside drawers close the drawer before scrolling.
  for (const sel of ['#cart-dialog', '#wishlist-dialog', '#menu-dialog']) {
    $(sel).addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').startsWith('#/')) return;
      e.preventDefault();
      closeDialog($(sel));
      setTimeout(() => scrollToHash(a.getAttribute('href')), 260);
    });
  }
}
