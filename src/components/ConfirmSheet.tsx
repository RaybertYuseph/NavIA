'use client';
import { useEffect } from 'react';
import { NaviaAgent } from '@/features/brand/NaviaAgent';

/** Confirmación con el estilo de la app (en vez del confirm() gris del navegador). */
export function ConfirmSheet(props: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { onCancel } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <button type="button" aria-label="Cerrar" tabIndex={-1} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onCancel} />
      <section className="sheet-up relative w-full rounded-t-[2rem] bg-white px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center shadow-2xl sm:max-w-sm sm:rounded-[2rem]">
        <NaviaAgent size={84} animated className="mx-auto -mt-14" />
        <h2 id="confirm-title" className="mt-1 text-xl font-extrabold tracking-tight">
          {props.title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{props.body}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" autoFocus onClick={props.onConfirm} className="btn-primary">
            {props.confirmLabel}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost">
            {props.cancelLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
