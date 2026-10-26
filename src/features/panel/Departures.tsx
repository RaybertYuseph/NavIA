'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { caracasTodayAt, formatHour, nextHalfHours } from '@/lib/time';
import type { RouteInfo, Trip, Vehicle } from '@/features/trips/types';

/**
 * Por ruta, quién está en la parada de salida: las unidades disponibles en orden de llegada (la
 * primera toma la próxima salida) y las salidas que el fiscal programó y todavía esperan unidad.
 */
export function StartQueue(props: { routes: RouteInfo[]; trips: Trip[]; vehicles: Vehicle[]; drivers: Record<string, string>; onNew: () => void }) {
  const rows = props.routes
    .filter((r) => !r.coming_soon)
    .map((r) => ({
      route: r,
      units: props.vehicles
        .filter((v) => v.available && v.available_route_id === r.id)
        .sort((a, b) => (a.available_at ?? '').localeCompare(b.available_at ?? '')),
      pending: props.trips.filter((t) => t.route_id === r.id && t.status === 'scheduled' && !t.vehicle_id),
    }))
    .filter((x) => x.units.length || x.pending.length);

  return (
    <section aria-labelledby="cola">
      <div className="flex items-end justify-between gap-2">
        <h2 id="cola" className="section-title">En la parada de salida</h2>
        <button type="button" onClick={props.onNew} className="chip mb-2 py-1.5 text-sm">
          + Nueva salida
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="card rounded-3xl p-4 text-slate-600">Ninguna unidad esperando salida y nada pendiente de unidad.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ route, units, pending }) => (
            <article key={route.id} className="card rounded-3xl p-4">
              <h3 className="font-semibold">{route.name}</h3>
              <ol className="mt-2 space-y-1.5">
                {units.map((v, i) => {
                  const trip = props.trips.find((t) => t.vehicle_id === v.id && t.status === 'scheduled');
                  return (
                    <li key={v.id} className="flex items-center gap-2 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">{i + 1}</span>
                      <span className="font-mono font-semibold">{v.plate}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-600">{(v.available_driver_id && props.drivers[v.available_driver_id]) || ''}</span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {trip ? `Sale ${formatHour(trip.scheduled_at)}` : v.available_at ? `Desde ${formatHour(v.available_at)}` : ''}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {pending.length > 0 && (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-100">
                  Sin unidad ({pending.map((t) => formatHour(t.scheduled_at)).join(', ')}): la toma el próximo conductor que se active en la parada.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/** Hoja para que el fiscal programe una salida: ruta y hora. Queda "por confirmar unidad". */
export function NewDepartureSheet(props: { routes: RouteInfo[]; onClose: () => void; onCreated: () => void }) {
  const routes = props.routes.filter((r) => !r.coming_soon && r.stops.length > 0);
  const slots = nextHalfHours(6);
  const [routeId, setRouteId] = useState(routes[0]?.id ?? '');
  const [time, setTime] = useState(slots[0] ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function create() {
    setBusy(true);
    setError(null);
    const { error: e } = await createClient().rpc('create_departure', { p_route_id: routeId, p_scheduled_at: caracasTodayAt(time) });
    setBusy(false);
    if (e) {
      if (e.code === 'PGRST202') return setError('Falta aplicar la migración 0008 en Supabase.');
      if (e.code === '23505') return setError('Ya hay una salida de esa ruta a esa hora.');
      return setError('No se pudo crear la salida. Prueba otra vez.');
    }
    props.onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="new-dep-title">
      <button type="button" aria-label="Cerrar" tabIndex={-1} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <section className="sheet-up relative flex max-h-[85dvh] w-full flex-col rounded-t-[2rem] bg-white shadow-2xl sm:max-w-md sm:rounded-[2rem]">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 id="new-dep-title" className="text-lg font-extrabold">
            Nueva salida
          </h2>
          <p className="text-sm text-slate-500">Queda por confirmar hasta que un conductor se active en la parada de salida.</p>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-slate-700">Ruta</legend>
            <div className="space-y-1.5">
              {routes.map((r) => {
                const active = r.id === routeId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRouteId(r.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.99] ${
                      active ? 'bg-brand-50 ring-2 ring-brand-400' : 'bg-slate-50 ring-1 ring-slate-200'
                    }`}
                  >
                    <span className={`flex-1 ${active ? 'font-bold text-ink' : 'font-medium text-slate-700'}`}>{r.name}</span>
                    {active && <span className="text-brand-600">✓</span>}
                  </button>
                );
              })}
              {routes.length === 0 && <p className="text-sm text-slate-500">No hay rutas abiertas para programar.</p>}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-slate-700">Hora de salida</legend>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <button key={s} type="button" aria-pressed={s === time} onClick={() => setTime(s)} className={`rounded-full px-3.5 py-2 text-sm font-semibold transition active:scale-95 ${
                    s === time ? 'bg-ink text-white shadow-lg shadow-ink/20' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200'
                  }`}>
                  {formatHour(caracasTodayAt(s))}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm text-slate-600">
              Otra hora
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-xl bg-slate-50 px-3 py-2 font-semibold text-ink ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-400 focus:outline-none"
              />
            </label>
          </fieldset>
        </div>
        <footer className="space-y-2 border-t border-slate-100 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <button type="button" onClick={() => void create()} disabled={busy || !routeId || !time} className="btn-primary w-full">
            {busy ? 'Creando…' : time ? `Crear salida de las ${formatHour(caracasTodayAt(time))}` : 'Elige una hora'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost w-full">
            Cancelar
          </button>
        </footer>
      </section>
    </div>
  );
}
