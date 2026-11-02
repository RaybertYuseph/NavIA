import { describe, expect, it } from 'vitest';
import { normalizeCedula, normalizeEmail, normalizePhone } from '@/lib/email';

describe('normalizeEmail', () => {
  it('quita espacios y mayúsculas', () => expect(normalizeEmail('  Ana.Perez@USM.edu.ve ')).toBe('ana.perez@usm.edu.ve'));
  it.each(['ana', 'ana@', 'ana@usm', 'ana @usm.edu', ''])('rechaza "%s"', (input) =>
    expect(normalizeEmail(input)).toBeNull());
});

describe('normalizeCedula', () => {
  it.each([
    ['27123456', '27123456'],
    ['V-27.123.456', '27123456'],
    [' v 9.876.543 ', '9876543'],
    ['E-81234567', '81234567'],
  ])('"%s" → %s', (input, out) => expect(normalizeCedula(input)).toBe(out));
  it.each(['', '123', 'abc', '27123456789'])('rechaza "%s"', (input) => expect(normalizeCedula(input)).toBeNull());
});

describe('normalizePhone', () => {
  it.each([
    ['0414 1234567', '04141234567'],
    ['0412-123-45-67', '04121234567'],
    ['+58 424 1234567', '04241234567'],
    ['584161234567', '04161234567'],
  ])('"%s" → %s', (input, out) => expect(normalizePhone(input)).toBe(out));
  it.each(['', '1234567', '4141234567', '0414123'])('rechaza "%s"', (input) => expect(normalizePhone(input)).toBeNull());
});
