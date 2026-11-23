'use client';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/ConfirmSheet';

/** Reinicia el día de la demo para todos (salidas y esperas de hoy). Devuelve un mensaje para mostrar. */
export async function resetDemoForEveryone(): Promise<string> {
  try {
    const r = await fetch('/api/demo/reiniciar', { method: 'POST' });
    const body = (await r.json().catch(() => ({}))) as { deleted?: number; error?: string };
    if (!r.ok) return `No se pudo reiniciar: ${body.error ?? r.status}`;
    const n = body.deleted ?? 0;
    return `Listo: demo reiniciada (${n} ${n === 1 ? 'salida borrada' : 'salidas borradas'}).`;
  } catch {
    return 'No se pudo reiniciar. Revisa tu conexión y prueba otra vez.';
  }
}

export const RESET_TITLE = '¿Reiniciar la demo?';
export const RESET_BODY =
  'Se borran las salidas de hoy y las paradas marcadas, para todos los que estén viendo la demo. El día empieza vacío.';

/** Botón "Reiniciar demo" con confirmación, para la pantalla de entrada. */
export function ResetDemoButton({ onDone }: { onDone?: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reset() {
    setAsking(false);
    setBusy(true);
    setMessage(await resetDemoForEveryone());
    setBusy(false);
    onDone?.();
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => setAsking(true)}
        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-60"
      >
        <span aria-hidden>↺</span> {busy ? 'Reiniciando…' : 'Reiniciar demo'}
      </button>
      {message && <p role="status" className="text-center text-sm font-medium text-slate-600">{message}</p>}
      {asking && (
        <ConfirmSheet
          title={RESET_TITLE}
          body={RESET_BODY}
          confirmLabel="Sí, reiniciar"
          cancelLabel="Cancelar"
          onConfirm={() => void reset()}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}
