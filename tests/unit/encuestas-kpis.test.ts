import { describe, expect, it } from 'vitest';
import { funnel, priceBuckets, summarize, toCsv, wilson, type DemoEvento, type Encuesta } from '@/features/encuestas/kpis';
import { priceFor } from '@/features/guide/surveys';

let id = 0;
const row = (audiencia: Encuesta['audiencia'], respuestas: Record<string, string>, contacto: string | null = 'a@b.co'): Encuesta => ({
  id: ++id,
  created_at: '2026-10-28T14:00:00Z',
  audiencia,
  vista: audiencia === 'estudiante' ? 'student' : 'driver',
  respuestas,
  contacto,
});

describe('tablero de encuestas', () => {
  it('los montos de precio son el % del pasaje de 1.180 Bs', () => {
    expect([2.5, 3.5, 5.5, 7.5].map(priceFor)).toEqual([29.5, 41.3, 64.9, 88.5]);
  });

  it('califica el KPI principal contra meta y umbral', () => {
    const est = [
      ...Array.from({ length: 7 }, () => row('estudiante', { usaria: 'Sí, seguro', piloto: 'Sí' })),
      ...Array.from({ length: 3 }, () => row('estudiante', { usaria: 'No', piloto: 'No' })),
    ];
    const [usaria, piloto] = summarize(est).principal;
    expect(usaria.display).toBe('70 %');
    expect(usaria.status).toBe('confirma');
    expect(piloto.status).toBe('confirma');
    expect(summarize(est.slice(0, 5)).principal[0].status).toBe('pocas');
    const malo = [...Array.from({ length: 8 }, () => row('estudiante', { usaria: 'No', piloto: 'No' })), ...est.slice(0, 2)];
    expect(summarize(malo).principal[0].status).toBe('refuta');
  });

  it('KPI A promedia utilidad y facilidad de 1 a 5', () => {
    const est = Array.from({ length: 10 }, (_, n) => row('estudiante', { util: '4', facil: n < 5 ? '5' : '3' }));
    const [util, facil] = summarize(est).apoyoA;
    expect(util.display).toBe('4 / 5');
    expect(facil.display).toBe('4 / 5');
    expect(facil.status).toBe('confirma');
  });

  it('las respuestas viejas con contacto y sin «piloto» cuentan como anotadas', () => {
    const est = Array.from({ length: 10 }, (_, n) => row('estudiante', { usaria: 'Probablemente' }, n < 5 ? 'x@y.co' : null));
    expect(summarize(est).principal[1].display).toBe('50 %');
  });

  it('conductores: 3 «sí» confirman aunque falten entrevistas', () => {
    const cond = Array.from({ length: 3 }, () => row('conductor-fiscal', { rol: 'Conductor', usaria: 'Probablemente', precio: '29.5', reparto: '50/50 con el estudiante (recibo 1.150,50 Bs)' }));
    const s = summarize([...cond, row('conductor-fiscal', { rol: 'Fiscal o coordinador', usaria: 'No' })]);
    expect(s.conductores).toBe(3);
    expect(s.apoyoB[0].status).toBe('confirma');
    expect(s.apoyoC.slice(1).map((m) => m.status)).toEqual(['confirma', 'confirma']);
  });

  it('agrupa el precio por opción, valor libre y mediana', () => {
    const est = ['29.5', '41.3', '41.3', '10', '100'].map((precio) => row('estudiante', { precio }));
    const p = priceBuckets(est, [29.5, 41.3, 64.9, 88.5]);
    expect(p.total).toBe(5);
    expect(p.buckets.map((b) => b.n)).toEqual([0, 1, 1, 2, 0, 0, 1]);
    expect(p.medianPct).toBeCloseTo(3.5);
  });

  it('las opciones del conductor son 190, 130, 90 y 60 Bs', () => {
    const cond = ['190', '60', '60', '45'].map((precio) => row('conductor-fiscal', { rol: 'Conductor', precio }));
    const s = summarize(cond).precioConductores;
    expect(s.buckets.map((b) => [b.label.split(' ·')[0], b.n])).toEqual([
      ['Nada', 0],
      ['Menos de 5,1 %', 1],
      ['5,1 %', 2],
      ['7,6 %', 0],
      ['11 %', 0],
      ['16,1 %', 1],
      ['Otro porcentaje', 0],
    ]);
  });

  it('junta las otras formas de cobro que escriben los conductores', () => {
    const s = summarize([row('conductor-fiscal', { rol: 'Conductor', reparto: 'Otra: cuota fija semanal' }), row('conductor-fiscal', { rol: 'Conductor', reparto: '50/50 con el estudiante (mitad y mitad)' })]);
    expect(s.alternativas.map((a) => a.texto)).toEqual(['cuota fija semanal']);
  });

  it('el CSV escapa comillas y solo lleva correos si se piden', () => {
    const rows = [row('estudiante', { falta: 'que diga "ya llegó"' }, 'r@n.co')];
    expect(toCsv(rows).split('\n')[1]).toContain('"que diga ""ya llegó"""');
    expect(toCsv(rows)).not.toContain('r@n.co');
    expect(toCsv(rows, true)).toContain('"r@n.co"');
  });

  it('los KPI solo cuentan el segmento Guarenas/Guatire; sin ruta (respuestas viejas) cuenta como segmento', () => {
    const est = [
      ...Array.from({ length: 6 }, () => row('estudiante', { ruta: 'Guatire', usaria: 'Sí, seguro' })),
      ...Array.from({ length: 4 }, () => row('estudiante', { usaria: 'Probablemente' })),
      ...Array.from({ length: 5 }, () => row('estudiante', { ruta: 'Los Teques', usaria: 'No' })),
      row('estudiante', { ruta: 'Otra: Caucagüita', usaria: 'No' }),
    ];
    const s = summarize(est);
    expect(s.estudiantes).toBe(10);
    expect(s.fueraDeSegmento).toBe(6);
    expect(s.principal[0].display).toBe('100 %');
    expect(s.rutas.estudiantes).toEqual([['Guatire', 6], ['Los Teques', 5], ['Sin dato', 4], ['Otra', 1]]);
  });

  it('«no pagaría nada» se guarda 0 y hace fallar la meta de precio', () => {
    const est = Array.from({ length: 10 }, (_, n) => row('estudiante', { precio: n < 8 ? '0' : '29.5' }));
    const s = summarize(est);
    expect(s.apoyoC[0].display).toBe('20 %');
    expect(s.apoyoC[0].status).toBe('refuta');
    expect(s.precioEstudiantes.buckets[0]).toEqual({ label: 'Nada', n: 8 });
  });

  it('el precio va en % del pasaje de cada ruta, así que cuenta todas las rutas', () => {
    const est = [
      ...Array.from({ length: 5 }, () => row('estudiante', { ruta: 'Guarenas', precio: '41.3' })),
      ...Array.from({ length: 5 }, () => row('estudiante', { ruta: 'Los Teques', precio: '0' })),
    ];
    const s = summarize(est);
    expect(s.estudiantes).toBe(5);
    expect(s.apoyoC[0].display).toBe('50 %');
    expect(s.precioEstudiantes.total).toBe(10);
  });

  it('el rango de Wilson acota una tasa con muestra chica', () => {
    const [lo, hi] = wilson(24, 40);
    expect(lo).toBeCloseTo(44.6, 0);
    expect(hi).toBeCloseTo(73.7, 0);
  });

  it('el embudo cuenta personas distintas por paso, enlace, día y canal', () => {
    const ev = (visitante: string, evento: DemoEvento['evento'], canal = 'whatsapp'): DemoEvento => ({ created_at: '2026-10-28T14:00:00Z', audiencia: 'estudiante', evento, canal, visitante });
    const f = funnel([ev('a', 'visita'), ev('a', 'visita'), ev('b', 'visita', 'usm'), ev('a', 'entrada'), ev('a', 'tour'), ev('a', 'encuesta')]);
    expect(f.porEnlace[0].pasos.map((p) => p.n)).toEqual([2, 1, 0, 1, 1]);
    expect(f.porEnlace[1].pasos).toHaveLength(4);
    expect(f.diario.map((d) => [d.canal, d.visita, d.encuesta])).toEqual([['usm', 1, 0], ['whatsapp', 1, 1]]);
  });
});
