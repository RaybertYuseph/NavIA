'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { currentStop, type RouteInfo, type Trip, type Vehicle } from '@/features/trips/types';
import { VehiclePhoto } from '@/features/vehicles/VehiclePhoto';
import { uploadVehiclePhoto } from '@/features/vehicles/uploadPhoto';
import { createClient } from '@/lib/supabase/client';
import { formatHour, timeAgo } from '@/lib/time';

export type UnitState = 'en_ruta' | 'disponible' | 'no_disponible' | 'taller';
export type Unit = { vehicle: Vehicle; trip: Trip | null; state: UnitState };

const UNIT_LABEL: Record<UnitState, string> = { en_ruta: 'En ruta', disponible: 'Disponible', no_disponible: 'No disponible', taller: 'Fuera de servicio' };
const UNIT_STYLE: Record<UnitState, string> = {
  en_ruta: 'bg-emerald-100 text-emerald-800',
  disponible: 'bg-sky-100 text-sky-800',
  no_disponible: 'bg-slate-200 text-slate-600',
  taller: 'bg-amber-100 text-amber-800',
};

type SetVehicles = (fn: (prev: Vehicle[]) => Vehicle[]) => void;
type RpcError = { code?: string; hint?: string } | null;

/** Mensaje para el fiscal según el error de las funciones de 0009. */
function explain(e: NonNullable<RpcError>, fallback: string) {
  if (e.code === 'PGRST202') return 'Falta aplicar la migración 0009 en Supabase.';
  if (e.hint === 'en_ruta') return 'La unidad está en ruta. Espera a que termine la salida.';
  return fallback;
}

/**
 * Gestor de unidades del fiscal: incorporar, desincorporar y reincorporar, poner fuera de
 * servicio (mantenimiento) y asignar una ruta por unidad, con aviso al conductor al cambiarla.
 */
export function UnitsManager(props: {
  units: Unit[];
  retired: Vehicle[];
  routes: RouteInfo[];
  drivers: Record<string, string>;
  trips: Trip[];
  now: number;
  setVehicles: SetVehicles;
  onTripsChanged: () => void;
}) {
  const { units, setVehicles } = props;
  const [assigning, setAssigning] = useState<Vehicle | null>(null);
  const [adding, setAdding] = useState(false);
  const [retiring, setRetiring] = useState<Vehicle | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const routeName = (id: string | null | undefined) => props.routes.find((r) => r.id === id)?.name ?? null;
  const managed = units.some((u) => 'in_service' in u.vehicle);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const patch = (id: string, change: Partial<Vehicle>) => setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...change } : v)));

  async function setInService(v: Vehicle, inService: boolean) {
    const { error } = await createClient().rpc('set_vehicle_in_service', { p_vehicle_id: v.id, p_in_service: inService });
    if (error) return setToast({ text: explain(error, 'No se pudo cambiar. Prueba otra vez.'), error: true });
    patch(v.id, { in_service: inService, ...(inService ? {} : { available: false, available_route_id: null }) });
    setToast({ text: inService ? `${v.plate} vuelve a estar en servicio.` : `${v.plate} quedó fuera de servicio. Sus salidas pendientes quedan sin unidad.` });
    if (!inService) props.onTripsChanged();
  }

  async function retire(v: Vehicle) {
    setRetiring(null);
    const { error } = await createClient().rpc('retire_vehicle', { p_vehicle_id: v.id });
    if (error) return setToast({ text: explain(error, 'No se pudo desincorporar. Prueba otra vez.'), error: true });
    patch(v.id, { active: false, available: false, route_id: null });
    setToast({ text: `${v.plate} fue desincorporada. Queda en el historial y puedes reincorporarla.` });
    props.onTripsChanged();
  }

  async function reinstate(v: Vehicle) {
    const { error } = await createClient().rpc('reinstate_vehicle', { p_vehicle_id: v.id });
    if (error) return setToast({ text: explain(error, 'No se pudo reincorporar. Prueba otra vez.'), error: true });
    patch(v.id, { active: true, in_service: true });
    setToast({ text: `${v.plate} volvió a la línea. Asígnale una ruta.` });
  }

  return (
    <section aria-labelledby="unidades">
      <div className="flex items-end justify-between gap-2">
        <h2 id="unidades" className="section-title">Unidades</h2>
        {managed && (
          <button type="button" onClick={() => setAdding(true)} className="chip mb-2 py-1.5 text-sm">
            + Agregar unidad
          </button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
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
                  <p className="text-xs text-slate-500">Ubicación {timeAgo(trip.last_seen_at, props.now)}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-600">{nextFor(props.trips, vehicle.id, props.now)}</p>
              )}
              {managed && !trip && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                  <label className="flex flex-1 items-center gap-2 text-sm font-medium whitespace-nowrap text-slate-700">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={vehicle.in_service !== false}
                      onClick={() => void setInService(vehicle, vehicle.in_service === false)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${vehicle.in_service !== false ? 'bg-emerald-600' : 'bg-amber-400'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${vehicle.in_service !== false ? 'left-5.5' : 'left-0.5'}`} />
                    </button>
                    {vehicle.in_service !== false ? 'En servicio' : 'Fuera de servicio'}
                  </label>
                  <button type="button" onClick={() => setRetiring(vehicle)} className="rounded-xl px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-red-700 ring-1 ring-red-200">
                    Desincorporar
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
        {units.length === 0 && <p className="card rounded-3xl p-4 text-slate-600">Ninguna unidad asignada a esta ruta todavía.</p>}
      </div>

      {props.retired.length > 0 && (
        <div className="mt-4">
          <button type="button" aria-expanded={showRetired} onClick={() => setShowRetired((s) => !s)} className="text-sm font-semibold text-slate-600">
            {showRetired ? '▾' : '▸'} Desincorporadas ({props.retired.length})
          </button>
          {showRetired && (
            <ul className="mt-2 space-y-1.5">
              {props.retired.map((v) => (
                <li key={v.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <span className="flex-1 font-mono font-semibold text-slate-600">{v.plate}</span>
                  <button type="button" onClick={() => void reinstate(v)} className="chip py-1 text-xs">
                    Reincorporar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {assigning && (
        <AssignRouteSheet
          vehicle={assigning}
          routes={props.routes}
          onClose={() => setAssigning(null)}
          onAssigned={(routeId) => {
            const had = assigning.route_id;
            patch(assigning.id, { route_id: routeId });
            if (had && had !== routeId) {
              setToast({ text: `${assigning.plate} ${routeId ? `ahora cubre ${routeName(routeId)}` : 'quedó sin ruta'}. Le avisamos a su conductor.` });
              props.onTripsChanged();
            }
          }}
        />
      )}
      {adding && (
        <AddVehicleSheet
          routes={props.routes}
          onClose={() => setAdding(false)}
          onCreated={(v) => {
            setVehicles((prev) => [...prev, v].sort((a, b) => a.plate.localeCompare(b.plate)));
            setToast({ text: `${v.plate} se incorporó a la línea.` });
          }}
        />
      )}
      {retiring && (
        <ConfirmSheet
          title={`¿Desincorporar ${retiring.plate}?`}
          body="Sale de la línea pero queda en el historial. Sus salidas pendientes quedan sin unidad y su conductor recibe un aviso."
          confirmLabel="Sí, desincorporar"
          cancelLabel="Cancelar"
          onConfirm={() => void retire(retiring)}
          onCancel={() => setRetiring(null)}
        />
      )}
      {toast && (
        <p
          role="status"
          className={`tour-pop fixed inset-x-4 bottom-24 z-40 mx-auto max-w-md rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ${
            toast.error ? 'bg-red-600 text-white' : 'bg-ink text-white'
          }`}
        >
          {toast.text}
        </p>
      )}
    </section>
  );
}

function nextFor(trips: Trip[], vehicleId: string, now: number) {
  const t = trips.find((x) => x.vehicle_id === vehicleId && x.status === 'scheduled' && new Date(x.scheduled_at).getTime() > now - 10 * 60_000);
  return t ? `Próxima salida: ${formatHour(t.scheduled_at)} · ${t.routes?.name}` : 'Sin más salidas hoy';
}

/** Hoja inferior común de esta pestaña: título, contenido con scroll y pie. */
function Sheet(props: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  const { onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button type="button" aria-label="Cerrar" tabIndex={-1} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <section className="sheet-up relative flex max-h-[85dvh] w-full flex-col rounded-t-[2rem] bg-white shadow-2xl sm:max-w-md sm:rounded-[2rem]">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 id="sheet-title" className="text-lg font-extrabold">
            {props.title}
          </h2>
          {props.subtitle && <p className="text-sm text-slate-500">{props.subtitle}</p>}
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3">{props.children}</div>
        <footer className="space-y-2 border-t border-slate-100 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{props.footer}</footer>
      </section>
    </div>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {text}
    </p>
  ) : null;
}

/** Una ruta por unidad. Si ya tenía una, primero confirma el cambio (su conductor recibe un aviso). */
function AssignRouteSheet(props: { vehicle: Vehicle; routes: RouteInfo[]; onClose: () => void; onAssigned: (routeId: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ id: string | null; name: string } | null>(null);
  const current = props.routes.find((r) => r.id === props.vehicle.route_id) ?? null;

  async function assign(routeId: string | null) {
    setBusy(true);
    setError(null);
    const { error: e } = await createClient().rpc('assign_vehicle_route', { p_vehicle_id: props.vehicle.id, p_route_id: routeId });
    setBusy(false);
    if (e) {
      setConfirming(null);
      return setError(e.code === 'PGRST202' ? 'Falta aplicar la migración 0007 en Supabase.' : 'No se pudo asignar. Prueba otra vez.');
    }
    props.onAssigned(routeId);
    props.onClose();
  }

  function choose(o: { id: string | null; name: string }) {
    if (o.id === (props.vehicle.route_id ?? null)) return props.onClose();
    if (current) return setConfirming(o);
    void assign(o.id);
  }

  if (confirming && current)
    return (
      <ConfirmSheet
        title="¿Cambiar de ruta?"
        body={
          confirming.id
            ? `${props.vehicle.plate} sale de ${current.name} y pasa a ${confirming.name}. Sus salidas pendientes en ${current.name} quedan sin unidad y su conductor recibe un aviso.`
            : `${props.vehicle.plate} sale de ${current.name} y queda sin ruta. Su conductor recibe un aviso.`
        }
        confirmLabel={busy ? 'Guardando…' : 'Sí, cambiar'}
        cancelLabel="Volver"
        onConfirm={() => void assign(confirming.id)}
        onCancel={() => setConfirming(null)}
      />
    );

  const options: { id: string | null; name: string; detail: string }[] = [
    ...props.routes.map((r) => ({ id: r.id, name: r.name, detail: r.coming_soon ? 'Próximamente' : (r.corridor ?? '') })),
    { id: null, name: 'Sin ruta', detail: 'La unidad queda libre' },
  ];
  return (
    <Sheet
      title={`¿Qué ruta cubre ${props.vehicle.plate}?`}
      subtitle="Cada unidad cubre una sola ruta."
      onClose={props.onClose}
      footer={
        <>
          <ErrorLine text={error} />
          <button type="button" onClick={props.onClose} className="btn-ghost w-full">
            Cancelar
          </button>
        </>
      }
    >
      <ul className="space-y-1.5">
        {options.map((o) => {
          const active = o.id === (props.vehicle.route_id ?? null);
          return (
            <li key={o.id ?? 'none'}>
              <button
                type="button"
                aria-pressed={active}
                disabled={busy}
                onClick={() => choose(o)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.99] disabled:opacity-60 ${
                  active ? 'bg-brand-50 ring-2 ring-brand-400' : 'bg-slate-50 ring-1 ring-slate-200'
                }`}
              >
                <span className="flex-1">
                  <span className={`block ${active ? 'font-bold text-ink' : 'font-medium text-slate-700'}`}>{o.name}</span>
                  {o.detail && <span className={`text-xs ${o.detail === 'Próximamente' ? 'text-amber-600' : 'text-slate-500'}`}>{o.detail}</span>}
                </span>
                {active && <span className="text-brand-600">✓ Actual</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

const PLATE_RE = /^[A-Z0-9]{5,8}$/;

/** Incorporar una unidad: placa, puestos y, si se quiere, su ruta. La foto se sube desde su tarjeta. */
function AddVehicleSheet(props: { routes: RouteInfo[]; onClose: () => void; onCreated: (v: Vehicle) => void }) {
  const [plate, setPlate] = useState('');
  const [capacity, setCapacity] = useState('30');
  const [routeId, setRouteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const seats = Number(capacity);
  const valid = PLATE_RE.test(clean) && Number.isInteger(seats) && seats >= 4 && seats <= 80;

  async function create() {
    setBusy(true);
    setError(null);
    const { data, error: e } = await createClient().rpc('create_vehicle', { p_plate: clean, p_capacity: seats, p_route_id: routeId });
    setBusy(false);
    if (e) {
      if (e.code === '23505')
        return setError(e.hint === 'desincorporada' ? 'Esa placa está desincorporada: reincorpórala desde la lista de abajo.' : 'Esa placa ya está registrada.');
      return setError(explain(e, 'No se pudo agregar. Prueba otra vez.'));
    }
    props.onCreated({ id: data as string, plate: clean, capacity: seats, photo_url: null, available: false, route_id: routeId, active: true, in_service: true });
    props.onClose();
  }

  return (
    <Sheet
      title="Agregar unidad"
      subtitle="Después puedes subir su foto desde la tarjeta."
      onClose={props.onClose}
      footer={
        <>
          <ErrorLine text={error} />
          <button type="button" disabled={!valid || busy} onClick={() => void create()} className="btn-primary w-full">
            {busy ? 'Agregando…' : clean ? `Agregar ${clean}` : 'Agregar unidad'}
          </button>
          <button type="button" onClick={props.onClose} className="btn-ghost w-full">
            Cancelar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Placa</span>
          <input
            autoFocus
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="AB123CD"
            autoCapitalize="characters"
            className="field font-mono text-lg font-bold uppercase"
          />
          {clean && !PLATE_RE.test(clean) && <span className="mt-1 block text-xs text-red-600">De 5 a 8 letras y números.</span>}
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Puestos</span>
          <input type="number" inputMode="numeric" min={4} max={80} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="field font-bold" />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold text-slate-700">Ruta (opcional)</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {[{ id: null as string | null, name: 'Sin ruta' }, ...props.routes].map((r) => {
              const active = r.id === routeId;
              return (
                <button
                  key={r.id ?? 'none'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRouteId(r.id)}
                  className={`rounded-full px-3.5 py-2 text-sm font-semibold transition active:scale-95 ${
                    active ? 'bg-ink text-white shadow-lg shadow-ink/20' : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200'
                  }`}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </Sheet>
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
