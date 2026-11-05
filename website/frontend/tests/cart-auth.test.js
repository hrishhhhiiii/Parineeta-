import { describe, it, expect, beforeEach } from 'vitest';

const memStorage = () => {
  let s = {};
  return {
    getItem: (k) => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
    clear: () => { s = {}; },
  };
};

globalThis.localStorage ||= memStorage();
globalThis.sessionStorage ||= memStorage();
globalThis.document ||= { cookie: '' };

import { requireSignIn, restorePendingCart, PENDING_CART_KEY, NEXT_KEY } from '../src/ui/signInGate.js';
import { store } from '../src/ui/store.js';

describe('Sign-in requirement before adding to cart', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    store.clear();
    document.cookie = '';
  });

  it('saves pending cart item and current page URL when unauthenticated', () => {
    globalThis.location = {
      pathname: '/p/gach-kouto/',
      search: '?s=lotus',
      hash: '#details',
      href: '',
    };

    const item = { id: 'gach-kouto', style: 'lotus', qty: 1 };
    const allowed = requireSignIn('add pieces to your cart', item);

    expect(allowed).toBe(false);
    expect(globalThis.location.href).toBe('/login.html');
    expect(localStorage.getItem(PENDING_CART_KEY)).toBe(JSON.stringify(item));
    expect(sessionStorage.getItem(NEXT_KEY)).toBe('/p/gach-kouto/?s=lotus#details');
  });

  it('restores pending item into cart after successful sign-in', () => {
    const item = { id: 'gach-kouto', qty: 2 };
    localStorage.setItem(PENDING_CART_KEY, JSON.stringify(item));

    // Simulate signed-in Clerk cookie
    document.cookie = '__client_uat=123456789; path=/';

    restorePendingCart();

    // Verify item was added to store
    const cart = store.cart;
    expect(cart.some((l) => l.id === 'gach-kouto' && l.qty === 2)).toBe(true);

    // Verify pending cart storage was cleared
    expect(localStorage.getItem(PENDING_CART_KEY)).toBeNull();
  });
});
