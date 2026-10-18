import { describe, expect, it } from 'vitest';
import { allowedActions, applyEvent, nextStop } from '@/features/driver/state';

const stops = [1, 2, 3].map((seq) => ({ id: `s${seq}`, seq, name: `Parada ${seq}`, lat: 0, lng: 0 }));

describe('botones del conductor', () => {
  it('recorre la ruta completa', () => {
    let s = { status: 'scheduled' as const, currentStopId: null } as Parameters<typeof applyEvent>[0];
    expect(allowedActions(s, stops)).toEqual({ enCamino: true, enParada: false, finDeRuta: false });

    s = applyEvent(s, 'en_camino', null);
    expect(nextStop(stops, s.currentStopId)?.id).toBe('s1');
    expect(allowedActions(s, stops)).toEqual({ enCamino: false, enParada: true, finDeRuta: true });

    for (const id of ['s1', 's2', 's3']) {
      s = applyEvent(s, 'en_parada', id);
      expect(s).toEqual({ status: 'en_parada', currentStopId: id });
      s = applyEvent(s, 'en_camino', null);
    }
    expect(nextStop(stops, s.currentStopId)).toBeNull();
    expect(allowedActions(s, stops).enParada).toBe(false);

    s = applyEvent(s, 'fin_de_ruta', null);
    expect(allowedActions(s, stops)).toEqual({ enCamino: false, enParada: false, finDeRuta: false });
  });
});
