import type { Audience } from '@/features/auth/demoAccess';
import { PASAJE, SURVEYS, fmtBs, fmtPct, pctOf, type Question } from '@/features/guide/surveys';

/** Qué ficha mide cada pregunta (ver surveys.ts); sin entrada, es de diagnóstico. */
const KPI: Record<Audience, Record<string, string>> = {
  estudiante: { ruta: 'Filtro de segmento', usaria: 'KPI principal', piloto: 'KPI principal', util: 'Apoyo A', facil: 'Apoyo A', whatsapp: 'Apoyo A', precio: 'Apoyo C' },
  'conductor-fiscal': { ruta: 'Filtro de segmento', usaria: 'Apoyo B', precio: 'Apoyo C', reparto: 'Apoyo C' },
};

const TITLE: Record<Audience, { title: string; link: string }> = {
  estudiante: { title: 'Estudiante', link: '/demo/estudiante' },
  'conductor-fiscal': { title: 'Conductor y fiscal', link: '/demo/conductor-fiscal' },
};

function Answers({ q }: { q: Question }) {
  const opt = 'rounded-xl bg-slate-50 px-3 py-1.5 text-sm ring-1 ring-slate-200/70';
  switch (q.kind) {
    case 'choice':
      return (
        <ul className="flex flex-col gap-1.5">
          {q.options.map((o) => (
            <li key={o} className={opt}>
              {o}
            </li>
          ))}
          {q.other && <li className={opt}>{q.other} (texto libre)</li>}
        </ul>
      );
    case 'scale':
      return (
        <p className={opt}>
          Escala de 1 a 5: 1 = {q.low}, 5 = {q.high}
        </p>
      );
    case 'price':
      return (
        <>
          <ul className="flex flex-col gap-1.5">
            {q.amounts.map((bs) => (
              <li key={bs} className={`${opt} flex justify-between gap-3`}>
                <b>{fmtPct(pctOf(bs))} del pasaje</b>
                <span className="text-slate-500">{fmtBs(bs)} de referencia</span>
              </li>
            ))}
            <li className={opt}>{q.none} (se guarda 0 Bs)</li>
            <li className={opt}>Otro porcentaje (libre)</li>
          </ul>
          <p className="mt-1.5 text-xs text-slate-500">
            Leyenda: se responde en % del pasaje de la ruta de cada quien; los Bs son de referencia sobre {fmtBs(PASAJE)}.
          </p>
        </>
      );
    case 'open':
      return <p className={opt}>Respuesta abierta (hasta 300 caracteres)</p>;
    case 'contact':
      return (
        <ul className="flex flex-col gap-1.5">
          <li className={opt}>Correo (obligatorio)</li>
          <li className={opt}>
            Casilla: «{q.pilot}»<span className="mt-0.5 block text-xs text-slate-500">{q.pilotHint}</span>
          </li>
        </ul>
      );
  }
}

/** Pestaña «Preguntas» del tablero: las dos encuestas tal como se ven en la demo. */
export function Questions() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(Object.keys(SURVEYS) as Audience[]).map((audience) => (
        <section key={audience} className="card rounded-3xl p-4">
          <p className="text-xs font-bold tracking-wide text-brand-600 uppercase">Encuesta</p>
          <h2 className="text-lg font-extrabold">{TITLE[audience].title}</h2>
          <p className="text-xs text-slate-500">
            Enlace {TITLE[audience].link} · {SURVEYS[audience].filter((q) => !q.showIf).length} preguntas, más 1 condicional
          </p>
          <ol className="mt-3 flex flex-col gap-4">
            {SURVEYS[audience].map((q, n) => (
              <li key={q.id}>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{n + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{q.text}</p>
                    <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{KPI[audience][q.id] ?? 'Diagnóstico'}</span>
                      {q.showIf && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                          Solo si responde {q.showIf.in.map((v) => `«${v}»`).join(' o ')}
                        </span>
                      )}
                    </p>
                    <div className="mt-2">
                      <Answers q={q} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
