import { describe, expect, it } from 'vitest';
import { normalizeEmail } from '@/lib/email';

describe('normalizeEmail', () => {
  it('quita espacios y mayúsculas', () => expect(normalizeEmail('  Ana.Perez@USM.edu.ve ')).toBe('ana.perez@usm.edu.ve'));
  it.each(['ana', 'ana@', 'ana@usm', 'ana @usm.edu', ''])('rechaza "%s"', (input) =>
    expect(normalizeEmail(input)).toBeNull());
});
