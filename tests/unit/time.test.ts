import { describe, expect, it } from 'vitest';
import { caracasDayRange, timeAgo } from '@/lib/time';

describe('caracasDayRange', () => {
  it('a las 22:00 de Caracas (02:00 UTC del día siguiente) sigue siendo el mismo día', () => {
    const r = caracasDayRange(new Date('2026-10-19T02:00:00Z'));
    expect(r).toEqual({ from: '2026-10-18T04:00:00.000Z', to: '2026-10-19T04:00:00.000Z' });
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-10-18T12:00:00Z').getTime();
  it('sin dato', () => expect(timeAgo(null, now)).toBe('sin datos aún'));
  it('reciente', () => expect(timeAgo('2026-10-18T11:59:40Z', now)).toBe('hace instantes'));
  it('minutos', () => expect(timeAgo('2026-10-18T11:55:00Z', now)).toBe('hace 5 min'));
  it('horas', () => expect(timeAgo('2026-10-18T10:30:00Z', now)).toBe('hace 1 h 30 min'));
});
