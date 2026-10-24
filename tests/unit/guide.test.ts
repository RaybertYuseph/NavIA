import { describe, expect, it } from 'vitest';
import { primaryAction } from '@/features/driver/state';
import { fareInfo, mostWaiting, staleUnits, waitingAhead, whereIsBus } from '@/features/guide/answers';
import { TOURS } from '@/features/guide/tours';
import type { Trip } from '@/features/trips/types';

const stops = [1, 2, 3].map((seq) => ({ id: `s${seq}`, seq, name: `P${seq}`, lat: seq, lng: seq }));
const trip = (id: string, status: Trip['status'], extra: Partial<Trip> = {}): Trip => ({
  id,
  route_id: 'r1',
  vehicle_id: null,
  waiting: {},
  driver_id: null,
  scheduled_at: '2026-10-18T07:00:00-04:00',
  started_at: null,
  status,
  current_stop_id: null,
  last_lat: null,
  last_lng: null,
  last_seen_at: null,
  routes: { name: 'Guarenas–USM', direction: 'ida', active: true, fare_usd: 1.3, stops },
  vehicles: { id: 'v1', plate: 'AB123CD', capacity: 30, photo_url: null, available: true },
  ...extra,
});
const now = new Date('2026-10-18T07:20:00-04:00').getTime();

describe('botón principal del conductor', () => {
  it('muestra solo el paso que sigue', () => {
    expect(primaryAction({ status: 'scheduled', currentStopId: null }, stops)).toEqual({ type: 'en_camino', stop: null });
    expect(primaryAction({ status: 'en_camino', currentStopId: null }, stops)).toEqual({ type: 'en_parada', stop: stops[0] });
    expect(primaryAction({ status: 'en_parada', currentStopId: 's2' }, stops)).toEqual({ type: 'en_camino', stop: null });
    expect(primaryAction({ status: 'en_parada', currentStopId: 's3' }, stops)).toEqual({ type: 'fin_de_ruta', stop: null });
    expect(primaryAction({ status: 'en_camino', currentStopId: 's3' }, stops)).toEqual({ type: 'fin_de_ruta', stop: null });
    expect(primaryAction({ status: 'finalizada', currentStopId: 's3' }, stops)).toBeNull();
  });
});

describe('respuestas de NavIA', () => {
  it('dice dónde viene la camioneta y ofrece el mapa', () => {
    const t = trip('a', 'en_camino', { current_stop_id: 's1', last_seen_at: new Date(now - 60_000).toISOString() });
    const a = whereIsBus([t], null, now);
    expect(a.text).toContain('AB123CD');
    expect(a.text).toContain('va hacia P2');
    expect(a.tab).toBe('envivo');
  });
  it('sin camionetas en camino, da la próxima salida', () => {
    expect(whereIsBus([], trip('b', 'scheduled'), now).text).toContain('7:00');
  });
  it('pasaje con coma decimal', () => expect(fareInfo([trip('a', 'scheduled')]).text).toContain('1,30 USD'));
  it('cuenta quién espera adelante', () => {
    expect(waitingAhead(stops, { s2: 3, s3: 1 }, 0).text).toBe('P2: 3 · P3: 1.');
    expect(waitingAhead(stops, { s1: 2 }, 0).text).toContain('Nadie');
  });
  it('detecta unidades sin ubicación reciente', () => {
    const fresh = trip('a', 'en_camino', { last_seen_at: new Date(now - 60_000).toISOString() });
    const old = trip('b', 'en_camino', { last_seen_at: new Date(now - 10 * 60_000).toISOString() });
    expect(staleUnits([fresh], now).text).toContain('Todas');
    expect(staleUnits([fresh, old], now).tab).toBe('unidades');
  });
  it('señala la salida con más espera', () => {
    expect(mostWaiting([trip('a', 'scheduled', { waiting: { s1: 2 } }), trip('b', 'scheduled')]).text).toContain('2 esperando');
  });
});

describe('tours', () => {
  it('cada vista termina presentando el botón de NavIA', () => {
    for (const steps of Object.values(TOURS)) expect(steps.at(-1)?.target).toBe('navia-fab');
  });
});
