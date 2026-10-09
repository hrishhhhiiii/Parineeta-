// Applies the admin-edited homepage text, social links, stores, videos and SEO to the page.
// Runs before icons are hydrated, so <i class="ph-…"> placeholders here become SVGs too.
import { HOMEPAGE, HOMEPAGE_SECTIONS, SOCIALS, PLATFORMS, STORES, VIDEOS, SEO, youtubeId, socialUrlOk, phoneList, telHref } from '../data/homepage.js';
import { SITE, photoSrc, photoSrcset } from '../data/site.js';

const $ = (s, r = document) => r.querySelector(s);

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'text') e.textContent = v;
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter((c) => c != null && c !== false));
  return e;
}

/** "Title <em>Em</em>" built with text nodes only. */
function setTitle(node, title, em) {
  if (!node) return;
  node.replaceChildren(...[title?.trim(), em?.trim() ? el('em', { text: em.trim() }) : null].filter(Boolean).flatMap((x, i) => (i ? [' ', x] : [x])));
}

function applyHero() {
  const h = HOMEPAGE.hero || {};
  const strip = $('.hero__strip');
  if (strip) {
    strip.querySelector('.bn').textContent = h.strip || '';
    strip.querySelector('.hero__strip-en').textContent = h.stripEn || '';
    strip.hidden = !h.strip && !h.stripEn;
  }
  setTitle($('.hero__title'), h.title, h.titleEm);
  if ($('.hero__sub')) $('.hero__sub').textContent = h.sub || '';
  const cta = $('.hero__ctas [data-wa]');
  if (cta && h.ctaText) cta.lastChild.textContent = h.ctaText;
  const img = $('.hero__photo img');
  if (img && h.photo) {
    img.src = photoSrc(h.photo, 1600);
    img.srcset = photoSrcset(h.photo);
    img.alt = h.photoAlt || '';
  }
  const meta = $('.hero__meta');
  if (meta) {
    meta.children[0].textContent = h.metaBn || '';
    meta.children[1].textContent = h.meta || '';
    meta.hidden = !h.meta && !h.metaBn;
  }
}

function applySections() {
  for (const [id] of HOMEPAGE_SECTIONS) {
    const d = HOMEPAGE[id];
    const sec = document.getElementById(id);
    if (!d || !sec) continue;
    setTitle(sec.querySelector('h2'), d.title, d.titleEm);
    // A category page (/c/…) makes the collection's heading an <h1> with the category's own line; keep that line.
    const lede = sec.querySelector('h1') ? null : sec.querySelector('.lede');
    if (lede) lede.textContent = d.lede || '';
    sec.hidden = Boolean(d.hidden);
    // Keep nav and footer links from pointing at a hidden section.
    document.querySelectorAll(`a[href="#${id}"]`).forEach((a) => { a.hidden = Boolean(d.hidden); });
  }
}

function applySocials() {
  const list = SOCIALS.filter((s) => !s.hidden && PLATFORMS[s.platform] && socialUrlOk(s.platform, s.url));
  const big = $('.socials');
  if (big) {
    big.replaceChildren(...list.map((s) => el('a', { class: 'social', href: s.url, target: '_blank', rel: 'noopener' },
      el('i', { class: `ph-light ph-${PLATFORMS[s.platform].icon}`, 'aria-hidden': 'true' }),
      el('span', {}, PLATFORMS[s.platform].label, s.handle ? el('small', { text: s.handle }) : null))));
    big.hidden = !list.length;
  }
  const small = $('.footer__social');
  if (small) {
    small.replaceChildren(...list.map((s) => el('a', { class: 'icon-btn icon-btn--ring', href: s.url, target: '_blank', rel: 'noopener', 'aria-label': PLATFORMS[s.platform].label },
      el('i', { class: `ph-light ph-${PLATFORMS[s.platform].icon}`, 'aria-hidden': 'true' }))));
  }
}

const mapsLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const mapsEmbed = (q) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`;
// A Google Maps link pasted in the admin (Share → Copy link). Only Google Maps addresses are used.
const isMapsUrl = (u) => /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+\/maps)(\/|$)/i.test(String(u || '').trim());
// Directions: the pasted link if there is one, otherwise a search for the place.
const directionsHref = (s) => (isMapsUrl(s.mapsUrl) ? String(s.mapsUrl).trim() : mapsPlace(s) ? mapsLink(mapsPlace(s)) : '');
// The small embedded map needs a place to search for; a short share link can't be embedded.
const mapsPlace = (s) => s.mapsQuery || (isMapsUrl(s.mapsUrl) ? [s.name, String(s.address || '').split('\n').join(', ')].filter(Boolean).join(', ') : '');

function applyStores() {
  const stores = STORES.filter((s) => !s.hidden && (s.name || s.address));
  const dl = $('#visit .contact');
  if (!dl) return;
  const addr = dl.querySelector('dt')?.parentElement;
  const call = [...dl.children].find((d) => d.querySelector('dt')?.textContent === 'Call');
  const email = [...dl.children].find((d) => d.querySelector('dt')?.textContent === 'Email');
  if (addr) {
    addr.querySelector('dt').textContent = stores.length > 1 ? 'Addresses' : 'Address';
    addr.querySelector('dd').replaceChildren(...stores.flatMap((s, i) => [
      i ? el('br') : null,
      stores.length > 1 && s.name ? el('strong', { text: s.name }) : null,
      stores.length > 1 && s.name ? el('br') : null,
      ...String(s.address || '').split('\n').flatMap((line, j) => (j ? [el('br'), line] : [line])),
      s.hours ? el('br') : null, s.hours ? el('small', { text: s.hours }) : null,
      stores.length > 1 && directionsHref(s) ? el('br') : null,
      stores.length > 1 && directionsHref(s) ? el('a', { href: directionsHref(s), target: '_blank', rel: 'noopener', text: 'Directions' }) : null,
    ]).filter((x) => x != null && x !== false));
    addr.hidden = !stores.length;
  }
  if (call) {
    const phones = [...new Set(stores.flatMap((s) => phoneList(s.phones)))];
    call.querySelector('dd').replaceChildren(...phones.flatMap((p, i) => (i ? [el('br'), el('a', { href: telHref(p), text: p })] : [el('a', { href: telHref(p), text: p })])));
    call.hidden = !phones.length;
  }
  if (email && SITE.email) {
    const a = email.querySelector('a');
    a.href = `mailto:${SITE.email}`;
    a.textContent = SITE.email;
  }
  const wa = [...dl.children].find((d) => d.querySelector('dt')?.textContent === 'WhatsApp')?.querySelector('a');
  if (wa && /^\d{10,15}$/.test(SITE.whatsapp || '')) {
    const n = SITE.whatsapp;
    wa.textContent = n.startsWith('91') && n.length === 12 ? `+91 ${n.slice(2, 7)} ${n.slice(7)}` : `+${n}`;
  }
  const first = stores.find((s) => directionsHref(s));
  const dirs = document.querySelectorAll('#visit a[data-directions]'); // "Get directions" and the link over the map
  const frame = $('#visit .visit__map iframe');
  if (first) {
    dirs.forEach((a) => { a.href = directionsHref(first); });
    if (frame && mapsPlace(first)) {
      // The map only loads when the visitor asks for it (see setupVisitMap in main.js).
      frame.dataset.src = mapsEmbed(mapsPlace(first));
      if (frame.src) frame.src = frame.dataset.src;
      frame.title = `Map showing ${mapsPlace(first)}`;
      const place = $('#visit .visit__map-place');
      if (place) place.textContent = mapsPlace(first);
    }
  }
  // The "Get directions" button; the link over the map hides with the map itself.
  const ctaDir = $('#visit .visit__ctas a[data-directions]');
  if (ctaDir) ctaDir.hidden = !first;
  if (frame) frame.parentElement.hidden = !first;
}

function applyVideos() {
  const vids = VIDEOS.map((v) => ({ ...v, id: youtubeId(v.youtubeId) })).filter((v) => v.id && !v.hidden);
  $('#yt-videos')?.remove();
  const host = $('#reels .reels__copy');
  if (!host || !vids.length) return;
  const grid = el('div', { class: 'yt', id: 'yt-videos' }, ...vids.map((v) => {
    const btn = el('button', { type: 'button', class: 'yt__play', 'aria-label': `Play video: ${v.title || 'YouTube video'}` },
      el('img', { src: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, alt: '', loading: 'lazy', width: '480', height: '360' }),
      el('span', { class: 'yt__icon', 'aria-hidden': 'true', text: '▶' }));
    // Only loads YouTube (and its cookies-free player) when the visitor asks to play.
    btn.addEventListener('click', () => btn.replaceWith(el('iframe', {
      class: 'yt__frame', src: `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`, title: v.title || 'YouTube video',
      allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true, loading: 'lazy',
    })));
    return el('figure', { class: 'yt__item' }, btn, v.title ? el('figcaption', { text: v.title }) : null);
  }));
  host.append(grid);
}

function applySeo() {
  if (document.documentElement.dataset.landingTitle) return; // product pages keep their own SEO
  if (SEO.title) document.title = SEO.title;
}

export function renderCmsContent() {
  applyHero();
  applySections();
  applySocials();
  applyStores();
  applyVideos();
  applySeo();
}
