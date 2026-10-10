// Regression: ISSUE-003 — a cart saved in the browser could carry any quantity (999, -5, 2.5), giving
// negative or fractional line totals in the cart, the WhatsApp enquiry and the order.
// Found by /qa on 2026-10-10
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-10.md
import { describe, it, expect } from 'vitest';
import { store, replaceState, cartTotal, MAX } from '../src/ui/store.js';

describe('saved cart quantities', () => {
  it('keeps whole pieces from 1 to the maximum and drops lines below 1', () => {
    replaceState({ cart: [
      { id: 'darpan', qty: 999 },
      { id: 'kunke', qty: -5 },
      { id: 'topor', qty: 2.5 },
      { id: 'paan-pata', qty: 0 },
      { id: 'biyer-piri', qty: 0.4 },
    ], wish: [] });
    const qty = Object.fromEntries(store.cart.map((l) => [l.id, l.qty]));
    expect(qty).toEqual({ darpan: MAX, topor: 2 });
  });

  it('a price saved with a line is ignored; the total comes from the catalogue', () => {
    replaceState({ cart: [{ id: 'darpan', qty: 1, price: 1, total: 1 }], wish: [] });
    expect(cartTotal(store.cart)).toBeGreaterThan(1);
    expect(cartTotal(store.cart)).toBeGreaterThanOrEqual(0);
  });

  it('a damaged quantity (text, missing) still drops the line', () => {
    replaceState({ cart: [{ id: 'darpan', qty: 'lots' }, { id: 'kunke' }], wish: [] });
    expect(store.cart).toEqual([]);
  });
});
