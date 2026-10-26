'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { routeKey, type RouteInfo, type Vehicle } from '@/features/trips/types';
import { VehiclePhoto } from '@/features/vehicles/VehiclePhoto';
import { formatHour } from '@/lib/time';
import { DepartTimePicker, departAt, postAtStop } from './DepartTime';

/**
 * Sin salida a su cargo, el conductor se activa en la parada de salida y elige cuándo sale
 * (ahora, 10, 20 o 30 min): esa es la salida que ve el estudiante. Las rutas que ofrece son las
 * del corredor de su unidad (ida y regreso); si la unidad no tiene ruta, todas.
 */
export function AvailableAtStop({ vehicles, routes, myVehicleId }: { vehicles: Vehicle[]; routes: RouteInfo[]; myVehicleId: string | null }) {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState(myVehicleId ?? vehicles.find((v) => v.route_id)?.id ?? vehicles[0]?.id ?? null);
  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const home = routes.find((r) => r.id === vehicle?.route_id);
  const options = home ? routes.filter((r) => routeKey(r) === routeKey(home)) : routes;
  const [routeId, setRouteId] = useState<string | null>(null);
  const route = options.find((r) => r.id === routeId) ?? options.find((r) => r.id === home?.id) ?? options[0] ?? null;
  const stop = route ? [...route.stops].sort((a, b) => a.seq - b.seq)[0] : null;
  const [departIn, setDepartIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    if (!vehicle || !route) return;
    setBusy(true);
    setError(null);
    const e = await postAtStop(vehicle.id, route.id, departIn);
    if (e) {
      setBusy(false);
      return setError(e);
    }
    navigator.vibrate?.(80);
    router.refresh();
  }

  if (!vehicle || !route || !stop) {
    return (
      <div className="card mt-2 flex flex-col items-center gap-2 rounded-3xl p-6 text-center">
        <NaviaAgent size={96} animated />
        <p className="text-lg font-bold">Todavía no tienes unidad ni ruta</p>
        <p className="text-sm text-slate-600">Pídele al fiscal que asigne tu unidad a una ruta.</p>
      </div>
    );
  }

  return (
    <section data-tour="unidad" className="card flex flex-col gap-4 rounded-3xl p-4">
      <div className="flex items-center gap-3">
        <NaviaAgent size={56} animated compact className="shrink-0" />
        <p className="text-sm font-medium text-slate-600">
          ¡Epa! Cuando estés en la parada de salida, dime cuándo sales y se lo muestro a los estudiantes.
        </p>
      </div>

      {vehicles.length > 1 && (
        <fieldset>
          <legend className="text-sm font-semibold text-slate-600">Tu unidad</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === vehicle.id}
                onClick={() => {
                  setVehicleId(v.id);
                  setRouteId(null);
                }}
                className={`shrink-0 rounded-2xl px-3.5 py-2 font-mono text-sm font-bold transition active:scale-95 ${
                  v.id === vehicle.id ? 'bg-ink text-white shadow-lg shadow-ink/20' : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200'
                }`}
              >
                {v.plate}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {options.length > 1 && (
        <fieldset>
          <legend className="text-sm font-semibold text-slate-600">¿Qué ruta vas a hacer?</legend>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {options.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === route.id}
                onClick={() => setRouteId(r.id)}
                className={`rounded-2xl px-3 py-2.5 text-left font-medium transition active:scale-[0.99] ${
                  r.id === route.id ? 'bg-brand-50 font-bold text-ink ring-2 ring-brand-400' : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <DepartTimePicker value={departIn} onChange={setDepartIn} disabled={busy} />

      <div className="flex items-center gap-3">
        <VehiclePhoto vehicle={vehicle} size="sm" />
        <p className="text-sm text-slate-600">
          <span className="block font-semibold text-ink">{route.name}</span>
          Parada de salida: {stop.name}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void activate()}
        className="min-h-24 rounded-[1.75rem] bg-linear-to-br from-emerald-500 to-teal-500 px-5 py-4 text-left text-white shadow-xl shadow-emerald-500/40 transition active:scale-[0.98] disabled:opacity-60"
      >
        <span className="block text-sm font-semibold opacity-90">
          <Icon name="pin" className="mr-1 inline h-4 w-4" />
          {busy ? 'Creando tu salida…' : `Ya estoy en la parada · salgo ${departIn === 0 ? 'ahora' : `a las ${formatHour(departAt(departIn))}`}`}
        </span>
        <span className="block text-2xl leading-tight font-extrabold">Estoy disponible en {stop.name}</span>
      </button>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
