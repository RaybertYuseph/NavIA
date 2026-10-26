'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icons';
import { NaviaAgent } from '@/features/brand/NaviaAgent';

/**
 * Simulaciones del tour: pantallas animadas con datos de ejemplo que muestran un flujo completo
 * (marcar la parada, la camioneta que se acerca y el aviso, la ruta del conductor, la línea vista
 * por el fiscal). No tocan la base de datos: se ven igual con el día vacío o sin señal.
 */
export type SceneName =
  | 'student-mark'
  | 'student-approach'
  | 'student-live'
  | 'student-ask'
  | 'driver-available'
  | 'driver-route'
  | 'driver-offline'
  | 'fiscal-live'
  | 'fiscal-departures'
  | 'driver-pain'
  | 'driver-qr'
  | 'driver-wallet'
  | 'driver-paypain'
  | 'student-paypain'
  | 'student-wallet';

export function TourScene({ name }: { name: SceneName }) {
  const [run, setRun] = useState(0);
  const Scene = SCENES[name];
  return (
    <div className="relative">
      <div className="relative h-[290px] overflow-hidden rounded-3xl bg-linear-to-b from-brand-50 to-white ring-1 ring-slate-200">
        <Scene key={run} />
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setRun((r) => r + 1);
        }}
        className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200"
      >
        <Icon name="refresh" className="h-3.5 w-3.5" /> Repetir
      </button>
    </div>
  );
}

/** Avanza un cuadro cada `durations[i]` ms; termina en el cuadro `durations.length`. */
function useFrames(durations: number[]) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (f >= durations.length) return;
    const t = setTimeout(() => setF(f + 1), durations[f]);
    return () => clearTimeout(t);
  }, [f, durations]);
  return f;
}

// Duraciones fuera de los componentes: un arreglo nuevo en cada render reiniciaría el temporizador.
const T = {
  mark: [1300, 1300, 1400, 1600],
  approach: [2000, 2000, 2800],
  live: [1600, 1600, 1400, 2400],
  ask: [900, 1300, 2200, 1100, 1300],
  available: [1500, 1200, 1900],
  route: Array.from({ length: 10 }, (_, i) => (i % 2 ? 1300 : 1100)),
  offline: [1400, 1700, 1700],
  fiscal: [1600, 1900, 1900],
  departures: [1600, 1600, 2200, 2000],
  pain: [700, 900, 1100, 900, 1100, 900, 900, 900, 1300],
  qr: [1300, 1300, 2000, 1200, 1300, 2200],
  wallet: [1500, 1500, 1400, 1900],
  paypain: [1300, 1300, 1300, 1600, 1800],
  spain: [1300, 1900, 1600, 1500, 1700],
  swallet: [1500, 1500, 1900, 2000],
};

/* ───────────────────────── Piezas comunes ───────────────────────── */

const ROUTE = [
  { name: 'Castillejo', x: 10, y: 82 },
  { name: 'Unefa', x: 30, y: 62 },
  { name: 'Buenaventura', x: 50, y: 70 },
  { name: 'Trapichito', x: 70, y: 44 },
  { name: 'USM', x: 90, y: 22 },
];

/** Aviso del teléfono que baja desde arriba, como una notificación real. */
function Notice({ show, title, body, bottom = false }: { show: boolean; title: string; body: string; bottom?: boolean }) {
  const hidden = bottom ? 'translate-y-28 opacity-0' : '-translate-y-28 opacity-0';
  return (
    <div
      aria-live="polite"
      className={`absolute inset-x-2 z-10 flex items-start gap-2 rounded-2xl bg-white/95 p-2.5 shadow-lg ring-1 ring-slate-200 transition-all duration-500 ${
        bottom ? 'bottom-10' : 'top-2'
      } ${show ? 'translate-y-0 opacity-100' : hidden}`}
    >
      <NaviaAgent size={30} compact />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
          NavIA <span>ahora</span>
        </span>
        <span className="block text-sm leading-snug font-bold">{title}</span>
        <span className="block text-xs leading-snug text-slate-600">{body}</span>
      </span>
    </div>
  );
}

function Bus({ x, y, label, tone = 'brand', pulse = false }: { x: number; y: number; label?: string; tone?: 'brand' | 'emerald' | 'indigo'; pulse?: boolean }) {
  const bg = tone === 'brand' ? 'bg-brand-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500';
  return (
    <div className="absolute z-[5] -translate-x-1/2 -translate-y-1/2 transition-all duration-[1100ms] ease-in-out" style={{ left: `${x}%`, top: `${y}%` }}>
      <span className={`relative flex h-8 w-8 items-center justify-center rounded-full ${bg} text-white shadow-lg ring-2 ring-white`}>
        {pulse && <span className={`absolute inset-0 animate-ping rounded-full ${bg} opacity-40`} />}
        <Icon name="bus" className="h-4.5 w-4.5" />
      </span>
      {label && <span className="absolute top-8 left-1/2 -translate-x-1/2 rounded bg-white/90 px-1 text-[10px] font-bold whitespace-nowrap shadow-sm">{label}</span>}
    </div>
  );
}

/** Mapa de ejemplo: la ruta como línea y sus paradas; `mine` resalta la parada del estudiante. */
function MiniMap({ mine, done = -1, children }: { mine?: number; done?: number; children?: React.ReactNode }) {
  return (
    <div className="absolute inset-0">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d="M0 30 Q40 20 100 60" stroke="#e2e8f0" strokeWidth="6" fill="none" vectorEffect="non-scaling-stroke" />
        <path d="M20 100 Q35 50 100 85" stroke="#e2e8f0" strokeWidth="5" fill="none" vectorEffect="non-scaling-stroke" />
        <polyline points={ROUTE.map((s) => `${s.x},${s.y}`).join(' ')} stroke="#7dd6fd" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {ROUTE.map((s, i) => (
        <div key={s.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          <span
            className={`block rounded-full ring-2 ring-white ${i === mine ? 'h-4 w-4 bg-amber-400' : i <= done ? 'h-3 w-3 bg-brand-300' : 'h-3 w-3 bg-brand-600'}`}
          />
          <span className={`absolute top-3.5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap ${i === mine ? 'font-extrabold text-amber-700' : 'font-semibold text-slate-500'}`}>
            {i === mine ? `📍 ${s.name}` : s.name}
          </span>
        </div>
      ))}
      {children}
    </div>
  );
}

/** Marca de "toque" sobre el botón que NavIA pulsa en la simulación. */
const tap = (on: boolean) => (on ? 'scale-95 ring-4 ring-brand-300' : '');

function Phone({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col gap-2 p-3 pb-10">{children}</div>;
}

/* ───────────────────────── Estudiante ───────────────────────── */

function StudentMark() {
  const f = useFrames(T.mark);
  const stops = ['Unefa', 'Buenaventura', 'Trapichito'];
  if (f >= 4) {
    return (
      <Phone>
        <div className="tour-pop card rounded-3xl p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">Esperas en</p>
              <p className="text-lg font-extrabold">Trapichito</p>
              <p className="text-xs text-slate-600">Salida 6:30 · Guatire → Guarenas → USM</p>
            </div>
            <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-800">Tú y 3 más</span>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-700">La camioneta está a 3 paradas.</p>
        </div>
        <div className="tour-pop flex items-center gap-2 rounded-2xl bg-emerald-50 p-2.5 text-xs text-emerald-900 ring-1 ring-emerald-200">
          <Icon name="bus" className="h-5 w-5 shrink-0" />
          <span>
            <b>El conductor ve:</b> Trapichito · 4 esperando. Así sabe que debe parar.
          </span>
        </div>
      </Phone>
    );
  }
  return (
    <Phone>
      <p className="rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-slate-200">
        <span className="block text-slate-500">Salida</span>
        <b>6:30 · Guatire → Guarenas → USM</b>
      </p>
      <p className="text-xs font-semibold text-slate-600">¿En qué parada estás?</p>
      <ul className="flex flex-col gap-1.5">
        {stops.map((s, i) => {
          const active = f >= 1 && s === 'Trapichito';
          return (
            <li
              key={s}
              className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm transition ${active ? `bg-brand-50 font-bold ring-2 ring-brand-400 ${tap(f === 1)}` : 'bg-white ring-1 ring-slate-200'}`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {active ? '✓' : i + 2}
              </span>
              <span className="flex-1">{s}</span>
              <span className="rounded-full bg-cyan-100 px-1.5 text-[10px] font-bold text-cyan-800">{[1, 2, 3][i]} esperando</span>
            </li>
          );
        })}
      </ul>
      <span className={`btn-primary transition ${tap(f === 2)} ${f < 1 ? 'opacity-40' : ''}`}>
        {f === 2 ? 'Buscando tu ubicación…' : f === 3 ? '✓ Estás a 23 m de Trapichito' : '📍 Estoy aquí'}
      </span>
    </Phone>
  );
}

function StudentApproach() {
  const f = useFrames(T.approach);
  const bus = Math.min(f, 3);
  const away = 3 - bus;
  const text = away === 0 ? '🚌 ¡Llegó tu camioneta a Trapichito!' : away === 1 ? '¡Tu parada es la siguiente! Prepárate.' : `La camioneta está a ${away} paradas.`;
  return (
    <>
      <Notice
        show={f >= 2}
        title={f >= 3 ? '🚌 Llegó tu camioneta' : 'Tu camioneta viene a tu parada'}
        body={f >= 3 ? 'AB123CD está en Trapichito. ¡Buen viaje!' : 'AB123CD salió de Buenaventura. Llega a Trapichito en unos 4 min.'}
      />
      <div className="absolute inset-x-0 top-16 bottom-24">
        <MiniMap mine={3} done={bus - 1}>
          <Bus x={ROUTE[bus].x} y={ROUTE[bus].y} label="AB123CD" pulse={f >= 3} />
        </MiniMap>
      </div>
      <div className="absolute inset-x-2 bottom-10 rounded-2xl bg-white/95 p-2.5 shadow-md ring-1 ring-slate-200">
        <p className="text-xs text-slate-500">Esperas en Trapichito · {f >= 3 ? 'el contador vuelve a 0' : 'Tú y 3 más'}</p>
        <p className={`text-sm font-bold ${away <= 1 ? 'text-brand-700' : ''}`}>{text}</p>
      </div>
    </>
  );
}

function StudentLive() {
  const f = useFrames(T.live);
  const a = ROUTE[Math.min(f + 1, 4)];
  const bPath = [
    { x: 18, y: 30 },
    { x: 34, y: 27 },
    { x: 50, y: 30 },
    { x: 64, y: 38 },
    { x: 76, y: 45 },
  ][Math.min(f, 4)];
  return (
    <>
      <MiniMap>
        <Bus x={a.x} y={a.y} label="AB123CD" pulse={f >= 3} />
        <Bus x={bPath.x} y={bPath.y} label="AC456EF" tone="emerald" />
        <Bus x={10} y={82} label="AD789GH · cargando" tone="indigo" />
      </MiniMap>
      <div className="absolute inset-x-2 top-2 flex gap-1.5">
        <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-brand-700 shadow-sm">2 en camino</span>
        <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold text-indigo-700 shadow-sm">1 cargando</span>
      </div>
      {f >= 3 && (
        <div className="tour-pop absolute inset-x-2 bottom-10 flex gap-2.5 rounded-2xl bg-white p-2.5 shadow-lg ring-1 ring-slate-200">
          <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-300 to-indigo-400 text-white">
            <Icon name="bus" className="h-7 w-7" />
          </span>
          <span className="min-w-0 text-xs">
            <b className="block text-sm">AB123CD · Guatire → Guarenas → USM</b>
            Va por Trapichito · llega a la USM en unos 6 min
          </span>
        </div>
      )}
    </>
  );
}

function StudentAsk() {
  const f = useFrames(T.ask);
  const bubble = (me: boolean, text: string, key: string) => (
    <p key={key} className={`tour-pop max-w-[85%] rounded-2xl px-3 py-2 text-sm ${me ? 'self-end rounded-br-md bg-brand-500 text-white' : 'self-start rounded-bl-md bg-white ring-1 ring-slate-200'}`}>
      {text}
    </p>
  );
  const typing = (
    <p className="self-start rounded-2xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
      <span className="typing-dot" /> <span className="typing-dot [animation-delay:.15s]" /> <span className="typing-dot [animation-delay:.3s]" />
    </p>
  );
  return (
    <Phone>
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <NaviaAgent size={28} compact />
        <b className="text-sm">NavIA</b>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-1.5 pb-6">
        {f >= 0 && bubble(true, '¿Dónde viene mi camioneta?', 'q1')}
        {f === 1 && typing}
        {f >= 2 && bubble(false, 'AB123CD va por Buenaventura. Llega a Trapichito en unos 4 minutos.', 'a1')}
        {f >= 3 && bubble(true, '¿A qué hora sale la próxima?', 'q2')}
        {f === 4 && typing}
        {f >= 5 && bubble(false, 'La próxima sale de Castillejo a las 7:00. Ya está confirmada.', 'a2')}
      </div>
    </Phone>
  );
}

/* ───────────────────────── Conductor ───────────────────────── */

function DriverAvailable() {
  const f = useFrames(T.available);
  return (
    <Phone>
      <div className="card rounded-3xl p-3">
        <p className="text-xs text-slate-500">Tu unidad</p>
        <p className="font-extrabold">AB123CD · Guatire → Guarenas → USM</p>
        <label className="mt-2 block text-xs font-semibold text-slate-600">¿A qué hora sales?</label>
        <p className={`mt-1 rounded-xl bg-white px-3 py-2 text-lg font-bold ring-1 transition ${f >= 1 ? 'ring-brand-400' : 'ring-slate-200'}`}>{f >= 1 ? '6:30' : '--:--'}</p>
      </div>
      <span className={`btn-primary transition ${tap(f === 1)}`}>{f >= 2 ? '✓ Salida de las 6:30 confirmada' : 'Estoy disponible en Castillejo'}</span>
      {f >= 3 && (
        <div className="tour-pop grid grid-cols-2 gap-2 text-xs">
          <span className="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
            <b className="block text-ink">Fiscal</b>1 unidad disponible en Castillejo
          </span>
          <span className="rounded-2xl bg-white p-2 ring-1 ring-slate-200">
            <b className="block text-ink">Estudiantes</b>Próxima salida 6:30 · AB123CD
          </span>
        </div>
      )}
    </Phone>
  );
}

const DRIVER_STOPS = [
  { name: 'Castillejo', waiting: 2 },
  { name: 'Unefa', waiting: 3 },
  { name: 'Buenaventura', waiting: 2 },
  { name: 'Trapichito', waiting: 4 },
  { name: 'USM', waiting: 0 },
];

function DriverRoute() {
  const f = useFrames(T.route);
  const finished = f >= 10;
  const s = Math.min(Math.floor(f / 2), 4); // parada en curso
  const atStop = f % 2 === 1; // ya llegó: toca "Ya subieron todos"
  const cleared = (i: number) => finished || i < s || (i === s && atStop);
  const boarded = DRIVER_STOPS.reduce((n, st, i) => n + (cleared(i) ? st.waiting : 0), 0);
  const stop = DRIVER_STOPS[s];
  const button = finished
    ? { top: 'Ruta completa', main: `✓ Terminada · ${boarded} abordaron` }
    : !atStop
      ? { top: s === 0 ? 'Parada de salida' : `Próxima parada · ${stop.waiting} esperando`, main: `Llegué a ${stop.name}` }
      : s === 4
        ? { top: 'En USM · última parada', main: 'Terminar ruta' }
        : { top: `Cargando en ${stop.name}`, main: 'Ya subieron todos' };
  return (
    <Phone>
      <span key={f} className={`tour-pop flex flex-col items-center rounded-2xl bg-linear-to-br from-brand-400 to-indigo-500 px-3 py-2.5 text-white shadow-md ${finished ? 'from-emerald-400 to-teal-500' : ''}`}>
        <span className="text-xs opacity-90">{button.top}</span>
        <span className="text-lg font-extrabold">{button.main}</span>
      </span>
      <p className="h-4 text-center text-[11px] font-semibold text-emerald-700">
        {atStop && stop.waiting > 0 && !finished ? `Aviso enviado a ${stop.waiting} estudiantes: «Llegó tu camioneta»` : ''}
      </p>
      <ul className="card flex flex-col gap-1 rounded-2xl p-2">
        {DRIVER_STOPS.map((st, i) => (
          <li key={st.name} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm ${i === s && !finished ? 'bg-brand-50 font-bold' : ''}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${cleared(i) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {cleared(i) ? '✓' : i + 1}
            </span>
            <span className="flex-1">{st.name}</span>
            {st.waiting > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${cleared(i) ? 'bg-slate-100 text-slate-400 line-through' : 'bg-cyan-100 text-cyan-800'}`}>{st.waiting} esperando</span>
            )}
          </li>
        ))}
      </ul>
    </Phone>
  );
}

function DriverOffline() {
  const f = useFrames(T.offline);
  const online = f === 0 || f >= 3;
  const pending = f === 1 ? 1 : f === 2 ? 2 : 0;
  return (
    <Phone>
      <span className={`self-start rounded-full px-2.5 py-1 text-xs font-bold transition ${online ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
        <Icon name="signal" className="mr-1 inline h-3.5 w-3.5" />
        {online ? (f >= 3 ? 'Señal de vuelta' : 'Con señal') : 'Sin señal'}
      </span>
      <span key={f} className={`tour-pop btn-primary ${tap(f === 1 || f === 2)}`}>{f <= 1 ? 'Llegué a Buenaventura' : 'Ya subieron todos'}</span>
      <div className="card rounded-2xl p-3 text-sm">
        {f === 0 && <p>Vas en camino. Cada botón que tocas se envía al instante.</p>}
        {pending > 0 && (
          <p className="tour-pop">
            <b>Guardado en el teléfono.</b> {pending} {pending === 1 ? 'aviso pendiente' : 'avisos pendientes'}: se envían apenas vuelva la señal.
          </p>
        )}
        {f >= 3 && (
          <p className="tour-pop text-emerald-800">
            <b>✓ Avisos enviados.</b> El fiscal y los estudiantes ya ven que pasaste por Buenaventura, con la hora real.
          </p>
        )}
      </div>
    </Phone>
  );
}

/* ───────────────────────── Fiscal ───────────────────────── */

function FiscalLive() {
  const f = useFrames(T.fiscal);
  const k = [
    { ruta: 1, disp: 1, fuera: 1, esp: 7 },
    { ruta: 1, disp: 2, fuera: 1, esp: 8 },
    { ruta: 2, disp: 1, fuera: 1, esp: 9 },
    { ruta: 2, disp: 1, fuera: 1, esp: 5 },
  ][f];
  const tiles = [
    ['En ruta', k.ruta, 'text-brand-700'],
    ['Disponibles', k.disp, 'text-emerald-700'],
    ['Fuera de servicio', k.fuera, 'text-slate-500'],
    ['Esperando', k.esp, 'text-cyan-700'],
  ] as const;
  return (
    <>
      <Notice bottom show={f === 1 || f === 2} title={f === 1 ? 'AD789GH disponible' : 'AC456EF arrancó'} body={f === 1 ? 'En Nueva Casarapa, sale a las 7:00.' : 'Salida de las 6:45 desde Castillejo, 4 estudiantes esperando.'} />
      <div className="absolute inset-x-2 top-2 grid grid-cols-4 gap-1.5">
        {tiles.map(([label, n, color]) => (
          <span key={label} className="rounded-xl bg-white/95 p-1.5 text-center shadow-sm ring-1 ring-slate-200">
            <b key={`${label}${n}`} className={`tour-pop block text-lg leading-none ${color}`}>{n}</b>
            <span className="text-[9px] leading-none text-slate-500">{label}</span>
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0 top-16 bottom-0">
        <MiniMap>
          <Bus x={ROUTE[Math.min(f + 1, 4)].x} y={ROUTE[Math.min(f + 1, 4)].y} label="AB123CD" />
          <Bus x={f >= 2 ? ROUTE[f - 1].x : 10} y={f >= 2 ? ROUTE[f - 1].y : 82} label="AC456EF" tone="emerald" />
        </MiniMap>
      </div>
    </>
  );
}

function FiscalDepartures() {
  const f = useFrames(T.departures);
  const rows = [
    { hour: '6:30', plate: 'AB123CD', state: f >= 3 ? 'Finalizada' : 'En camino', detail: f >= 3 ? '9 abordaron' : 'va por Trapichito', tone: f >= 3 ? 'bg-slate-100 text-slate-600' : 'bg-brand-100 text-brand-800' },
    { hour: '6:45', plate: 'AC456EF', state: f >= 1 ? 'En camino' : 'Cargando', detail: f >= 1 ? 'va por Unefa' : 'en Castillejo', tone: f >= 1 ? 'bg-brand-100 text-brand-800' : 'bg-indigo-100 text-indigo-800' },
    { hour: '7:00', plate: 'AD789GH', state: 'Programada', detail: 'Nueva Casarapa', tone: 'bg-amber-100 text-amber-800' },
  ];
  return (
    <Phone>
      <div className="flex items-center justify-between">
        <b className="text-sm">Salidas de hoy · Guatire → USM</b>
        <span key={f} className="tour-pop rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-800">{[7, 6, 6, 4][Math.min(f, 3)]} esperando</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.plate} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 text-xs ring-1 ring-slate-200">
            <b className="w-9 text-sm">{r.hour}</b>
            <span className="min-w-0 flex-1">
              <b className="block">{r.plate}</b>
              <span className="text-slate-500">{r.detail}</span>
            </span>
            <span key={r.state} className={`tour-pop rounded-full px-2 py-0.5 font-bold ${r.tone}`}>{r.state}</span>
          </li>
        ))}
      </ul>
      {f === 2 && (
        <p className="tour-pop rounded-xl bg-red-50 p-2 text-xs text-red-800 ring-1 ring-red-200">
          <b>AC456EF dejó de enviar ubicación hace 3 min.</b> Puede ser falta de señal: llama al conductor si no vuelve.
        </p>
      )}
      {f >= 3 && <p className="tour-pop rounded-xl bg-emerald-50 p-2 text-xs text-emerald-800 ring-1 ring-emerald-200">✓ AC456EF volvió a enviar ubicación.</p>}
    </Phone>
  );
}

/* ───────────────────────── Conductor: hoy y release 2 ───────────────────────── */

const GROUP = [
  { who: 'Ana', text: '¿Ya salió la de las 6:30?' },
  { who: 'José', text: '¿Dónde vienes??' },
  { who: 'me', text: '🎤 0:07 · Voy saliendo de Castillejo' },
  { who: 'Luis', text: '¿Pasaste por Unefa? Estoy ahí' },
  { who: 'María', text: '📷 Captura · Te hice el pago móvil, ¿te llegó?' },
  { who: 'Pedro', text: 'Yo también te pagué 👆' },
  { who: 'Ana', text: '¿Cuánto falta para Trapichito?' },
  { who: 'Carla', text: '¿Ya pasaste?? 😡' },
];

/** Así es hoy: el grupo de WhatsApp de la ruta mientras el conductor maneja. */
function DriverPain() {
  const f = useFrames(T.pain);
  const shown = GROUP.slice(0, Math.min(f + 1, GROUP.length));
  return (
    <div className="absolute inset-0 flex flex-col bg-[#efeae2]">
      <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2 text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
          <Icon name="users" className="h-4 w-4" />
        </span>
        <span className="flex-1 text-sm leading-tight font-bold">
          Ruta Guatire → USM 🚌
          <span className="block text-[10px] font-normal opacity-80">48 participantes</span>
        </span>
        <span key={shown.length} className="tour-pop rounded-full bg-[#25d366] px-2 py-0.5 text-[11px] font-bold">
          {12 + shown.length * 3} sin leer
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-1 overflow-hidden px-2 pb-10">
        {shown.slice(-6).map((m) => (
          <p
            key={`${m.who}${m.text}`}
            className={`tour-pop max-w-[82%] rounded-lg px-2 py-1 text-xs shadow-sm ${m.who === 'me' ? 'self-end bg-[#d9fdd3]' : 'self-start bg-white'}`}
          >
            {m.who !== 'me' && <b className="block text-[10px] text-[#128c7e]">{m.who}</b>}
            {m.text}
          </p>
        ))}
      </div>
      {f >= 9 && (
        <p className="tour-pop absolute inset-x-2 bottom-10 rounded-xl bg-red-600 p-2.5 text-xs font-semibold text-white shadow-lg">
          Mientras maneja: responde dónde viene y cuál es la próxima parada, y revisa los pagos móviles uno por uno en el banco.
        </p>
      )}
    </div>
  );
}

/** Patrón fijo de un código QR de ejemplo (no codifica nada). */
function FakeQr({ seed, big = false }: { seed: number; big?: boolean }) {
  const cells = Array.from({ length: 81 }, (_, i) => {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const finder = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
    return finder ? !(r % 6 === 1 && c % 6 === 1) : ((i * 7 + seed * 13) % 5) < 2;
  });
  return (
    <span className={`grid grid-cols-9 gap-px rounded-md bg-white p-1.5 ${big ? 'h-32 w-32' : 'h-24 w-24'}`}>
      {cells.map((on, i) => (
        <span key={i} className={on ? 'bg-ink' : 'bg-white'} />
      ))}
    </span>
  );
}

function Release2() {
  return <span className="absolute bottom-2 left-2 z-10 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">Release 2 · simulación</span>;
}

/** Release 2: el conductor escanea el QR del estudiante y ve al instante si el pasaje está pago. */
function DriverQr() {
  const f = useFrames(T.qr);
  const second = f >= 3;
  const result = f === 2 ? 'ok' : f >= 5 ? 'used' : null;
  const count = f >= 2 ? 13 : 12;
  return (
    <Phone>
      <Release2 />
      <div className="flex items-center justify-between text-xs">
        <b className="text-sm">Cobrar pasaje</b>
        <span key={count} className="tour-pop rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
          Hoy: {count} pasajes
        </span>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-ink">
        <span className="absolute inset-6 rounded-xl border-2 border-dashed border-white/40" />
        {f >= 1 && f !== 3 && <FakeQr key={second ? 2 : 1} seed={second ? 2 : 1} />}
        {(f === 1 || f === 4) && <span className="absolute inset-x-10 top-1/2 h-0.5 animate-pulse bg-brand-300 shadow-[0_0_12px_2px] shadow-brand-300" />}
        {(f === 0 || f === 3) && <span className="text-xs text-white/70">Apunta al QR del estudiante</span>}
        {result && (
          <span
            className={`tour-pop absolute inset-x-3 bottom-3 rounded-xl p-2.5 text-xs text-white shadow-lg ${result === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}
          >
            {result === 'ok' ? (
              <>
                <b className="block text-sm">✓ Pasaje cobrado · 1.180 Bs</b>Andrea M. · paquete semanal, le quedan 7 pasajes
              </>
            ) : (
              <>
                <b className="block text-sm">✗ Este QR ya se usó hoy a las 6:32</b>No cobres dos veces: pídele su propio QR o pago móvil.
              </>
            )}
          </span>
        )}
      </div>
    </Phone>
  );
}

/** Release 2: cierre del día del conductor con pasajes, total, comisión y paso a su cuenta. */
function DriverWallet() {
  const f = useFrames(T.wallet);
  return (
    <Phone>
      <Release2 />
      <b className="text-sm">Cierre del día · lun 26 oct</b>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[
          ['Pasajes', '54'],
          ['Cobrado', '63.720 Bs'],
          ['Neto', '62.127 Bs'],
        ].map(([l, v]) => (
          <span key={l} className="rounded-xl bg-white p-1.5 ring-1 ring-slate-200">
            <b className="block text-sm leading-tight">{v}</b>
            <span className="text-[10px] text-slate-500">{l}</span>
          </span>
        ))}
      </div>
      {f >= 1 && (
        <ul className="tour-pop flex flex-col gap-1 rounded-xl bg-white p-2 text-xs ring-1 ring-slate-200">
          <li className="flex justify-between">
            <span>6:30 · Guatire → USM · 28 pasajes</span>
            <b>33.040 Bs</b>
          </li>
          <li className="flex justify-between">
            <span>10:30 · Guatire → USM · 26 pasajes</span>
            <b>30.680 Bs</b>
          </li>
          <li className="flex justify-between border-t border-slate-100 pt-1 text-slate-500">
            <span>Comisión NavIA 2,5% (tu parte)</span>
            <span>−1.593 Bs</span>
          </li>
        </ul>
      )}
      {f >= 2 && (
        <span className={`tour-pop btn-primary text-sm ${tap(f === 2)}`}>
          {f === 2 ? 'Transferir a mi cuenta' : f === 3 ? 'Enviando a tu cuenta ****4821…' : '✓ 62.127 Bs en tu cuenta'}
        </span>
      )}
    </Phone>
  );
}

/* ───────────────────────── El pago hoy y con saldo NavIA ───────────────────────── */

/** Así se paga hoy: datos dictados en la puerta y la app del banco que no carga con poca señal. */
function StudentPayPain() {
  const f = useFrames(T.spain);
  return (
    <Phone>
      <p className="tour-pop rounded-2xl bg-white p-2.5 text-sm ring-1 ring-slate-200">
        <b className="block text-xs text-slate-500">En la puerta de la camioneta</b>
        {f === 0 ? '—¿Me pasas los datos del pago móvil?' : '—0414 555 12 34, cédula 12.345.678, Banesco… ¿lo anotaste?'}
      </p>
      {f >= 2 && (
        <div className="tour-pop flex flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl bg-white ring-1 ring-slate-200">
          <span className="flex items-end gap-0.5" aria-label="Una barra de señal">
            {[1, 2, 3, 4].map((b) => (
              <span key={b} className={`w-1.5 rounded-sm ${b === 1 ? 'bg-red-500' : 'bg-slate-200'}`} style={{ height: `${b * 5}px` }} />
            ))}
          </span>
          <b className="text-sm">App del banco</b>
          <span className={`text-xs ${f >= 3 ? 'font-bold text-red-700' : 'text-slate-500'}`}>
            {f >= 3 ? 'Tiempo de espera agotado. Intenta de nuevo.' : 'Escaneando el QR del banco… cargando'}
          </span>
        </div>
      )}
      {f >= 4 && (
        <p className="tour-pop rounded-xl bg-red-600 p-2.5 text-xs font-semibold text-white shadow-lg">
          3 compañeros esperan detrás de ti. Pagar así toma de 2 a 4 minutos por estudiante.
        </p>
      )}
    </Phone>
  );
}

/** Release 2: el estudiante paga con su saldo NavIA mostrando el QR de la app. */
function StudentWallet() {
  const f = useFrames(T.swallet);
  const saldo = f >= 3 ? '4.690' : '5.900';
  return (
    <Phone>
      <Release2 />
      <div className="flex items-center justify-between rounded-2xl bg-linear-to-br from-brand-400 to-indigo-500 p-3 text-white shadow-md">
        <span>
          <span className="block text-[11px] opacity-90">Saldo NavIA</span>
          <b key={saldo} className="tour-pop block text-xl leading-tight">{saldo} Bs</b>
          <span className="text-[10px] opacity-90">{f >= 3 ? 'Te alcanza para 3 pasajes' : 'Te alcanza para 4 pasajes'}</span>
        </span>
        <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">+ Recargar</span>
      </div>
      {f === 0 && <span className="btn-primary">Pagar mi pasaje</span>}
      {f === 1 && <span className={`btn-primary ${tap(true)}`}>Pagar mi pasaje</span>}
      {f >= 2 && f < 3 && (
        <div className="tour-pop flex flex-1 flex-col items-center justify-center gap-1">
          <FakeQr seed={3} big />
          <span className="text-xs font-semibold text-slate-600">Muéstraselo al conductor · sirve sin señal</span>
        </div>
      )}
      {f >= 3 && (
        <div className="tour-pop flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-50 p-3 text-center ring-1 ring-emerald-200">
          <b className="text-lg text-emerald-800">✓ Pasaje pagado</b>
          <span className="text-xs text-emerald-900">1.210 Bs · AB123CD · 6:31 · en 3 segundos</span>
          {f >= 4 && <span className="tour-pop mt-1 text-[11px] text-slate-600">Recargas en casa, con buena señal, y en la puerta solo muestras el QR.</span>}
        </div>
      )}
    </Phone>
  );
}

/** Así cobra hoy el conductor: capturas por WhatsApp contra movimientos del banco, uno por uno. */
function DriverPayPain() {
  const f = useFrames(T.paypain);
  const moves = [
    ['6:28', 'Pago móvil 0414-***-12', '1.180,00'],
    ['6:29', 'Pago móvil 0424-***-87', '1.000,00'],
    ['6:31', 'Pago móvil 0412-***-55', '1.180,00'],
    ['6:31', 'Pago móvil 0416-***-03', '1.180,00'],
  ];
  return (
    <Phone>
      <div className="grid grid-cols-2 gap-2">
        <span className="rounded-xl bg-[#d9fdd3] p-2 text-[11px] shadow-sm">
          <b className="block text-[#128c7e]">María</b>📷 Captura · 1.180 Bs · 6:31 «ya te pagué»
        </span>
        <span className="rounded-xl bg-[#d9fdd3] p-2 text-[11px] shadow-sm">
          <b className="block text-[#128c7e]">Pedro</b>📷 Captura · 1.180 Bs · 6:30
        </span>
      </div>
      <div className="flex flex-col gap-1 rounded-2xl bg-white p-2 ring-1 ring-slate-200">
        <b className="text-xs text-slate-500">Banco · movimientos de hoy</b>
        {moves.slice(0, Math.min(f + 1, 4)).map(([h, d, a]) => (
          <span key={h + d} className={`tour-pop flex justify-between text-[11px] ${a !== '1.180,00' ? 'font-bold text-red-700' : ''}`}>
            <span>
              {h} · {d}
            </span>
            <span>{a}</span>
          </span>
        ))}
      </div>
      {f >= 4 && (
        <p className="tour-pop rounded-xl bg-red-600 p-2.5 text-xs font-semibold text-white shadow-lg">
          28 capturas, 25 pagos en el banco, uno de 1.000 Bs. ¿Quién no pagó? Revisarlo toma la noche entera.
        </p>
      )}
    </Phone>
  );
}

const SCENES: Record<SceneName, () => React.ReactElement> = {
  'student-mark': StudentMark,
  'student-approach': StudentApproach,
  'student-live': StudentLive,
  'student-ask': StudentAsk,
  'driver-available': DriverAvailable,
  'driver-route': DriverRoute,
  'driver-offline': DriverOffline,
  'fiscal-live': FiscalLive,
  'fiscal-departures': FiscalDepartures,
  'driver-pain': DriverPain,
  'driver-qr': DriverQr,
  'driver-wallet': DriverWallet,
  'driver-paypain': DriverPayPain,
  'student-paypain': StudentPayPain,
  'student-wallet': StudentWallet,
};
