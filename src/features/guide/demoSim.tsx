'use client';
import { useEffect } from 'react';

export const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';
const TICK_MS = 15_000;

/** Crea las salidas de ejemplo de hoy (si aún no hay). Devuelve cuántas creó, o null si falló. */
export async function startDemoSimulation(): Promise<number | null> {
  try {
    const r = await fetch('/api/demo/simular', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start' }),
    });
    if (!r.ok) return null;
    return ((await r.json()) as { created: number | null }).created ?? 0;
  } catch {
    return null;
  }
}

/** En la demo, mueve las salidas simuladas mientras la pantalla está a la vista. */
export function DemoTicker() {
  useEffect(() => {
    if (!DEMO) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      void fetch('/api/demo/simular', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'tick' }),
      }).catch(() => undefined);
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}
