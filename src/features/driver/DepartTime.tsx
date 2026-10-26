'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Trip } from '@/features/trips/types';
import { caracasNowHHMM, caracasTodayAt, formatHour } from '@/lib/time';

/** "14:07" de hoy, con la forma que muestra la app ("2:07 p. m."). */
export const showHHMM = (hhmm: string) => formatHour(caracasTodayAt(hhmm));

/**
 * Hora de salida que escribe el conductor (hora y minuto de hoy), con el atajo "Ahora". Esa hora
 * es la que ve el estudiante.
 */
export function DepartTimePicker({ value, onChange, disabled }: { value: string; onChange: (hhmm: string) => void; disabled?: boolean }) {
  const now = caracasNowHHMM();
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-600">Hora de salida</span>
      <span className="mt-1.5 flex items-center gap-2">
        <input
          type="time"
          required
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-4 py-3 text-2xl font-extrabold tracking-tight text-ink ring-1 ring-slate-200 focus:bg-white focus:ring-2 focus:ring-brand-400 focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled}
          aria-pressed={value === now}
          onClick={() => onChange(caracasNowHHMM())}
          className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-95 disabled:opacity-60 ${
            value === now ? 'bg-ink text-white shadow-lg shadow-ink/20' : 'bg-white text-slate-700 ring-1 ring-slate-200'
          }`}
        >
          Ahora
        </button>
      </span>
    </label>
  );
}

/** Activa (o corrige la hora de) la salida del conductor en la parada de salida. */
export async function postAtStop(vehicleId: string, routeId: string, hhmm: string) {
  const res = await fetch('/api/unidad/en-parada', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ vehicle_id: vehicleId, route_id: routeId, depart_at: caracasTodayAt(hhmm) }),
  }).catch(() => null);
  if (res?.ok) return null;
  if (!res) return 'Sin señal: prueba cuando vuelva la conexión.';
  if (res.status === 501) return 'Falta aplicar la migración 0008 en Supabase.';
  const { hint } = (await res.json().catch(() => ({}))) as { hint?: string };
  if (hint === 'hora_ocupada') return 'No se pudo cambiar la hora: ya sale otra unidad de esta ruta a esa hora. Elige otra.';
  if (hint === 'hora_invalida') return 'Escribe una hora de hoy que no haya pasado.';
  if (res.status === 409) return 'El fiscal marcó esta unidad fuera de servicio. Elige otra o avísale.';
  return 'No se pudo guardar. Prueba otra vez.';
}

/** Con la salida confirmada y sin arrancar, el conductor puede escribir otra hora de salida. */
export function ChangeDepartTime({ trip }: { trip: Trip }) {
  const router = useRouter();
  const [hhmm, setHhmm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!trip.vehicle_id) return null;

  async function save() {
    if (!hhmm) return;
    setBusy(true);
    setError(null);
    const e = await postAtStop(trip.vehicle_id!, trip.route_id, hhmm);
    setBusy(false);
    if (e) return setError(e);
    setHhmm(null);
    router.refresh();
  }

  if (hhmm === null)
    return (
      <button type="button" onClick={() => setHhmm(new Date(trip.scheduled_at) > new Date() ? toHHMM(trip.scheduled_at) : caracasNowHHMM())} className="mt-3 text-sm font-semibold text-brand-700">
        Cambiar hora de salida
      </button>
    );
  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <DepartTimePicker value={hhmm} onChange={setHhmm} disabled={busy} />
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy || !hhmm} onClick={() => void save()} className="btn-primary flex-1 py-2.5">
          {busy ? 'Guardando…' : hhmm ? `Salgo a las ${showHHMM(hhmm)}` : 'Escribe la hora'}
        </button>
        <button type="button" disabled={busy} onClick={() => setHhmm(null)} className="btn-ghost py-2.5">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** "14:07" en Caracas de una hora ISO. */
function toHHMM(iso: string) {
  return caracasNowHHMM(new Date(iso));
}
