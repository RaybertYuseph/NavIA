import { describe, expect, it } from 'vitest';
import { distanceM } from '@/lib/geo';

describe('distanceM', () => {
  it('mide el rango de 50 m para marcar la parada', () => {
    const stop = { lat: 10.5, lng: -66.9 };
    expect(distanceM(stop, { lat: 10.5003, lng: -66.9 })).toBeLessThan(50); // ~33 m
    expect(distanceM(stop, { lat: 10.501, lng: -66.9 })).toBeGreaterThan(50); // ~111 m
  });
});
