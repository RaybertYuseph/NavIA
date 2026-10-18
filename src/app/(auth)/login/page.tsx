'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { normalizeVePhone } from '@/lib/phone';

/** Entrar con el teléfono y un código por SMS, sin contraseñas (E1-H1). */
export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [normalized, setNormalized] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    const p = normalizeVePhone(phone);
    if (!p) return setError('Escribe un celular venezolano, por ejemplo 0414-1234567.');
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({ phone: p });
    setBusy(false);
    if (error) return setError('No pudimos enviar el código. Revisa tu señal e intenta de nuevo.');
    setNormalized(p);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!normalized) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ phone: normalized, token: code.trim(), type: 'sms' });
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
        <p className="mt-1 text-slate-600">Entra con tu número de teléfono.</p>
      </div>

      {!normalized ? (
        <form onSubmit={requestCode} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="phone">Celular</label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0414-1234567"
            className="rounded-xl border border-slate-300 bg-white p-4 text-lg"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button disabled={busy} className="rounded-xl bg-indigo-600 p-4 text-lg font-semibold text-white disabled:opacity-50">
            {busy ? 'Enviando…' : 'Recibir código'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="code">Código que te llegó por SMS</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="rounded-xl border border-slate-300 bg-white p-4 text-center text-2xl tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <button disabled={busy || code.length < 6} className="rounded-xl bg-indigo-600 p-4 text-lg font-semibold text-white disabled:opacity-50">
            {busy ? 'Verificando…' : 'Entrar'}
          </button>
          <button type="button" className="text-sm text-slate-600" onClick={() => setNormalized(null)}>
            Cambiar número
          </button>
        </form>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </main>
  );
}
