import { reduceMotion } from './dom.js';

let lenis = null;
export const setLenis = (l) => {
  lenis = l;
};

let verifyTimer = 0;
// True while a smooth scroll started here, without Lenis, is still travelling (phones, and until Lenis loads).
let nativeBusy = false;
// A touch, wheel or key press means the visitor has taken over: stop steering the page.
// (No window when the tests import this file.)
if (typeof window !== 'undefined') {
  for (const type of ['touchstart', 'wheel', 'keydown']) {
    window.addEventListener(type, () => {
      clearTimeout(verifyTimer);
      nativeBusy = false;
    }, { passive: true });
  }
}

export function scrollToHash(hash, attempt = 0) {
  let target = null;
  try {
    target = hash === '#top' ? 0 : document.querySelector(hash);
  } catch {
    return;
  }
  if (target == null) return;
  const navH = document.getElementById('nav')?.offsetHeight || 64;
  if (!lenis) {
    // Where the top bar ends on screen (it sits below the announcement strip when there is one).
    const under = Math.round(document.getElementById('nav')?.getBoundingClientRect().bottom || navH);
    const top = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY - (under - 1);
    const smooth = !reduceMotion();
    clearTimeout(verifyTimer);
    nativeBusy = smooth;
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    if (!smooth) return;
    // While the page travels, layout work waits (whenScrollIdle): it would stop the scroll half way down.
    // Once the page has stopped moving, check where it landed. Sections above the target grow as they
    // are built on the way, so finish the job (twice at most).
    let last = -1;
    let still = 0;
    let waited = 0;
    const tick = () => {
      waited += 100;
      still = window.scrollY === last ? still + 1 : 0;
      last = window.scrollY;
      if (still < 2 && waited < 4000) {
        verifyTimer = setTimeout(tick, 100);
        return;
      }
      nativeBusy = false;
      if (target === 0 || attempt >= 2) return;
      const atBottom = Math.abs(window.scrollY - (document.documentElement.scrollHeight - window.innerHeight)) < 2;
      if (!atBottom && Math.abs(target.getBoundingClientRect().top - under) > 6) scrollToHash(hash, attempt + 1);
    };
    verifyTimer = setTimeout(tick, 100);
    return;
  }
  // Lazily initialised sections can interrupt a long smooth scroll, so check where we landed and finish the job.
  const verify = () => {
    clearTimeout(verifyTimer);
    if (target === 0 || attempt >= 2) return;
    if (lenis.isScrolling) {
      verifyTimer = setTimeout(verify, 300);
      return;
    }
    const atBottom = Math.abs(window.scrollY - (document.documentElement.scrollHeight - window.innerHeight)) < 2;
    if (!atBottom && Math.abs(target.getBoundingClientRect().top - navH) > 6) scrollToHash(hash, attempt + 1);
  };
  clearTimeout(verifyTimer);
  // Lenis already honours the page's scroll-padding-top (the nav height).
  lenis.scrollTo(target, { onComplete: verify });
  verifyTimer = setTimeout(verify, 2500);
}

/** Runs fn once no smooth scroll is in progress (layout recalculation would cancel it). */
export function whenScrollIdle(fn) {
  if (!nativeBusy && (!lenis || !lenis.isScrolling)) {
    fn();
    return;
  }
  setTimeout(() => whenScrollIdle(fn), 200);
}

/** Instant jump (no smooth animation), used when switching between the landing page and a product page. */
export function jumpTo(y) {
  if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
  else window.scrollTo(0, y);
}

export function closeAllDialogs() {
  for (const d of document.querySelectorAll('dialog[open]')) {
    d.classList.remove('is-closing');
    d.close();
  }
  document.documentElement.classList.remove('modal-open');
  lenis?.start();
}

const anyOpen = () => !!document.querySelector('dialog[open]');

export function openDialog(d) {
  if (d.open) return;
  d.classList.remove('is-closing');
  d.showModal();
  document.documentElement.classList.add('modal-open');
  lenis?.stop();
}

export function closeDialog(d) {
  if (!d.open || d.classList.contains('is-closing')) return;
  d.classList.add('is-closing');
  setTimeout(() => {
    d.close();
    d.classList.remove('is-closing');
    if (!anyOpen()) {
      document.documentElement.classList.remove('modal-open');
      lenis?.start();
    }
  }, reduceMotion() ? 0 : 220);
}

export function setupDialogs() {
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDialog(d);
    });
    d.addEventListener('click', (e) => {
      if (e.target === d) closeDialog(d);
      if (e.target.closest('[data-close]')) closeDialog(d);
    });
  }
}
