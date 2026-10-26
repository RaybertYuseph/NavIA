import { describe, expect, it } from 'vitest';
import { caracasDayRange, caracasTodayAt, nextHalfHours, timeAgo } from '@/lib/time';

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

describe('salidas nuevas', () => {
  // 18:40 UTC = 14:40 en Caracas.
  const now = new Date('2026-10-26T18:40:00Z');
  it('arma la hora de hoy en Caracas', () => {
    expect(caracasTodayAt('15:30', now)).toBe('2026-10-26T15:30:00-04:00');
    // 02:00 UTC del 27 sigue siendo el 26 en Caracas.
    expect(caracasTodayAt('23:00', new Date('2026-10-27T02:00:00Z'))).toBe('2026-10-26T23:00:00-04:00');
  });
  it('propone las próximas medias horas sin pasar de medianoche', () => {
    expect(nextHalfHours(3, now)).toEqual(['15:00', '15:30', '16:00']);
    expect(nextHalfHours(3, new Date('2026-10-27T03:10:00Z'))).toEqual(['23:30']);
  });
});
