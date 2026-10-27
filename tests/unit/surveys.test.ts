import { describe, expect, it } from 'vitest';
import { SURVEYS, visibleQuestions } from '@/features/guide/surveys';

const ids = (a: Record<string, string>, audience: keyof typeof SURVEYS = 'estudiante') => visibleQuestions(SURVEYS[audience], a).map((q) => q.id);

describe('encuestas de la demo', () => {
  it('son 7 preguntas para quien la usaría', () => {
    expect(ids({ usaria: 'Sí, seguro' })).toHaveLength(7);
    expect(ids({ usaria: 'Probablemente' }, 'conductor-fiscal')).toHaveLength(7);
    expect(ids({})).not.toContain('falta');
  });

  it('pregunta qué le falta a quien no la usaría, justo antes del contacto', () => {
    for (const audience of ['estudiante', 'conductor-fiscal'] as const) {
      for (const usaria of ['No sé', 'No']) {
        const shown = ids({ usaria }, audience);
        expect(shown).toHaveLength(8);
        expect(shown.slice(-2)).toEqual(['falta', 'piloto']);
      }
    }
  });

  it('las condiciones apuntan a opciones que existen', () => {
    for (const qs of Object.values(SURVEYS)) {
      for (const q of qs.filter((x) => x.showIf)) {
        const target = qs.find((x) => x.id === q.showIf!.id);
        expect(target?.kind).toBe('choice');
        if (target?.kind === 'choice') for (const v of q.showIf!.in) expect(target.options).toContain(v);
      }
    }
  });
});

describe('avance de la demo', () => {
  it('el recorrido llega al 100 % solo al terminarlo', async () => {
    const { tourPercent } = await import('@/features/guide/demoProgress');
    expect(tourPercent(null)).toBe(0);
    expect(tourPercent({ at: 2, max: 4, total: 10, done: false })).toBe(50);
    expect(tourPercent({ at: 9, max: 9, total: 10, done: false })).toBe(99);
    expect(tourPercent({ at: 9, max: 9, total: 10, done: true })).toBe(100);
  });
});
