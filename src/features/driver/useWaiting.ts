'use client';
import { useEffect, useRef, useState } from 'react';

const POLL_MS = 10_000;

/** Estudiantes en espera por parada de la salida, consultado cada 10 s mientras haya señal. */
/** onGone: la salida ya no existe (el fiscal reinició la demo). */
export function useWaiting(tripId: string, initial: Record<string, number>, enabled: boolean, onGone?: () => void) {
  const [waiting, setWaiting] = useState(initial ?? {});
  const gone = useRef(onGone);
  useEffect(() => {
    gone.current = onGone;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      if (!navigator.onLine) return;
      try {
        const res = await fetch(`/api/salida/espera?trip=${tripId}`, { cache: 'no-store' });
        if (res.status === 404 && !cancelled) {
          cancelled = true;
          gone.current?.();
          return;
        }
        if (res.ok && !cancelled) setWaiting((await res.json()).waiting);
      } catch {
        // Sin señal: se mantiene el último conteo.
      }
    };
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tripId, enabled]);

  return waiting;
}
