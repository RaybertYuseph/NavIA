import Link from 'next/link';
import { NaviaLogo } from '@/features/brand/NaviaAgent';
import { fmtBs, fmtPct } from '@/features/guide/surveys';
import { DashboardTabs } from './DashboardTabs';
import { LeaveButton } from './LeaveButton';
import { Questions } from './Questions';
import { PASOS, PRUEBA, RESPONSABLE, diarioCsv, funnel, summarize, toCsv, type DemoEvento, type Encuesta, type Meter, type Status } from './kpis';

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
          {m.range && m.status !== 'pocas' && (
            <span className="block">
              Rango plausible (95 %): {Math.round(m.range[0])}–{Math.round(m.range[1])} %
            </span>
          )}
        </span>
        <Chip status={m.status} />
      </div>
    </div>
  );
}

function Card({ tag, title, note, meters }: { tag: string; title: string; note?: string; meters: Meter[] }) {
  return (
    <section className="card rounded-3xl p-4">
      <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">
        {tag} <span className="font-semibold text-slate-400 normal-case">· responsable: {RESPONSABLE}</span>
      </p>
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

const csvHref = (text: string) => `data:text/csv;charset=utf-8,${encodeURIComponent(`\ufeff${text}`)}`;

function Counts({ title, items }: { title: string; items: [string, number][] }) {
  return (
    <div>
      <p className="text-sm font-bold">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">Sin datos todavía.</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {items.map(([k, n]) => (
            <li key={k} className="rounded-full bg-slate-50 px-2.5 py-1 text-xs ring-1 ring-slate-200/70">
              {k} <b className="tabular-nums">{n}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ENLACE: Record<string, string> = { estudiante: 'Estudiante', 'conductor-fiscal': 'Conductor-fiscal' };

function Funnel({ eventos, error }: { eventos: DemoEvento[]; error: string | null }) {
  const f = funnel(eventos);
  return (
    <section className="card rounded-3xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">Embudo · registro diario</p>
          <h2 className="text-lg font-extrabold">Alcanzadas → vieron → actuaron</h2>
          <p className="mt-0.5 text-xs text-slate-500">Personas distintas (una por navegador) en cada paso, desde que se activó el registro. Entre paréntesis, el % sobre quienes abrieron el enlace; pasa el cursor por el número para ver el detalle.</p>
        </div>
        {f.diario.length > 0 && (
          <a href={csvHref(diarioCsv(f.diario))} download="registro-diario-navia.csv" className="btn-ghost px-3 py-2 text-sm">
            Registro diario CSV
          </a>
        )}
      </div>
      {error ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Falta crear la tabla del embudo: corre <b>0015_demo_eventos.sql</b> en Supabase ({error}).
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {f.porEnlace.map(({ audiencia, pasos }) => {
              const top = Math.max(1, pasos[0].n);
              return (
                <div key={audiencia}>
                  <p className="text-sm font-bold">{ENLACE[audiencia]}</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {pasos.map((p, i) => (
                      <li key={p.evento} className="grid grid-cols-[9.5rem_1fr_5.5rem] items-center gap-2 text-xs">
                        <span className="text-slate-600">{p.label}</span>
                        <span className="h-3 rounded-full bg-slate-100">
                          <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(p.n / top) * 100}%` }} />
                        </span>
                        <span
                          className="whitespace-nowrap text-right tabular-nums"
                          title={i > 0 && pasos[0].n > 0 ? `${p.n} de ${pasos[0].n} que abrieron el enlace (${Math.round((p.n / pasos[0].n) * 100)} %)` : undefined}
                        >
                          <b>{p.n}</b>
                          {i > 0 && pasos[0].n > 0 && <span className="ml-1 text-slate-400">({Math.round((p.n / pasos[0].n) * 100)} %)</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {f.diario.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-1 font-semibold">Día</th>
                    <th className="py-1 font-semibold">Enlace</th>
                    <th className="py-1 font-semibold">Canal</th>
                    {PASOS.map((p) => (
                      <th key={p.evento} className="py-1 text-right font-semibold">
                        {p.label.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {f.diario.map((d) => (
                    <tr key={`${d.dia}${d.audiencia}${d.canal}`}>
                      <td className="py-1.5">{new Date(`${d.dia}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className="py-1.5">{ENLACE[d.audiencia]}</td>
                      <td className="py-1.5">{d.canal}</td>
                      {PASOS.map((p) => (
                        <td key={p.evento} className="py-1.5 text-right font-bold">
                          {d.audiencia === 'conductor-fiscal' && p.evento === 'video' ? '–' : d[p.evento]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-500">El CSV trae columnas vacías de «¿del segmento?» y «notas» para completar a mano (incidentes, objeciones, citas sin nombres).</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function Dashboard(props: { rows: Encuesta[]; error: string | null; eventos: DemoEvento[]; eventosError: string | null; name: string }) {
  const { rows, error, eventos, eventosError, name } = props;
  const s = summarize(rows);
  const quedan = Math.ceil((new Date(PRUEBA.corte).getTime() - Date.now()) / 86_400_000);
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
              <a href={csvHref(toCsv(rows))} download="encuestas-navia.csv" className="btn-ghost px-3 py-2 text-sm" title="Sin correos: listo para el Prompt KPI-2">
                CSV sin correos
              </a>
              <a href={csvHref(toCsv(rows, true))} download="encuestas-navia-con-correos.csv" className="btn-ghost px-3 py-2 text-sm" title="Para contactar al piloto; no lo subas a la IA">
                CSV con correos
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
          <p className="mt-3 text-xs text-slate-500">
            Los KPI cuentan solo el segmento: la ruta Guarenas/Guatire → USM.{' '}
            <b>{s.fueraDeSegmento === 1 ? '1 respuesta de otra ruta queda' : `${s.fueraDeSegmento} respuestas de otras rutas quedan`} fuera</b>. Responsable de los KPI: {RESPONSABLE}.
          </p>
          {s.fueraDeSegmento > 0 && (
            <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200/70">
              Estudiantes de otras rutas (lista de expansión, no suma a los KPI): <b>{s.otrasRutas.usarian}</b> la usarían y <b>{s.otrasRutas.anotados}</b> se anotaron al piloto.
            </p>
          )}
        </section>

        <DashboardTabs
          results={
            <>
        <Card tag="KPI principal" title="Intención de adopción del estudiante" note="Anotarse al piloto pesa más: es un compromiso, no solo una opinión." meters={s.principal} />

        <Funnel eventos={eventos} error={eventosError} />

        <section className="card rounded-3xl p-4">
          <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">Segmento y canal</p>
          <h2 className="text-lg font-extrabold">Quién respondió y por dónde llegó</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Counts title="Ruta de los estudiantes" items={s.rutas.estudiantes} />
            <Counts title="Ruta del enlace conductor-fiscal" items={s.rutas.conductores} />
            <Counts title="Canal (solo segmento)" items={s.canales} />
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Card tag="Apoyo A" title="Valor percibido" meters={s.apoyoA} />
          <Card tag="Apoyo B" title="Conductores" note="Más la reunión de piloto con la asociación, que se anota aparte." meters={s.apoyoB} />
        </div>

        <section className="card rounded-3xl p-4">
          <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">Apoyo C · factor precio</p>
          <h2 className="text-lg font-extrabold">Cuánto pagarían por NavIA</h2>
          <p className="mt-0.5 text-xs text-slate-500">Respuesta en % del pasaje de la ruta de cada quien (los Bs son de referencia, sobre 1.180 Bs). Cuenta todas las rutas. La decisión actual es 2,5 % por lado.</p>
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
