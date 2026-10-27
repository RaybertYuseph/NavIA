import { describe, expect, it } from 'vitest';
import { priceBuckets, summarize, toCsv, type Encuesta } from '@/features/encuestas/kpis';
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
    const p = priceBuckets(est);
    expect(p.total).toBe(5);
    expect(p.buckets.map((b) => b.n)).toEqual([1, 1, 2, 0, 0, 1]);
    expect(p.medianPct).toBeCloseTo(3.5);
  });

  it('el CSV escapa comillas y lleva el correo', () => {
    const csv = toCsv([row('estudiante', { falta: 'que diga "ya llegó"' }, 'r@n.co')]);
    expect(csv.split('\n')[1]).toContain('"que diga ""ya llegó"""');
    expect(csv).toContain('"r@n.co"');
  });
});
