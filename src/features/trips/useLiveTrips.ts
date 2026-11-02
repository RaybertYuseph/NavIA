'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { liveDelay, startPolling } from '@/lib/polling';
import { subscribeWithSession } from '@/lib/supabase/realtime';
import { fetchTodayTrips } from './query';
import type { Trip, Vehicle } from './types';

/**
 * Salidas de hoy en vivo (E5-H1): Supabase Realtime empuja cada cambio de trips y vehicles
 * y, si el WebSocket cae con la red, se vuelve a consultar cada 10 s. Con Realtime conectado se consulta
 * cada 60 s solo como respaldo de un evento perdido, y nunca con la app minimizada.
 */
export function useLiveTrips(initial: Trip[]) {
  const [trips, setTrips] = useState(initial);
  // Datos nuevos del servidor (router.refresh, por ejemplo tras simular la demo): se adoptan sin esperar al Realtime.
  useEffect(() => setTrips(initial), [initial]);
  const current = useRef(trips);
  current.current = trips;
  const [now, setNow] = useState(() => Date.now());
  const [online, setOnline] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setTrips(await fetchTodayTrips(createClient()));
    } catch {
      // Sin señal: se mantiene lo último que se vio.
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let live = false;
    let connectedOnce = false;
    const unsubscribe = subscribeWithSession(supabase, () =>
      supabase
        .channel('navia-live')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' }, (p: RealtimePostgresChangesPayload<Trip>) => {
          const row = p.new as Partial<Trip> & { id: string };
          // Se le asignó (o quitó) unidad: hace falta la foto y la placa de la nueva.
          const before = current.current.find((t) => t.id === row.id);
          if (before && 'vehicle_id' in row && row.vehicle_id !== before.vehicle_id) void refetch();
          setTrips((prev) =>
            prev.map((t) => (t.id === row.id ? { ...t, ...row, routes: t.routes, vehicles: t.vehicles } : t)),
          );
        })
        // Una salida nueva (el fiscal la creó o un conductor se activó sin pendientes).
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trips' }, () => void refetch())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicles' }, (p: RealtimePostgresChangesPayload<Vehicle>) => {
          const v = p.new as Vehicle;
          setTrips((prev) => prev.map((t) => (t.vehicle_id === v.id ? { ...t, vehicles: { ...t.vehicles, ...v } } : t)));
        }),
      (connected) => {
        // Al reconectar (no en la primera conexión) pudo perderse algo mientras estuvo caído.
        if (connected && !live && connectedOnce) void refetch();
        if (connected) connectedOnce = true;
        live = connected;
      },
    );

    const stopPolling = startPolling(refetch, () => liveDelay(live));
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    // Al volver la señal, startPolling ya consulta de inmediato.
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      unsubscribe();
      stopPolling();
      clearInterval(tick);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refetch]);

  return { trips, now, online, refetch };
}
