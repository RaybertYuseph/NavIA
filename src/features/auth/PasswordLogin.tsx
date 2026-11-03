'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PASSWORD_MIN, normalizeCedula, normalizeEmail, normalizePhone } from '@/lib/email';
import { FormError } from './FormError';

type Mode = 'entrar' | 'crear' | 'olvido';

const inputClass = 'rounded-xl border border-slate-300 bg-white p-4 text-lg';

/**
 * Entrar o crear cuenta con correo y contraseña, sin verificar el correo (E1-H1).
 * Requiere "Confirm email" apagado en Supabase para que signUp devuelva la sesión al instante.
 */
export function PasswordLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('entrar');
  const [fullName, setFullName] = useState('');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Vuelta desde un enlace de recuperar contraseña que ya no sirve.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('aviso') === 'enlace-vencido') {
      setMode('olvido');
      setError('Ese enlace ya se usó o venció. Pide uno nuevo.');
      document.querySelector('details')?.setAttribute('open', ''); // en modo demo el formulario va plegado
    }
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeEmail(email);
    if (!normalized) return setError('Escribe un correo válido, por ejemplo ana@gmail.com.');
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(normalized, {
      redirectTo: `${window.location.origin}/auth/callback?next=/nueva-clave`,
    });
    setBusy(false);
    if (error?.status === 429) return setError('Ya te enviamos un enlace hace poco. Espera unos minutos y revisa tu correo.');
    if (error) return setError(`No pudimos enviar el correo. Revisa tu señal e intenta de nuevo. (${error.message})`);
    // Mismo mensaje exista o no la cuenta: no revela qué correos están registrados.
    setNotice(`Si hay una cuenta con ${normalized}, te llegó un enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.`);
  }

  if (mode === 'olvido') {
    return (
      <>
        <form onSubmit={sendReset} className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">Te enviamos un enlace a tu correo para que elijas una contraseña nueva.</p>
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
          <button disabled={busy} className="rounded-xl bg-linear-to-r from-brand-500 to-indigo-500 p-4 text-lg font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-50">
            {busy ? 'Enviando…' : 'Enviarme el enlace'}
          </button>
        </form>
        {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <FormError message={error} />
        <button type="button" onClick={() => switchMode('entrar')} className="text-sm font-semibold text-brand-700">
          Volver a entrar
        </button>
      </>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeEmail(email);
    if (!normalized) return setError('Escribe un correo válido, por ejemplo ana@gmail.com.');
    if (password.length < PASSWORD_MIN) return setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
    if (mode === 'crear' && fullName.trim().length < 3) return setError('Escribe tu nombre y apellido.');
    const ci = normalizeCedula(cedula);
    const tel = normalizePhone(phone);
    if (mode === 'crear' && !ci) return setError('Escribe tu cédula, solo números (por ejemplo 27123456).');
    if (mode === 'crear' && !tel) return setError('Escribe tu teléfono, por ejemplo 0414 1234567.');

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const result =
      mode === 'entrar'
        ? await supabase.auth.signInWithPassword({ email: normalized, password })
        : await supabase.auth.signUp({
            email: normalized,
            password,
            options: { data: { full_name: fullName.trim(), cedula: ci, phone: tel } },
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
            <label className="text-sm font-medium" htmlFor="cedula">Cédula</label>
            <input
              id="cedula"
              inputMode="numeric"
              placeholder="27123456"
              className={inputClass}
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
            />
            <label className="text-sm font-medium" htmlFor="phone">Teléfono</label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0414 1234567"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-sm text-slate-500">El fiscal de la línea usa tu cédula para aprobar tu cuenta.</p>
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
      {mode === 'entrar' && (
        <button type="button" onClick={() => switchMode('olvido')} className="text-sm font-semibold text-brand-700">
          ¿Olvidaste tu contraseña?
        </button>
      )}
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
