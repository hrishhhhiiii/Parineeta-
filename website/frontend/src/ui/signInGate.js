// Browsing is open to everyone. Adding to the cart, Buy now, the wishlist and checkout need a signed-in
// customer, so the first of those taps on a guest's browser shows a short prompt instead. Signing in
// brings the person back to the page they were on (login.js reads the saved address).
import { h, icon } from './dom.js';
import { openDialog, closeDialog } from './dialogs.js';

// Clerk sets this cookie while someone is signed in. Reading it avoids loading Clerk on every page.
const SIGNED_IN = /(?:^|;\s*)__client_uat(?:_[\w-]+)?=[1-9]/;
export const NEXT_KEY = 'parineeta:next';

/** True when this browser has a signed-in person. With no sign-in set up (local development without
 *  Clerk keys) the gate stays open, so the shop can still be tried. */
export const signedIn = () => !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || SIGNED_IN.test(document.cookie);

let dlg = null;
let line = null;

function dialog() {
  if (dlg) return dlg;
  line = h('p', { class: 'muted', id: 'gate-line' });
  dlg = h('dialog', { class: 'sheet sheet--modal', 'aria-labelledby': 'gate-title', 'data-lenis-prevent': '' },
    h('div', { class: 'modal' },
      h('div', { class: 'drawer__head' },
        h('h2', { class: 'drawer__title', id: 'gate-title', text: 'Sign in to continue' }),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => closeDialog(dlg) }, icon('x'))),
      h('div', { class: 'drawer__body' },
        line,
        h('p', { class: 'field__help', text: 'Browsing stays open to everyone. An account keeps your cart and wishlist with you on every device.' }),
        h('div', { class: 'gate__actions' },
          h('button', { type: 'button', class: 'btn btn--gold btn--wide', onclick: goToSignIn }, 'Sign in or create an account'),
          h('button', { type: 'button', class: 'btn btn--ghost btn--wide', onclick: () => closeDialog(dlg) }, 'Not now')))));
  document.body.append(dlg);
  return dlg;
}

function goToSignIn() {
  try { sessionStorage.setItem(NEXT_KEY, location.pathname + location.search + location.hash); } catch { /* storage blocked: they land on the account page */ }
  location.href = '/login.html';
}

/**
 * Call before any action that needs an account. Returns true when the person is signed in and the
 * action may go ahead; otherwise shows the prompt and returns false.
 * @param {string} what  Short phrase that completes "Sign in to …", e.g. "add pieces to your cart".
 */
export function requireSignIn(what) {
  if (signedIn()) return true;
  const d = dialog();
  line.textContent = `Sign in to ${what}.`;
  openDialog(d);
  return false;
}
