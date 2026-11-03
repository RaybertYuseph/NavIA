'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PASSWORD_MIN } from '@/lib/email';
import { FormError } from './FormError';

const inputClass = 'rounded-xl border border-slate-300 bg-white p-4 text-lg';

export function NewPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < PASSWORD_MIN) return setError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
    if (password !== repeat) return setError('Las dos contraseñas no coinciden.');
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      if (error.code === 'same_password') return setError('Esa es tu contraseña actual. Elige una distinta.');
      if (error.code === 'weak_password') return setError('Esa contraseña es muy débil. Prueba con una más larga.');
      return setError(`No se pudo guardar. Revisa tu señal e intenta de nuevo. (${error.message})`);
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="new-password">Contraseña nueva</label>
      <input id="new-password" type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
      <label className="text-sm font-medium" htmlFor="repeat-password">Repítela</label>
      <input id="repeat-password" type="password" autoComplete="new-password" className={inputClass} value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      <p className="text-sm text-slate-500">Mínimo {PASSWORD_MIN} caracteres.</p>
      <button disabled={busy} className="rounded-xl bg-linear-to-r from-brand-500 to-indigo-500 p-4 text-lg font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-50">
        {busy ? 'Guardando…' : 'Guardar y entrar'}
      </button>
      <FormError message={error} />
    </form>
  );
}
