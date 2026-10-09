// Phase 4: the phone number a customer types for "Notify me" (the database checks it again).
import { describe, it, expect } from 'vitest';
import { cleanPhone } from '../src/data/rpc.js';

describe('Notify me phone numbers', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['+91 98765 43210', '9876543210'],
    ['098765-43210', '9876543210'],
  ])('"%s" becomes %s', (typed, clean) => expect(cleanPhone(typed)).toBe(clean));
  it.each(['12345', '5876543210', '', 'abcdefghij'])('"%s" is refused', (typed) => expect(cleanPhone(typed)).toBe(''));
});
