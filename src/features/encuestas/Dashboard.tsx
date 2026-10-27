import Link from 'next/link';
import { NaviaLogo } from '@/features/brand/NaviaAgent';
import { fmtBs, fmtPct } from '@/features/guide/surveys';
import { DashboardTabs } from './DashboardTabs';
import { LeaveButton } from './LeaveButton';
import { Questions } from './Questions';
import { PRUEBA, summarize, toCsv, type Encuesta, type Meter, type Status } from './kpis';

const STATUS: Record<Status, { label: string; cls: string; bar: string }> = {
  confirma: { label: 'Confirma', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500' },
  iterar: { label: 'Zona gris', cls: 'bg-amber-50 text-amber-700 ring-amber-200', bar: 'bg-amber-500' },
  refuta: { label: 'Replantear', cls: 'bg-red-50 text-red-700 ring-red-200', bar: 'bg-red-500' },
  pocas: { label: 'Faltan respuestas', cls: 'bg-slate-100 text-slate-600 ring-slate-200', bar: 'bg-brand-500' },
};

const fecha = (iso: string) => new Date(iso).toLocaleString('es-VE', { timeZone: 'America/Caracas', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Chip({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${s.cls}`}>{s.label}</span>;
}

function MeterRow({ m }: { m: Meter }) {
  // Escala de la barra: 100 % en porcentajes, 5 en «de 5» y en la nota de 1 a 5.
  const max = m.unit === '%' ? 100 : 5;
  const at = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const meta = m.unit === '%' ? `${m.target} %` : m.unit === '/5' ? `${m.target}/5` : `${m.target} de 5`;
  const umbral = m.unit === '%' ? `${m.refute} %` : m.unit === '/5' ? `${m.refute.toLocaleString('es-VE')}/5` : `${m.refute} de 5`;
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{m.label}</span>
        <span className="text-xl font-extrabold tabular-nums">{m.display}</span>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-slate-100" aria-hidden>
        <div className={`h-full rounded-full ${STATUS[m.status].bar}`} style={{ width: at(m.value) }} />
        <span className="absolute -top-1 h-4.5 w-0.5 rounded bg-red-400" style={{ left: at(m.refute) }} />
        <span className="absolute -top-1 h-4.5 w-0.5 rounded bg-ink" style={{ left: at(m.target) }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Meta {meta} · replantear bajo {umbral}
        </span>
        <Chip status={m.status} />
      </div>
    </div>
  );
}

function Card({ tag, title, note, meters }: { tag: string; title: string; note?: string; meters: Meter[] }) {
  return (
    <section className="card rounded-3xl p-4">
      <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">{tag}</p>
      <h2 className="text-lg font-extrabold">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
      <div className="mt-1 divide-y divide-slate-100">
        {meters.map((m) => (
          <MeterRow key={m.label} m={m} />
        ))}
      </div>
    </section>
  );
}

function Prices({ title, data }: { title: string; data: ReturnType<typeof summarize>['precioEstudiantes'] }) {
  const max = Math.max(1, ...data.buckets.map((b) => b.n));
  return (
    <div>
      <p className="text-sm font-bold">
        {title} <span className="font-medium text-slate-500">({data.total})</span>
      </p>
      <p className="text-xs text-slate-500">Mediana: {data.medianPct === null ? '–' : `${fmtPct(data.medianPct)} del pasaje`}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {data.buckets.map((b) => (
          <li key={b.label} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-2 text-xs">
            <span className="text-slate-600">{b.label}</span>
            <span className="h-3 rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(b.n / max) * 100}%` }} />
            </span>
            <span className="text-right font-bold tabular-nums">{b.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Dashboard({ rows, error, name }: { rows: Encuesta[]; error: string | null; name: string }) {
  const s = summarize(rows);
  const quedan = Math.ceil((new Date(PRUEBA.corte).getTime() - Date.now()) / 86_400_000);
  const csv = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${toCsv(rows)}`)}`;
  const avance = Math.min(100, (s.estudiantes / PRUEBA.estudiantes) * 100);

  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-0 z-20 border-b border-white/60 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <NaviaLogo size={34} />
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">Encuestas</span>
          <span className="ml-auto hidden text-sm text-slate-500 sm:inline">{name}</span>
          <Link href="/panel" className="text-sm font-semibold text-brand-700">
            Panel del fiscal
          </Link>
          <LeaveButton />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 pt-4 pb-16">
        <section className="card rounded-3xl p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold">Prueba NavIA de 7 días</h1>
              <p className="text-sm text-slate-600">
                Mar 27 oct → corte lun 2 nov a las 12:00 · decisión mar 3 nov ·{' '}
                <b>{quedan > 0 ? `quedan ${quedan} ${quedan === 1 ? 'día' : 'días'}` : 'prueba cerrada'}</b>
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/encuestas" prefetch={false} className="btn-ghost px-3 py-2 text-sm">
                Actualizar
              </Link>
              <a href={csv} download="encuestas-navia.csv" className="btn-ghost px-3 py-2 text-sm">
                Descargar CSV
              </a>
            </div>
          </div>
          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">No se pudieron leer las encuestas: {error}</p>}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['Estudiantes', `${s.estudiantes}`, `de ${PRUEBA.estudiantes}`],
              ['Conductores', `${s.conductores}`, `de ${PRUEBA.conductores}`],
              ['Enlace conductor-fiscal', `${s.conductoresFiscal}`, 'respuestas'],
            ].map(([k, v, d]) => (
              <div key={k} className="rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200/70">
                <p className="text-2xl font-extrabold tabular-nums">{v}</p>
                <p className="text-xs text-slate-500">
                  {k} <span className="whitespace-nowrap">{d}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${avance}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">Muestra de estudiantes: {Math.round(avance)} % de la meta. Con 30 ya hay señal; antes de 10 los porcentajes no se califican.</p>
          </div>
        </section>

        <DashboardTabs
          results={
            <>
        <Card tag="KPI principal" title="Intención de adopción del estudiante" note="Anotarse al piloto pesa más: es un compromiso, no solo una opinión." meters={s.principal} />

        <div className="grid gap-4 md:grid-cols-2">
          <Card tag="Apoyo A" title="Valor percibido" meters={s.apoyoA} />
          <Card tag="Apoyo B" title="Conductores" note="Más la reunión de piloto con la asociación, que se anota aparte." meters={s.apoyoB} />
        </div>

        <section className="card rounded-3xl p-4">
          <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">Apoyo C · factor precio</p>
          <h2 className="text-lg font-extrabold">Cuánto pagarían por NavIA</h2>
          <p className="mt-0.5 text-xs text-slate-500">Respuesta libre en Bs, expresada como % del pasaje de 1.180 Bs. La decisión actual es 2,5 % por lado.</p>
          <div className="mt-1 divide-y divide-slate-100">
            {s.apoyoC.map((m) => (
              <MeterRow key={m.label} m={m} />
            ))}
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Prices title="Estudiantes: adicional al pasaje" data={s.precioEstudiantes} />
            <Prices title="Conductores: comisión por pasaje" data={s.precioConductores} />
          </div>
          {s.alternativas.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold">Otras formas de cobro que proponen los conductores</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {s.alternativas.map((a) => (
                  <li key={a.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200/70">
                    {a.texto}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="card rounded-3xl p-4">
            <h2 className="text-lg font-extrabold">Respuestas por día</h2>
            {s.porDia.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Todavía no hay respuestas.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1 font-semibold">Día</th>
                    <th className="py-1 text-right font-semibold">Estudiantes</th>
                    <th className="py-1 text-right font-semibold">Conductor-fiscal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {s.porDia.map((d) => (
                    <tr key={d.dia}>
                      <td className="py-1.5">{new Date(`${d.dia}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className="py-1.5 text-right font-bold">{d.est}</td>
                      <td className="py-1.5 text-right font-bold">{d.cf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card rounded-3xl p-4">
            <h2 className="text-lg font-extrabold">Qué le falta a NavIA</h2>
            <p className="text-xs text-slate-500">De quienes respondieron «No sé» o «No» a usarla.</p>
            {s.faltas.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nadie lo ha respondido todavía.</p>
            ) : (
              <ul className="mt-2 flex max-h-80 flex-col gap-2 overflow-y-auto">
                {s.faltas.map((f) => (
                  <li key={f.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200/70">
                    {f.texto}
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {f.audiencia === 'estudiante' ? 'Estudiante' : 'Conductor-fiscal'} · {fecha(f.fecha)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card rounded-3xl p-4">
          <h2 className="text-lg font-extrabold">Últimas respuestas</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="py-1 font-semibold">Fecha</th>
                  <th className="py-1 font-semibold">Enlace</th>
                  <th className="py-1 font-semibold">Correo</th>
                  <th className="py-1 font-semibold">¿La usaría?</th>
                  <th className="py-1 font-semibold">Piloto</th>
                  <th className="py-1 text-right font-semibold">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 25).map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 whitespace-nowrap">{fecha(r.created_at)}</td>
                    <td className="py-1.5">{r.audiencia === 'estudiante' ? 'Estudiante' : (r.respuestas.rol ?? 'Conductor-fiscal')}</td>
                    <td className="max-w-48 truncate py-1.5">{r.contacto ?? '–'}</td>
                    <td className="py-1.5">{r.respuestas.usaria ?? '–'}</td>
                    <td className="py-1.5">{r.respuestas.piloto ?? (r.contacto ? 'Sí' : '–')}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.respuestas.precio ? fmtBs(Number(r.respuestas.precio)) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 25 && <p className="mt-2 text-xs text-slate-500">Se muestran 25 de {rows.length}. El CSV las trae todas.</p>}
        </section>
            </>
          }
          questions={<Questions />}
        />
      </main>
    </div>
  );
}
