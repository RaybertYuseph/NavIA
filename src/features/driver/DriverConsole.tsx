'use client';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Icon } from '@/components/icons';
import { NaviaAgent } from '@/features/brand/NaviaAgent';
import { NO_SIGNAL, driverTip, waitingAhead } from '@/features/guide/answers';
import { NaviaFab } from '@/features/guide/NaviaFab';
import { db } from '@/lib/offline/db';
import { enqueue, onPendingChange, startAutoSync } from '@/lib/offline/sync';
import { AvailabilityToggle } from './AvailabilityToggle';
import { AvailableAtStop } from './AvailableAtStop';
import type { TripEventType } from '@/lib/offline/types';
import { formatHour } from '@/lib/time';
import { STATUS_LABEL, STATUS_STYLE, sortedStops, type RouteInfo, type Trip, type Vehicle } from '@/features/trips/types';
import { applyEvent, driverPhase, nextStop, primaryAction, type DriverState } from './state';
import { useGps, type GpsState } from './useGps';
import { useWaiting } from './useWaiting';
import { useWakeLock } from './useWakeLock';

const GPS_LABEL: Record<GpsState, string> = {
  off: 'GPS en espera',
  waiting: 'Buscando GPS…',
  ok: 'GPS activo',
  denied: 'Activa la ubicación en el navegador',
  unavailable: 'GPS no disponible',
};

const storageKey = (tripId: string) => `navia:trip:${tripId}`;

/**
 * Estado al abrir: el del servidor, salvo que este teléfono tenga botones tocados sin señal
 * que aún no llegan (eventos en la cola). Así un reinicio de la demo no queda tapado por
 * un estado viejo guardado en el teléfono.
 */
async function loadInitialState(trip: Trip): Promise<DriverState> {
  const server: DriverState = { status: trip.status, currentStopId: trip.current_stop_id };
  try {
    const pending = await db.queue.where('trip_id').equals(trip.id).filter((i) => i.kind === 'event').count();
    const raw = localStorage.getItem(storageKey(trip.id));
    if (!pending || !raw) {
      localStorage.removeItem(storageKey(trip.id));
      return server;
    }
    return JSON.parse(raw) as DriverState;
  } catch {
    return server;
  }
}

export function DriverConsole(props: { trips: Trip[]; vehicles: Vehicle[]; routes: RouteInfo[]; myVehicleId: string | null }) {
  const { trips } = props;
  const open = trips.filter((t) => t.status !== 'finalizada' && t.status !== 'cancelada');
  const [tripId, setTripId] = useState(open[0]?.id ?? trips[0]?.id);
  // Una salida nueva (recién asignada al activarse) pasa al frente.
  const trip = trips.find((t) => t.id === tripId) ?? open[0] ?? trips[0];

  useEffect(() => startAutoSync(), []);

  // Sin salida abierta: se activa disponible en la parada de salida y la BD le asigna una.
  const atStop = open.length === 0 && <AvailableAtStop vehicles={props.vehicles} routes={props.routes} myVehicleId={props.myVehicleId} />;
  if (!trip) return <div className="flex flex-col gap-4">{atStop}</div>;
  return (
    <div className="flex flex-col gap-4">
      {atStop}
      {trip.vehicles && open.length > 0 && <AvailabilityToggle key={trip.vehicles.id} vehicle={trip.vehicles} />}
      {trips.length > 1 && (
        <section data-tour="salidas" aria-label="Tus salidas de hoy">
          <h2 className="section-title">Tus salidas de hoy</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {trips.map((t) => {
              const active = t.id === trip.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTripId(t.id)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-2xl px-3.5 py-2 text-left transition ${
                    active ? 'bg-ink text-white shadow-lg shadow-ink/20' : 'card text-slate-700'
                  } ${t.status === 'finalizada' && !active ? 'opacity-50' : ''}`}
                >
                  <span className="block text-lg leading-tight font-extrabold">{formatHour(t.scheduled_at)}</span>
                  <span className={`block max-w-36 truncate text-xs ${active ? 'text-white/80' : 'text-slate-500'}`}>
                    {t.status === 'finalizada' ? '✓ ' : ''}
                    {t.routes?.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <TripControls key={trip.id} trip={trip} next={nextTrip(trips, trip)} onGo={setTripId} />
    </div>
  );
}

/** La salida que sigue a esta (o la primera abierta), para ofrecerla al terminar la ruta. */
function nextTrip(trips: Trip[], current: Trip) {
  const open = trips.filter((t) => t.id !== current.id && t.status !== 'finalizada' && t.status !== 'cancelada');
  return open.find((t) => t.scheduled_at > current.scheduled_at) ?? open[0] ?? null;
}

const PHASES = ['Llegué', 'Cargando', 'En camino'] as const;

const ACTION_STYLE = {
  en_camino: 'from-emerald-500 to-teal-500 shadow-emerald-500/40',
  en_parada: 'from-amber-400 to-orange-500 shadow-amber-500/40',
  fin_de_ruta: 'from-ink to-indigo-800 shadow-ink/30',
} as const;

function TripControls({ trip, next, onGo }: { trip: Trip; next: Trip | null; onGo: (tripId: string) => void }) {
  const stops = useMemo(() => sortedStops(trip), [trip]);
  const [state, setState] = useState<DriverState>({ status: trip.status, currentStopId: trip.current_stop_id });
  const [pending, setPending] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [undo, setUndo] = useState<{ label: string; prev: DriverState; eventId: string } | null>(null);
  const [goBackTo, setGoBackTo] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  useEffect(() => {
    let cancelled = false;
    void loadInitialState(trip).then((s) => !cancelled && setState(s));
    return () => {
      cancelled = true;
    };
  }, [trip]);
  useEffect(() => onPendingChange(setPending), []);

  const active = state.status === 'en_camino' || state.status === 'en_parada';
  const gps = useGps(trip.id, active);
  useWakeLock(active);

  const action = primaryAction(state, stops);
  const upcoming = nextStop(stops, state.currentStopId);
  const currentIdx = stops.findIndex((s) => s.id === state.currentStopId);
  const waiting = useWaiting(trip.id, trip.waiting, state.status !== 'finalizada' && state.status !== 'cancelada');
  const waitingAt = (stopId: string | undefined) => (stopId ? (waiting[stopId] ?? 0) : 0);
  const totalAhead = stops.slice(currentIdx + 1).reduce((a, s) => a + waitingAt(s.id), 0);

  function remember(next: DriverState, at: string) {
    setState(next);
    localStorage.setItem(storageKey(trip.id), JSON.stringify({ ...next, at }));
  }

  async function send(type: TripEventType, stopId: string | null = null, label?: string) {
    setConfirmEnd(false);
    const prev = state;
    const next = applyEvent(state, type, stopId);
    const at = new Date().toISOString();
    const id = crypto.randomUUID();
    remember(next, at);
    navigator.vibrate?.(80);
    if (label) setUndo({ label, prev, eventId: id });
    await enqueue({ kind: 'event', id, trip_id: trip.id, type, stop_id: stopId, occurred_at: at });
  }

  /**
   * Vuelve a un estado anterior (Deshacer o corregir una parada). Si el evento aún no salió del
   * teléfono se borra de la cola; igual se envía la corrección, que fija el estado y es inocua si
   * el evento nunca llegó.
   */
  async function restore(prev: DriverState, eventId?: string) {
    setUndo(null);
    setGoBackTo(null);
    if (eventId) await db.queue.where('id').equals(eventId).delete();
    const at = new Date().toISOString();
    remember(prev, at);
    navigator.vibrate?.(40);
    await enqueue({
      kind: 'event',
      id: crypto.randomUUID(),
      trip_id: trip.id,
      type: 'correccion',
      stop_id: null,
      occurred_at: at,
      restore: { status: prev.status, stop_id: prev.currentStopId },
    });
  }

  // Arriba del botón, dónde está y qué sigue; el botón dice lo que el conductor acaba de hacer.
  const atStop = stops[currentIdx];
  const label = !action
    ? null
    : action.type === 'en_parada'
      ? { top: state.status === 'scheduled' ? `Parada de salida: ${action.stop?.name}` : `Próxima parada: ${action.stop?.name}`, main: `Llegué a ${action.stop?.name}` }
      : action.type === 'fin_de_ruta'
        ? { top: atStop ? `En ${atStop.name} · última parada` : 'Ruta completa', main: 'Terminar ruta' }
        : state.status === 'en_parada'
          ? { top: `Cargando en ${atStop?.name ?? 'la parada'}`, main: 'Ya subieron todos' }
          : { top: 'Cuando arranques', main: '¡En camino!' };
  const onPrimary = () => (action?.type === 'fin_de_ruta' ? setConfirmEnd(true) : action && label && void send(action.type, action.stop?.id ?? null, label.main));

  return (
    <>
      <section className="card rounded-3xl p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-500">Salida {formatHour(trip.scheduled_at)}</p>
            <h2 className="text-lg leading-tight font-extrabold">{trip.routes?.name}</h2>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[state.status]}`}>{STATUS_LABEL[state.status]}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${gps === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
            <Icon name="pin" className="h-3.5 w-3.5" /> {GPS_LABEL[gps]}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${pending > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
            <Icon name={pending > 0 ? 'signal' : 'check'} className="h-3.5 w-3.5" />
            {pending > 0 ? `${pending} por enviar` : 'Todo enviado'}
          </span>
        </div>
        {state.status !== 'finalizada' && state.status !== 'cancelada' && (
          <p className={`mt-3 flex items-center gap-2 rounded-2xl px-3 py-2.5 font-bold ${totalAhead > 0 ? 'bg-cyan-50 text-cyan-900' : 'bg-slate-50 text-slate-600'}`}>
            <Icon name="users" className="h-5 w-5" />
            {totalAhead === 0
              ? 'Nadie ha marcado su parada todavía'
              : `${totalAhead} ${totalAhead === 1 ? 'estudiante esperando' : 'estudiantes esperando'} en tu ruta`}
          </p>
        )}
      </section>

      <div data-tour="accion" className="flex flex-col gap-2">
        {action && label && (
          <ol className="flex items-center gap-1.5 px-1 text-xs font-bold" aria-label="Paso actual">
            {PHASES.map((p, i) => {
              // En la última parada, con "Terminar ruta" por delante, los tres pasos quedan hechos.
              const phase = action.type === 'fin_de_ruta' ? PHASES.length : driverPhase(state.status);
              const now = i === phase;
              const done = i < phase;
              return (
                <li key={p} className="flex flex-1 items-center gap-1.5" aria-current={now ? 'step' : undefined}>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-500 text-white' : now ? 'bg-brand-500 text-white ring-4 ring-brand-100' : 'bg-slate-200 text-slate-500'}`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span className={now ? 'text-brand-700' : done ? 'text-slate-600' : 'text-slate-400'}>{p}</span>
                  {i < PHASES.length - 1 && <span className={`h-0.5 flex-1 rounded ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                </li>
              );
            })}
          </ol>
        )}
        {action && label ? (
          <button
            type="button"
            onClick={onPrimary}
            className={`${ACTION_STYLE[action.type]} min-h-28 rounded-[1.75rem] bg-linear-to-br px-5 py-4 text-left text-white shadow-xl transition active:scale-[0.98]`}
          >
            <span className="block text-sm font-semibold opacity-90">{label.top}</span>
            <span className="block text-3xl leading-tight font-extrabold">{label.main}</span>
            {action.type === 'en_parada' && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/25 px-3 py-1 text-sm font-bold">
                <Icon name="users" className="h-4 w-4" />
                {waitingAt(action.stop?.id) === 0 ? 'Nadie marcó esta parada' : `${waitingAt(action.stop?.id)} esperando ahí`}
              </span>
            )}
          </button>
        ) : (
          <div className="card flex flex-col items-center gap-2 rounded-3xl p-5 text-center">
            <NaviaAgent size={72} animated mood={state.status === 'finalizada' ? 'happy' : 'idle'} />
            <p className="text-lg font-extrabold">{state.status === 'finalizada' ? '¡Ruta terminada! Buen trabajo.' : 'Esta salida fue cancelada.'}</p>
            {next ? (
              <button type="button" onClick={() => onGo(next.id)} className="btn-primary mt-1 w-full">
                Ir a mi próxima salida: {formatHour(next.scheduled_at)}
              </button>
            ) : (
              <p className="text-sm text-slate-600">No te quedan más salidas hoy.</p>
            )}
          </div>
        )}
        {active && action?.type !== 'fin_de_ruta' && (
          <button type="button" onClick={() => setConfirmEnd(true)} className="btn-ghost self-center px-4 py-2 text-sm">
            Terminar la ruta antes
          </button>
        )}
      </div>

      {confirmEnd && (
        <ConfirmSheet
          title="¿Terminar la ruta?"
          body={
            action?.type === 'fin_de_ruta'
              ? 'Aviso a los estudiantes y al fiscal que esta salida terminó.'
              : `Todavía te faltan paradas${totalAhead > 0 ? ` y ${totalAhead} ${totalAhead === 1 ? 'estudiante espera' : 'estudiantes esperan'}` : ''}. ¿Seguro que quieres terminar ya?`
          }
          confirmLabel="Sí, terminar"
          cancelLabel="Seguir en ruta"
          onConfirm={() => void send('fin_de_ruta', null, 'Terminar ruta')}
          onCancel={() => setConfirmEnd(false)}
        />
      )}
      {goBackTo && (
        <ConfirmSheet
          title={`¿Volver a ${goBackTo.name}?`}
          body="Quedas otra vez cargando en esa parada y se desmarcan las paradas siguientes."
          confirmLabel={`Sí, volver a ${goBackTo.name}`}
          cancelLabel="Dejarlo así"
          onConfirm={() => void restore({ status: 'en_parada', currentStopId: goBackTo.id })}
          onCancel={() => setGoBackTo(null)}
        />
      )}
      {undo && (
        <div role="status" className="tour-pop fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-2xl">
          <Icon name="check" className="h-5 w-5 shrink-0 text-emerald-300" />
          <p className="min-w-0 flex-1 truncate text-sm">
            Marcaste: <span className="font-bold">{undo.label}</span>
          </p>
          <button type="button" onClick={() => void restore(undo.prev, undo.eventId)} className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-bold">
            Deshacer
          </button>
        </div>
      )}

      <section data-tour="paradas" className="card rounded-3xl p-4" aria-label="Paradas">
        <h3 className="section-title">Paradas</h3>
        <ol className="relative flex flex-col">
          {stops.map((s, i) => {
            const done = state.status === 'finalizada' || (currentIdx >= 0 && (i < currentIdx || (i === currentIdx && state.status !== 'en_parada')));
            const here = i === currentIdx && state.status === 'en_parada';
            const isNext = !here && s.id === upcoming?.id && active;
            return (
              <li key={s.id} className="flex items-center gap-3 py-1.5 text-sm">
                {done ? (
                  <button
                    type="button"
                    onClick={() => setGoBackTo({ id: s.id, name: s.name })}
                    aria-label={`Volver a ${s.name}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white ring-offset-2 transition active:scale-90"
                  >
                    ✓
                  </button>
                ) : (
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    here ? 'bg-amber-400 text-white ring-4 ring-amber-100' : isNext ? 'bg-brand-500 text-white ring-4 ring-brand-100' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {i + 1}
                </span>
                )}
                <span className={done ? 'text-slate-400 line-through decoration-slate-300' : here || isNext ? 'font-bold' : 'font-medium'}>{s.name}</span>
                {!done && (
                  <span
                    className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${waitingAt(s.id) > 0 ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-400'}`}
                    aria-label={`${waitingAt(s.id)} esperando`}
                  >
                    <Icon name="users" className="h-3.5 w-3.5" /> {waitingAt(s.id)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {active && <p className="text-center text-xs text-slate-500">Deja el teléfono en el soporte, con la pantalla encendida y cargando.</p>}

      <NaviaFab
        inline
        tip={driverTip(state.status, upcoming)}
        questions={[
          { q: '¿Qué hago ahora?', answer: () => ({ text: driverTip(state.status, upcoming) }) },
          { q: '¿Cuántos me esperan?', answer: () => waitingAhead(stops, waiting, currentIdx) },
          { q: '¿Y si se va la señal?', answer: () => NO_SIGNAL },
        ]}
      />
    </>
  );
}
