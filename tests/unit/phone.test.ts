import { describe, expect, it } from 'vitest';
import { normalizeVePhone } from '@/lib/phone';

describe('normalizeVePhone', () => {
  it.each([
    ['0414-123.45.67', '584141234567'],
    ['414 1234567', '584141234567'],
    ['+58 412 1234567', '584121234567'],
    ['04241234567', '584241234567'],
  ])('%s → %s', (input, out) => expect(normalizeVePhone(input)).toBe(out));

  it.each(['0212-1234567', '12345', '0414-12345'])('rechaza %s', (input) =>
    expect(normalizeVePhone(input)).toBeNull());
});
