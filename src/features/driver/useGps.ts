'use client';
import { useEffect, useRef, useState } from 'react';
import { enqueue } from '@/lib/offline/sync';

const PING_EVERY_MS = 20_000;

export type GpsState = 'off' | 'waiting' | 'ok' | 'denied' | 'unavailable';

/** Envía la ubicación cada ~20 s a la cola offline mientras la salida está activa (E3-H2). */
export function useGps(tripId: string, active: boolean) {
  const [state, setState] = useState<GpsState>('off');
  const lastSent = useRef(0);

  useEffect(() => {
    if (!active) {
      setState('off');
      return;
    }
    if (!('geolocation' in navigator)) {
      setState('unavailable');
      return;
    }
    setState('waiting');
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setState('ok');
        if (pos.timestamp - lastSent.current < PING_EVERY_MS) return;
        lastSent.current = pos.timestamp;
        void enqueue({
          kind: 'ping',
          id: crypto.randomUUID(),
          trip_id: tripId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed_kmh: pos.coords.speed == null ? null : Math.round(pos.coords.speed * 3.6),
          recorded_at: new Date(pos.timestamp).toISOString(),
        });
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [tripId, active]);

  return state;
}
