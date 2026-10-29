/** Venezuela usa UTC-4 todo el año (sin horario de verano). */
const CARACAS_OFFSET_MS = -4 * 60 * 60 * 1000;

/** Inicio y fin (ISO, UTC) del día de hoy en Caracas. */
export function caracasDayRange(now = new Date()) {
  const local = new Date(now.getTime() + CARACAS_OFFSET_MS);
  const startUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - CARACAS_OFFSET_MS;
  return {
    from: new Date(startUtc).toISOString(),
    to: new Date(startUtc + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function formatHour(iso: string) {
  return new Intl.DateTimeFormat('es-VE', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Caracas',
  }).format(new Date(iso));
}

/** "hace 2 min": la antigüedad del dato siempre visible (E5-H1). */
export function timeAgo(iso: string | null, now = Date.now()) {
  if (!iso) return 'sin datos aún';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'hace instantes';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h ${m % 60} min`;
}

/** "14:30" de hoy en Caracas, como ISO con su zona: lo que recibe create_departure. */
export function caracasTodayAt(hhmm: string, now = new Date()) {
  const day = new Date(now.getTime() + CARACAS_OFFSET_MS).toISOString().slice(0, 10);
  return `${day}T${hhmm}:00-04:00`;
}

/** Las próximas medias horas de hoy en Caracas ("15:00", "15:30"…), para elegir rápido. */
export function nextHalfHours(count: number, now = new Date()) {
  const local = new Date(now.getTime() + CARACAS_OFFSET_MS);
  let m = Math.floor((local.getUTCHours() * 60 + local.getUTCMinutes()) / 30) * 30 + 30;
  const out: string[] = [];
  for (; out.length < count && m < 24 * 60; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  return out;
}

/** Hora y minuto actuales en Caracas ("14:07"), para el campo de hora de salida. */
export function caracasNowHHMM(now = new Date()) {
  return new Date(now.getTime() + CARACAS_OFFSET_MS).toISOString().slice(11, 16);
}
