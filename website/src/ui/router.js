import { byId, isSet } from '../data/products.js';
import { $ } from './dom.js';
import { jumpTo, closeAllDialogs, scrollToHash } from './dialogs.js';

const PRODUCT_ROUTE = /^#\/p\/([a-z0-9-]+)$/;
// Real product URLs (/p/<id>/) are prebuilt pages for search engines; in-page links keep the hash form.
const PATH_ROUTE = /^\/p\/([a-z0-9-]+)\/?(?:index\.html)?$/;
// Prebuilt product pages carry the landing page's title and description on <html>.
const landing = document.documentElement.dataset;
const baseTitle = landing.landingTitle || document.title;
const metaDesc = document.querySelector('meta[name="description"]');
const baseDesc = landing.landingDesc || metaDesc?.content || '';

let inPage = false;
let landingY = 0;
let hooks = null;

export const isProductRoute = () => inPage;

function enter(p) {
  closeAllDialogs();
  if (!inPage) landingY = window.scrollY;
  inPage = true;
  $('#main').hidden = true;
  const page = $('#product-page');
  page.hidden = false;
  hooks.render(page, p);
  document.title = `${p.en} (${p.bn}) | Parineeta, Patuli`;
  if (metaDesc) metaDesc.content = `${p.line} ${p.story}`.slice(0, 300);
  jumpTo(0);
  requestAnimationFrame(() => $('#pg-en')?.focus({ preventScroll: true }));
}

function leave(hash) {
  inPage = false;
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
  if (m) return m[1];
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
  else if (inPage) leave(location.hash);
}

export function initRouter(h) {
  hooks = h;
  window.addEventListener('hashchange', route);
  route();
}
