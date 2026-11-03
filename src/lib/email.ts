/** Normaliza un correo para el login; devuelve null si no parece un correo. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/** Supabase envía códigos de 6 dígitos por defecto; el largo se puede cambiar en el dashboard. */
export const OTP_MIN = 6;
export const OTP_MAX = 10;

/** Supabase exige 6 por defecto; pedimos 8 en el formulario. */
export const PASSWORD_MIN = 8;

/** Cédula venezolana sin letra ni puntos ("V-27.123.456" → "27123456"); null si no lo parece. */
export function normalizeCedula(input: string): string | null {
  const digits = input.replace(/^\s*[VvEe]\s*-?\s*/, '').replace(/[\s.\-]/g, '');
  return /^\d{6,9}$/.test(digits) ? digits : null;
}

/** Teléfono venezolano como 04141234567 (acepta +58, espacios y guiones); null si no lo parece. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+58')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('58') && digits.length === 12) digits = '0' + digits.slice(2);
  return /^0\d{10}$/.test(digits) ? digits : null;
}
