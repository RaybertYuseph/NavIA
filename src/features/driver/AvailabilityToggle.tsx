'use client';
import { useState } from 'react';
import type { Vehicle } from '@/features/trips/types';
import { VehiclePhoto } from '@/features/vehicles/VehiclePhoto';

/** El conductor marca su unidad como disponible para salir (la ve el fiscal al instante). */
export function AvailabilityToggle({ vehicle }: { vehicle: Vehicle }) {
  const [available, setAvailable] = useState(vehicle.available);
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
      .then((r) => r.ok)
      .catch(() => false);
    setBusy(false);
    if (!ok) return setError(navigator.onLine ? 'No se pudo cambiar. Prueba otra vez.' : 'Sin señal: prueba cuando vuelva la conexión.');
    setAvailable(next);
    navigator.vibrate?.(60);
  }

  return (
    <section data-tour="unidad" className="card flex items-center gap-3 rounded-3xl p-3">
      <VehiclePhoto vehicle={vehicle} size="sm" />
      <div className="flex-1">
        <p className="text-sm text-slate-500">Tu unidad</p>
        <p className={`font-bold ${available ? 'text-emerald-700' : 'text-slate-600'}`}>
          {available ? 'Disponible para salir' : 'No disponible'}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
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
    </section>
  );
}
