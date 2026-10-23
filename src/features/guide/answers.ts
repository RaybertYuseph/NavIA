import { nextStop } from '@/features/driver/state';
import { currentStop, isLive, sortedStops, totalWaiting, type Stop, type Trip, type TripStatus } from '@/features/trips/types';
import { formatHour, timeAgo } from '@/lib/time';

/** Respuesta de NavIA: frase corta y cercana con el dato concreto, y si aplica, a qué pestaña ir. */
export type NaviaAnswer = { text: string; tab?: string; actionLabel?: string };

export function minutesUntil(iso: string, now: number) {
  const m = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (m <= 0) return 'Sale en cualquier momento';
  if (m < 60) return `Sale en ${m} min`;
  return `Sale en ${Math.floor(m / 60)} h ${m % 60} min`;
}

// ── Estudiante ──────────────────────────────────────────────────────────────

export function studentTip(live: Trip[], next: Trip | null, now: number) {
  if (live.length > 0) return `¡Epa! Tengo ${live.length === 1 ? '1 camioneta' : `${live.length} camionetas`} en camino. Marca tu parada y te aviso cuando llegue.`;
  if (next) return `¡Epa! Tu próxima salida es a las ${formatHour(next.scheduled_at)}. ${minutesUntil(next.scheduled_at, now)}.`;
  return '¡Epa! Por hoy no quedan salidas. Nos vemos mañana, pana.';
}

export function whereIsBus(live: Trip[], next: Trip | null, now: number): NaviaAnswer {
  if (live.length === 0) {
    return {
      text: next
        ? `Ahorita ninguna camioneta va en camino. La próxima sale a las ${formatHour(next.scheduled_at)} (${next.routes?.name}).`
        : 'Ahorita ninguna camioneta va en camino y por hoy no quedan salidas.',
    };
  }
  const lines = live.map((t) => {
    const here = currentStop(t);
    const upcoming = nextStop(sortedStops(t), t.current_stop_id);
    const where = t.status === 'en_parada' && here ? `está en ${here.name}` : upcoming ? `va hacia ${upcoming.name}` : 'está llegando';
    return `La ${t.vehicles?.plate ?? 'camioneta'} de ${t.routes?.name} ${where} (ubicación ${timeAgo(t.last_seen_at, now)}).`;
  });
  return { text: lines.join(' '), tab: 'envivo', actionLabel: 'Verla en el mapa' };
}

export function whenNext(next: Trip | null, now: number): NaviaAnswer {
  if (!next) return { text: 'Por hoy no quedan salidas programadas.', tab: 'horarios', actionLabel: 'Ver los horarios' };
  return {
    text: `La próxima es a las ${formatHour(next.scheduled_at)} en la ruta ${next.routes?.name}${next.vehicles?.plate ? `, camioneta ${next.vehicles.plate}` : ''}. ${minutesUntil(next.scheduled_at, now)}.`,
    tab: 'horarios',
    actionLabel: 'Ver todos los horarios',
  };
}

export const HOW_TO_MARK: NaviaAnswer = {
  text: 'En Inicio elige tu salida y tu parada, y toca «Estoy aquí». El conductor ve cuántos esperan y yo te aviso cuando la camioneta llegue.',
  tab: 'inicio',
  actionLabel: 'Marcar mi parada',
};

export function fareInfo(trips: Trip[]): NaviaAnswer {
  const routes = new Map(trips.filter((t) => t.routes).map((t) => [t.route_id, t.routes!]));
  if (routes.size === 0) return { text: 'Hoy no hay rutas activas.' };
  const fares = [...new Set([...routes.values()].map((r) => Number(r.fare_usd).toFixed(2).replace('.', ',')))];
  return {
    text: `Hoy hay ${routes.size} ${routes.size === 1 ? 'ruta' : 'rutas'}. El pasaje es de ${fares.join(' o ')} USD.`,
    tab: 'horarios',
    actionLabel: 'Ver rutas y paradas',
  };
}

// ── Conductor ───────────────────────────────────────────────────────────────

export function driverTip(status: TripStatus, upcoming: Stop | null) {
  switch (status) {
    case 'scheduled':
      return '¡Epa! Cuando arranques toca el botón grande y aviso a los estudiantes.';
    case 'en_camino':
      return upcoming ? `Vas hacia ${upcoming.name}. Cuando llegues, toca «Llegué».` : 'Ya no quedan paradas. Cuando llegues, termina la ruta.';
    case 'en_parada':
      return 'Cuando suban todos, toca «Seguir ruta».';
    default:
      return '¡Buen trabajo! Esta salida ya terminó.';
  }
}

export function waitingAhead(stops: Stop[], waiting: Record<string, number>, fromIdx: number): NaviaAnswer {
  const ahead = stops.slice(fromIdx + 1).filter((s) => (waiting[s.id] ?? 0) > 0);
  if (ahead.length === 0) return { text: 'Nadie ha marcado que espera en las próximas paradas.' };
  return { text: ahead.map((s) => `${s.name}: ${waiting[s.id]}`).join(' · ') + '.' };
}

export const NO_SIGNAL: NaviaAnswer = {
  text: 'Tranquilo. Si se va la señal guardo tus avisos en el teléfono y los envío apenas vuelva. Tú sigue tocando los botones normal.',
};

// ── Fiscal ──────────────────────────────────────────────────────────────────

export type LineSummary = { enRuta: number; disponibles: number; fuera: number; done: number; total: number; waiting: number };

export function fiscalTip(s: LineSummary) {
  return `¡Epa! Hay ${s.enRuta} en ruta y ${s.disponibles} ${s.disponibles === 1 ? 'disponible' : 'disponibles'}. Van ${s.done} de ${s.total} salidas.`;
}

export function lineStatus(s: LineSummary): NaviaAnswer {
  return {
    text: `${s.enRuta} en ruta, ${s.disponibles} ${s.disponibles === 1 ? 'disponible' : 'disponibles'} y ${s.fuera} fuera de servicio. Van ${s.done} de ${s.total} salidas y hay ${s.waiting} ${s.waiting === 1 ? 'estudiante esperando' : 'estudiantes esperando'}.`,
    tab: 'resumen',
    actionLabel: 'Ver el resumen',
  };
}

export function staleUnits(trips: Trip[], now: number, staleMs = 5 * 60_000): NaviaAnswer {
  const stale = trips.filter((t) => isLive(t) && (!t.last_seen_at || now - new Date(t.last_seen_at).getTime() > staleMs));
  if (stale.length === 0) return { text: 'Todas las unidades en ruta están enviando su ubicación. Fino.' };
  return {
    text: `Sin ubicación reciente: ${stale.map((t) => `${t.vehicles?.plate ?? 'sin placa'} (${timeAgo(t.last_seen_at, now)})`).join(', ')}. Puede ser falta de señal; sus avisos llegan cuando la recupere.`,
    tab: 'unidades',
    actionLabel: 'Ver unidades',
  };
}

export function mostWaiting(trips: Trip[]): NaviaAnswer {
  const best = [...trips].filter((t) => totalWaiting(t) > 0).sort((a, b) => totalWaiting(b) - totalWaiting(a))[0];
  if (!best) return { text: 'Ahorita nadie está esperando en las paradas.' };
  return { text: `La salida de las ${formatHour(best.scheduled_at)} (${best.routes?.name}) tiene ${totalWaiting(best)} esperando.`, tab: 'salidas', actionLabel: 'Ver salidas' };
}
