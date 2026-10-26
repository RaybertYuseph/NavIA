'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Trip } from '@/features/trips/types';
import { formatHour } from '@/lib/time';

export const DEPART_OPTIONS = [0, 10, 20, 30] as const;

/** Hora de salida que resulta de "Salgo en N min" (al minuto, como la guarda la BD). */
export function departAt(minutes: number, now = Date.now()) {
  return new Date(Math.floor(now / 60_000) * 60_000 + minutes * 60_000).toISOString();
}

/** Fichas "Salgo: Ahora · 10 · 20 · 30 min" con la hora que resulta. */
export function DepartTimePicker({ value, onChange, disabled }: { value: number; onChange: (m: number) => void; disabled?: boolean }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-600">¿Cuándo sales?</legend>
      <div className="mt-1.5 grid grid-cols-4 gap-2">
        {DEPART_OPTIONS.map((m) => {
          const active = m === value;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange(m)}
              className={`rounded-2xl px-1 py-2 text-center transition active:scale-95 disabled:opacity-60 ${
                active ? 'bg-ink text-white shadow-lg shadow-ink/20' : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200'
              }`}
            >
              <span className="block text-sm font-extrabold">{m === 0 ? 'Ahora' : `${m} min`}</span>
              <span className={`block text-[11px] ${active ? 'text-white/75' : 'text-slate-500'}`}>{formatHour(departAt(m))}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Activa (o corrige la hora de) la salida del conductor en la parada de salida. */
export async function postAtStop(vehicleId: string, routeId: string, departIn: number) {
  const res = await fetch('/api/unidad/en-parada', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ vehicle_id: vehicleId, route_id: routeId, depart_in: departIn }),
  }).catch(() => null);
  if (res?.ok) return null;
  if (!res) return 'Sin señal: prueba cuando vuelva la conexión.';
  if (res.status === 501) return 'Falta aplicar la migración 0008 en Supabase.';
  if (res.status === 409) {
    const { hint } = (await res.json().catch(() => ({}))) as { hint?: string };
    if (hint === 'hora_ocupada') return 'No se pudo cambiar la hora: ya sale otra unidad de esta ruta a esa hora. Elige otra.';
    return 'El fiscal marcó esta unidad fuera de servicio. Elige otra o avísale.';
  }
  return 'No se pudo guardar. Prueba otra vez.';
}

/** Con la salida confirmada y sin arrancar, el conductor puede cambiar la hora a la que sale. */
export function ChangeDepartTime({ trip }: { trip: Trip }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!trip.vehicle_id) return null;

  async function choose(m: number) {
    setBusy(true);
    setError(null);
    const e = await postAtStop(trip.vehicle_id!, trip.route_id, m);
    setBusy(false);
    if (e) return setError(e);
    setOpen(false);
    router.refresh();
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm font-semibold text-brand-700">
        Cambiar hora de salida
      </button>
    );
  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <DepartTimePicker value={-1} onChange={(m) => void choose(m)} disabled={busy} />
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
