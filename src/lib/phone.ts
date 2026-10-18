/**
 * Normaliza un teléfono venezolano a E.164 sin "+" (como lo guarda Supabase Auth).
 * Acepta "0414-123.45.67", "414 1234567", "+58 414 1234567". Devuelve null si no es móvil válido.
 */
export function normalizeVePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('58')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (!/^4(12|14|16|24|26|22)\d{7}$/.test(d)) return null;
  return `58${d}`;
}
