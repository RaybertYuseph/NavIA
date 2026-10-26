'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { currentStop, type Trip, type Vehicle } from '@/features/trips/types';
import { VehiclePhoto } from '@/features/vehicles/VehiclePhoto';

/**
 * El conductor marca su unidad como disponible para salir (la ve el fiscal al instante). Con la
 * salida en curso no hay interruptor: la unidad está en servicio hasta terminar la ruta (0009).
 */
export function AvailabilityToggle({ vehicle, trip }: { vehicle: Vehicle; trip: Trip }) {
  const router = useRouter();
  const [available, setAvailable] = useState(vehicle.available);
  const live = trip.status === 'en_parada' || trip.status === 'en_camino';
  // La base de datos la deja disponible al llegar a la salida y no disponible al terminar.
  useEffect(() => {
    if (live) setAvailable(true);
    else if (trip.status === 'finalizada') setAvailable(false);
  }, [live, trip.status]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !available;
    setBusy(true);
    setError(null);
    // Por la API propia: así el bundle del conductor no carga el cliente de Supabase.
    const ok = await fetch('/api/unidad/disponible', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vehicle_id: vehicle.id, available: next }),
    })
      .then(async (r) => r.ok || ((await r.json().catch(() => ({}))) as { hint?: string }).hint || false)
      .catch(() => false);
    setBusy(false);
    if (ok !== true) {
      if (!navigator.onLine) return setError('Sin señal: prueba cuando vuelva la conexión.');
      if (ok === 'fuera_de_servicio') return setError('El fiscal marcó esta unidad fuera de servicio.');
      if (ok === 'en_ruta') return setError('Tu unidad tiene una salida en curso: termina la ruta primero.');
      return setError('No se pudo cambiar. Prueba otra vez.');
    }
    setAvailable(next);
    navigator.vibrate?.(60);
    // Al dejar de estar disponible, la salida que no arrancó vuelve a pendiente (0008).
    if (!next) router.refresh();
  }

  return (
    <section data-tour="unidad" className="card flex items-center gap-3 rounded-3xl p-3">
      <VehiclePhoto vehicle={vehicle} size="sm" />
      <div className="flex-1">
        <p className="text-sm text-slate-500">Tu unidad</p>
        {live ? (
          <p className="font-bold text-emerald-700">
            En servicio · {trip.status === 'en_parada' ? `Cargando en ${currentStop(trip)?.name ?? 'la parada'}` : 'En camino'}
          </p>
        ) : (
          <p className={`font-bold ${available ? 'text-emerald-700' : 'text-slate-600'}`}>{available ? 'Disponible para salir' : 'No disponible'}</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      {!live && (
      <button
        type="button"
        role="switch"
        aria-checked={available}
        aria-label="Unidad disponible"
        disabled={busy}
        onClick={toggle}
        className={`relative h-9 w-16 shrink-0 rounded-full transition-colors disabled:opacity-50 ${available ? 'bg-emerald-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${available ? 'left-8' : 'left-1'}`} />
      </button>
      )}
    </section>
  );
}
