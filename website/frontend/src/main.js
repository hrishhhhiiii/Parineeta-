import './styles/fonts.css';
import './styles/main.css';
import './styles/pages.css';
import './styles/redesign.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { PRODUCTS, STORY, byId } from './data/products.js';
import { waLink } from './data/site.js';
import { $, $$, reduceMotion, inr, icon } from './ui/dom.js';
import { hydrateIcons } from './ui/icons.js';
import { store } from './ui/store.js';
import { setupDialogs, setLenis, scrollToHash, whenScrollIdle } from './ui/dialogs.js';
import { setupEnquiry } from './ui/enquiry.js';
import { setupProductPanel, openProduct } from './ui/productPanel.js';
import { setupDrawers } from './ui/drawers.js';
import { renderMarquee, renderStory, renderChips, renderGrid, filterGrid, renderSets, renderBento, renderReels, renderTrust, renderLookbook } from './ui/sections.js';
import { setupLightbox, openLightbox } from './ui/lightbox.js';
import { setupCheckout } from './ui/checkout.js';
import { initRouter, isProductRoute } from './ui/router.js';
import { renderProductPage, stopProductPage, clearProductPage, productHref, refreshWish } from './ui/productPage.js';
import { initAlpana } from './ui/alpana.js';
import { initInvite } from './ui/invite.js';
import { motion } from './ui/motion.js';
import { applyPublished } from './cms/published.js';
import { IS_PREVIEW, receivePreview } from './cms/preview.js';
import { renderAnnouncement } from './ui/announcement.js';
import { renderCmsContent } from './ui/cmsContent.js';

// Content published from the admin is baked into the build; preview swaps in the admin's drafts.
applyPublished();
if (IS_PREVIEW) await receivePreview();
renderAnnouncement();
renderCmsContent();

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

setupDialogs();
setupLightbox();
setupEnquiry();
setupProductPanel();
setupDrawers();
setupCheckout();
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

/* ---------- pause-animations control ---------- */
const motionBtn = $('#motion-toggle');
const bandVideoEl = $('#filmband-video');
function paintMotion(paused) {
  document.documentElement.classList.toggle('motion-paused', paused);
  motionBtn.setAttribute('aria-pressed', String(paused));
  motionBtn.setAttribute('aria-label', paused ? 'Play animations' : 'Pause animations');
  motionBtn.title = paused ? 'Play animations' : 'Pause animations';
  motionBtn.replaceChildren(icon(paused ? 'play' : 'pause'));
  if (paused) bandVideoEl.pause();
}
motion.listeners.add(paintMotion);
paintMotion(motion.paused);
motionBtn.addEventListener('click', () => motion.set(!motion.paused));

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
whenNear($('#story-chapters'), () => {
  import('./three/story.js').then(({ initStory }) => {
    const story = initStory($('#story-canvas'), STORY.map((c) => byId(c.product)));
    chapters.forEach((li, i) => {
      ScrollTrigger.create({
        trigger: li,
        start: 'top 62%',
        end: 'bottom 62%',
        onToggle: (self) => {
          if (!self.isActive) return;
          story.setChapter(i);
          chapters.forEach((c) => c.classList.toggle('is-active', c === li));
        },
      });
    });
    whenScrollIdle(() => ScrollTrigger.refresh());
  });
});
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
let filter = 'all';
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
  focusEls.price.textContent = inr(p.priceFrom);
  focusEls.page.href = productHref(p.id);
  focusEls.page.setAttribute('aria-label', `View Details of ${p.en}`);
  paintFocusWish();
  if (!reduce) gsap.fromTo('.focus-card__names > *', { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.05, ease: 'power2.out', overwrite: true });
}
store.subscribe(paintFocusWish);
focusEls.wish.addEventListener('click', () => {
  const p = gallery?.focused;
  if (p) store.toggleWish(p.id);
});
$('#focus-open').addEventListener('click', () => {
  const p = gallery?.focused;
  if (p) openProduct(p.id);
});

function startGallery() {
  if (gallery || view !== '3d') return;
  import('./three/gallery.js').then(({ initGallery }) => {
    gallery = initGallery({ canvas: $('#gallery-canvas'), stageEl: $('#pavilion-stage'), products: PRODUCTS, onFocus, onOpen: (p) => openProduct(p.id) });
    if (filter !== 'all') gallery.setFilter(filter);
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
  $('#grid-view').hidden = v !== 'grid';
  syncCollectionUrl();
  if (v === 'grid') {
    renderGrid();
    filterGrid(filter);
  } else startGallery();
  whenScrollIdle(() => ScrollTrigger.refresh());
}
$$('.view-toggle__btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
renderChips((cat) => {
  filter = cat;
  gallery?.setFilter(cat);
  filterGrid(cat);
  syncCollectionUrl();
});

// Collection filter and view live in the query string so they can be shared and survive reloads.
function syncCollectionUrl() {
  const q = new URLSearchParams(location.search);
  if (filter === 'all') q.delete('cat');
  else q.set('cat', filter);
  if (view === 'grid') q.delete('view');
  else q.set('view', view);
  const qs = q.toString();
  history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}
const startParams = new URLSearchParams(location.search);
const startView = startParams.get('view');
const startCat = startParams.get('cat');
if (startView === 'grid' || startView === '3d') view = startView;
if (startCat && document.querySelector(`.chip[data-cat="${CSS.escape(startCat)}"]`)) document.querySelector(`.chip[data-cat="${CSS.escape(startCat)}"]`).click();
if (view === 'grid') setView('grid');
else whenNear($('#collection'), startGallery, '400px');

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
const bandVideo = $('#filmband-video');
let bandInView = false;
motion.listeners.add((paused) => {
  if (!paused && bandInView && !reduce) {
    if (!bandVideo.src) bandVideo.src = '/media/reels/kouto-river.mp4';
    bandVideo.play().catch(() => {});
  }
});
if (!reduce) {
  new IntersectionObserver(([entry]) => {
    bandInView = entry.isIntersecting;
    if (entry.isIntersecting && !motion.paused) {
      if (!bandVideo.src) bandVideo.src = '/media/reels/kouto-river.mp4';
      bandVideo.play().catch(() => {});
    } else bandVideo.pause();
  }, { threshold: 0.25 }).observe(bandVideo);
}
$('#filmband-open').addEventListener('click', () => {
  bandVideo.pause();
  openLightbox([{ type: 'reel', id: 'kouto-river' }], 0);
});

/* ---------- product pages (#/p/<id>) ---------- */
store.subscribe(refreshWish);
initRouter({
  render: renderProductPage,
  stop: stopProductPage,
  clear: clearProductPage,
  afterLeave: () => requestAnimationFrame(() => whenScrollIdle(() => ScrollTrigger.refresh())),
});

window.addEventListener('load', () => whenScrollIdle(() => ScrollTrigger.refresh()));
