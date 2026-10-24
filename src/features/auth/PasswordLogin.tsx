'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PASSWORD_MIN, normalizeEmail } from '@/lib/email';
import { FormError } from './FormError';

type Mode = 'entrar' | 'crear';

const inputClass = 'rounded-xl border border-slate-300 bg-white p-4 text-lg';

/**
 * Entrar o crear cuenta con correo y contraseña, sin verificar el correo (E1-H1).
 * Requiere "Confirm email" apagado en Supabase para que signUp devuelva la sesión al instante.
 */
export function PasswordLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('entrar');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeEmail(email);
    if (!normalized) return setError('Escribe un correo válido, por ejemplo ana@gmail.com.');
    if (password.length < PASSWORD_MIN) return setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
    if (mode === 'crear' && fullName.trim().length < 3) return setError('Escribe tu nombre y apellido.');

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const result =
      mode === 'entrar'
        ? await supabase.auth.signInWithPassword({ email: normalized, password })
        : await supabase.auth.signUp({
            email: normalized,
            password,
            options: { data: { full_name: fullName.trim() } },
          });
    setBusy(false);

    if (result.error) return setError(describeError(result.error, mode));
    if (!result.data.session) {
      // signUp sin sesión: "Confirm email" sigue encendido en Supabase.
      return setError('La cuenta se creó, pero falta activarla desde el correo. Avísale al coordinador.');
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <>
      <div role="tablist" className="grid grid-cols-2 rounded-xl bg-slate-200 p-1 text-sm font-semibold">
        {(['entrar', 'crear'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`rounded-lg p-2 ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            {m === 'entrar' ? 'Entrar' : 'Crear cuenta'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === 'crear' && (
          <>
            <label className="text-sm font-medium" htmlFor="name">Nombre y apellido</label>
            <input id="name" autoComplete="name" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </>
        )}
        <label className="text-sm font-medium" htmlFor="email">Correo</label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          placeholder="tucorreo@gmail.com"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="text-sm font-medium" htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mode === 'crear' && <p className="text-sm text-slate-500">Mínimo {PASSWORD_MIN} caracteres.</p>}
        <button disabled={busy} className="rounded-xl bg-linear-to-r from-brand-500 to-indigo-500 p-4 shadow-lg shadow-brand-500/30 text-lg font-semibold text-white disabled:opacity-50">
          {busy ? 'Un momento…' : mode === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>

      <FormError message={error} />
    </>
  );
}

function describeError(error: { status?: number; code?: string; message: string }, mode: Mode) {
  if (error.status === 429) return 'Demasiados intentos seguidos. Espera un minuto e intenta de nuevo.';
  if (error.code === 'user_already_exists') return 'Ya existe una cuenta con ese correo. Usa la pestaña Entrar.';
  if (error.code === 'weak_password') return 'Esa contraseña es muy débil. Prueba con una más larga.';
  if (error.code === 'email_not_confirmed') return 'Tu cuenta aún no está activada. Avísale al coordinador.';
  if (mode === 'entrar' && error.status === 400) return 'Correo o contraseña incorrectos.';
  return `No pudimos conectar. Revisa tu señal e intenta de nuevo. (${error.message})`;
}
