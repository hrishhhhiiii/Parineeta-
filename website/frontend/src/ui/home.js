// Homepage shopping parts (shop catalogue, phase 3): promo banners and category tiles under the hero,
// and the "Ready now", "Bestsellers" and "Recently viewed" rows at the top of the collection.
//
//   BANNERS (admin) ─► activeBanners(today) ─► carousel (swipe, arrows, dots, pause; 5 s auto unless reduced motion)
//   CATEGORIES      ─► category tiles ─► collection filtered to that category
//   PRODUCTS        ─► railItems('ready' | 'featured' | 'recent') ─► rows (shown only with 2+ products)
//
// The top half has no page code (the tests call it directly).
import { PRODUCTS, byId, isSet, categoryOf, topCategories, inCategory, categoryPath } from '../data/products.js';
import { BANNERS } from '../data/homepage.js';
import { photoSrc, photoSrcset } from '../data/site.js';
import { todayIso } from '../data/pricing.js';
import { readyAny } from './catalogue.js';
import { h, icon, $, reduceMotion } from './dom.js';

/* ---------- banners ---------- */

/** Where a banner goes, or null when its target no longer exists. Web links must be https. */
export function bannerTarget(b) {
  switch (b?.linkType) {
    case 'product': {
      const p = byId(b.linkProduct);
      return p && !isSet(p.id) && PRODUCTS.includes(p) ? { kind: 'product', href: `/p/${p.id}/` } : null;
    }
    case 'category':
      return categoryOf(b.linkCategory) ? { kind: 'category', cat: b.linkCategory, href: `/?cat=${encodeURIComponent(b.linkCategory)}#collection` } : null;
    case 'search': {
      const q = String(b.linkSearch || '').trim();
      return q ? { kind: 'search', q, href: `/?q=${encodeURIComponent(q)}#collection` } : null;
    }
    case 'url': {
      const url = String(b.linkUrl || '').trim();
      return /^https:\/\/[^\s]+$/i.test(url) ? { kind: 'url', href: url } : null;
    }
    default:
      return null;
  }
}

/** Banners to show today: visible, with a picture and headline, inside their dates, and going somewhere. */
export function activeBanners(list = BANNERS, today = todayIso()) {
  return list.filter((b) => b && b.photo && b.title && !b.hidden
    && (!b.start || b.start <= today) && (!b.end || b.end >= today) && bannerTarget(b));
}

/* ---------- recently viewed (this browser only) ---------- */

const RECENT_KEY = 'parineeta:recent';
const RECENT_MAX = 8;
function readRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
export function rememberViewed(id) {
  const ids = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    /* private mode: not kept */
  }
}
/** Products opened lately, newest first; ones no longer on the site are skipped. */
export const recentProducts = (ids = readRecent()) => ids.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);

/* ---------- rows ---------- */

export const RAILS = [['ready', 'Ready now'], ['featured', 'Bestsellers']];

/** A row's products; empty when it would have fewer than 2 (a lone card isn't a row). */
export function railItems(kind, products = PRODUCTS, recentIds) {
  const list = kind === 'ready' ? products.filter(readyAny)
    : kind === 'featured' ? products.filter((p) => p.featured)
      : kind === 'recent' ? recentProducts(recentIds)
        : [];
  return list.length >= 2 ? list.slice(0, 12) : [];
}

/* ---------- page parts ---------- */

let hooks = { card: null, openCategory: () => {}, openSearch: () => {} };

function bannerCarousel(list) {
  const total = list.length;
  const track = h('div', { class: 'banners__track' });
  const slides = list.map((b, i) => {
    const t = bannerTarget(b);
    const a = h('a', {
      class: 'banner', href: t.href, role: 'group', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${total}: ${b.title}`,
      ...(t.kind === 'url' ? { target: '_blank', rel: 'noopener' } : {}),
    },
    h('img', { class: 'banner__img', src: photoSrc(b.photo, 1600), srcset: photoSrcset(b.photo), sizes: '(max-width: 1100px) 100vw, 1100px', alt: '', loading: i ? 'lazy' : 'eager', decoding: 'async', width: 1600, height: 800 }),
    h('span', { class: 'banner__text' },
      h('span', { class: 'banner__title', text: b.title }),
      b.line ? h('span', { class: 'banner__line', text: b.line }) : null,
      h('span', { class: 'banner__cta' }, t.kind === 'url' ? 'Open' : 'Shop now', icon('arrow-right'))));
    // Categories and searches open the collection on this page, without a reload.
    if (t.kind === 'category' || t.kind === 'search') {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (t.kind === 'category') hooks.openCategory(t.cat);
        else hooks.openSearch(t.q);
      });
    }
    return a;
  });
  track.append(...slides);
  const wrap = h('div', { class: 'banners', role: 'region', 'aria-roledescription': 'carousel', 'aria-label': 'Highlights' }, track);
  if (total < 2) return wrap;

  let index = 0;
  let paused = reduceMotion(); // no automatic movement for visitors who ask for less motion
  let hover = false;
  let visible = true;
  // The slide on screen is the truth (a swipe or an unfinished smooth scroll can leave `index` behind).
  const shown = () => Math.min(total - 1, Math.max(0, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
  const go = (i) => {
    index = (i + total) % total;
    track.scrollTo({ left: index * track.clientWidth, behavior: reduceMotion() ? 'auto' : 'smooth' });
    paintDots();
  };
  const step = (d) => go(shown() + d);
  const dots = slides.map((_, i) => h('button', { type: 'button', class: 'banners__dot', 'aria-label': `Show banner ${i + 1}`, onclick: () => go(i) }));
  const paintDots = () => dots.forEach((d, i) => d.setAttribute('aria-current', String(i === index)));
  const pauseBtn = h('button', { type: 'button', class: 'icon-btn banners__pause' });
  const paintPause = () => {
    pauseBtn.setAttribute('aria-label', paused ? 'Play banners' : 'Pause banners');
    pauseBtn.replaceChildren(icon(paused ? 'play' : 'pause', 'fill'));
  };
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    paintPause();
  });
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (i !== index && i >= 0 && i < total) {
      index = i;
      paintDots();
    }
  }, { passive: true });
  wrap.addEventListener('mouseenter', () => { hover = true; });
  wrap.addEventListener('mouseleave', () => { hover = false; });
  wrap.addEventListener('focusin', () => { hover = true; });
  wrap.addEventListener('focusout', () => { hover = false; });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(wrap);
  setInterval(() => {
    if (!paused && !hover && visible && !document.hidden) step(1);
  }, 5000);
  wrap.append(h('div', { class: 'banners__controls' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous banner', onclick: () => step(-1) }, icon('caret-left')),
    h('div', { class: 'banners__dots' }, ...dots),
    pauseBtn,
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next banner', onclick: () => step(1) }, icon('caret-right'))));
  paintDots();
  paintPause();
  return wrap;
}

function categoryTiles() {
  const cats = topCategories().filter((c) => PRODUCTS.some((p) => inCategory(p, c.id)));
  return cats.map((c) => {
    const photo = c.image || PRODUCTS.find((p) => inCategory(p, c.id) && p.media?.some((m) => m.type === 'photo'))?.media.find((m) => m.type === 'photo').id;
    // A real page per category (/c/<id>/, built for categories with products) that search engines can follow.
    const a = h('a', { class: 'cat-tile', href: categoryPath(c) },
      h('span', { class: 'cat-tile__media' }, photo
        ? h('img', { class: 'cat-tile__img', src: photoSrc(photo, 400), alt: '', loading: 'lazy', width: 400, height: 400 })
        : h('span', { class: 'cat-tile__img cat-tile__img--none brand-mask', 'aria-hidden': 'true' })),
      h('span', { class: 'cat-tile__name', text: c.label }),
      c.bn ? h('span', { class: 'cat-tile__bn bn', lang: 'bn', text: c.bn }) : null);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      hooks.openCategory(c.id);
    });
    return a;
  });
}

/** Draws the rows at the top of the collection. Called again after visiting a product. */
export function renderRails() {
  const box = $('#rails');
  if (!box || !hooks.card) return;
  const rows = RAILS.map(([kind, title]) => {
    const items = railItems(kind);
    if (!items.length) return null;
    const id = `rail-${kind}`;
    return h('section', { class: 'rail', 'aria-labelledby': id },
      h('h3', { class: 'rail__title', id, text: title }),
      h('div', { class: 'mini-grid mini-grid--rail', role: 'list', 'aria-labelledby': id }, ...items.map((p) => {
        const c = hooks.card(p);
        c.setAttribute('role', 'listitem');
        return c;
      })));
  }).filter(Boolean);
  box.replaceChildren(...rows);
  box.dataset.empty = String(!rows.length);
}

export function initHome(opts) {
  hooks = { ...hooks, ...opts };
  const banners = activeBanners();
  const tiles = categoryTiles();
  const bannerBox = $('#banners');
  const tileBox = $('#cat-tiles');
  if (banners.length) bannerBox.replaceChildren(bannerCarousel(banners));
  bannerBox.hidden = !banners.length;
  tileBox.replaceChildren(...tiles);
  tileBox.hidden = tiles.length < 2;
  $('#promo').hidden = bannerBox.hidden && tileBox.hidden;
  renderRails();
}
