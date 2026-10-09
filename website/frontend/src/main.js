import './styles/numerals.css';
import './styles/fonts.css';
import './styles/main.css';
import './styles/pages.css';
import './styles/redesign.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { PRODUCTS, STORY, byId, has3d, categoryOf, parentOf, categoryBySlug } from './data/products.js';
import { waLink, photoSrc, reelStill } from './data/site.js';
import { HOMEPAGE } from './data/homepage.js';
import { $, $$, reduceMotion, inr, icon } from './ui/dom.js';
import { hydrateIcons } from './ui/icons.js';
import { store, droppedLines, onDropped } from './ui/store.js';
import { toast } from './ui/toast.js';
import { fromPrice } from './data/pricing.js';
import { initCatalogue, setCatalogue, catalogueState, syncUrl, isRefined, renderResults, showCollection, emptyState } from './ui/catalogue.js';
import { initHome, renderRails, rememberViewed } from './ui/home.js';
import { setupDialogs, setLenis, scrollToHash, whenScrollIdle } from './ui/dialogs.js';
import { setupEnquiry } from './ui/enquiry.js';
import { setupProductPanel, openProduct } from './ui/productPanel.js';
import { setupDrawers } from './ui/drawers.js';
import { renderMarquee, renderStory, renderChips, renderGrid, filterGrid, tileCard, renderSets, renderBento, renderReels, renderTrust, renderLookbook } from './ui/sections.js';
import { setupLightbox, openLightbox } from './ui/lightbox.js';
import { setupCheckout } from './ui/checkout.js';
import { initRouter, isProductRoute, goTo } from './ui/router.js';
import { renderProductPage, switchProduct, stopProductPage, clearProductPage, productHref, refreshWish, miniCard } from './ui/productPage.js';
import { initAlpana } from './ui/alpana.js';
import { initInvite } from './ui/invite.js';
import { motion } from './ui/motion.js';
import { applyPublished } from './cms/published.js';
import { IS_PREVIEW, receivePreview } from './cms/preview.js';
import { renderAnnouncement } from './ui/announcement.js';
import { renderCmsContent } from './ui/cmsContent.js';
import { requireSignIn } from './ui/signInGate.js';

// Content published from the admin is baked into the build; preview swaps in the admin's drafts.
applyPublished();
if (IS_PREVIEW) await receivePreview();
renderAnnouncement();
renderCmsContent();
// Signed-in customers: the header icon becomes their account menu, and the cart and wishlist follow them
// across devices. Clerk's cookie is checked first, so guests never download Clerk or supabase-js.
// They load after the page has finished and the browser is idle, so Clerk never competes with the first screen.
if (!IS_PREVIEW && /(?:^|;\s*)__client_uat(?:_[\w-]+)?=[1-9]/.test(document.cookie)) {
  const startAccount = () => {
    import('./ui/cartSync.js').then((m) => m.startCartSync()).catch(() => {});
    import('./ui/accountMenu.js').then((m) => m.startAccountMenu()).catch(() => {});
  };
  const later = () => ('requestIdleCallback' in window ? requestIdleCallback(startAccount, { timeout: 3000 }) : setTimeout(startAccount, 300));
  if (document.readyState === 'complete') later();
  else addEventListener('load', later, { once: true });
}

gsap.registerPlugin(ScrollTrigger);
const reduce = reduceMotion();

/* ---------- static content ---------- */
hydrateIcons();
$('#year').textContent = String(new Date().getFullYear());
const hello = 'Namaskar Parineeta! I found you on your website and would like to know more.';
$$('[data-wa]').forEach((a) => {
  a.href = waLink(hello);
});
renderMarquee();
renderTrust();
renderLookbook();
renderStory();
renderSets();
renderBento();
renderReels();

// Google Maps weighs about half a megabyte, so the Visit map loads only when asked for.
function setupVisitMap() {
  const btn = document.getElementById('visit-map-load');
  const frame = document.querySelector('#visit .visit__map iframe');
  if (!btn || !frame) return;
  btn.addEventListener('click', () => {
    frame.src = frame.dataset.src;
    frame.hidden = false;
    frame.removeAttribute('tabindex');
    // A tap anywhere on the map opens the shop's own Google Maps page.
    const open = document.querySelector('#visit .visit__map-open');
    if (open) open.hidden = false;
    btn.remove();
    frame.focus({ preventScroll: true });
  }, { once: true });
}

setupDialogs();
setupLightbox();
setupEnquiry();
setupProductPanel();
setupDrawers();
setupCheckout();
setupVisitMap();
initAlpana();
initInvite();

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  setLenis(lenis);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.closest('dialog')) return;
  if (a.classList.contains('skip-link')) {
    e.preventDefault();
    const target = isProductRoute() ? $('#pg-en') : $('#main');
    target.setAttribute('tabindex', '-1');
    target.focus();
    return;
  }
  const hash = a.getAttribute('href');
  if (hash.length < 2 || hash.startsWith('#/')) return; // product routes: let the router handle the hash change
  if (isProductRoute()) return; // leaving a product page: the router restores the landing page, then scrolls
  e.preventDefault();
  scrollToHash(hash);
});

/* ---------- nav state ---------- */
const nav = $('#nav');
const sentinel = document.createElement('div');
sentinel.setAttribute('aria-hidden', 'true');
sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:40px;pointer-events:none;';
document.body.prepend(sentinel);
new IntersectionObserver(([entry]) => nav.classList.toggle('is-scrolled', !entry.isIntersecting)).observe(sentinel);

// The floating WhatsApp button steps aside while a section with its own WhatsApp button is on screen,
// so on phones it never covers the hero's or the Visit section's button.
const fab = $('.fab');
if (fab) {
  const showing = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? showing.add(e.target) : showing.delete(e.target)));
    fab.classList.toggle('is-tucked', showing.size > 0);
  }, { threshold: 0.15 });
  $$('#top, #visit').forEach((s) => io.observe(s));
}

/* ---------- preloader + hero ---------- */
const preloader = $('#preloader');
let preloaderGone = false;
function hidePreloader() {
  if (preloaderGone) return;
  preloaderGone = true;
  preloader.classList.add('is-done');
  setTimeout(() => preloader.remove(), 900);
  if (!reduce) {
    gsap.from('[data-hero-in]', { y: 28, opacity: 0, duration: 1.1, stagger: 0.12, ease: 'power3.out', delay: 0.15 });
    gsap.from('.hero__strip', { opacity: 0, duration: 1, delay: 0.1 });
  }
}
// Reveal the page as soon as fonts are in, so the headline is not held back by WebGL.
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(hidePreloader);

/* ---------- deferred images ---------- */
// Chrome's preload scanner fetched the services backdrop despite loading="lazy", so it carries data-src until it nears the viewport.
const deferred = $$('img[data-src]');
const loadDeferred = (img) => {
  if (img.dataset.sizes) img.sizes = img.dataset.sizes;
  if (img.dataset.srcset) img.srcset = img.dataset.srcset;
  img.src = img.dataset.src;
  img.removeAttribute('data-src');
};
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      loadDeferred(e.target);
    }
  }, { rootMargin: '1200px 0px' });
  deferred.forEach((img) => io.observe(img));
} else deferred.forEach(loadDeferred);

/* ---------- lazy 3D sections ---------- */
function whenNear(el, fn, margin = '600px') {
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    fn();
  }, { rootMargin: margin });
  io.observe(el);
}

const chapters = $$('.chapter');
// Chapters light up as they scroll by whether or not the 3D model loads (on a weak phone WebGL can
// fail, and the chapters must not stay faded). The model follows along once it has loaded.
let story = null;
let chapterNow = 0;
// A chapter whose product has no 3D model shows a photo on the stage instead of an empty pedestal:
// the chapter's own photo, else the product's first photo or film still.
const storyStage = $('.story__stage');
const storyPhoto = storyStage ? document.createElement('img') : null;
if (storyPhoto) {
  storyPhoto.className = 'story__photo';
  storyPhoto.alt = '';
  storyPhoto.decoding = 'async';
  storyStage.append(storyPhoto);
}
function stagePhoto(i) {
  if (!storyPhoto) return;
  const c = STORY[i];
  const p = c && byId(c.product);
  const media = [c?.photo, ...(p?.media || [])].filter((m) => m?.id && (m.type === 'photo' || m.type === 'reel'));
  const m = !p || has3d(p) ? null : media.find((x) => x.type === 'photo') || media[0];
  storyStage.classList.toggle('is-photo', !!m);
  if (!m) return;
  const src = m.type === 'photo' ? photoSrc(m.id, 800) : reelStill(m.id);
  if (storyPhoto.getAttribute('src') !== src) storyPhoto.src = src;
  storyPhoto.alt = p.en;
}
stagePhoto(0);
chapters.forEach((li, i) => {
  ScrollTrigger.create({
    trigger: li,
    start: 'top 62%',
    end: 'bottom 62%',
    onToggle: (self) => {
      if (!self.isActive) return;
      chapterNow = i;
      story?.setChapter(i);
      stagePhoto(i);
      chapters.forEach((c) => c.classList.toggle('is-active', c === li));
    },
  });
});
// The 3D model (about 160 KB of three.js) starts loading only when the story is close, after the page
// has finished loading and the browser is idle, and not at all when the visitor asked to save data.
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200));
const afterLoad = (fn) => (document.readyState === 'complete' ? fn() : addEventListener('load', fn, { once: true }));
if (!navigator.connection?.saveData) {
  whenNear($('#story-chapters'), () => afterLoad(() => idle(() => {
    import('./three/story.js').then(({ initStory }) => {
      story = initStory($('#story-canvas'), STORY.map((c) => byId(c.product)));
      story.setChapter(chapterNow);
      whenScrollIdle(() => ScrollTrigger.refresh());
    }).catch(() => { /* no 3D: the chapters still work */ });
  })), '200px');
}
chapters[0]?.classList.add('is-active');
ScrollTrigger.create({
  trigger: '#story-chapters',
  start: 'top 62%',
  end: 'bottom 62%',
  onUpdate: (self) => {
    $('#story-progress').style.transform = `scaleY(${self.progress.toFixed(3)})`;
  },
});

/* ---------- collection ---------- */
let gallery = null;
let view = 'grid';
const focusEls = { bn: $('#focus-bn'), en: $('#focus-en'), line: $('#focus-line'), price: $('#focus-price'), wish: $('#focus-wish'), page: $('#focus-page') };

function paintFocusWish() {
  const p = gallery?.focused;
  if (!p) return;
  const on = store.hasWish(p.id);
  focusEls.wish.setAttribute('aria-pressed', String(on));
  focusEls.wish.setAttribute('aria-label', on ? `Remove ${p.en} from wishlist` : `Save ${p.en} to wishlist`);
  focusEls.wish.replaceChildren(icon('heart', on ? 'fill' : 'light'));
}

function onFocus(p) {
  focusEls.bn.textContent = p.bn;
  focusEls.en.textContent = p.en;
  focusEls.line.textContent = p.line;
  focusEls.price.textContent = inr(fromPrice(p));
  focusEls.page.href = productHref(p.id);
  focusEls.page.setAttribute('aria-label', `View Details of ${p.en}`);
  paintFocusWish();
  if (!reduce) gsap.fromTo('.focus-card__names > *', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.05, ease: 'power2.out', overwrite: true });
}
store.subscribe(paintFocusWish);
focusEls.wish.addEventListener('click', () => {
  const p = gallery?.focused;
  if (p && requireSignIn('save pieces to your wishlist')) store.toggleWish(p.id);
});
$('#focus-open').addEventListener('click', () => {
  const p = gallery?.focused;
  if (p) openProduct(p.id);
});

function startGallery() {
  if (gallery || view !== '3d') return;
  import('./three/gallery.js').then(({ initGallery }) => {
    gallery = initGallery({ canvas: $('#gallery-canvas'), stageEl: $('#pavilion-stage'), products: PRODUCTS.filter((p) => has3d(p) && !p.noPavilion), onFocus, onOpen: (p) => goTo(productHref(p.id)) });
    if (catalogueState().cat !== 'all') gallery.setFilter(catalogueState().cat);
    $('#pav-prev').addEventListener('click', () => gallery.prev());
    $('#pav-next').addEventListener('click', () => gallery.next());
  });
}

function setView(v) {
  view = v;
  $$('.view-toggle__btn').forEach((b) => {
    const on = b.dataset.view === v;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $('#pavilion').hidden = v !== '3d';
  syncUrl();
  if (v === 'grid') renderGrid();
  else startGallery();
  showCollectionState(catalogueState());
  whenScrollIdle(() => ScrollTrigger.refresh());
}
$$('.view-toggle__btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

/** Category chips show the grouped grid; a search, sub-category, price, "Ready now" or sort shows one flat list. */
function showCollectionState(st) {
  gallery?.setFilter(st.cat);
  // Category pages (/c/…) carry the category as the collection's <h1>; it follows the visitor's choice.
  const heading = $('#collection-title');
  const chosen = st.sub || st.cat;
  if (heading?.tagName === 'H1') {
    const c = chosen && chosen !== 'all' ? categoryOf(chosen) : null;
    heading.textContent = c?.label || HOMEPAGE.collection.title;
    const lede = $('#collection .lede');
    if (lede) lede.textContent = c ? c.line || '' : HOMEPAGE.collection.lede;
    const about = $('#cat-about');
    if (about) {
      about.textContent = c?.about || '';
      about.hidden = !c?.about;
    }
  }
  const refined = isRefined(st);
  $('#grid-view').hidden = view !== 'grid' || refined;
  $('#grid-results').hidden = view !== 'grid' || !refined;
  // The Ready now / Bestsellers / Recently viewed rows belong to plain browsing, not to a search.
  $('#rails').hidden = view !== 'grid' || refined || $('#rails').dataset.empty !== 'false';
  if (view !== 'grid') return;
  if (refined) renderResults($('#grid-results'));
  else filterGrid(st.cat);
}

// Category pages (/c/<id>/, built by build/product-pages.js) open the collection filtered to that category.
// The written-in list is for search engines; the live collection replaces it. The address becomes /?cat=…
// so search, filters and Back work exactly as on the homepage.
const catPage = location.pathname.match(/^\/c\/([a-z0-9-]+)\/?(?:index\.html)?$/);
$('#cat-static')?.remove();
if (catPage) {
  const c = categoryBySlug(catPage[1]) || categoryOf(catPage[1]);
  const q = new URLSearchParams(location.search);
  if (c) q.set(parentOf(c.id) ? 'sub' : 'cat', c.id);
  history.replaceState(history.state, '', `/${q.toString() ? `?${q}` : ''}#collection`);
  addEventListener('load', () => setTimeout(() => scrollToHash('#collection'), 300), { once: true });
}
renderChips((cat) => setCatalogue({ cat, sub: '' }));
// Banners and category tiles under the hero, rows at the top of the collection (ui/home.js).
initHome({
  card: miniCard,
  openCategory: (cat) => showCollection({ ...emptyState(), cat }),
  openSearch: (q) => showCollection({ ...emptyState(), q }),
});
// Search and filters (ui/catalogue.js) live in the address, so results can be shared and Back works.
initCatalogue({
  card: tileCard,
  getView: () => view,
  onChange: (st) => {
    if (isRefined(st) && view !== 'grid') setView('grid');
    else showCollectionState(st);
    whenScrollIdle(() => ScrollTrigger.refresh());
  },
  showResults: () => {
    if (view !== 'grid') setView('grid');
  },
});
const startView = new URLSearchParams(location.search).get('view');
if (startView === 'grid' || startView === '3d') view = startView;
if (view === 'grid') setView('grid');
else {
  showCollectionState(catalogueState());
  whenNear($('#collection'), startGallery, '400px');
}

/* ---------- reveals ---------- */
if (!reduce) {
  gsap.set('[data-reveal]', { y: 14, opacity: 0.2 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 94%',
    once: true,
    onEnter: (els) => gsap.to(els, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: 'expo.out' }),
  });
  gsap.utils.toArray('.tile, .set, .video--reel, .trust__shot, .look-item').forEach((el) => {
    gsap.from(el, { y: 20, opacity: 0.2, duration: 0.7, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 96%', once: true } });
  });
  gsap.to('.hero__photo img', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
}

/* ---------- ambient film band ---------- */
// A silent 10-second, 540px loop cut from the bright part of the film (444 KB instead of the 2.8 MB film);
// "Watch the film" still opens the full version with sound.
const BAND_LOOP = '/media/reels/kouto-river-loop.mp4';
const bandVideo = $('#filmband-video');
let bandInView = false;
motion.listeners.add((paused) => {
  if (!paused && bandInView && !reduce) {
    if (!bandVideo.src) bandVideo.src = BAND_LOOP;
    bandVideo.play().catch(() => {});
  }
});
if (!reduce) {
  new IntersectionObserver(([entry]) => {
    bandInView = entry.isIntersecting;
    if (entry.isIntersecting && !motion.paused) {
      if (!bandVideo.src) bandVideo.src = BAND_LOOP;
      bandVideo.play().catch(() => {});
    } else bandVideo.pause();
  }, { threshold: 0.25 }).observe(bandVideo);
}
$('#filmband-open').addEventListener('click', () => {
  bandVideo.pause();
  openLightbox([{ type: 'reel', id: 'kouto-river' }], 0);
});

/* ---------- cart items that could not be kept ---------- */
// Saved cart lines for pieces that no longer exist are removed; say so instead of letting them vanish.
const tellDropped = (n) => toast(n > 1 ? `${n} items from your earlier cart are no longer available.` : '1 item from your earlier cart is no longer available.', { iconName: 'shopping-bag-open' });
if (droppedLines()) requestAnimationFrame(() => tellDropped(droppedLines()));
onDropped(tellDropped);

/* ---------- product pages (/p/<id>/) ---------- */
store.subscribe(refreshWish);
initRouter({
  render: (root, p) => {
    renderProductPage(root, p);
    rememberViewed(p.id);
  },
  // The product builder: another card picked (or Back/Forward) switches the panel without a page load.
  switch: (p) => {
    const ok = switchProduct(p);
    if (ok) rememberViewed(p.id);
    return ok;
  },
  stop: stopProductPage,
  clear: clearProductPage,
  afterLeave: () => {
    // "Recently viewed" now includes the piece just seen.
    renderRails();
    showCollectionState(catalogueState());
    requestAnimationFrame(() => whenScrollIdle(() => ScrollTrigger.refresh()));
  },
});

window.addEventListener('load', () => whenScrollIdle(() => ScrollTrigger.refresh()));
