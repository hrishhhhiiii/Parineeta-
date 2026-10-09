import { PRODUCTS, SETS, STORY, CATEGORIES, byId, productHref, parentOf, topCategories } from '../data/products.js';
import { REELS, REVIEWS, SERVICES, TRUST, LOOKBOOK, FILMS, ytThumb, ytEmbed, photoSrc, photoSrcset, reelPreview, reelPosterSmall, reelStill } from '../data/site.js';
import { openLightbox, describeMedia } from './lightbox.js';
import { h, icon, inr, $ } from './dom.js';
import { store } from './store.js';
import { fromPrice } from '../data/pricing.js';
import { openEnquiry } from './enquiry.js';
import { thumbImg } from './drawers.js';
import { toast } from './toast.js';
import { loadReviews, latestReviews, SOURCE_LABELS } from '../data/reviews.js';
import { requireSignIn } from './signInGate.js';

export function renderMarquee() {
  const words = ['গাছকৌটো', 'Gach Kouto', 'টোপর', 'Topor', 'শোলার মুকুট', 'Shola Mukut', 'পানপাতা', 'Paan Pata', 'আলপনা', 'Alpana', 'বিয়ের পিঁড়ি', 'Biyer Piri', 'কুনকে', 'Kunke'];
  const track = $('#marquee');
  const group = () => h('div', { class: 'marquee__group' }, ...words.flatMap((w, i) => [
    h('span', { class: i % 2 === 0 ? 'marquee__bn bn' : 'marquee__en', lang: i % 2 === 0 ? 'bn' : 'en', text: w }),
    i % 2 === 1 ? icon('flower-lotus') : null,
  ]));
  track.append(group(), group());
}

export function renderStory() {
  const ol = $('#story-chapters');
  STORY.forEach((c, i) => {
    const p = byId(c.product);
    ol.append(h('li', { class: 'chapter', dataset: { index: i } },
      h('div', { class: 'chapter__card' },
        h('p', { class: 'chapter__moment', text: c.moment }),
        h('h3', { class: 'chapter__title', text: c.title }),
        h('p', { class: 'chapter__body', text: c.body }),
        h('p', { class: 'chapter__object' },
          h('span', { class: 'bn', lang: 'bn', translate: 'no', text: p.bn }),
          h('span', { text: p.en })),
        h('div', { class: 'chapter__foot' },
          c.photo ? realThumb(c.photo, c.photo.type === 'reel' ? 'Watch the real one' : 'See it in a real wedding') : null,
          h('a', { class: 'link-btn', href: productHref(p.id) }, `See the ${p.en}`, icon('arrow-up-right'))))));
  });
}

function realThumb(ref, label) {
  const m = describeMedia(ref);
  return h('button', { type: 'button', class: 'real-thumb', onclick: () => openLightbox([ref], 0) },
    h('span', { class: 'real-thumb__img' },
      h('img', { src: m.thumb, alt: '', loading: 'lazy', width: 360, height: 480 }),
      ref.type === 'reel' ? h('span', { class: 'real-thumb__play' }, icon('play', 'fill')) : null),
    h('span', { class: 'real-thumb__label', text: label }));
}

export function renderTrust() {
  const box = $('#trust-collage');
  const refs = TRUST.map((t) => ({ type: 'photo', id: t.id, title: t.guest ? `${t.guest}, ${t.caption.charAt(0).toLowerCase()}${t.caption.slice(1)}` : t.caption }));
  TRUST.forEach((t, i) => {
    box.append(h('figure', { class: `trust__shot trust__shot--${i}` },
      h('button', { type: 'button', class: 'trust__btn', 'aria-label': `View photo: ${refs[i].title}`, onclick: () => openLightbox(refs, i, { enquire: false }) },
        h('img', { src: photoSrc(t.id, 800), srcset: photoSrcset(t.id), sizes: ['(max-width: 900px) 100vw, 21vw', '(max-width: 900px) 100vw, 31vw', '(max-width: 900px) 50vw, 15vw', '(max-width: 900px) 50vw, 15vw'][i], alt: refs[i].title, loading: 'lazy', width: 800, height: 800 })),
      h('figcaption', { text: t.guest || refs[i].title })));
  });
}

export function renderLookbook() {
  const grid = $('#lookbook-grid');
  const refs = LOOKBOOK.map((l) => ({ type: 'photo', id: l.id }));
  LOOKBOOK.forEach((l, i) => {
    grid.append(h('figure', { class: 'look-item' },
      h('button', { type: 'button', class: 'look-item__btn', 'aria-label': `View larger: ${l.title}`, onclick: () => openLightbox(refs, i) },
        h('img', { src: photoSrc(l.id, 800), srcset: photoSrcset(l.id), sizes: '(max-width: 640px) 50vw, (max-width: 1100px) 45vw, 30vw', alt: l.title, loading: 'lazy', width: l.w, height: l.h })),
      h('figcaption', { text: l.title })));
  });
}

export function renderChips(onChange) {
  const box = $('#chips');
  // Chips are the main categories; a main category's chip also covers its sub-categories (in Filters).
  const present = new Set(PRODUCTS.map((p) => parentOf(p.category) || p.category));
  for (const c of [CATEGORIES.find((x) => x.id === 'all'), ...topCategories()]) {
    if (!c || (c.id !== 'all' && !present.has(c.id))) continue;
    box.append(h('button', { type: 'button', class: `chip${c.id === 'all' ? ' is-active' : ''}`, 'aria-pressed': String(c.id === 'all'), dataset: { cat: c.id }, text: c.label }));
  }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    for (const x of box.children) {
      x.classList.toggle('is-active', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    }
    onChange(b.dataset.cat);
  });
}

function wishButton(id, name) {
  const btn = h('button', { type: 'button', class: 'icon-btn icon-btn--ring' });
  const paint = () => {
    const on = store.hasWish(id);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`);
    btn.replaceChildren(icon('heart', on ? 'fill' : 'light'));
  };
  btn.addEventListener('click', () => {
    if (!requireSignIn('save pieces to your wishlist')) return;
    const added = store.toggleWish(id);
    toast(added ? `${name} saved to your wishlist.` : `${name} removed from your wishlist.`, { iconName: 'heart' });
  });
  store.subscribe(paint);
  return btn;
}

/** The shop's real photo of a product, revealed on hover over its 3D render. */
export function realPhoto(p, cls = 'card__real') {
  const ref = p.media?.find((m) => m.type === 'photo');
  if (!ref) return null;
  return h('img', { class: cls, src: photoSrc(ref.id, 400), srcset: `${photoSrc(ref.id, 400)} 400w, ${photoSrc(ref.id, 800)} 800w`, sizes: '300px', alt: '', loading: 'lazy', width: 400, height: 500 });
}

export function filterGrid(filter) {
  for (const group of $('#grid-view').children) {
    const cat = group.dataset.cat;
    group.hidden = filter !== 'all' && cat !== filter && parentOf(cat) !== filter;
  }
}

/** A photo shown whole, as uploaded (never cropped or zoomed), on a blurred copy of itself that fills
 *  the rest of the frame. Returns [backdrop, photo] for a positioned frame. */
export function wholePhoto(img, smallSrc) {
  img.classList.add('photo-whole');
  return [h('img', { class: 'photo-whole__bg', src: smallSrc, alt: '', 'aria-hidden': 'true', loading: 'lazy', decoding: 'async' }), img];
}

/** The shop's own picture of a product: a photo, else a film still, else the 3D render. */
function tileImage(p) {
  const photo = p.media?.find((m) => m.type === 'photo');
  if (photo) return wholePhoto(h('img', { class: 'tile-card__img', src: photoSrc(photo.id, 800), srcset: photoSrcset(photo.id), sizes: '(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 28vw', alt: '', loading: 'lazy', width: 800, height: 1000 }), photoSrc(photo.id, 400));
  const reel = p.media?.find((m) => m.type === 'reel');
  if (reel) return wholePhoto(h('img', { class: 'tile-card__img', src: reelStill(reel.id), alt: '', loading: 'lazy', width: 720, height: 1280 }), reelStill(reel.id));
  return thumbImg(p, p.styles[0], 'tile-card__img tile-card__img--render');
}

export function renderGrid() {
  const grid = $('#grid-view');
  if (grid.childElementCount) return;
  for (const c of CATEGORIES) {
    const items = PRODUCTS.filter((p) => p.category === c.id);
    if (!items.length) continue;
    const titleId = `cat-${c.id}-title`;
    grid.append(h('section', { class: 'cat-group', dataset: { cat: c.id }, 'aria-labelledby': titleId },
      h('header', { class: 'cat-group__head' },
        h('div', { class: 'cat-group__names' },
          c.bn ? h('p', { class: 'cat-group__bn bn', lang: 'bn', translate: 'no', text: c.bn }) : null,
          h('h3', { class: 'cat-group__title', id: titleId, text: c.label })),
        c.line ? h('p', { class: 'cat-group__line', text: c.line }) : null,
        h('span', { class: 'cat-group__count', text: `${items.length} piece${items.length > 1 ? 's' : ''}` })),
      h('div', { class: 'cat-group__grid' }, ...items.map(tileCard))));
  }
}

export function tileCard(p) {
  return h('article', { class: 'tile-card' },
    h('a', { class: 'tile-card__link', href: productHref(p.id) },
      tileImage(p),
      h('span', { class: 'tile-card__info' },
        h('span', { class: 'tile-card__names' },
          h('span', { class: 'tile-card__bn bn', lang: 'bn', translate: 'no', text: p.bn }),
          h('span', { class: 'tile-card__title', text: p.en })),
        h('span', { class: 'tile-card__price' }, h('span', { class: 'sr-only', text: 'from ' }), inr(fromPrice(p))))),
    wishButton(p.id, p.en));
}

export function renderSets() {
  const rail = $('#sets-rail');
  for (const s of SETS) {
    const items = s.items.map(byId);
    const fan = h('div', { class: 'set__fan', 'aria-hidden': 'true' },
      ...items.slice(0, 3).map((p, i) => h('div', { class: `set__piece set__piece--${i}` }, thumbImg(p, p.styles[0]))));
    rail.append(h('article', { class: 'set' },
      fan,
      h('div', { class: 'set__body' },
        h('p', { class: 'set__bn bn', lang: 'bn', translate: 'no', text: s.bn }),
        h('h3', { class: 'set__title', text: s.en }),
        h('p', { class: 'set__line', text: s.line }),
        h('ul', { class: 'set__items', 'aria-label': 'Included' }, ...items.map((p) => h('li', { text: p.en }))),
        h('div', { class: 'set__foot' },
          h('p', { class: 'price' }, h('span', { class: 'price__from', text: 'from' }), ` ${inr(s.price)}`),
          h('div', { class: 'card__btns' },
            wishButton(s.id, s.en),
            h('button', { type: 'button', class: 'btn btn--gold btn--sm', onclick: () => { if (!requireSignIn('add pieces to your cart')) return; store.add({ id: s.id, qty: 1 }); toast(`${s.en} added to your enquiry cart.`, { action: 'View cart', onAction: () => document.querySelector('[data-open="cart"]').click() }); } }, 'Add to cart'))))));
  }
  document.querySelectorAll('[data-rail]').forEach((b) =>
    b.addEventListener('click', () => {
      const el = document.getElementById(b.dataset.rail);
      el.scrollBy({ left: Number(b.dataset.dir) * Math.min(460, el.clientWidth * 0.8), behavior: 'smooth' });
    }));
}

export function renderBento() {
  const list = $('#bento');
  for (const s of SERVICES) {
    list.append(h('li', { class: 'service' },
      h('button', { type: 'button', class: 'service__btn', onclick: () => openEnquiry({ subject: s.title }) },
        h('span', { class: 'service__bn bn', lang: 'bn', translate: 'no', text: s.bn }),
        h('span', { class: 'service__title', text: s.title }),
        h('span', { class: 'service__text', text: s.body }),
        h('span', { class: 'service__cta' }, 'Enquire', icon('arrow-up-right')))));
  }
  $('#services-enquire').addEventListener('click', () => openEnquiry({ subject: 'A custom commission' }));
}

export function videoTile({ id, title }, cls) {
  const btn = h('button', { type: 'button', class: `video ${cls}`, 'aria-label': `Play video: ${title}` },
    h('img', { src: ytThumb(id), alt: '', loading: 'lazy', width: 1080, height: 1920 }),
    h('span', { class: 'video__play' }, icon('play', 'fill')),
    h('span', { class: 'video__title', text: title }));
  btn.addEventListener('click', () => {
    const frame = h('iframe', {
      class: `video ${cls} video--playing`,
      src: ytEmbed(id),
      title,
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin',
    });
    btn.replaceWith(frame);
  });
  return btn;
}

function reelTile(id, i, refs) {
  const title = FILMS[id].title;
  const btn = h('button', { type: 'button', class: 'video video--reel', 'aria-label': `Play film: ${title}` },
    h('img', { src: reelPosterSmall(id), alt: '', loading: 'lazy', width: 360, height: 640 }),
    h('span', { class: 'video__play' }, icon('play', 'fill')),
    h('span', { class: 'video__title', text: title }));
  btn.addEventListener('click', () => openLightbox(refs, i));
  let preview = null;
  btn.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    preview = h('video', { class: 'video__preview', src: reelPreview(id), muted: true, loop: true, playsinline: true, preload: 'auto', 'aria-hidden': 'true' });
    preview.muted = true;
    btn.insertBefore(preview, btn.children[1]);
    preview.play().catch(() => {});
  });
  btn.addEventListener('pointerleave', () => {
    if (!preview) return;
    preview.pause();
    preview.remove();
    preview = null;
  });
  return btn;
}

export function renderReels() {
  const wall = $('#reels-wall');
  const refs = REELS.map((id) => ({ type: 'reel', id }));
  REELS.forEach((id, i) => wall.append(reelTile(id, i, refs)));
  const reviews = $('#reviews');
  REVIEWS.forEach((r) => reviews.append(videoTile(r, 'video--review')));
  renderWrittenReviews(reviews);
}

/** The newest written reviews the shop chose to show (admin → Customer reviews), above the films. */
function renderWrittenReviews(films) {
  // Fetched only when "Visit us" comes near, so the database isn't asked during the first screen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      showWrittenReviews(films);
    }, { rootMargin: '900px 0px' });
    io.observe(films);
  } else showWrittenReviews(films);
}

function showWrittenReviews(films) {
  loadReviews().then(() => {
    const list = latestReviews(3);
    if (!list.length) return;
    const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const box = h('div', { class: 'home-reviews' }, ...list.map((r) => h('article', { class: 'review review--compact' },
      r.rating ? h('p', { class: 'review__stars', 'aria-label': `${r.rating} out of 5 stars`, text: '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) }) : null,
      r.title ? h('h4', { class: 'review__title', text: r.title }) : null,
      h('p', { class: 'review__text', text: r.text.length > 220 ? `${r.text.slice(0, 217).trimEnd()}…` : r.text }),
      h('footer', { class: 'review__meta' },
        h('span', { class: 'review__name', text: [r.name, r.place].filter(Boolean).join(', ') }),
        r.product && byId(r.product) ? h('span', { text: byId(r.product).en }) : null,
        r.date ? h('span', { text: fmt(r.date) }) : null,
        SOURCE_LABELS[r.source] ? (r.sourceUrl
          ? h('a', { class: 'review__source', href: r.sourceUrl, target: '_blank', rel: 'noopener', text: `From ${SOURCE_LABELS[r.source]} ↗` })
          : h('span', { class: 'review__source', text: `From ${SOURCE_LABELS[r.source]}` })) : null))));
    films.before(box);
  });
}
