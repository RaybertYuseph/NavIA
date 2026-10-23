'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Tabs } from '@/components/Tabs';
import { fiscalTip, lineStatus, mostWaiting, staleUnits, type LineSummary } from '@/features/guide/answers';
import { useGuide } from '@/features/guide/GuideProvider';
import { NaviaFab } from '@/features/guide/NaviaFab';
import { BusMap } from '@/features/map/BusMap';
import { groupByRoute } from '@/features/trips/derive';
import { useLiveTrips } from '@/features/trips/useLiveTrips';
import { STATUS_LABEL, STATUS_STYLE, currentStop, isLive, totalWaiting, type Trip, type Vehicle } from '@/features/trips/types';
import { VehiclePhoto } from '@/features/vehicles/VehiclePhoto';
import { uploadVehiclePhoto } from '@/features/vehicles/uploadPhoto';
import { createClient } from '@/lib/supabase/client';
import { formatHour, timeAgo } from '@/lib/time';

type UnitState = 'en_ruta' | 'disponible' | 'fuera';

const UNIT_LABEL: Record<UnitState, string> = { en_ruta: 'En ruta', disponible: 'Disponible', fuera: 'Fuera de servicio' };
const UNIT_STYLE: Record<UnitState, string> = {
  en_ruta: 'bg-emerald-100 text-emerald-800',
  disponible: 'bg-sky-100 text-sky-800',
  fuera: 'bg-slate-200 text-slate-600',
};

/** Vista del fiscal de la línea: unidades, mapa en vivo y salidas de hoy por ruta. */
export function FiscalPanel(props: { initialTrips: Trip[]; initialVehicles: Vehicle[]; drivers: Record<string, string> }) {
  const { trips, now, online, refetch } = useLiveTrips(props.initialTrips);
  const vehicles = useLiveVehicles(props.initialVehicles);
  const { tab } = useGuide();

  const units = vehicles.map((v) => {
    const trip = trips.find((t) => t.vehicle_id === v.id && isLive(t)) ?? null;
    const state: UnitState = trip ? 'en_ruta' : v.available ? 'disponible' : 'fuera';
    return { vehicle: v, trip, state };
  });
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

      {tab === 'resumen' && (
      <>
      <section data-tour="kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="En ruta" value={counts.en_ruta} tone="text-emerald-700" />
        <Kpi label="Disponibles" value={counts.disponible} tone="text-sky-700" />
        <Kpi label="Fuera de servicio" value={counts.fuera} tone="text-slate-600" />
        <Kpi label="Salidas completadas" value={`${done}/${trips.length}`} tone="text-indigo-600" />
        <Kpi label="Estudiantes en espera" value={waiting} tone="text-cyan-600" wide />
      </section>

      <section aria-labelledby="mapa" data-tour="mapa">
        <h2 id="mapa" className="section-title">Mapa en vivo</h2>
        {live.length === 0 ? (
          <p className="card rounded-3xl p-4 text-slate-600">Ninguna unidad está enviando ubicación ahora.</p>
        ) : (
          <BusMap
            className="h-80"
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
                {trip ? (
                  <>
                    <p className="mt-1 text-sm">
                      {trip.routes?.name} · {formatHour(trip.scheduled_at)}
                    </p>
                    <p className="text-sm text-slate-600">
                      {trip.driver_id && props.drivers[trip.driver_id]} · {currentStop(trip)?.name ?? 'Saliendo'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Ubicación {timeAgo(trip.last_seen_at, now)}
                      {totalWaiting(trip) > 0 && ` · ${totalWaiting(trip)} esperando`}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">{nextFor(trips, vehicle.id, now)}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      )}

      {tab === 'salidas' && (
      <section aria-labelledby="salidas">
        <h2 id="salidas" className="section-title">Salidas de hoy por ruta</h2>
        <div className="flex flex-col gap-3">
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
    const channel = supabase
      .channel('navia-vehicles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vehicles' }, (p: RealtimePostgresChangesPayload<Vehicle>) => {
        const v = p.new as Vehicle;
        setVehicles((prev) => prev.map((x) => (x.id === v.id ? { ...x, ...v } : x)));
      })
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, []);
  return vehicles;
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

  async function reset() {
    if (!confirm('¿Reiniciar la demo? Todas las salidas de hoy vuelven a "Programada".')) return;
    setBusy(true);
    const { data, error } = await createClient().rpc('reset_demo_today');
    setBusy(false);
    setMessage(error ? 'No se pudo reiniciar.' : `Listo: ${data} salidas reiniciadas.`);
    await onDone();
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-3xl border border-dashed border-slate-300 p-4">
      <p className="flex-1 text-sm text-slate-600">Demo: deja las salidas de hoy como al inicio del día para repetir el recorrido.</p>
      <button type="button" disabled={busy} onClick={reset} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Reiniciando…' : 'Reiniciar demo'}
      </button>
      {message && <p className="text-sm text-slate-700">{message}</p>}
    </section>
  );
}
