'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { OTP_MAX, OTP_MIN, normalizeEmail } from '@/lib/email';

/** Entrar con el correo y un código de un solo uso, sin contraseñas (E1-H1). */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeEmail(email);
    if (!normalized) return setError('Escribe un correo válido, por ejemplo ana@gmail.com.');
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({ email: normalized });
    setBusy(false);
    if (error) {
      return setError(
        error.status === 429
          ? 'Pediste muchos códigos seguidos. Espera un minuto e intenta de nuevo.'
          : 'No pudimos enviar el código. Revisa tu señal e intenta de nuevo.',
      );
    }
    setSentTo(normalized);
    setCode('');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email: sentTo, token: code, type: 'email' });
    setBusy(false);
    if (error) return setError('Código incorrecto o vencido.');
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">NavIA</p>
        <h1 className="text-3xl font-bold">Tu copiloto de ruta</h1>
        <p className="mt-1 text-slate-600">Entra con tu correo. Te enviamos un código, sin contraseñas.</p>
      </div>

      {!sentTo ? (
        <form onSubmit={requestCode} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="tucorreo@gmail.com"
            className="rounded-xl border border-slate-300 bg-white p-4 text-lg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={busy} className="rounded-xl bg-indigo-600 p-4 text-lg font-semibold text-white disabled:opacity-50">
            {busy ? 'Enviando…' : 'Recibir código'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="code">
            Código que enviamos a <span className="font-semibold">{sentTo}</span>
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_MAX}
            className="rounded-xl border border-slate-300 bg-white p-4 text-center text-2xl tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button disabled={busy || code.length < OTP_MIN} className="rounded-xl bg-indigo-600 p-4 text-lg font-semibold text-white disabled:opacity-50">
            {busy ? 'Verificando…' : 'Entrar'}
          </button>
          <p className="text-sm text-slate-500">Si no lo ves en unos minutos, revisa la carpeta de spam.</p>
          <button type="button" className="text-sm text-slate-600" onClick={() => setSentTo(null)}>
            Cambiar correo
          </button>
        </form>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </main>
  );
}
