'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Tabs } from '@/components/Tabs';
import { fiscalTip, lineStatus, mostWaiting, staleUnits, type LineSummary } from '@/features/guide/answers';
import { useGuide } from '@/features/guide/GuideProvider';
import { NaviaFab } from '@/features/guide/NaviaFab';
import { BusMap } from '@/features/map/BusMap';
import { groupByRoute, waitingByRoute } from '@/features/trips/derive';
import { useLiveTrips } from '@/features/trips/useLiveTrips';
import { STATUS_LABEL, STATUS_STYLE, currentStop, isLive, routeKey, totalWaiting, type RouteInfo, type Trip, type Vehicle } from '@/features/trips/types';
import { VehiclePhoto } from '@/features/vehicles/VehiclePhoto';
import { uploadVehiclePhoto } from '@/features/vehicles/uploadPhoto';
import { createClient } from '@/lib/supabase/client';
import { subscribeWithSession } from '@/lib/supabase/realtime';
import { formatHour, timeAgo } from '@/lib/time';

type UnitState = 'en_ruta' | 'disponible' | 'fuera';

const UNIT_LABEL: Record<UnitState, string> = { en_ruta: 'En ruta', disponible: 'Disponible', fuera: 'Fuera de servicio' };
const UNIT_STYLE: Record<UnitState, string> = {
  en_ruta: 'bg-emerald-100 text-emerald-800',
  disponible: 'bg-sky-100 text-sky-800',
  fuera: 'bg-slate-200 text-slate-600',
};

const CORRIDOR_KEY = 'navia:fiscal:corredor';

/**
 * Vista del fiscal de la línea: unidades, mapa en vivo y salidas de hoy. Las fichas de arriba
 * filtran todo por corredor (ida y regreso de una misma ruta) y se recuerdan en este teléfono.
 */
export function FiscalPanel(props: { initialTrips: Trip[]; initialVehicles: Vehicle[]; routes: RouteInfo[]; drivers: Record<string, string> }) {
  const { trips: allTrips, now, online, refetch } = useLiveTrips(props.initialTrips);
  const [vehicles, setVehicles] = useLiveVehicles(props.initialVehicles);
  const { tab } = useGuide();
  const corridors = useMemo(() => corridorsOf(props.routes), [props.routes]);
  const [corridor, setCorridor] = useCorridor(corridors.map((c) => c.key));
  const routeIds = corridor ? new Set(props.routes.filter((r) => routeKey(r) === corridor).map((r) => r.id)) : null;
  const trips = routeIds ? allTrips.filter((t) => routeIds.has(t.route_id)) : allTrips;
  const routeName = (id: string | null | undefined) => props.routes.find((r) => r.id === id)?.name ?? null;
  const [assigning, setAssigning] = useState<Vehicle | null>(null);

  const units = vehicles
    .map((v) => {
      const trip = allTrips.find((t) => t.vehicle_id === v.id && isLive(t)) ?? null;
      const state: UnitState = trip ? 'en_ruta' : v.available ? 'disponible' : 'fuera';
      return { vehicle: v, trip, state };
    })
    .filter((u) => !routeIds || (u.vehicle.route_id && routeIds.has(u.vehicle.route_id)) || (u.trip && routeIds.has(u.trip.route_id)));
  const mapRoute = corridor ? (props.routes.find((r) => routeKey(r) === corridor && !r.coming_soon) ?? props.routes.find((r) => routeKey(r) === corridor)) : null;
  const comingSoon = !!corridor && props.routes.filter((r) => routeKey(r) === corridor).every((r) => r.coming_soon);
  const counts = {
    en_ruta: units.filter((u) => u.state === 'en_ruta').length,
    disponible: units.filter((u) => u.state === 'disponible').length,
    fuera: units.filter((u) => u.state === 'fuera').length,
  };
  const done = trips.filter((t) => t.status === 'finalizada').length;
  const live = trips.filter((t) => isLive(t) && t.last_lat != null && t.last_lng != null);
  const waiting = trips.reduce((a, t) => a + totalWaiting(t), 0);
  const summary: LineSummary = { enRuta: counts.en_ruta, disponibles: counts.disponible, fuera: counts.fuera, done, total: trips.length, waiting };

  return (
    <div className="flex flex-col gap-5">
      <OfflineBanner online={online} />
      <Tabs
        tabs={[
          { id: 'resumen', label: 'Resumen', icon: 'grid' },
          { id: 'unidades', label: 'Unidades', icon: 'bus', badge: counts.en_ruta },
          { id: 'salidas', label: 'Salidas', icon: 'list' },
        ]}
      />

      {corridors.length > 1 && (
        <nav aria-label="Filtrar por ruta" data-tour="rutas" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ key: null, soon: false }, ...corridors].map((c) => {
            const active = c.key === corridor;
            return (
              <button
                key={c.key ?? 'todas'}
                type="button"
                aria-pressed={active}
                onClick={() => setCorridor(c.key)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition active:scale-95 ${
                  active ? 'bg-ink text-white shadow-lg shadow-ink/20' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200'
                }`}
              >
                {c.key ?? 'Todas las rutas'}
                {c.soon && <span className={`ml-1.5 text-xs font-medium ${active ? 'text-white/70' : 'text-amber-600'}`}>Próximamente</span>}
              </button>
            );
          })}
        </nav>
      )}
      {comingSoon && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
          Esta ruta está por abrir: todavía no tiene salidas. Ya puedes asignarle unidades en la pestaña Unidades.
        </p>
      )}

      {tab === 'resumen' && (
      <>
      <section data-tour="kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="En ruta" value={counts.en_ruta} tone="text-emerald-700" />
        <Kpi label="Disponibles" value={counts.disponible} tone="text-sky-700" />
        <Kpi label="Fuera de servicio" value={counts.fuera} tone="text-slate-600" />
        <Kpi label="Salidas completadas" value={`${done}/${trips.length}`} tone="text-indigo-600" />
        <Kpi label="Estudiantes en espera" value={waiting} tone="text-cyan-600" wide />
      </section>

      <WaitingByStop trips={trips} />

      <section aria-labelledby="mapa" data-tour="mapa">
        <h2 id="mapa" className="section-title">Mapa en vivo</h2>
        {live.length === 0 && !mapRoute ? (
          <p className="card rounded-3xl p-4 text-slate-600">Ninguna unidad está enviando ubicación ahora.</p>
        ) : (
          <BusMap
            key={corridor ?? 'todas'}
            className="h-80"
            stops={mapRoute ? [...mapRoute.stops].sort((a, b) => a.seq - b.seq).map((s, i) => ({ ...s, seq: i + 1 })) : []}
            buses={live.map((t) => ({
              id: t.id,
              lat: t.last_lat!,
              lng: t.last_lng!,
              label: `${t.vehicles?.plate ?? ''} · ${formatHour(t.scheduled_at)}`,
              stale: !t.last_seen_at || now - new Date(t.last_seen_at).getTime() > 5 * 60_000,
            }))}
          />
        )}
      </section>

      <ResetDemo onDone={refetch} />
      </>
      )}

      {tab === 'unidades' && (
      <section aria-labelledby="unidades">
        <h2 id="unidades" className="section-title">Unidades</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {units.map(({ vehicle, trip, state }) => (
            <article key={vehicle.id} className="card flex gap-3 rounded-3xl p-3">
              <PhotoUploader vehicle={vehicle} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-mono font-semibold">{vehicle.plate}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${UNIT_STYLE[state]}`}>{UNIT_LABEL[state]}</span>
                </div>
                <p className="text-sm text-slate-500">{vehicle.capacity} puestos</p>
                {'route_id' in vehicle && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className={`truncate text-sm font-medium ${vehicle.route_id ? 'text-brand-700' : 'text-slate-400'}`}>
                      {routeName(vehicle.route_id) ?? 'Sin ruta asignada'}
                    </span>
                    <button type="button" onClick={() => setAssigning(vehicle)} className="chip py-1 text-xs">
                      {vehicle.route_id ? 'Cambiar ruta' : 'Asignar ruta'}
                    </button>
                  </div>
                )}
                {trip ? (
                  <>
                    <p className="mt-1 text-sm">
                      {trip.routes?.name} · {formatHour(trip.scheduled_at)}
                    </p>
                    <p className="text-sm text-slate-600">
                      {trip.driver_id && props.drivers[trip.driver_id]} ·{' '}
                      {trip.status === 'en_parada' && currentStop(trip) ? `Cargando en ${currentStop(trip)!.name}` : (currentStop(trip)?.name ?? 'Saliendo')}
                    </p>
                    <p className="text-xs text-slate-500">
                      Ubicación {timeAgo(trip.last_seen_at, now)}
                      {totalWaiting(trip) > 0 && ` · ${totalWaiting(trip)} esperando`}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">{nextFor(allTrips, vehicle.id, now)}</p>
                )}
              </div>
            </article>
          ))}
          {units.length === 0 && <p className="card rounded-3xl p-4 text-slate-600">Ninguna unidad asignada a esta ruta todavía.</p>}
        </div>
        {assigning && (
          <AssignRouteSheet
            vehicle={assigning}
            routes={props.routes}
            onClose={() => setAssigning(null)}
            onAssigned={(routeId) => setVehicles((prev) => prev.map((v) => (v.id === assigning.id ? { ...v, route_id: routeId } : v)))}
          />
        )}
      </section>
      )}

      {tab === 'salidas' && (
      <section aria-labelledby="salidas">
        <h2 id="salidas" className="section-title">Salidas de hoy por ruta</h2>
        <div className="flex flex-col gap-3">
          {trips.length === 0 && <p className="card rounded-3xl p-4 text-slate-600">Esta ruta no tiene salidas hoy.</p>}
          {groupByRoute(trips).map(({ route, trips: rt }) => (
            <article key={rt[0].route_id} className="card overflow-x-auto rounded-3xl p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{route.name}</h3>
                {rt.some((t) => totalWaiting(t) > 0) && (
                  <span className="shrink-0 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-800">
                    {rt.reduce((a, t) => a + totalWaiting(t), 0)} en espera
                  </span>
                )}
              </div>
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Hora</th>
                    <th className="py-1 pr-3 font-medium">Unidad</th>
                    <th className="py-1 pr-3 font-medium">Conductor</th>
                    <th className="py-1 pr-3 font-medium">Estado</th>
                    <th className="py-1 pr-3 font-medium">Última parada</th>
                    <th className="py-1 font-medium">En espera</th>
                  </tr>
                </thead>
                <tbody>
                  {rt.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{formatHour(t.scheduled_at)}</td>
                      <td className="py-1.5 pr-3 font-mono">{t.vehicles?.plate ?? '—'}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{(t.driver_id && props.drivers[t.driver_id]) || '—'}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                      </td>
                      <td className="py-1.5 pr-3">{currentStop(t)?.name ?? '—'}</td>
                      <td className="py-1.5">{totalWaiting(t) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      </section>
      )}

      <NaviaFab
        raised
        tip={fiscalTip(summary)}
        questions={[
          { q: '¿Cómo va la línea?', answer: () => lineStatus(summary) },
          { q: '¿Alguna unidad sin señal?', answer: () => staleUnits(trips, now) },
          { q: '¿Dónde esperan más?', answer: () => mostWaiting(trips) },
        ]}
      />
    </div>
  );
}

/** Por ruta: total en espera y cuántos hay en cada parada (suma de las salidas de hoy). */
function WaitingByStop({ trips }: { trips: Trip[] }) {
  const routes = waitingByRoute(trips);
  if (routes.length === 0) return null;
  return (
    <section aria-labelledby="espera-paradas">
      <h2 id="espera-paradas" className="section-title">Estudiantes en espera por parada</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {routes.map((r) => (
          <article key={r.routeId} className="card rounded-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{r.name}</h3>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${r.total > 0 ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-500'}`}>
                {r.total} en espera
              </span>
            </div>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {r.stops.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className={s.n > 0 ? 'font-medium' : 'text-slate-500'}>{s.name}</span>
                  <span className={`min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-bold ${s.n > 0 ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-400'}`}>
                    {s.n}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function Kpi({ label, value, tone, wide }: { label: string; value: number | string; tone: string; wide?: boolean }) {
  return (
    <div className={`card rounded-3xl p-4 ${wide ? 'col-span-2 sm:col-span-1' : ''}`}>
      <p className={`text-3xl font-extrabold tracking-tight ${tone}`}>{value}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

function nextFor(trips: Trip[], vehicleId: string, now: number) {
  const t = trips.find((x) => x.vehicle_id === vehicleId && x.status === 'scheduled' && new Date(x.scheduled_at).getTime() > now - 10 * 60_000);
  return t ? `Próxima salida: ${formatHour(t.scheduled_at)} · ${t.routes?.name}` : 'Sin más salidas hoy';
}

function useLiveVehicles(initial: Vehicle[]) {
  const [vehicles, setVehicles] = useState(initial);
  useEffect(() => {
    const supabase = createClient();
    return subscribeWithSession(supabase, () =>
      supabase
        .channel('navia-vehicles')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicles' }, (p: RealtimePostgresChangesPayload<Vehicle>) => {
          const v = p.new as Vehicle;
          setVehicles((prev) => prev.map((x) => (x.id === v.id ? { ...x, ...v } : x)));
        }),
    );
  }, []);
  return [vehicles, setVehicles] as const;
}

/** Corredores para las fichas: primero los que tienen salidas, luego los "Próximamente". */
function corridorsOf(routes: RouteInfo[]) {
  const byKey = new Map<string, boolean>();
  for (const r of routes) byKey.set(routeKey(r), (byKey.get(routeKey(r)) ?? true) && r.coming_soon);
  return [...byKey].map(([key, soon]) => ({ key, soon })).sort((a, b) => Number(a.soon) - Number(b.soon));
}

/** Corredor elegido, recordado en este teléfono (si ya no existe, vuelve a "Todas"). */
function useCorridor(keys: string[]) {
  const [corridor, setCorridor] = useState<string | null>(null);
  const known = keys.join('|');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CORRIDOR_KEY);
      if (saved && known.split('|').includes(saved)) setCorridor(saved);
    } catch {
      /* sin almacenamiento: queda en "Todas" */
    }
  }, [known]);
  const choose = (key: string | null) => {
    setCorridor(key);
    try {
      if (key) localStorage.setItem(CORRIDOR_KEY, key);
      else localStorage.removeItem(CORRIDOR_KEY);
    } catch {
      /* sin almacenamiento: el filtro dura mientras la página esté abierta */
    }
  };
  return [corridor, choose] as const;
}

/** Hoja para elegir la ruta que cubre una unidad. */
function AssignRouteSheet(props: { vehicle: Vehicle; routes: RouteInfo[]; onClose: () => void; onAssigned: (routeId: string | null) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function assign(routeId: string | null) {
    setBusy(routeId ?? 'none');
    setError(null);
    const { error: e } = await createClient().rpc('assign_vehicle_route', { p_vehicle_id: props.vehicle.id, p_route_id: routeId });
    setBusy(null);
    if (e) return setError(e.code === 'PGRST202' ? 'Falta aplicar la migración 0007 en Supabase.' : 'No se pudo asignar. Prueba otra vez.');
    props.onAssigned(routeId);
    onClose();
  }

  const options: { id: string | null; name: string; detail: string }[] = [
    ...props.routes.map((r) => ({ id: r.id, name: r.name, detail: r.coming_soon ? 'Próximamente' : (r.corridor ?? '') })),
    { id: null, name: 'Sin ruta', detail: 'La unidad queda libre' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="assign-title">
      <button type="button" aria-label="Cerrar" tabIndex={-1} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <section className="sheet-up relative flex max-h-[85dvh] w-full flex-col rounded-t-[2rem] bg-white shadow-2xl sm:max-w-md sm:rounded-[2rem]">
        <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex-1">
            <h2 id="assign-title" className="text-lg font-extrabold">
              ¿Qué ruta cubre {props.vehicle.plate}?
            </h2>
            <p className="text-sm text-slate-500">Las salidas nuevas de esa ruta toman esta unidad.</p>
          </div>
        </header>
        <ul className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
          {options.map((o) => {
            const active = o.id === (props.vehicle.route_id ?? null);
            return (
              <li key={o.id ?? 'none'}>
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={busy !== null}
                  onClick={() => void assign(o.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.99] disabled:opacity-60 ${
                    active ? 'bg-brand-50 ring-2 ring-brand-400' : 'bg-slate-50 ring-1 ring-slate-200'
                  }`}
                >
                  <span className="flex-1">
                    <span className={`block ${active ? 'font-bold text-ink' : 'font-medium text-slate-700'}`}>{o.name}</span>
                    {o.detail && <span className={`text-xs ${o.detail === 'Próximamente' ? 'text-amber-600' : 'text-slate-500'}`}>{o.detail}</span>}
                  </span>
                  {busy === (o.id ?? 'none') ? <span className="text-xs text-slate-500">Guardando…</span> : active && <span className="text-brand-600">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <footer className="border-t border-slate-100 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error && (
            <p role="alert" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <button type="button" onClick={onClose} className="btn-ghost w-full">
            Cancelar
          </button>
        </footer>
      </section>
    </div>
  );
}

function PhotoUploader({ vehicle }: { vehicle: Vehicle }) {
  const input = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(vehicle.photo_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = useMemo(() => ({ ...vehicle, photo_url: photo ?? vehicle.photo_url }), [vehicle, photo]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setPhoto(await uploadVehiclePhoto(createClient(), vehicle.id, file));
    } catch {
      setError('No se pudo subir');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <VehiclePhoto vehicle={{ ...shown, plate: '' }} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="text-xs font-medium text-brand-700 disabled:opacity-50">
        {busy ? 'Subiendo…' : photo ? 'Cambiar foto' : 'Subir foto'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
    </div>
  );
}

function ResetDemo({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function reset() {
    setAsking(false);
    setBusy(true);
    const { data, error } = await createClient().rpc('reset_demo_today');
    setBusy(false);
    setMessage(error ? 'No se pudo reiniciar.' : `Listo: ${data} salidas reiniciadas.`);
    await onDone();
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-dashed border-slate-300 p-4">
      <p className="flex-1 text-sm text-slate-600">Demo: deja las salidas de hoy como al inicio del día para repetir el recorrido.</p>
      <button type="button" disabled={busy} onClick={() => setAsking(true)} className="btn-ghost px-4 py-2 text-sm disabled:opacity-50">
        {busy ? 'Reiniciando…' : 'Reiniciar demo'}
      </button>
      {message && <p className="w-full text-sm font-medium text-slate-700">{message}</p>}
      {asking && (
        <ConfirmSheet
          title="¿Reiniciar la demo?"
          body="Todas las salidas de hoy vuelven a «Programada» y se borran las esperas marcadas."
          confirmLabel="Sí, reiniciar"
          cancelLabel="Cancelar"
          onConfirm={() => void reset()}
          onCancel={() => setAsking(false)}
        />
      )}
    </section>
  );
}
