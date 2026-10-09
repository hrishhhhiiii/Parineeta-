import { STORY, PALETTES, CATEGORIES, productHref, variantsOf, parentOf } from '../data/products.js';
import { fromPrice, stockText } from '../data/pricing.js';
import { builderProducts, defaultLine } from '../data/builder.js';
import { choiceFields, firstPick, paintStock } from './productPanel.js';
import { REVIEWS as FILM_REVIEWS, waLink, photoSrc, reelStill } from '../data/site.js';
import { reviewsFor, ratingSummary, myReviews, saveMyReview, loadReviews, SOURCE_LABELS } from '../data/reviews.js';
import { h, icon, inr, reduceMotion } from './dom.js';
import { store, lineInfo, MAX } from './store.js';
import { openEnquiry } from './enquiry.js';
import { openCheckout } from './checkout.js';
import { openLightbox, describeMedia } from './lightbox.js';
import { thumbImg } from './drawers.js';
import { videoTile, realPhoto, wholePhoto } from './sections.js';
import { toast } from './toast.js';
import { mediaStage } from './mediaStage.js';
import { productSchema, breadcrumbSchema } from '../data/seo.js';
import { requireSignIn } from './signInGate.js';

const canvas = h('canvas', { class: 'ppage__canvas', role: 'img', 'aria-label': 'Interactive 3D view. Drag to rotate, scroll or pinch to zoom.' });
let viewer = null;
let viewerLoading = null;
const cur = { p: null, style: null, pick: {}, qty: 1 };
const refs = {};

// The prebuilt /p/<id>/ page, so shared links open the product with its own title and preview.
const pageUrl = (id) => `${location.origin}/p/${id}/`;
export { productHref };

function ensureViewer() {
  viewerLoading ||= import('../three/viewer.js').then(({ createViewer }) => {
    viewer = createViewer(canvas);
    return viewer;
  });
  return viewerLoading;
}

export function stopProductPage() {
  viewer?.stop();
  document.querySelector('.ppage__video')?.pause();
}

/* ---------------- small parts ---------------- */
export function stars(value, label = true) {
  const wrap = h('span', { class: 'stars', ...(label ? { role: 'img', 'aria-label': `${value.toFixed(1)} out of 5 stars` } : { 'aria-hidden': 'true' }) });
  for (let i = 1; i <= 5; i++) {
    const fill = Math.max(0, Math.min(1, value - (i - 1)));
    wrap.append(h('span', { class: 'stars__one' }, icon('star'), h('span', { class: 'stars__fill', style: `width:${fill * 100}%` }, icon('star', 'fill'))));
  }
  return wrap;
}

const fmtDate = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

function radio(name, value, checked, label, extra) {
  const id = `${name}-${value}`;
  return h('label', { class: 'opt', for: id },
    h('input', { type: 'radio', name, value, id, checked: checked || null }),
    extra || null,
    h('span', { class: 'opt__label', text: label }));
}

/* ---------------- configurator ---------------- */
function line() {
  return { id: cur.p.id, style: cur.style, pick: { ...cur.pick }, custom: refs.custom ? refs.custom.value.trim() : '', qty: cur.qty };
}

function paintTotal() {
  const { total, unit, stock } = lineInfo(line());
  paintStock(refs.stock, cur.p, stock);
  // A sold-out combination can't be added or booked; asking on WhatsApp still works.
  const out = stock.status === 'out';
  refs.add.disabled = out;
  refs.add.lastChild.textContent = out ? 'Sold out' : 'Add to cart';
  refs.book.disabled = out;
  refs.ask.lastChild.textContent = out ? 'Ask on WhatsApp' : 'Enquire';
  refs.total.replaceChildren(h('span', { class: 'price__from', text: cur.qty > 1 ? `${cur.qty} × ${inr(unit)} =` : 'from' }), ' ', inr(total));
  refs.qty.textContent = String(cur.qty);
  refs.minus.disabled = cur.qty <= 1;
  refs.plus.disabled = cur.qty >= MAX;
}

function paintWish() {
  const on = store.hasWish(cur.p.id);
  refs.wish.setAttribute('aria-pressed', String(on));
  refs.wish.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Save to wishlist');
  refs.wish.replaceChildren(icon('heart', on ? 'fill' : 'light'));
}

function configurator(p) {
  const styles = h('div', { class: 'swatches swatches--lg' }, ...p.styles.map((s) => {
    const pal = PALETTES[s];
    return radio('pg-style', s, s === cur.style, pal.label, h('span', { class: 'swatch', style: `--a:${pal.base};--b:${pal.accent};--c:${pal.detail}`, 'aria-hidden': 'true' }));
  }));
  styles.addEventListener('change', (e) => {
    cur.style = e.target.value;
    // Colourways are previewed on the 3D model; the photos show the piece as made.
    refs.show3d?.();
    viewer?.show(p, cur.style);
    paintTotal();
  });
  const choices = choiceFields(p, cur.pick, (g, o) => {
    cur.pick[g] = o;
    const photo = variantsOf(p).find((x) => x.id === g)?.options.find((x) => x.id === o)?.photo;
    if (photo) refs.showPhoto?.(photo);
    paintTotal();
  }, 'pg');
  refs.stock = h('p', { class: 'field__help pp__stock' });
  refs.add = h('button', { type: 'submit', class: 'btn btn--gold btn--wide' }, icon('shopping-bag-open'), 'Add to cart');
  refs.book = h('button', { type: 'button', class: 'btn btn--ghost btn--wide', onclick: () => openCheckout({ lines: [line()] }) }, icon('paper-plane-tilt'), 'Buy now');
  refs.ask = h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => openEnquiry({ lines: [line()] }) }, icon('chat-circle-text'), 'Enquire');
  refs.custom = p.customizable ? h('input', { class: 'input', id: 'pg-custom', type: 'text', maxlength: 80, autocomplete: 'off' }) : null;
  refs.qty = h('output', { class: 'qty__val', 'aria-live': 'polite', text: '1' });
  refs.minus = h('button', { type: 'button', class: 'qty__btn', 'aria-label': 'Decrease quantity', onclick: () => { cur.qty = Math.max(1, cur.qty - 1); paintTotal(); } }, icon('minus'));
  refs.plus = h('button', { type: 'button', class: 'qty__btn', 'aria-label': 'Increase quantity', onclick: () => { cur.qty = Math.min(MAX, cur.qty + 1); paintTotal(); } }, icon('plus'));
  refs.total = h('p', { class: 'price price--lg' });
  refs.wish = h('button', { type: 'button', class: 'icon-btn icon-btn--ring icon-btn--lg', onclick: () => {
    if (!requireSignIn('save pieces to your wishlist')) return;
    const added = store.toggleWish(p.id);
    paintWish();
    toast(added ? `${p.en} saved to your wishlist.` : `${p.en} removed from your wishlist.`, { iconName: 'heart' });
  } });
  const share = h('button', { type: 'button', class: 'icon-btn icon-btn--ring icon-btn--lg', 'aria-label': 'Share this piece', onclick: async () => {
    const url = pageUrl(p.id);
    try {
      if (navigator.share) await navigator.share({ title: `${p.en} | Parineeta`, text: p.line, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied. Paste it anywhere to share.', { iconName: 'link-simple' });
      }
    } catch {
      /* share sheet dismissed */
    }
  } }, icon('share-network'));

  const form = h('form', { class: 'pp__form', onsubmit: (e) => {
    e.preventDefault();
    if (!requireSignIn('add pieces to your cart')) return;
    store.add(line());
    toast(`${p.en} added to your enquiry cart.`, { action: 'View cart', onAction: () => document.querySelector('[data-open="cart"]').click() });
  } },
  h('fieldset', { class: 'field' }, h('legend', { class: 'field__label', text: 'Colourway' }), styles),
  ...choices,
  refs.custom ? h('div', { class: 'field' },
    h('label', { class: 'field__label', for: 'pg-custom' }, 'Personalise it ', h('span', { class: 'field__opt', text: '(optional)' })),
    refs.custom,
    h('p', { class: 'field__help', text: p.customHelp || 'Names, a date, or a line you want painted on it.' })) : null,
  h('div', { class: 'pp__buy' },
    h('div', { class: 'qty', 'aria-label': 'Quantity' }, refs.minus, refs.qty, refs.plus),
    h('div', { class: 'pp__total' }, refs.total, refs.stock)),
  h('div', { class: 'builder__buy' }, refs.add, refs.book),
  h('div', { class: 'builder__more' }, refs.ask, refs.wish, share),
  h('p', { class: 'fineprint', text: 'Pay a booking advance or the full estimate by UPI or bank transfer, or pay when you collect. We confirm the final price with you on WhatsApp.' }));
  return form;
}

/* ---------------- reviews ---------------- */
function reviewCard(r, pending = false) {
  const style = r.style && PALETTES[r.style] ? PALETTES[r.style].label : '';
  return h('article', { class: `review${pending ? ' review--pending' : ''}` },
    h('header', { class: 'review__head' },
      r.rating ? stars(r.rating) : null,
      r.title ? h('h3', { class: 'review__title', text: r.title }) : null),
    h('p', { class: 'review__text', text: r.text }),
    h('footer', { class: 'review__meta' },
      h('span', { class: 'review__name', text: [r.name, r.place].filter(Boolean).join(', ') }),
      r.date ? h('span', { text: fmtDate(r.date) }) : null,
      style ? h('span', { text: `Colourway: ${style}` }) : null,
      r.verified ? h('span', { class: 'review__verified' }, icon('seal-check'), 'Confirmed order') : null,
      SOURCE_LABELS[r.source] ? (r.sourceUrl
        ? h('a', { class: 'review__source', href: r.sourceUrl, target: '_blank', rel: 'noopener', text: `From ${SOURCE_LABELS[r.source]} ↗` })
        : h('span', { class: 'review__source', text: `From ${SOURCE_LABELS[r.source]}` })) : null,
      pending ? h('span', { class: 'review__pending', text: 'Awaiting approval, only visible to you' }) : null));
}

// Saves a review in /admin → Customer reviews, hidden until the shop shows it
// (database/migrations/011_reviews.sql). Resolves to true when it was saved.
async function submitReview(p, v) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/submit_review`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p: { product: p.id, rating: v.rating, name: v.name, place: v.place, style: v.style, phone: v.phone, title: v.title, text: v.text } }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function reviewForm(p, onDone) {
  const ratingBox = h('div', { class: 'rate', role: 'radiogroup', 'aria-labelledby': 'rv-rating-label' });
  for (let v = 5; v >= 1; v--) {
    const id = `rv-star-${v}`;
    ratingBox.append(h('input', { type: 'radio', name: 'rating', value: v, id, class: 'rate__input' }),
      h('label', { for: id, class: 'rate__star', title: `${v} star${v > 1 ? 's' : ''}` }, icon('star', 'fill'), h('span', { class: 'sr-only', text: `${v} star${v > 1 ? 's' : ''}` })));
  }
  const err = (id) => h('p', { class: 'field__error', id: `${id}-err` });
  const status = h('p', { class: 'enq__status', role: 'status', 'aria-live': 'polite' });
  const form = h('form', { class: 'review-form', novalidate: true },
    h('div', { class: 'field' }, h('p', { class: 'field__label', id: 'rv-rating-label', text: 'Your rating' }), ratingBox, err('rv-rating')),
    h('div', { class: 'enq__row' },
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rv-name', text: 'Your name' }), h('input', { class: 'input', id: 'rv-name', name: 'name', maxlength: 60, autocomplete: 'name', required: true }), err('rv-name')),
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rv-place' }, 'Town ', h('span', { class: 'field__opt', text: '(optional)' })), h('input', { class: 'input', id: 'rv-place', name: 'place', maxlength: 60, autocomplete: 'address-level2' }))),
    h('div', { class: 'enq__row' },
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rv-style' }, 'Colourway you bought ', h('span', { class: 'field__opt', text: '(optional)' })),
        h('select', { class: 'input', id: 'rv-style', name: 'style' }, h('option', { value: '', text: 'Not sure' }), ...p.styles.map((s) => h('option', { value: s, text: PALETTES[s].label })))),
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rv-phone' }, 'Phone ', h('span', { class: 'field__opt', text: '(optional, never shown)' })), h('input', { class: 'input', id: 'rv-phone', name: 'phone', type: 'tel', inputmode: 'tel', maxlength: 20, autocomplete: 'tel' }))),
    h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rv-title' }, 'Headline ', h('span', { class: 'field__opt', text: '(optional)' })), h('input', { class: 'input', id: 'rv-title', name: 'title', maxlength: 80, autocomplete: 'off' })),
    h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'rv-text', text: 'Your review' }), h('textarea', { class: 'input input--area', id: 'rv-text', name: 'text', rows: 4, maxlength: 1000, required: true, autocomplete: 'off' }), err('rv-text')),
    status,
    h('div', { class: 'enq__actions' },
      h('button', { type: 'button', class: 'btn btn--gold', 'data-send': 'save' }, icon('pencil-simple-line'), 'Submit review'),
      h('button', { type: 'button', class: 'btn btn--ghost', 'data-send': 'wa' }, icon('whatsapp-logo', 'fill'), 'Send on WhatsApp instead')),
    h('p', { class: 'fineprint', text: 'The shop reads every review and adds it to the website after checking the order. Your phone number is only used for that and is never shown.' }));

  const setErr = (id, msg) => {
    const out = form.querySelector(`#${id}-err`);
    const input = form.querySelector(`#${id}`);
    out.textContent = msg;
    if (input) {
      if (msg) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', `${id}-err`);
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    }
  };

  function collect() {
    const f = form.elements;
    const v = {
      rating: Number(form.querySelector('input[name="rating"]:checked')?.value || 0),
      name: f.name.value.trim(),
      place: f.place.value.trim(),
      style: f.style.value,
      phone: f.phone.value.trim(),
      title: f.title.value.trim(),
      text: f.text.value.trim(),
    };
    let ok = true;
    setErr('rv-rating', v.rating ? '' : 'Please choose a star rating.');
    setErr('rv-name', v.name.length >= 2 ? '' : 'Please tell us your name.');
    setErr('rv-text', v.text.length >= 20 ? '' : 'Please write at least a sentence or two (20 characters).');
    if (!v.rating || v.name.length < 2 || v.text.length < 20) ok = false;
    return ok ? v : null;
  }

  const message = (v) => [
    'Namaskar Parineeta! I would like to leave a review.',
    '',
    `Piece: ${p.en} (${p.bn})`,
    `Rating: ${v.rating} out of 5`,
    v.title && `Headline: ${v.title}`,
    `Review: ${v.text}`,
    '',
    `Name: ${v.name}`,
    v.place && `Town: ${v.place}`,
    v.style && `Colourway: ${PALETTES[v.style].label}`,
    v.phone && `Phone: ${v.phone}`,
  ].filter((x) => x !== '' && x != null && x !== false).join('\n').replace('\nPiece', '\n\nPiece');

  function finish(v) {
    saveMyReview({ product: p.id, rating: v.rating, name: v.name, place: v.place, style: v.style, title: v.title, text: v.text, date: new Date().toISOString().slice(0, 10) });
    form.reset();
    onDone();
  }

  form.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-send]');
    if (!btn) return;
    const v = collect();
    if (!v) {
      status.className = 'enq__status is-error';
      status.textContent = 'Please check the highlighted fields.';
      (form.querySelector('#rv-rating-err:not(:empty)') ? form.querySelector('input[name="rating"]') : form.querySelector('[aria-invalid="true"]'))?.focus();
      return;
    }
    status.textContent = '';
    if (btn.dataset.send === 'save') {
      btn.disabled = true;
      status.className = 'enq__status is-busy';
      status.textContent = 'Sending your review…';
      const ok = await submitReview(p, v);
      btn.disabled = false;
      if (ok) {
        status.textContent = '';
        finish(v);
        toast('Thank you! The shop will check your review and add it to the website.', { iconName: 'check-circle' });
      } else {
        status.className = 'enq__status is-error';
        status.textContent = 'We could not send that just now. Please press “Send on WhatsApp instead”.';
      }
      return;
    }
    if (btn.dataset.send === 'wa') {
      const url = waLink(message(v));
      // 'noopener' would make window.open return null, and this tab would follow to WhatsApp too.
      const win = window.open(url, '_blank');
      if (win) win.opener = null;
      else window.location.href = url;
      finish(v);
      toast('Thank you. WhatsApp is open with your review; press send and we will publish it after checking.', { iconName: 'whatsapp-logo' });
    }
  });
  return form;
}

function reviewsSection(p) {
  let written = reviewsFor(p.id);
  const section = h('section', { class: 'ppage__section ppage__reviews', id: 'pg-reviews', 'aria-labelledby': 'pg-reviews-title' });
  const list = h('div', { class: 'reviews-list' });
  const formWrap = h('div', { class: 'review-form-wrap', hidden: true });
  const writeBtn = h('button', { type: 'button', class: 'btn btn--gold', 'aria-expanded': 'false' }, icon('pencil-simple-line'), 'Write a review');
  const summaryBox = h('div', { class: 'reviews-summary' });

  function paintList() {
    const mine = myReviews(p.id);
    list.replaceChildren();
    mine.forEach((r) => list.append(reviewCard(r, true)));
    written.forEach((r) => list.append(reviewCard(r)));
    if (!mine.length && !written.length) {
      list.append(h('div', { class: 'reviews-empty' },
        h('p', { class: 'reviews-empty__title', text: 'No written reviews yet' }),
        h('p', { text: `Bought a ${p.en} from us? Tell other families how it went, and help them choose.` })));
    }
  }

  const toggleForm = (open) => {
    formWrap.hidden = !open;
    writeBtn.setAttribute('aria-expanded', String(open));
    if (open) formWrap.querySelector('input[name="rating"]')?.focus();
  };
  writeBtn.addEventListener('click', () => toggleForm(formWrap.hidden));
  formWrap.append(reviewForm(p, () => {
    toggleForm(false);
    paintList();
  }));

  function paintSummary() {
    const { total, avg, counts } = ratingSummary(written);
    const dist = h('div', { class: 'dist', 'aria-label': 'Rating breakdown' },
      ...[5, 4, 3, 2, 1].map((n) => {
        const c = counts[n - 1];
        return h('div', { class: 'dist__row' },
          h('span', { class: 'dist__label', text: `${n}` }), icon('star', 'fill'),
          h('span', { class: 'dist__bar' }, h('span', { class: 'dist__fill', style: `width:${total ? (c / total) * 100 : 0}%` })),
          h('span', { class: 'dist__count', text: String(c) }));
      }));
    summaryBox.replaceChildren(
      h('p', { class: `reviews-summary__avg${total ? '' : ' reviews-summary__avg--none'}`, text: total ? avg.toFixed(1) : 'No reviews yet' }),
      stars(total ? avg : 0),
      h('p', { class: 'reviews-summary__count', text: total ? `${total} written review${total > 1 ? 's' : ''}` : 'Be the first to review this piece' }),
      ...(total ? [dist] : []), // the DOM prints a bare null as text
      writeBtn);
    return { total, avg };
  }
  const first = paintSummary();

  const productFilms = FILM_REVIEWS.filter((f) => f.product === p.id);
  const shopFilms = FILM_REVIEWS.filter((f) => f.product !== p.id);
  const films = h('div', { class: 'review-films' },
    h('h3', { class: 'h3', text: productFilms.length ? 'Customers on film' : 'Customers at our shop, on film' }),
    h('div', { class: 'review-films__row' }, ...[...productFilms, ...shopFilms].map((f) => videoTile(f, 'video--review'))));

  paintList();
  section.append(
    h('h2', { class: 'h2', id: 'pg-reviews-title', text: 'Reviews' }),
    h('div', { class: 'ppage__reviews-grid' }, summaryBox, h('div', {}, formWrap, list)),
    films);
  const api = { section, openForm: () => toggleForm(true), total: first.total, avg: first.avg };
  // The reviews the shop chose to show arrive from the database a moment later.
  api.refresh = () => {
    written = reviewsFor(p.id);
    paintList();
    Object.assign(api, paintSummary());
    return api;
  };
  return api;
}

/* ---------------- page ---------------- */
/** A small product card for the sideways rows (product page and homepage rows). */
export function miniCard(x) {
  return h('a', { class: 'mini-card', href: productHref(x.id) },
    h('span', { class: 'mini-card__media' }, thumbImg(x, x.styles[0], 'mini-card__img'), realPhoto(x)),
    h('span', { class: 'mini-card__bn bn', lang: 'bn', translate: 'no', text: x.bn }),
    h('span', { class: 'mini-card__title', text: x.en }),
    h('span', { class: 'mini-card__price', text: `from ${inr(fromPrice(x))}` }));
}

function ritualSection(p) {
  const chapter = STORY.find((c) => c.product === p.id);
  if (!chapter) return null;
  return h('section', { class: 'ppage__section ppage__ritual', 'aria-labelledby': 'pg-ritual-title' },
    h('p', { class: 'chapter__moment', text: chapter.moment }),
    h('h2', { class: 'h2', id: 'pg-ritual-title', text: chapter.title }),
    h('p', { class: 'lede', text: chapter.body }),
    chapter.photo ? h('button', { type: 'button', class: 'real-thumb', onclick: () => openLightbox([chapter.photo], 0) },
      h('span', { class: 'real-thumb__img' }, h('img', { src: describeMedia(chapter.photo).thumb, alt: '', loading: 'lazy', width: 360, height: 480 }),
        chapter.photo.type === 'reel' ? h('span', { class: 'real-thumb__play' }, icon('play', 'fill')) : null),
      h('span', { class: 'real-thumb__label', text: chapter.photo.type === 'reel' ? 'Watch the real one' : 'See it in a real wedding' })) : null);
}

function detailsSection(p) {
  const cat = CATEGORIES.find((c) => c.id === p.category)?.label || '';
  const items = [
    ['clock', 'Made to order', `Ready in about ${p.leadDays} days from confirmation.`],
    ['paint-brush', 'Painted by hand', 'Every piece is painted in our studio in Patuli, so no two are identical.'],
    ['palette', `${p.styles.length} colourway${p.styles.length === 1 ? '' : 's'}`, p.styles.map((s) => PALETTES[s].label).join(', ')],
    ['text-aa', p.customizable ? 'Personalised for you' : 'Classic design', p.customizable ? 'Add names, a date or a portrait, painted by hand.' : 'Painted in our signature design for this piece.'],
  ];
  return h('section', { class: 'ppage__section', 'aria-labelledby': 'pg-details-title' },
    h('h2', { class: 'h2', id: 'pg-details-title', text: 'The details' }),
    cat ? h('p', { class: 'field__help', text: `Category: ${cat}` }) : null,
    h('ul', { class: 'details-grid' }, ...items.map(([ic, title, body]) =>
      h('li', { class: 'details-grid__item' }, icon(ic), h('strong', { text: title }), h('span', { text: body })))));
}

function ldScript(id, data) {
  document.getElementById(id)?.remove();
  const s = document.createElement('script');
  s.type = 'application/ld+json';
  s.id = id;
  s.textContent = JSON.stringify(data);
  document.head.append(s);
}

/** The same Product and breadcrumb data the build writes into /p/<id>/ (data/seo.js), plus the star rating. */
function setJsonLd(p, summary) {
  const photos = p.media.filter((m) => m.type === 'photo').slice(0, 4).map((m) => photoSrc(m.id, 1600));
  const data = productSchema(p, { origin: location.origin, images: photos });
  if (summary.total) data.aggregateRating = { '@type': 'AggregateRating', ratingValue: summary.avg.toFixed(1), reviewCount: summary.total };
  ldScript('pg-jsonld', data);
  ldScript('pg-crumbs-ld', breadcrumbSchema(location.origin, { category: p.category, product: p }));
}

export function clearProductPage(root) {
  document.getElementById('pg-jsonld')?.remove();
  document.getElementById('pg-crumbs-ld')?.remove();
  root.replaceChildren();
}

/* ---------------- the product builder ----------------
   Products of the same category as cards on the left; the selected one in a sticky panel on the right
   (3D first, then its choices and Add to cart / Buy now). Picking another card switches the panel in
   place: the 3D canvas is reused, and the address changes to that product's own /p/<id>/ page. */
const build = { root: null, grid: null, head: null, panel: null, below: null, crumbs: null, status: null, ids: new Set(), gallery: null };
const narrow = () => window.matchMedia('(max-width: 899px)').matches;
const catLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || '';
const toPanel = () => build.panel.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });

function builderCard(x) {
  const line = () => defaultLine(x, firstPick);
  const { stock } = lineInfo(line());
  const out = stock.status === 'out';
  // The shop's photo (else a film's still frame), whole and uncropped; without either, the 3D render.
  const photo = x.media?.find((m) => m.type === 'photo');
  const reel = x.media?.find((m) => m.type === 'reel');
  const picture = photo ? wholePhoto(realPhoto(x, 'bcard__img'), photoSrc(photo.id, 400))
    : reel ? wholePhoto(h('img', { class: 'bcard__img', src: reelStill(reel.id), alt: '', loading: 'lazy', width: 720, height: 1280 }), reelStill(reel.id))
    : thumbImg(x, x.styles[0], 'bcard__img bcard__img--render');
  // A real link (its own /p/<id>/ page): the router switches the panel in place on a plain click.
  const select = h('a', { class: 'bcard__select', href: productHref(x.id), onclick: (e) => {
    if (cur.p?.id !== x.id) return;
    // Already in the panel; on a phone, take them up to it.
    e.preventDefault();
    if (narrow()) toPanel();
  } },
  h('span', { class: 'bcard__media' }, picture, h('span', { class: 'bcard__tag', text: 'Selected' })),
  h('span', { class: 'bcard__text' },
    h('span', { class: 'bcard__bn bn', lang: 'bn', translate: 'no', text: x.bn }),
    h('span', { class: 'bcard__name', text: x.en }),
    x.line ? h('span', { class: 'bcard__line', text: x.line }) : null,
    h('span', { class: 'bcard__meta' },
      h('span', { class: 'bcard__price' }, h('span', { class: 'price__from', text: 'from ' }), inr(fromPrice(x))),
      h('span', { class: `bcard__stock${out ? ' is-out' : ''}`, text: stockText(x, stock) }))));
  const actions = out
    ? [h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => openEnquiry({ lines: [line()] }) }, icon('chat-circle-text'), 'Ask on WhatsApp')]
    : [
      h('button', { type: 'button', class: 'btn btn--gold btn--sm', 'aria-label': `Add ${x.en} to cart`, onclick: () => {
        if (!requireSignIn('add pieces to your cart')) return;
        store.add(line());
        toast(`${x.en} added to your enquiry cart.`, { action: 'View cart', onAction: () => document.querySelector('[data-open="cart"]').click() });
      } }, icon('shopping-bag-open'), 'Add to cart'),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', 'aria-label': `Buy ${x.en} now`, onclick: () => openCheckout({ lines: [line()] }) }, 'Buy now'),
    ];
  return h('li', { class: 'bcard', 'data-id': x.id }, select, h('div', { class: 'bcard__actions' }, ...actions));
}

function paintGrid(p) {
  const { items, family, title } = builderProducts(p);
  build.ids = new Set(items.map((x) => x.id));
  const cards = items.map(builderCard);
  const more = items.length > family
    ? [h('li', { class: 'bgrid__divider', role: 'presentation' }, h('span', { text: 'More from the collection' })), ...cards.slice(family)]
    : [];
  build.grid.replaceChildren(...cards.slice(0, family), ...more);
  const parent = parentOf(p.category);
  build.head.replaceChildren(
    h('h2', { class: 'builder__title', id: 'builder-title', text: title || 'The collection' }),
    h('p', { class: 'builder__count', text: `${family} piece${family === 1 ? '' : 's'}${parent ? ` in ${catLabel(parent)}` : ''}. Tap one to see it in 3D.` }));
}

function markSelected(p) {
  for (const li of build.grid.querySelectorAll('.bcard')) {
    const on = li.dataset.id === p.id;
    li.classList.toggle('is-active', on);
    const a = li.querySelector('.bcard__select');
    if (on) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  }
}

function paintCrumbs(p) {
  const cat = catLabel(p.category);
  build.crumbs.replaceChildren(
    h('a', { href: '#top', text: 'Home' }), icon('caret-right'),
    h('a', { href: '#collection', text: 'Collection' }), icon('caret-right'),
    ...(cat ? [h('span', { text: cat }), icon('caret-right')] : []),
    h('span', { 'aria-current': 'page', text: p.en }));
}

function storySection(p) {
  if (!p.story) return null;
  return h('section', { class: 'ppage__section ppage__about', 'aria-labelledby': 'pg-about-title' },
    h('h2', { class: 'h2', id: 'pg-about-title', text: `About the ${p.en}` }),
    h('p', { class: 'lede', text: p.story }));
}

/** Shows product p in the panel and in the sections below the builder. */
function activate(p, initial = false) {
  build.gallery?.stop();
  cur.p = p;
  cur.style = p.styles[0];
  cur.pick = firstPick(p);
  cur.qty = 1;
  const reviews = reviewsSection(p);

  const ratingLine = h('p', { class: 'ppage__rating' });
  const paintRating = () => ratingLine.replaceChildren(
    stars(reviews.total ? reviews.avg : 0),
    h('button', { type: 'button', class: 'ppage__rating-link', onclick: () => {
      reviews.section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (!reviews.total) setTimeout(reviews.openForm, 500);
    }, text: reviews.total ? `${reviews.avg.toFixed(1)} from ${reviews.total} review${reviews.total > 1 ? 's' : ''}` : 'No reviews yet. Write the first one.' }));
  paintRating();
  loadReviews().then(() => {
    if (cur.p !== p) return;
    reviews.refresh();
    paintRating();
    setJsonLd(p, reviews); // Google's star rating for the product
  });

  const stage = h('div', { class: 'ppage__viewer builder__stage' });
  build.gallery = mediaStage(p, { stage, canvas, ensureViewer, viewer: () => viewer, style: () => cur.style, isCurrent: () => cur.p === p, start3d: true });
  refs.show3d = build.gallery.show3d;
  refs.showPhoto = build.gallery.showPhoto;

  build.panel.replaceChildren(...[
    stage,
    build.gallery.thumbs,
    h('div', { class: 'builder__info' },
      h('p', { class: 'pp__bn bn', lang: 'bn', translate: 'no', text: p.bn }),
      h('h1', { class: 'ppage__title', id: 'pg-en', tabindex: '-1', text: p.en }),
      ratingLine,
      p.line ? h('p', { class: 'ppage__line', text: p.line }) : null,
      configurator(p)),
    build.status,
  ].filter(Boolean));
  build.below.replaceChildren(...[storySection(p), ritualSection(p), detailsSection(p), reviews.section].filter(Boolean));
  build.status.textContent = initial ? '' : `Showing ${p.en}`;
  paintCrumbs(p);
  markSelected(p);
  paintTotal();
  paintWish();
  setJsonLd(p, reviews);

  if (!initial) {
    // A short fade marks the switch (none for people who turn animations off).
    if (!reduceMotion()) {
      build.panel.classList.remove('is-switching');
      void build.panel.offsetWidth;
      build.panel.classList.add('is-switching');
    }
    // On a phone the panel sits above the grid: bring it into view.
    if (narrow()) toPanel();
  }
}

export function renderProductPage(root, p) {
  build.root = root;
  build.crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' });
  build.head = h('div', { class: 'builder__head' });
  build.grid = h('ul', { class: 'bgrid', 'aria-labelledby': 'builder-title' });
  // data-lenis-prevent: the page's smooth scrolling leaves the panel's own scrolling alone.
  build.panel = h('aside', { class: 'builder__panel', 'aria-label': 'The selected piece', 'data-lenis-prevent': '' });
  build.below = h('div', { class: 'builder__below' });
  build.status = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  build.panel.addEventListener('animationend', () => build.panel.classList.remove('is-switching'));
  // Arrow keys move between the cards.
  build.grid.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key) || !e.target.matches('.bcard__select')) return;
    const links = [...build.grid.querySelectorAll('.bcard__select')];
    const i = links.indexOf(e.target);
    const cols = Math.max(1, Math.round(build.grid.clientWidth / (e.target.closest('.bcard').offsetWidth || 1)));
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    const next = links[Math.min(links.length - 1, Math.max(0, i + step))];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  });

  root.replaceChildren(
    h('div', { class: 'container' },
      build.crumbs,
      h('div', { class: 'builder' },
        h('section', { class: 'builder__main', 'aria-labelledby': 'builder-title' }, build.head, build.grid),
        build.panel),
      build.below));
  paintGrid(p);
  activate(p, true);
}

/** Switches the builder to product p without rebuilding the page. False when p isn't in the grid
 *  (for example opened from search), so the router renders the page afresh. */
export function switchProduct(p) {
  if (!build.root?.isConnected || build.root.hidden || !build.ids.has(p.id)) return false;
  activate(p);
  return true;
}

export function refreshWish() {
  if (cur.p && refs.wish?.isConnected) paintWish();
}
