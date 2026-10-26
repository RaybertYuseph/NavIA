'use client';
import { useEffect, useRef, useState } from 'react';
import { SelectField } from '@/components/SelectField';
import { distanceM } from '@/lib/geo';
import { createClient } from '@/lib/supabase/client';
import { formatHour } from '@/lib/time';
import { pendingStops } from './derive';
import { isLive, sortedStops, type Trip } from './types';

type MyWait = { trip_id: string; stop_id: string };
type Point = { lat: number; lng: number };

/** Radio para marcar la parada; set_my_wait lo vuelve a validar en el servidor. */
const RANGE_M = 50;
const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';
const OUT_OF_RANGE = `Debes estar a menos de ${RANGE_M} m de tu parada para marcarla.`;
const NO_PERMISSION =
  'Necesito tu ubicación para confirmar que estás en la parada. Actívala en el candado junto a la dirección (Permisos → Ubicación) y prueba otra vez.';
const NO_FIX = 'No pude obtener tu ubicación. Revisa que el GPS esté encendido y prueba otra vez.';

function locate() {
  return new Promise<Point>((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('sin_gps'));
    // Tope propio: el timeout del navegador no corre mientras el aviso de permiso sigue abierto.
    const giveUp = setTimeout(() => reject(new Error('sin_respuesta')), 15_000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(giveUp);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      (e) => {
        clearTimeout(giveUp);
        reject(e);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 15_000 },
    );
  });
}

function howFar(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}

/**
 * "Estoy en la parada": el estudiante marca dónde espera una salida de hoy, solo si su GPS lo
 * ubica a 50 m o menos de la parada. El conteo llega en trips.waiting por Realtime; cuando el
 * bus pasa por esa parada la espera se da por recogida. En la demo se puede simular la ubicación.
 */
export function WaitAtStop({ trips, preferredTripId }: { trips: Trip[]; preferredTripId: string | null }) {
  // Solo salidas con unidad confirmada o en camino: las que esperan unidad no tienen hora segura.
  const open = trips.filter((t) => (t.vehicle_id && pendingStops(t).length > 0) || isLive(t));
  const [wait, setWait] = useState<MyWait | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string>('');
  const [busy, setBusy] = useState<false | 'gps' | 'save'>(false);
  const [error, setError] = useState<string | null>(null);
  /** Cada búsqueda de GPS tiene un número; si llega una más nueva (o "Simular"), la vieja se ignora. */
  const search = useRef(0);

  useEffect(() => {
    const ids = trips.map((t) => t.id);
    if (ids.length === 0) return;
    void createClient()
      .from('stop_waits')
      .select('trip_id, stop_id')
      .in('trip_id', ids)
      .is('picked_at', null)
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: MyWait | null }) => data && setWait(data));
    // Solo al abrir: después la espera cambia por lo que toca el propio estudiante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el conteo de mi parada baja a 0 (p. ej. el fiscal reinició la demo), se confirma con el
  // servidor si la espera sigue; si ya no existe, la tarjeta vuelve a "Estoy aquí".
  const myCount = wait ? (trips.find((t) => t.id === wait.trip_id)?.waiting?.[wait.stop_id] ?? 0) : null;
  useEffect(() => {
    if (!wait || myCount !== 0) return;
    let cancelled = false;
    void createClient()
      .from('stop_waits')
      .select('trip_id')
      .eq('trip_id', wait.trip_id)
      .is('picked_at', null)
      .maybeSingle()
      .then(({ data }: { data: { trip_id: string } | null }) => !cancelled && !data && setWait(null));
    return () => {
      cancelled = true;
    };
  }, [wait, myCount]);

  const trip = trips.find((t) => t.id === (wait?.trip_id ?? tripId ?? preferredTripId)) ?? open[0] ?? null;
  if (!trip) return null;

  async function save(next: MyWait | null, at?: Point) {
    if (!trip) return;
    setBusy('save');
    setError(null);
    const supabase = createClient();
    const args = { p_trip_id: next?.trip_id ?? trip.id, p_stop_id: next?.stop_id ?? null };
    let { error: e } = await supabase.rpc('set_my_wait', { ...args, p_lat: at?.lat ?? null, p_lng: at?.lng ?? null });
    // Base sin la migración 0006 (set_my_wait de dos argumentos): se guarda igual, validado solo aquí.
    if (e?.code === 'PGRST202') ({ error: e } = await supabase.rpc('set_my_wait', args));
    setBusy(false);
    if (e) return setError(e.hint === 'fuera_de_rango' ? OUT_OF_RANGE : 'No se pudo guardar. Revisa tu conexión y prueba otra vez.');
    setWait(next);
  }

  /** Marca la parada si el GPS confirma que el estudiante está a 50 m o menos. */
  async function markHere(stop: Point & { id: string }) {
    if (!trip) return;
    const mine = ++search.current;
    setBusy('gps');
    setError(null);
    let at: Point;
    try {
      at = await locate();
    } catch (e) {
      if (mine !== search.current) return;
      setBusy(false);
      return setError((e as GeolocationPositionError).code === 1 ? NO_PERMISSION : NO_FIX);
    }
    if (mine !== search.current) return;
    const d = distanceM(at, stop);
    if (d > RANGE_M) {
      setBusy(false);
      return setError(`${OUT_OF_RANGE} Ahora estás a unos ${howFar(d)}.`);
    }
    await save({ trip_id: trip.id, stop_id: stop.id }, at);
  }

  if (wait) {
    const stops = sortedStops(trip);
    const mine = stops.find((s) => s.id === wait.stop_id);
    const myIdx = stops.findIndex((s) => s.id === wait.stop_id);
    const busIdx = stops.findIndex((s) => s.id === trip.current_stop_id);
    const picked = (busIdx >= 0 && busIdx >= myIdx) || trip.status === 'finalizada';
    const others = Math.max(0, (trip.waiting?.[wait.stop_id] ?? 1) - 1);

    if (picked) {
      return (
        <Card>
          <p className="text-lg font-bold">🚌 ¡Llegó tu camioneta a {mine?.name}!</p>
          <p className="text-sm text-slate-600">¡Buen viaje, pana!</p>
          <button type="button" onClick={() => setWait(null)} className="btn-ghost mt-3 w-full">
            Marcar otra parada
          </button>
        </Card>
      );
    }
    const stopsAway = busIdx < 0 ? null : myIdx - busIdx;
    return (
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Esperas en</p>
            <p className="text-xl font-extrabold">{mine?.name}</p>
            <p className="text-sm text-slate-600">
              Salida {formatHour(trip.scheduled_at)} · {trip.routes?.name}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-cyan-100 px-3 py-1 text-sm font-bold text-cyan-800">
            {others === 0 ? 'Solo tú' : `Tú y ${others} más`}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-700">
          {!isLive(trip)
            ? 'La camioneta todavía no ha arrancado.'
            : stopsAway === null
              ? 'La camioneta ya viene en camino.'
              : stopsAway === 1
                ? '¡Tu parada es la siguiente! Prepárate.'
                : `La camioneta está a ${stopsAway} paradas.`}
        </p>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void save(null)}
          className="btn-ghost mt-3 w-full disabled:opacity-50"
        >
          {busy ? 'Quitando…' : 'Ya no espero aquí'}
        </button>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </Card>
    );
  }

  const choices = pendingStops(trip);
  const chosen = choices.find((s) => s.id === stopId);
  return (
    <Card>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (chosen) void markHere(chosen);
        }}
      >
        <SelectField
          label="Salida"
          value={trip.id}
          options={open.map((t) => ({ value: t.id, label: `${formatHour(t.scheduled_at)} · ${t.routes?.name ?? ''}${isLive(t) ? ' · en camino' : ''}` }))}
          onChange={(id) => {
            setTripId(id);
            setStopId('');
            setError(null);
          }}
        />
        <fieldset>
          <legend className="text-sm font-semibold text-slate-600">¿En qué parada estás?</legend>
          {choices.length === 0 ? (
            <p className="mt-1.5 text-sm text-slate-500">La camioneta ya pasó por todas las paradas de esta salida.</p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {choices.map((s) => {
                const n = trip.waiting?.[s.id] ?? 0;
                const active = s.id === stopId;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setStopId(s.id);
                        setError(null);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.99] ${
                        active ? 'bg-brand-50 ring-2 ring-brand-400' : 'bg-slate-50 ring-1 ring-slate-200'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${active ? 'bg-brand-500 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}
                      >
                        {active ? '✓' : s.seq}
                      </span>
                      <span className={`flex-1 ${active ? 'font-bold text-ink' : 'font-medium text-slate-700'}`}>{s.name}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${n > 0 ? 'bg-cyan-100 text-cyan-800' : 'bg-white text-slate-400'}`}>
                        {n} esperando
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
        <button
          type="submit"
          disabled={!!busy || !chosen}
          className="btn-primary mt-1"
        >
          {busy === 'gps' ? 'Buscando tu ubicación…' : busy === 'save' ? 'Guardando…' : '📍 Estoy aquí'}
        </button>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {DEMO && (
          <button
            type="button"
            disabled={busy === 'save' || !chosen}
            onClick={() => {
              if (!chosen) return;
              search.current++; // cancela la búsqueda de GPS en curso
              void save({ trip_id: trip.id, stop_id: chosen.id }, chosen);
            }}
            className="btn-ghost text-sm disabled:opacity-50"
          >
            Simular que estoy en la parada (demo)
          </button>
        )}
        <p className="text-xs text-slate-500">Uso tu ubicación solo para confirmar que estás a menos de {RANGE_M} m de la parada.</p>
      </form>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card rounded-3xl p-4">{children}</div>;
}
