import { COMISION_LADO, DRIVER_AMOUNTS, OTRA, PRICE_PERCENTS, SEGMENTO, fmtBs, fmtPct, pctOf, priceFor } from '@/features/guide/surveys';

/**
 * Tablero de la prueba de 7 días (/encuestas): convierte las filas de la tabla encuestas en las
 * metas y umbrales de las fichas «Prueba NavIA 7 días» (v2, responsable: Raybert Rodelo). Si
 * cambian las metas, se cambian aquí y se anotan con fecha en el registro de cambios de las fichas.
 * Los KPI se calculan solo con el segmento (ruta Guarenas/Guatire); el resto se cuenta aparte.
 */
export type Encuesta = {
  id: number;
  created_at: string;
  audiencia: 'estudiante' | 'conductor-fiscal';
  vista: string;
  respuestas: Record<string, string>;
  contacto: string | null;
};

export type DemoEvento = { created_at: string; audiencia: Encuesta['audiencia']; evento: 'visita' | 'entrada' | 'tour' | 'video' | 'encuesta'; canal: string; visitante: string };

export type Status = 'confirma' | 'iterar' | 'refuta' | 'pocas';
/** `range`: rango plausible al 95 % (Wilson) de un porcentaje, para leerlo con una muestra chica. */
export type Meter = { label: string; value: number; display: string; target: number; refute: number; unit: '%' | 'de 5' | '/5'; status: Status; range?: [number, number] };

export const RESPONSABLE = 'Raybert Rodelo';

export const PRUEBA = { inicio: '2026-10-27', corte: '2026-11-02T12:00:00-04:00', decision: '2026-11-03', estudiantes: 40, conductores: 5 };
/** Con menos respuestas que esto un porcentaje no dice nada todavía. */
const MIN_ESTUDIANTES = 10;

const SI_USARIA = ['Sí, seguro', 'Probablemente'];
const share = (rows: Encuesta[], ok: (r: Encuesta) => boolean) => (rows.length ? (rows.filter(ok).length / rows.length) * 100 : 0);

/** Intervalo de Wilson al 95 % para k de n, en %: con pocas respuestas, dónde puede estar de verdad la tasa. */
export function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 100];
  const z = 1.96;
  const p = k / n;
  const den = 1 + (z * z) / n;
  const mid = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, mid - half) * 100, Math.min(1, mid + half) * 100];
}
const rangeOf = (rows: Encuesta[], ok: (r: Encuesta) => boolean) => wilson(rows.filter(ok).length, rows.length);

/** Del segmento: ruta Guarenas o Guatire. Las respuestas de antes de la pregunta de ruta (sin `ruta`) cuentan como segmento. */
export const enSegmento = (r: Encuesta) => r.respuestas.ruta === undefined || SEGMENTO.includes(r.respuestas.ruta);
const rutaDe = (r: Encuesta) => (r.respuestas.ruta === undefined ? 'Sin dato' : r.respuestas.ruta.startsWith(OTRA) ? 'Otra' : r.respuestas.ruta);
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
    { label: 'Nada', n: bs.filter((v) => v === 0).length },
    { label: `Menos de ${fmtPct(pctOf(edges[0]))}`, n: bs.filter((v) => v > 0 && v < edges[0] - 0.01).length },
    ...edges.map((a) => ({ label: `${fmtPct(pctOf(a))} · ${fmtBs(a)}`, n: bs.filter((v) => near(v, a)).length })),
    { label: 'Otro porcentaje', n: bs.filter((v) => v >= edges[0] - 0.01 && !edges.some((a) => near(v, a))).length },
  ];
  const sorted = bs.map(pctOf).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median = sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : null;
  return { buckets, total: bs.length, medianPct: median };
}

export function summarize(all: Encuesta[]) {
  const rows = all.filter(enSegmento);
  const fuera = all.filter((r) => !enSegmento(r));
  const est = rows.filter((r) => r.audiencia === 'estudiante');
  const cf = rows.filter((r) => r.audiencia === 'conductor-fiscal');
  const cond = cf.filter((r) => r.respuestas.rol === 'Conductor');
  const enough = est.length >= MIN_ESTUDIANTES;

  const siUsaria = (r: Encuesta) => SI_USARIA.includes(r.respuestas.usaria);
  const usaria = share(est, siUsaria);
  const piloto = share(est, anotado);
  const principal: Meter[] = [
    { label: 'La usaría («Sí, seguro» o «Probablemente»)', value: usaria, display: pct(usaria), target: 60, refute: 30, unit: '%', status: status(usaria, 60, 30, enough), range: rangeOf(est, siUsaria) },
    { label: 'Se anota al piloto', value: piloto, display: pct(piloto), target: 40, refute: 20, unit: '%', status: status(piloto, 40, 20, enough), range: rangeOf(est, anotado) },
  ];

  const nota = (id: string) => {
    const ns = est.map((r) => Number(r.respuestas[id])).filter((n) => n >= 1 && n <= 5);
    return { n: ns.length, avg: ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : 0 };
  };
  const shown = (x: { n: number; avg: number }) => (x.n ? `${x.avg.toLocaleString('es-VE', { maximumFractionDigits: 1 })} / 5` : '–');
  const util = nota('util');
  const facil = nota('facil');
  const dejaWa = (r: Encuesta) => r.respuestas.whatsapp === 'Sí';
  const wa = share(est, dejaWa);
  const apoyoA: Meter[] = [
    { label: 'Utilidad promedio', value: util.avg, display: shown(util), target: 4, refute: 3.5, unit: '/5', status: status(util.avg, 4, 3.5, enough) },
    { label: 'Facilidad de uso promedio', value: facil.avg, display: shown(facil), target: 4, refute: 3.5, unit: '/5', status: status(facil.avg, 4, 3.5, facil.n >= MIN_ESTUDIANTES) },
    { label: 'Dejaría de preguntar en WhatsApp', value: wa, display: pct(wa), target: 60, refute: 40, unit: '%', status: status(wa, 60, 40, enough), range: rangeOf(est, dejaWa) },
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

  // El precio se responde en % del pasaje de cada ruta, así que cuenta todas las rutas, no solo el segmento.
  const minimo = COMISION_LADO;
  const estTodas = all.filter((r) => r.audiencia === 'estudiante');
  const condTodas = all.filter((r) => r.audiencia === 'conductor-fiscal' && r.respuestas.rol === 'Conductor');
  const condPrecioAll = condTodas.length >= PRUEBA.conductores;
  const conPrecio = estTodas.filter((r) => precio(r) !== null);
  const paga = (r: Encuesta) => pctOf(precio(r)!) >= minimo - 0.05;
  const estPaga = share(conPrecio, paga);
  const estPrecio = conPrecio.length;
  const condPaga = condTodas.filter((r) => precio(r) !== null && paga(r)).length;
  const cond5050 = cond.filter((r) => r.respuestas.reparto?.startsWith('50/50')).length;
  const apoyoC: Meter[] = [
    { label: `Estudiantes que pagarían ${minimo.toLocaleString('es-VE')} % o más`, value: estPaga, display: pct(estPaga), target: 50, refute: 25, unit: '%', status: status(estPaga, 50, 25, estPrecio >= MIN_ESTUDIANTES), range: rangeOf(conPrecio, paga) },
    { label: `Conductores que ven justo ${minimo.toLocaleString('es-VE')} % o más`, value: condPaga, display: `${condPaga} de ${Math.max(condTodas.length, PRUEBA.conductores)}`, target: 3, refute: 2, unit: 'de 5', status: condPaga >= 3 ? 'confirma' : condPrecioAll ? status(condPaga, 3, 2, true) : 'pocas' },
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

  const cuenta = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);

  return {
    fueraDeSegmento: fuera.length,
    rutas: { estudiantes: cuenta(all.filter((r) => r.audiencia === 'estudiante').map(rutaDe)), conductores: cuenta(all.filter((r) => r.audiencia === 'conductor-fiscal').map(rutaDe)) },
    canales: cuenta(rows.map((r) => r.respuestas.canal ?? 'sin dato')),
    estudiantes: est.length,
    conductoresFiscal: cf.length,
    conductores: cond.length,
    principal,
    apoyoA,
    apoyoB,
    apoyoC,
    precioEstudiantes: priceBuckets(estTodas, PRICE_PERCENTS.map((p) => priceFor(p))),
    precioConductores: priceBuckets(condTodas, DRIVER_AMOUNTS),
    porDia: [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, n]) => ({ dia, ...n })),
    alternativas: cond.filter((r) => r.respuestas.reparto?.startsWith(OTRA)).map((r) => ({ id: r.id, texto: r.respuestas.reparto.slice(OTRA.length) })),
    faltas: rows.filter((r) => r.respuestas.falta).map((r) => ({ id: r.id, audiencia: r.audiencia, texto: r.respuestas.falta, fecha: r.created_at })),
  };
}

const cell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;

/**
 * CSV para Excel o Sheets: una columna por pregunta, con fecha y si es del segmento. Sin correos por
 * defecto (el taller pide no subir datos personales a la IA); `correos` los agrega para contactar.
 */
export function toCsv(rows: Encuesta[], correos = false) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r.respuestas)))];
  const head = ['fecha', 'enlace', 'vista', 'segmento', ...(correos ? ['correo'] : []), ...keys].map(cell).join(',');
  const line = (r: Encuesta) => [r.created_at, r.audiencia, r.vista, enSegmento(r) ? 'sí' : 'no', ...(correos ? [r.contacto] : []), ...keys.map((k) => r.respuestas[k])];
  return [head, ...rows.map((r) => line(r).map(cell).join(','))].join('\n');
}

export const PASOS: { evento: DemoEvento['evento']; label: string }[] = [
  { evento: 'visita', label: 'Abrieron el enlace' },
  { evento: 'entrada', label: 'Entraron a la demo' },
  { evento: 'video', label: 'Vieron el video completo' },
  { evento: 'tour', label: 'Terminaron el tour' },
  { evento: 'encuesta', label: 'Enviaron la encuesta' },
];

const diaDe = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

/**
 * Embudo del taller (alcanzadas → vieron → actuaron): personas distintas (por navegador) en cada
 * paso, por enlace; y el registro diario por día, enlace y canal, como la tabla de la sección 5.
 */
export function funnel(eventos: DemoEvento[]) {
  const personas = (xs: DemoEvento[], evento: DemoEvento['evento']) => new Set(xs.filter((e) => e.evento === evento).map((e) => e.visitante)).size;
  const porEnlace = (['estudiante', 'conductor-fiscal'] as const).map((audiencia) => {
    const xs = eventos.filter((e) => e.audiencia === audiencia);
    return { audiencia, pasos: PASOS.filter((p) => audiencia === 'estudiante' || p.evento !== 'video').map((p) => ({ ...p, n: personas(xs, p.evento) })) };
  });
  const grupos = new Map<string, DemoEvento[]>();
  for (const e of eventos) {
    const k = `${diaDe(e.created_at)}|${e.audiencia}|${e.canal}`;
    grupos.set(k, [...(grupos.get(k) ?? []), e]);
  }
  const diario = [...grupos.entries()]
    .map(([k, xs]) => {
      const [dia, audiencia, canal] = k.split('|');
      return { dia, audiencia, canal, ...Object.fromEntries(PASOS.map((p) => [p.evento, personas(xs, p.evento)])) } as { dia: string; audiencia: string; canal: string } & Record<DemoEvento['evento'], number>;
    })
    .sort((a, b) => b.dia.localeCompare(a.dia) || a.audiencia.localeCompare(b.audiencia) || a.canal.localeCompare(b.canal));
  return { porEnlace, diario };
}

/** Registro diario en CSV (sección 5 del taller); las columnas de segmento y notas se llenan a mano. */
export function diarioCsv(diario: ReturnType<typeof funnel>['diario']) {
  const head = ['fecha', 'enlace', 'canal', ...PASOS.map((p) => p.label), '¿del segmento?', 'notas'].map(cell).join(',');
  return [head, ...diario.map((d) => [d.dia, d.audiencia, d.canal, ...PASOS.map((p) => d[p.evento]), '', ''].map(cell).join(','))].join('\n');
}
