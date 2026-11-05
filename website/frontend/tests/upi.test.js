import { describe, it, expect } from 'vitest';
import { upiQuery, upiUrl } from '../src/ui/checkout.js';
import { PAYMENTS } from '../src/data/site.js';

describe('UPI QR code link formatting (RFC 3986)', () => {
  it('formats query string with clean @ in VPA and %20 in spaces', () => {
    const q = upiQuery(1250, 'PRN-261102-TEST');
    expect(q).toContain(`pa=${PAYMENTS.upi.id}`);
    expect(q).not.toContain('%40'); // unescaped clean @
    expect(q).toContain('am=1250.00');
    expect(q).toContain('cu=INR');
    expect(q).toContain('tn=Parineeta%20order%20PRN-261102-TEST');
    expect(q).not.toContain('+'); // RFC 3986 uses %20, never +
  });

  it('generates correct UPI URI for QR code scanner', () => {
    const amount = 500;
    const ref = 'PRN-REF1';

    const url = upiUrl(amount, ref);
    expect(url).toMatch(/^upi:\/\/pay\?pa=/);
    expect(url).toContain('am=500.00');
    expect(url).toContain('cu=INR');
    expect(url).toContain('tn=Parineeta%20order%20PRN-REF1');
  });
});
