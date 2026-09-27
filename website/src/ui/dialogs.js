import { reduceMotion } from './dom.js';

let lenis = null;
export const setLenis = (l) => {
  lenis = l;
};

let verifyTimer = 0;

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
    const top = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY - (navH - 1);
    window.scrollTo({ top, behavior: reduceMotion() ? 'auto' : 'smooth' });
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
  if (!lenis || !lenis.isScrolling) {
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
