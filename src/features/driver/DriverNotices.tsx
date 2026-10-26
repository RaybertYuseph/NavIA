'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';

const POLL_MS = 20_000;
type Notice = { id: string; body: string; created_at: string };

/**
 * Avisos del fiscal al conductor (cambio de ruta, unidad fuera de servicio). Se consultan cada
 * 20 s; al llegar uno nuevo se recarga la consola porque sus salidas pudieron cambiar.
 */
export function DriverNotices() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!navigator.onLine) return;
      try {
        const res = await fetch('/api/avisos', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const list = ((await res.json()) as { notices: Notice[] }).notices;
        const fresh = list.some((n) => !seen.current.has(n.id));
        list.forEach((n) => seen.current.add(n.id));
        setNotices(list);
        if (fresh) {
          navigator.vibrate?.([80, 60, 80]);
          router.refresh();
        }
      } catch {
        // Sin señal: se vuelve a intentar en la próxima vuelta.
      }
    };
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [router]);

  if (notices.length === 0) return null;

  async function dismiss() {
    const ids = notices.map((n) => n.id);
    setNotices([]);
    await fetch('/api/avisos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) }).catch(() => null);
  }

  return (
    <section role="status" className="tour-pop flex items-start gap-3 rounded-3xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
      <Icon name="bus" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-semibold tracking-wide text-amber-700 uppercase">Aviso del fiscal</p>
        {notices.map((n) => (
          <p key={n.id} className="font-semibold">
            {n.body}
          </p>
        ))}
      </div>
      <button type="button" onClick={() => void dismiss()} className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-amber-800 ring-1 ring-amber-200">
        Entendido
      </button>
    </section>
  );
}
