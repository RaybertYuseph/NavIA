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
