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

export type PrimaryAction = { type: 'en_camino' | 'en_parada' | 'fin_de_ruta'; stop: Stop | null } | null;

/** El único paso que sigue para el conductor; la pantalla lo muestra como el botón grande. */
export function primaryAction(state: DriverState, stops: Stop[]): PrimaryAction {
  const upcoming = nextStop(stops, state.currentStopId);
  switch (state.status) {
    case 'scheduled':
      return { type: 'en_camino', stop: null };
    case 'en_parada':
      return upcoming ? { type: 'en_camino', stop: null } : { type: 'fin_de_ruta', stop: null };
    case 'en_camino':
      return upcoming ? { type: 'en_parada', stop: upcoming } : { type: 'fin_de_ruta', stop: null };
    default:
      return null;
  }
}
