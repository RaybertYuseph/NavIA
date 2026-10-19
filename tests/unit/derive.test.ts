import { describe, expect, it } from 'vitest';
import { groupByRoute, nextDeparture, pendingStops, stopsForMap } from '@/features/trips/derive';
import type { Trip } from '@/features/trips/types';

const stops = [1, 2, 3].map((seq) => ({ id: `s${seq}`, seq, name: `P${seq}`, lat: seq, lng: seq }));
const trip = (id: string, hhmm: string, status: Trip['status'], route = 'r1'): Trip => ({
  id,
  route_id: route,
  vehicle_id: null,
  waiting: {},
  driver_id: null,
  scheduled_at: `2026-10-18T${hhmm}:00-04:00`,
  started_at: null,
  status,
  current_stop_id: null,
  last_lat: null,
  last_lng: null,
  last_seen_at: null,
  routes: { name: route, direction: 'ida', active: true, fare_usd: 1.3, stops },
  vehicles: null,
});

describe('nextDeparture', () => {
  const now = new Date('2026-10-18T07:05:00-04:00').getTime();
  it('salta las que ya salieron y las que pasaron hace más de 10 min', () => {
    const trips = [trip('a', '06:00', 'scheduled'), trip('b', '07:00', 'finalizada'), trip('c', '07:00', 'scheduled'), trip('d', '07:30', 'scheduled')];
    expect(nextDeparture(trips, now)?.id).toBe('c');
  });
  it('null si no queda ninguna', () => expect(nextDeparture([trip('a', '06:00', 'scheduled')], now)).toBeNull());
  it('en la demo, pasada la última, muestra la primera programada', () => {
    const trips = [trip('a', '06:00', 'finalizada'), trip('b', '06:10', 'scheduled')];
    expect(nextDeparture(trips, now, true)?.id).toBe('b');
  });
});

describe('stopsForMap', () => {
  it('marca como hechas las paradas hasta la actual', () => {
    const t = { ...trip('a', '06:00', 'en_parada'), current_stop_id: 's2' };
    expect(stopsForMap(t).map((s) => s.done)).toEqual([true, true, false]);
  });
});

describe('groupByRoute', () => {
  it('agrupa en orden de aparición', () => {
    const g = groupByRoute([trip('a', '06:00', 'scheduled', 'r1'), trip('b', '06:10', 'scheduled', 'r2'), trip('c', '07:00', 'scheduled', 'r1')]);
    expect(g.map((x) => x.trips.map((t) => t.id))).toEqual([['a', 'c'], ['b']]);
  });
});

describe('pendingStops', () => {
  it('todas antes de salir; luego solo las que faltan', () => {
    expect(pendingStops(trip('a', '06:00', 'scheduled')).map((s) => s.seq)).toEqual([1, 2, 3]);
    expect(pendingStops({ ...trip('a', '06:00', 'en_parada'), current_stop_id: 's2' }).map((s) => s.seq)).toEqual([3]);
    expect(pendingStops(trip('a', '06:00', 'finalizada'))).toEqual([]);
  });
});
