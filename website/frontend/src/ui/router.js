import { byId, isSet } from '../data/products.js';
import { productTitle, productDescription } from '../data/seo.js';
import { $ } from './dom.js';
import { jumpTo, closeAllDialogs, scrollToHash } from './dialogs.js';
import { toast } from './toast.js';

// Old shared links (#/p/<id>) still open the product, then the address is tidied to /p/<id>/.
const PRODUCT_ROUTE = /^#\/p\/([a-z0-9-]+)$/;
// Product links are real URLs (/p/<id>/): prebuilt pages search engines can crawl. Clicks on them are
// handled here without a page load.
const PATH_ROUTE = /^\/p\/([a-z0-9-]+)\/?(?:index\.html)?$/;
// Prebuilt product pages carry the landing page's title and description on <html>.
const landing = document.documentElement.dataset;
const baseTitle = landing.landingTitle || document.title;
const metaDesc = document.querySelector('meta[name="description"]');
const baseDesc = landing.landingDesc || metaDesc?.content || '';

let inPage = false;
let shownId = null;
let landingY = 0;
let hooks = null;

export const isProductRoute = () => inPage;

function enter(p) {
  if (inPage && shownId === p.id) return;
  // Already on a product page: the product builder switches to p in place when p is in its grid.
  const switched = inPage && hooks.switch?.(p);
  shownId = p.id;
  if (!switched) {
    closeAllDialogs();
    if (!inPage) landingY = window.scrollY;
    inPage = true;
    $('#main').hidden = true;
    const page = $('#product-page');
    page.hidden = false;
    hooks.render(page, p);
  }
  document.title = productTitle(p);
  if (metaDesc) metaDesc.content = productDescription(p);
  if (switched) return;
  jumpTo(0);
  requestAnimationFrame(() => $('#pg-en')?.focus({ preventScroll: true }));
}

function leave(hash) {
  inPage = false;
  shownId = null;
  hooks.stop();
  const page = $('#product-page');
  page.hidden = true;
  hooks.clear(page);
  $('#main').hidden = false;
  document.title = baseTitle;
  if (metaDesc) metaDesc.content = baseDesc;
  hooks.afterLeave();
  let target = null;
  try {
    target = hash && hash.length > 1 && hash !== '#top' ? document.querySelector(hash) : null;
  } catch {
    target = null;
  }
  requestAnimationFrame(() => {
    if (hash === '#top') jumpTo(0);
    else {
      jumpTo(landingY);
      if (target) requestAnimationFrame(() => scrollToHash(hash));
    }
  });
}

/** Product id from #/p/<id>, or from a /p/<id>/ path when no other hash is set. */
function currentId() {
  const m = location.hash.match(PRODUCT_ROUTE);
  if (m) {
    history.replaceState(history.state, '', `/p/${m[1]}/`);
    return m[1];
  }
  const pm = location.pathname.match(PATH_ROUTE);
  if (!pm) return null;
  // Any other hash on a product path means the visitor is heading back to the landing page.
  if (location.hash && location.hash !== '#') {
    history.replaceState(history.state, '', `/${location.hash}`);
    return null;
  }
  return pm[1];
}

function route() {
  const id = currentId();
  const p = id ? byId(id) : null;
  if (p && !isSet(p.id) && p.model) enter(p);
  else if (id) {
    // An old link to a piece that was removed or renamed: say so and show the collection instead.
    history.replaceState(history.state, '', '/#collection');
    if (inPage) leave('#collection');
    else requestAnimationFrame(() => scrollToHash('#collection'));
    toast('That piece is no longer on the website. Here is everything else we make.', { iconName: 'magnifying-glass' });
  } else if (inPage) leave(location.hash);
}

/** Opens product links in place: same tab, plain left click, a /p/<id>/ path on this site. */
function onClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  // In-page links (#collection) resolve to the current path too; those are left to the hash handling.
  if (a.getAttribute('href').startsWith('#')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.hash || !PATH_ROUTE.test(url.pathname)) return;
  e.preventDefault();
  goTo(url.pathname);
}

/** Opens a /p/<id>/ page in place, the same way clicking its link does. */
export function goTo(path) {
  if (path !== location.pathname || location.hash) history.pushState(null, '', path);
  route();
}

export function initRouter(h) {
  hooks = h;
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);
  document.addEventListener('click', onClick);
  route();
}
