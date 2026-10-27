import { DRIVER_AMOUNTS, PRICE_PERCENTS, fmtBs, fmtPct, pctOf, priceFor } from '@/features/guide/surveys';

/**
 * Tablero de la prueba de 7 días (/encuestas): convierte las filas de la tabla encuestas en las
 * metas y umbrales de las fichas «Prueba NavIA 7 días». Si cambian las metas, se cambian aquí.
 */
export type Encuesta = {
  id: number;
  created_at: string;
  audiencia: 'estudiante' | 'conductor-fiscal';
  vista: string;
  respuestas: Record<string, string>;
  contacto: string | null;
};

export type Status = 'confirma' | 'iterar' | 'refuta' | 'pocas';
export type Meter = { label: string; value: number; display: string; target: number; refute: number; unit: '%' | 'de 5' | '/5'; status: Status };

export const PRUEBA = { inicio: '2026-10-27', corte: '2026-11-02T12:00:00-04:00', decision: '2026-11-03', estudiantes: 40, conductores: 5 };
/** Con menos respuestas que esto un porcentaje no dice nada todavía. */
const MIN_ESTUDIANTES = 10;

const SI_USARIA = ['Sí, seguro', 'Probablemente'];
const share = (rows: Encuesta[], ok: (r: Encuesta) => boolean) => (rows.length ? (rows.filter(ok).length / rows.length) * 100 : 0);
const pct = (n: number) => `${Math.round(n)} %`;

function status(value: number, target: number, refute: number, enough: boolean): Status {
  if (!enough) return 'pocas';
  if (value >= target) return 'confirma';
  return value < refute ? 'refuta' : 'iterar';
}

/** Antes del correo obligatorio, dejar contacto era la forma de anotarse al piloto. */
export const anotado = (r: Encuesta) => r.respuestas.piloto === 'Sí' || (r.respuestas.piloto === undefined && !!r.contacto);

const precio = (r: Encuesta) => {
  const v = Number(r.respuestas.precio);
  return r.respuestas.precio !== undefined && Number.isFinite(v) ? v : null;
};

/** Reparto de respuestas de precio: una fila por opción en Bs (de menor a mayor), «menos» y «otro valor». */
export function priceBuckets(rows: Encuesta[], amounts: number[]) {
  const bs = rows.map(precio).filter((v): v is number => v !== null);
  const edges = [...amounts].sort((a, b) => a - b);
  const near = (v: number, a: number) => Math.abs(v - a) < 0.01;
  const buckets = [
    { label: `Menos de ${fmtBs(edges[0])}`, n: bs.filter((v) => v < edges[0] - 0.01).length },
    ...edges.map((a) => ({ label: `${fmtBs(a)} · ${fmtPct(pctOf(a))}`, n: bs.filter((v) => near(v, a)).length })),
    { label: 'Otro valor', n: bs.filter((v) => v >= edges[0] - 0.01 && !edges.some((a) => near(v, a))).length },
  ];
  const sorted = bs.map(pctOf).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : null;
  return { buckets, total: bs.length, medianPct: median };
}

export function summarize(rows: Encuesta[]) {
  const est = rows.filter((r) => r.audiencia === 'estudiante');
  const cf = rows.filter((r) => r.audiencia === 'conductor-fiscal');
  const cond = cf.filter((r) => r.respuestas.rol === 'Conductor');
  const enough = est.length >= MIN_ESTUDIANTES;

  const usaria = share(est, (r) => SI_USARIA.includes(r.respuestas.usaria));
  const piloto = share(est, anotado);
  const principal: Meter[] = [
    { label: 'La usaría («Sí, seguro» o «Probablemente»)', value: usaria, display: pct(usaria), target: 60, refute: 30, unit: '%', status: status(usaria, 60, 30, enough) },
    { label: 'Se anota al piloto', value: piloto, display: pct(piloto), target: 40, refute: 20, unit: '%', status: status(piloto, 40, 20, enough) },
  ];

  const nota = (id: string) => {
    const ns = est.map((r) => Number(r.respuestas[id])).filter((n) => n >= 1 && n <= 5);
    return { n: ns.length, avg: ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0 };
  };
  const shown = (x: { n: number; avg: number }) => (x.n ? `${x.avg.toLocaleString('es-VE', { maximumFractionDigits: 1 })} / 5` : '–');
  const util = nota('util');
  const facil = nota('facil');
  const wa = share(est, (r) => r.respuestas.whatsapp === 'Sí');
  const apoyoA: Meter[] = [
    { label: 'Utilidad promedio', value: util.avg, display: shown(util), target: 4, refute: 3.5, unit: '/5', status: status(util.avg, 4, 3.5, enough) },
    { label: 'Facilidad de uso promedio', value: facil.avg, display: shown(facil), target: 4, refute: 3.5, unit: '/5', status: status(facil.avg, 4, 3.5, facil.n >= MIN_ESTUDIANTES) },
    { label: 'Dejaría de preguntar en WhatsApp', value: wa, display: pct(wa), target: 60, refute: 40, unit: '%', status: status(wa, 60, 40, enough) },
  ];

  const condUsaria = cond.filter((r) => SI_USARIA.includes(r.respuestas.usaria)).length;
  const condAll = cond.length >= PRUEBA.conductores;
  const apoyoB: Meter[] = [
    {
      label: `Conductores que la usarían (${cond.length} respondieron)`,
      value: condUsaria,
      display: `${condUsaria} de ${Math.max(cond.length, PRUEBA.conductores)}`,
      target: 3,
      refute: 2,
      unit: 'de 5',
      // 3 «sí» confirman aunque falten conductores; para refutar hacen falta los 5.
      status: condUsaria >= 3 ? 'confirma' : condAll ? status(condUsaria, 3, 2, true) : 'pocas',
    },
  ];

  const minimo = PRICE_PERCENTS[0];
  const estPaga = share(est.filter((r) => precio(r) !== null), (r) => pctOf(precio(r)!) >= minimo - 0.05);
  const estPrecio = est.filter((r) => precio(r) !== null).length;
  const condPaga = cond.filter((r) => precio(r) !== null && pctOf(precio(r)!) >= minimo - 0.05).length;
  const cond5050 = cond.filter((r) => r.respuestas.reparto?.startsWith('50/50')).length;
  const apoyoC: Meter[] = [
    { label: `Estudiantes que pagarían ${minimo.toLocaleString('es-VE')} % o más`, value: estPaga, display: pct(estPaga), target: 50, refute: 25, unit: '%', status: status(estPaga, 50, 25, estPrecio >= MIN_ESTUDIANTES) },
    { label: `Conductores que ven justo ${minimo.toLocaleString('es-VE')} % o más`, value: condPaga, display: `${condPaga} de ${Math.max(cond.length, PRUEBA.conductores)}`, target: 3, refute: 2, unit: 'de 5', status: condPaga >= 3 ? 'confirma' : condAll ? status(condPaga, 3, 2, true) : 'pocas' },
    { label: 'Conductores que aceptan el 50/50', value: cond5050, display: `${cond5050} de ${Math.max(cond.length, PRUEBA.conductores)}`, target: 3, refute: 2, unit: 'de 5', status: cond5050 >= 3 ? 'confirma' : condAll ? status(cond5050, 3, 2, true) : 'pocas' },
  ];

  const porDia = new Map<string, { est: number; cf: number }>();
  for (const r of rows) {
    const d = new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
    const e = porDia.get(d) ?? { est: 0, cf: 0 };
    if (r.audiencia === 'estudiante') e.est++;
    else e.cf++;
    porDia.set(d, e);
  }

  return {
    estudiantes: est.length,
    conductoresFiscal: cf.length,
    conductores: cond.length,
    principal,
    apoyoA,
    apoyoB,
    apoyoC,
    precioEstudiantes: priceBuckets(est, PRICE_PERCENTS.map((p) => priceFor(p))),
    precioConductores: priceBuckets(cond, DRIVER_AMOUNTS),
    porDia: [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, n]) => ({ dia, ...n })),
    faltas: rows.filter((r) => r.respuestas.falta).map((r) => ({ id: r.id, audiencia: r.audiencia, texto: r.respuestas.falta, fecha: r.created_at })),
  };
}

/** CSV para Excel o Sheets: una columna por pregunta, con correo y fecha. */
export function toCsv(rows: Encuesta[]) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r.respuestas)))];
  const cell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const head = ['fecha', 'enlace', 'vista', 'correo', ...keys].map(cell).join(',');
  return [head, ...rows.map((r) => [r.created_at, r.audiencia, r.vista, r.contacto, ...keys.map((k) => r.respuestas[k])].map(cell).join(','))].join('\n');
}
