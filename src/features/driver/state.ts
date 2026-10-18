import type { Stop, TripStatus } from '@/features/trips/types';
import type { TripEventType } from '@/lib/offline/types';

export type DriverState = { status: TripStatus; currentStopId: string | null };

/** Lo mismo que hace el trigger apply_trip_event, para que el botón responda sin señal. */
export function applyEvent(state: DriverState, type: TripEventType, stopId: string | null): DriverState {
  switch (type) {
    case 'en_camino':
      return { ...state, status: 'en_camino' };
    case 'en_parada':
      return { status: 'en_parada', currentStopId: stopId ?? state.currentStopId };
    case 'fin_de_ruta':
      return { ...state, status: 'finalizada' };
    case 'cancelada':
      return { ...state, status: 'cancelada' };
    default:
      return state;
  }
}

/** Próxima parada: la siguiente a la actual, o la primera si aún no ha llegado a ninguna. */
export function nextStop(stops: Stop[], currentStopId: string | null): Stop | null {
  if (!currentStopId) return stops[0] ?? null;
  const i = stops.findIndex((s) => s.id === currentStopId);
  return i >= 0 ? (stops[i + 1] ?? null) : (stops[0] ?? null);
}

/** Qué botones se pueden tocar en cada estado. */
export function allowedActions(state: DriverState, stops: Stop[]) {
  const active = state.status === 'en_camino' || state.status === 'en_parada';
  return {
    enCamino: state.status === 'scheduled' || state.status === 'en_parada',
    enParada: state.status === 'en_camino' && nextStop(stops, state.currentStopId) !== null,
    finDeRuta: active,
  };
}
