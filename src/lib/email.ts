/** Normaliza un correo para el login; devuelve null si no parece un correo. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/** Supabase envía códigos de 6 dígitos por defecto; el largo se puede cambiar en el dashboard. */
export const OTP_MIN = 6;
export const OTP_MAX = 10;
